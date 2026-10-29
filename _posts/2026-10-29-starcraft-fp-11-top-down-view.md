---
title: "StarCraft FP #11: The Top-Down Camera, Drawn from the HD Art"
date: 2026-10-29
categories: [gamedev, projects]
tags: [starcraft, openbw, rendering, sprites, software-rendering, cpp]
toc: true
toc_label: "Contents"
toc_icon: "map"
excerpt: "StarCraft's own camera over the same game: HD terrain and creep edges, every sprite in StarCraft's draw order, the same fog of war as first person, about 2.5 ms a frame on the CPU."
---

Everything so far looks at the game from the ground. This post adds StarCraft's own camera, from above, over the same simulation. V switches between the two in every mode: replays, recordings, the sandbox, and with a hero (stepping out commands the base from above while the hero keeps fighting on its own).

![A replay at zoom 2: Dragoons shooting into burning Terran buildings, selection circles, the minimap at the bottom left](/assets/images/starcraft-fp/topdown-replay.jpg)

## Two ways to get it

OpenBW has a complete SD client renderer in `ui/ui.h`. With the 1.16.1 game files it would draw the original 640x480 look with little work. The other way is a renderer of our own from the Remastered HD art the first-person view already loads. The second won: one set of art, the same units and fog in both views, and the look of the rest of the project.

## Terrain

A map is a grid of 32 px tiles, and each tile's HD art (`TileSet/<name>.dds.vr4`) has 4 texels per map pixel. The art is decoded once per mip level (4, 2 or 1 texels per map pixel) into premultiplied ARGB. The zoom steps are 1, 1.5, 2, 3 and 4 screen pixels per map pixel (StarCraft draws 1), so at 1, 2 and 4 the pixels are copied 1:1 from a level. The test checks that at zoom 4 the ground away from units is the map's tile art texel for texel (1540 of 1540 points).

## Creep and its edges

Creep is not in the map's tile array. OpenBW keeps a creep flag per tile, and such a tile is drawn with one of the tileset's creep tiles (`cv5` group 1): mostly the six plain ones, now and then one of the seven rarer ones, picked by a hash of the tile position so it stays put.

Drawn like that, creep ends on the tile grid in square steps. StarCraft softens it with edge frames drawn on the tiles next to the creep. Remastered keeps them in `TileSet/<name>.dds.grp`, 8 files our extraction did not have yet. The format:

```
u32 file size, u16 frame count (37), u16 0x1004
per frame: u32 0, u16 w, u16 h, u32 size, then a DDS image (DXT1 with 1-bit alpha)
```

The HD frames have no offsets of their own. They come from the SD creep GRP, times 4, kept inside the 128 texel tile: `x = min(4 * sd.x, 128 - w)`, the same for y.

The frame a tile gets depends on which of its 8 neighbours have creep. A side neighbour marks the edge next to it, a diagonal one counts only together with a side next to it, and the 256 neighbour patterns collapse to exactly 37 frames plus "no edge". OpenBW's UI builds the same table.

![Creep without the edge frames (left) and with the HD edges (right), at zoom 4](/assets/images/starcraft-fp/topdown-creep-edges.jpg)

## Sprites in StarCraft's order

OpenBW keeps every sprite on a list per tile row, and each sprite holds its images: body, shadow, turret, overlays, effects. They are drawn in StarCraft's order, sorted by

```
elevation << 14 | (elevation <= 4 ? y : 0) << 1 | turret
```

which puts layers first, ground units from north to south and turrets over their base. Each sprite's images are drawn in reverse list order. An HD frame is placed in its anim's box, centred on the image position (4 texels per map pixel):

```
x0 = cx + (xoff - box_w / 2) / 4        flipped: x0 = cx - (xoff + w - box_w / 2) / 4
y0 = cy + (yoff - box_h / 2) / 4
```

The image's draw mode picks the blend: normal, shadow (darkens what is under it), cloaked (see-through, or a shimmer of displaced pixels for an enemy you have not detected), warp-in, and the selection circle, drawn under the unit before its first non-shadow image. The player colour is a mask decoded with each frame and applied when drawing.

## Same units, same fog

The view does not read the game by itself. It reads the snapshot the first-person renderer builds every frame: units drawn between simulation frames, the viewer's fog of war, remembered enemy buildings, cloak state. So both views always agree on what is visible. In a two-player game, or a player's view of a recording, the ground is dimmed where that player does not see, the other player's units show only where theirs do, and a building seen once stays drawn, dimmed and not clickable, until the spot is in sight again.

![One player's fog: never explored, scouted by an Overlord, and the Nexus remembered after the Overlord left](/assets/images/starcraft-fp/topdown-fog.jpg)

## Controls

- WASD, the arrow keys or the window edge scroll; the wheel zooms about the mouse; the middle button drags the map;
- the minimap moves the view on a click or drag, and a right-click on it orders the selection there;
- left-click selects the topmost pixel with alpha of at least 128 (else the nearest unit within 4 px); a dragged box selects up to 12 of your units, units before buildings; right-click orders;
- E goes into the selected unit in first person; in a replay a click follows a unit.

## Cost

It is all software rendering. Art is decoded in a parallel pass before drawing, then the frame is drawn in row bands across threads, and the picture is identical on any number of threads (the test compares 1 and 7). A 1280x800 frame takes 11.3 ms on one thread and about 2.5 ms on 12 cores. The minimap takes 0.27 ms, from per-tile colours rebuilt every 24 frames. Decoded art is capped at 256 MB.

Missing for now: Protoss warp-in is a blue see-through tint instead of the warp texture, hallucinations are not tinted, the art's glow layers are not drawn, and there are no control groups or hotkeys.
