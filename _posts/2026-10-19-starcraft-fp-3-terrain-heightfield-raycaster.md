---
title: "StarCraft FP #3: Rebuilding the Map as a Heightfield"
date: 2026-10-19
categories: [gamedev, projects]
tags: [starcraft, raycasting, heightfield, terrain, software-renderer, cpp]
toc: true
toc_label: "Contents"
toc_icon: "mountain"
excerpt: "A StarCraft map is a flat picture with walkability flags. Turning it into terrain you can stand in: minitile heightfield, column raycaster, cliffs from the map's own art."
---

A StarCraft map has no geometry. It is a grid of 32x32 px tiles, each tile a picture, plus flags per 8x8 px minitile: walkable or not, and which of three height levels it is on. Cliffs, ramps and rocks exist only as painted art. This post covers how that becomes terrain in first person.

## The model: a minitile heightfield

Every 8 px minitile becomes a cell (`src/fp_terrain.h`):

```cpp
enum Kind : uint8_t { floor, cliff, obstacle, water, space, edge, apron };
enum Flags : uint8_t { ramp = 1, doodad = 2, very_high = 4, flat = 8 };
struct Cell {
    uint8_t kind, level, flags, type; // level: floor level, or the top level of a cliff
    uint8_t band;                     // cliffs: the band's depth in cells, foot to top
    float h;                          // top surface height in px
};
```

- Walkable cells are floor at their level. Levels are 112 px apart.
- Unwalkable cells are solid: a cliff takes its upper level, an obstacle stands 32 px above the floor beside it (72 with the tileset's "very high" bit), and the space platform's void has no floor.
- Floors are one continuous surface with heights at the cell corners, so a ramp is a smooth slope (blended over 20 cells, about 20 degrees).

`fp_terraintest` checks the model against OpenBW itself: walkability equals `is_walkable`, levels equal `get_ground_height_at`, no cliff sits below the floor it borders, and two builds of the same map are identical.

![Heightmap of (2)Bottleneck: green floors by height, grey obstacles, black void, magenta the low part of block cliffs, yellow ramps](/assets/images/starcraft-fp/terrain-heightmap.png)

## The renderer: one ray per column

Each screen column marches its ray through the cell grid front to back. It keeps a clip row, the highest screen row drawn so far in that column:

1. at each cell, project the cell's top. If it is below the eye and above the clip row, draw the floor span.
2. if the cell rises above the previous one, draw its face between the old and new heights.
3. move the clip row up and continue.

Rays do not stop at the first wall: they carry on to the view distance (3000 px), so high ground shows its full height from below and low ground shows from above. Every pixel keeps its depth, and sprites and models test against it, so a unit behind a ridge is cut off where the ridge is.

Walls follow the isometric 2:1 edges of the art. The solid/open field is smoothed over a few cells and contoured, and a cell on the boundary holds the straight line through it, instead of 8 px staircases.

## Cliffs from the map's own art

StarCraft paints a cliff's face onto the map as a band of tiles between the cliff's foot and its top. The camera looks north, so only south-facing faces have art. Two treatments, after reading how [Titan Reactor](https://github.com/imbateam-gg/titan-reactor) generates its terrain:

- **Natural tilesets** (Badlands, Jungle, Ash World, ...): the band becomes a slope from foot to top with the art draped on it.
- **Space Platform and Installation**: the band stays a vertical wall carrying the band's art, and the low rest of the band is a flat apron at the foot's level.

The drop sits at the walkable edge, not halfway down the band, so a unit on top can stand at the edge and look down into the trench. Obstacles on natural tilesets are draped mounds rising to full height 3 cells in from their edge, not flat blocks.

![Cliffs in first person: natural tilesets drape the cliff band as a slope, the space platform keeps it as a wall](/assets/images/starcraft-fp/terrain-cliffs.jpg)

## Past the map edge

Resources near the border stood against the sky and looked like they floated. Beyond the edge the world now continues as the map's mirror image, darkened, for 96 cells, then as a plain ground plane in the map's average colour. Nothing can go there; it is scenery.

## Cost

Terrain takes 2-3.5 ms per frame at 640x400 on 12 threads. Flat cells take a fast path, and cells that join surfaces more than 0.4 of a level apart are not joined, which avoids twisted sheets between an apron and the plateau above it.
