---
title: "StarCraft FP #4: SC2 Models in a Software Rasteriser"
date: 2026-10-19
categories: [gamedev, projects]
tags: [starcraft, m3, rasterizer, 3d-models, software-renderer, cpp]
toc: true
toc_label: "Contents"
toc_icon: "cube"
excerpt: "Flat billboards of buildings read worst in first person. Reading StarCraft II .m3 models and drawing them on the CPU into the same depth buffer as the terrain."
---

Sprites of units work as billboards. Sprites of buildings do not: a Nexus drawn from above and stood upright is a tall flat picture that turns with you. Buildings and mineral fields needed real geometry.

The [SC Evo Complete](https://www.moddb.com/mods/sc-evo-complete) mod remakes the Brood War roster as StarCraft II models (`.m3` files). The models are kitbashes of Blizzard's SC2 art, so they stay a local copy and are never committed.

![Left: buildings as billboards of their sprites. Right: the same buildings as SC2 models](/assets/images/starcraft-fp/models-buildings.jpg)

## Reading .m3

An `.m3` file (header tag `MD34`) is a table of typed arrays referenced by index. The layouts come from the [m3addon](https://github.com/SC2Mapster/m3addon) project's `structures.xml`. The reader (`src/fp_m3.h`) takes only what a rest-pose render needs:

- vertices (position, normal, UV) and the triangle lists of each region, as stored (the rest pose);
- standard materials that are opaque: composite materials by their first opaque section. Additive glows and decals are skipped;
- diffuse and emissive textures: DDS in DXT1, DXT3, DXT5 or ARGB, decoded once and cached.

44 building and mineral types have a model. The ones the mod lacks (Lair, Hive, Starport, Spire, ...) and unfinished buildings stay sprites.

## The rasteriser

Models go into the same per-pixel depth buffer the terrain raycaster fills, so terrain, models and sprites hide each other correctly.

```
for each visible model instance:
    transform vertices (scale to the unit's footprint, turn to its heading)
    for each triangle:
        cull back faces, clip against the near plane
        split into scanline spans
        per pixel: depth test, texture lookup with UVs interpolated in 1/z,
                   diffuse * light from the south-west + emissive,
                   team colour where the diffuse alpha marks it
        write colour, depth and the unit's index
```

Two details from the work:

- **Scale.** A model is scaled so its footprint covers the unit's placement box by area. That fits most buildings without per-model numbers.
- **Picking.** The renderer keeps a per-pixel unit index next to the depth, so the crosshair can pick a model by its pixels. The first version let a model under the crosshair win over a sprite standing in front of it; picking now compares depths.

With models on, a busy base view costs 5.1-5.7 ms instead of 4.9 ms with sprites only.

## Switchable while playing

The M key cycles what is drawn as 3D: sprites only, buildings and minerals (the default), and experimentally units too (rest pose, turned to the unit's heading, not animated). That keeps the original art one key away, which matters for the next post: the mod's textures are SC2's, not Remastered's.
