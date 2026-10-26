---
title: "StarCraft FP #5: Remastered Pixels on 3D Buildings"
date: 2026-10-21
categories: [gamedev, projects]
tags: [starcraft, texturing, sprites, trellis, kaggle, color-transfer, python]
toc: true
toc_label: "Contents"
toc_icon: "paint-brush"
excerpt: "The SC2 models have the shape but not the look. Measuring the sprite camera, trying reliefs and TRELLIS, then painting or recolouring the models with the Remastered art."
---

The SC2 models from post #4 have complete shapes, but their textures are StarCraft II's, not Remastered's. The goal was the Remastered look in 3D. This post covers the measurements and the approaches tried, with the one that won.

## What the sprite camera is

To use a sprite's pixels in 3D you need the camera that drew them. Two layers of the HD files give it away:

- **Normal map** (R = screen x, A = screen y). On Terran buildings, the normals with no sideways part form two clusters: roofs at -55 to -57 degrees from the view axis and south walls at +35 to +37. Roofs and walls are 90 degrees apart, so the camera is orthographic, looks north and is tilted down 35 degrees.
- **Depth** (ao_depth alpha): depth along the view ray, nearer is brighter, on one scale for every sprite. Fitting roof and wall slopes on ten buildings gives `D = c - 0.6 w` (w in HD pixels along the ray).

The Nexus did not fit: its four base discs only stand level with a 45-degree camera. So the "standard" camera is not universal, which came back in post #8.

## Approaches tried

| Approach | Result |
|---|---|
| Relief from the sprite's own depth | exact geometry of what the sprite shows, every frame and animation, nothing behind it |
| Zero-1-to-3 XL (novel view diffusion) | plausible for the Dragoon, garbled buildings, views disagree, 256 px |
| TRELLIS-image-large on a free Kaggle T4 | complete, coherent buildings; its own colours mapped onto the sprite's palette |
| The mod's model, fitted and textured from the sprite | complete from every side, the sprite's look where the shapes agree |

TRELLIS needed some work on Kaggle's image (Python 3.13, torch 2.11): `spconv` would not install, so the kernel carries a plain PyTorch submanifold convolution in its place, checked against `F.conv3d` to 6e-6. Running only its second stage on the mod's voxels gave the best Dragoon: the mod's walker in the sprite's colours.

![The Dragoon: HD sprite, the mod's model, TRELLIS alone, and TRELLIS on the mod's shape (three seeds) from several sides](/assets/images/starcraft-fp/sprite3d-dragoon.jpg)

## Fitting the mod's model to the sprite

Every building the mod has goes through `mod_batch.py`:

1. pose the model with its "Stand" animation (bones from the first keys, 4-bone skinning) and drop parts that are entirely underground (construction pieces);
2. turn, scale and move it until its outline through the sprite camera covers the sprite's (IoU 0.13 to 0.90 on the first run, mostly 0.7-0.85 after fixes);
3. texture it, one of two ways.

**Painted.** A fresh UV atlas (xatlas) is filled with the sprite's pixels wherever the sprite camera sees that surface. The sprite is first aligned to the model by optical flow (OpenCV DIS, at most 8 px), because the shapes match only to a few pixels. Hidden sides take pixels from a mirrored or turned shown surface where one matches, then from the most alike shown point. Closest to Remastered where the mod's shape agrees, smeared where it does not.

**Recoloured.** The mod's own texture at full detail, with its colours moved to the sprite's palette. Per-pixel lookups turned the yellow hazard stripes white. What kept every accent was distribution transfer (Pitié 2005): the whole 3D colour cloud of the texture is matched to the sprite's along three random axes at a time (by rank, per axis), repeated with new axes until it settles.

![Per building: the HD sprite, the model painted with sprite pixels, and the mod texture recoloured to the sprite's palette](/assets/images/starcraft-fp/sprite3d-recolour.jpg)

## Picking per building

Neither texturing wins everywhere, so both are built for every building and the choice is per building. Recolour won for most of them; painted won where the shapes agree (Command Center, Barracks, Supply Depot, the Zerg hatcheries, several Protoss tech buildings). The Hatchery, Lair and Hive come from one mod model posed three ways.

![Command Center from south-east, north-east, north and the sprite camera. Rows: the relief with a mirrored back, TRELLIS alone, the mod's model, and a mix (sprite depth in front, the mod's shape behind, TRELLIS detail), all textured with Remastered pixels](/assets/images/starcraft-fp/sprite3d-command-center.jpg)

The game reads the picked models as `.glb` files (`src/fp_glb.h`, `--sprite3d DIR`), and a test-base map mode places one finished base per race to walk around.
