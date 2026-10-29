---
title: "StarCraft FP #10: Repainting Eye-Level Sprites with a LoRA"
date: 2026-10-29
categories: [gamedev, projects]
tags: [starcraft, stable-diffusion, lora, controlnet, dxt, kaggle, python]
toc: true
toc_label: "Contents"
toc_icon: "palette"
excerpt: "Stable Diffusion 1.5 with a LoRA trained on each unit's own frames repaints the eye-level renders. What it fixed, what it invented, the DXT encoder behind half the smears, and a repaint that only touches the pixels no frame showed."
---

Post #9 ended with the clean-up model left out of the game: units drawn from a steep camera still had blotchy backs and sides at eye level. This post covers what replaced it, a generative repaint, and the fixes that came after it.

## The repaint

`repaint.py` runs on the free Kaggle T4 from post #9, one unit at a time:

1. **LoRA training.** Every original frame of the unit, centred on a 512 px canvas, plus its mirror image (the game mirrors directions too), all captioned with a token and a short description of the unit. Rank 16 on the UNet's attention layers, 1200 steps, about 28 minutes.
2. **img2img with ControlNet tile.** Each eye-level render goes on the same canvas and through Stable Diffusion 1.5 at strength 0.4, with the render as the tile ControlNet's input. The tile model holds the render's layout, and the LoRA pulls its texture towards the unit's art.
3. **Back to sprite size**, inside the render's own outline: coverage and the team colour mask stay the render's.

```bash
repaint.py full main_920.anim eyelevel/main_920.anim out/ --token sc_lurker \
    --desc "zerg lurker, a heavy crawling creature with a spiked brown carapace, blue plated underside and long claws" \
    --strength 0.4
```

On the Firebat and the SCV, the backs and sides read as armour plates and gear instead of murk.

![Firebat: original frames (top), eye-level render (middle), repainted (bottom)](/assets/images/starcraft-fp/repaint-firebat.jpg)

## Smeared pixels

Some repainted frames still looked smeared: colours in the wrong places, blocky patches as if drawn at a lower resolution. There were two causes.

**The DXT encoder.** Remastered sprites store their frames in DXT5 (colour) and DXT1 (team colour) atlases: 4x4 blocks, each with two endpoint colours and the pixels in between. The files were written with Pillow's encoder, which picks poor endpoints where a block mixes two materials, so red armour turns into stray grey squares and the other way round. On repainted frames Pillow's DXT5 scores 22 dB against the uncompressed image, quicktex at its best level 29 dB. The anim writer now uses quicktex, for the renders and the repaints.

![A repainted Firebat frame: uncompressed (left), Pillow's DXT5 (middle), quicktex (right)](/assets/images/starcraft-fp/repaint-dxt.png)

**Colours from the wrong surface.** A voxel seen from eye level takes its colour from the original frame of the nearest direction, but that pixel may show another surface in front of it. The renderer now uses a frame's pixel only for points within 6 px of the surface that frame's depth layer shows. It also saves the pixels it is unsure about: surfaces no frame showed, and pixels borrowed from a surface just in front. Those get a second pass, an inpaint at strength 0.75 over the unsure areas only (`--masks`).

With both fixes the repaint went into the game for the Firebat, SCV, Medic, Marine, Zergling, Hydralisk, Zealot and Probe.

## Where it invents

The other units got worse. The whole-frame pass redraws what was already right, and the tile ControlNet adds detail by design:

- Siege Tank: light panels over the hull and blurred treads, still there single-pass at 0.25;
- Vulture: cockpit glass on its nose, engines turned to lumps;
- Overlord: a face and eyes;
- Lurker: its shell turned red-pink; Dragoon: darker, with murky legs.

![Siege Tank: original (top), eye-level render (middle), repainted at 0.3 (bottom)](/assets/images/starcraft-fp/repaint-tank.jpg)

## Repainting only the unsure pixels

`--strength 0` skips the whole-frame pass. Only the unsure areas are inpainted, and the result is pasted back at sprite size over those pixels plus a soft 1 px ring. Every other pixel stays the render's, since even the round trip through the 512 canvas softens it.

```python
def paste(new, rgba, mask):
    # the unsure pixels and a soft 1 px ring around them take the repaint, the rest stays the render
    w = np.clip(gaussian_filter(binary_dilation(mask).astype(np.float32), 0.7) * 1.5, 0, 1)[..., None]
    return new * w + rgba * (1 - w)
```

The relief units (post #8: frames warped column by column by their own depth) needed masks too. `relief_eye.warp` now marks every pixel drawn from a source pixel pair stretched over more than 2 rows, plus the holes it fills: 3-30% of a frame. Those masks come in row stripes, and grown and blurred as they are they covered 60-80% of the frame, so they are first closed and then opened (3x3) into solid regions.

The Lurker's drips under its shell became ribbed underbody in the right colours. The Overlord's tentacles got segments, but its hanging pods grew red-eyed faces, so it keeps its render.

![Lurker: eye-level render (top), unsure areas repainted (bottom)](/assets/images/starcraft-fp/repaint-lurker.jpg)

![Overlord: eye-level render (top), unsure areas repainted (bottom), with faces on the pods](/assets/images/starcraft-fp/repaint-overlord.jpg)

## Holes and floating claws

The repaint keeps the render's outline, so it cannot fix the outline itself, and the Lurker's had two faults: 500-900 px holes under the shell, where the original frames show the shell from above and nothing under it, and claws floating below the body, their legs lost in the warp.

`--relief-tidy` handles the frames that are one piece in the original (no second part of 30 px or more: the walk and attack frames, not the death splatter):

1. open 3x3: drips and teeth narrower than 3 px go;
2. keep only the largest part;
3. close 3x3 and fill holes up to 1500 px;
4. the added pixels take the nearest colour and join the unsure mask, so the repaint draws them.

![Lurker: before (top) and after (bottom) the outline fix](/assets/images/starcraft-fp/repaint-lurker-tidy.jpg)

The Lurker has 595 frames, 55 minutes of inpainting on one T4. Split by frame group over two kernels (`--groups` 0-12 on one, 13-25 on the other; the death groups are untouched and come from the previous run) it took 25, merged into one file afterwards.

## Result

| Unit | In the game |
|---|---|
| Firebat, SCV, Medic, Marine, Zergling, Hydralisk, Zealot, Probe | repainted: whole frame, then the unsure areas |
| Lurker | unsure areas only, outline fixed |
| Siege Tank, Vulture, Overlord, Drone, Dragoon | the plain render |

The repaint helps where the render already has the right shapes and only the paint is murky. On hard surfaces and creatures with few frames to learn from it invents detail, and those units keep the plain render.
