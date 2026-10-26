---
title: "StarCraft FP #7: Eye-Level Sprites by Voxel Carving"
date: 2026-10-25
categories: [gamedev, projects]
tags: [starcraft, sprites, voxels, visual-hull, view-dependent-texturing, python]
toc: true
toc_label: "Contents"
toc_icon: "cubes"
excerpt: "The HD sprites are drawn from above, so in first person every unit looks like a picture stood upright. Rebuilding each pose as voxels from its own 17 directions and redrawing it from eye level."
---

Every unit sprite in StarCraft is drawn by a camera above the battlefield. In first person that shows: a Marine billboard is a top-down picture stood upright, with the top of its helmet and shoulders filling the frame. The goal was to keep the 2D billboards (and the art) but redraw every frame as seen from eye level.

## Why not just generate the new view

Two shortcuts were tried first.

- **GazPrash's [2d-to-3d-voxelizer](https://github.com/GazPrash/2d-to-3d-voxelizer).** I wrote a headless CLI around its Go backend (`cmd/headless`). In quad mode it extrudes a front picture and trims it with side pictures, so it expects level side views. On a sprite seen from above it paints the four input pictures on a slab: they still look down, and the diagonals double up.
- **Zero-1-to-3 XL** (novel view diffusion, each frame lowered by 26 degrees). It lowers the camera but invents details (the visor becomes a blob, a second rifle appears), is soft at 256 px, and generates each frame alone, so 221 frames would flicker.

Fine-tuning an image model on the original art has no eye-level pictures to learn the view from. The view has to come from geometry.

![The Marine: original frames, GazPrash's voxelizer at eye level and 10 degrees, and the calibrated voxels with the frames' pixels](/assets/images/starcraft-fp/eyelevel-gazprash-vs-voxel.jpg)

## 17 views of one pose

A turning unit stores each pose as 17 directions, 11.25 degrees apart. That is 17 orthographic photos of the same pose from a turntable, which is enough to rebuild it.

**Calibrate first.** The building camera from post #5 (35 degrees, axis on the box centre) gave a hull that fit the Marine's silhouettes at only IoU 0.89. Searching for the camera tilt and the turning axis's column together found 31 degrees and 6 px right of centre, where the hull reprojects onto all 17 silhouettes at IoU 0.99.

**Carve.** `unit_voxel.py` builds one pose, one voxel per HD pixel:

1. silhouette hull: keep voxels inside all 17 silhouettes;
2. depth carving: each direction's depth layer says where its visible surface is, so voxels in front of it are empty (two directions must agree). This removes the hollows silhouettes cannot see, between the rifle and the chest or between the legs;
3. drop specks, find the surface and its normals.

The depth scale for units turned out different from buildings (-0.78 instead of -0.6 levels per pixel). It is fitted per unit as the slope of the hull's farthest depths at each level, because the hull is never behind the true surface.

![The voxel model through the original camera (bottom) against the 17 drawn frames (top): IoU 0.96-0.99](/assets/images/starcraft-fp/eyelevel-marine-check.jpg)

## Drawing it with the original pixels

Voxel colours look blocky: neighbouring voxels come from differently lit directions. The new frames use view-dependent texturing instead. Each output pixel finds its surface point on the model and samples the original frame of the nearest direction that sees that point.

The first version was blurry. Drawn back through the original camera it kept only 52% of a frame's sharpness, even with that very frame available. It averaged 16 bilinear samples per pixel and blended neighbouring directions. One sample per pixel, a Catmull-Rom filter clamped to the 4 nearest texels, and the nearest direction's frame alone wherever it sees the point keep 98% (32.9 dB) and run 4 times faster.

![The Marine at eye level: original frame, first version, sharper sampling](/assets/images/starcraft-fp/eyelevel-marine-v1-v2.jpg)

## The cone under the feet

Seen from 31 degrees above, nothing shows how a sole meets the ground. A point under a flat bottom of half-size r stays inside every silhouette until it is r tan(tilt) below it, so carving leaves an upside-down cone under each foot. At eye level that cone showed as a dark smear (painted with the fill for unseen surfaces). Squaring it off gave thick soles; the fix was to cut it at the real sole, the first layer with 95% of the foot's full section.

![Feet from behind, front and side: thick soles (left) and the cone cut at the real sole (right)](/assets/images/starcraft-fp/eyelevel-marine-feet.jpg)

## In the game

`eyelevel_anim.py` builds all 13 poses and writes a drop-in `.anim` file with the same frame numbers (diffuse DXT5 and teamcolor DXT1). The game loads it with `--eyelevel DIR` and uses the original art again when the view looks down on a unit by more than 18 degrees, from a cliff for example. V toggles it while playing.

![The same scene: today's billboards (top) and eye-level frames (bottom)](/assets/images/starcraft-fp/eyelevel-marine-ingame.jpg)
