---
title: "StarCraft FP #1: StarCraft in First Person over OpenBW"
date: 2026-10-17
categories: [gamedev, projects]
tags: [starcraft, openbw, software-renderer, sdl2, cpp, reverse-engineering]
toc: true
toc_label: "Contents"
toc_icon: "gamepad"
excerpt: "Walking StarCraft maps at eye level: OpenBW runs the game, a CPU renderer draws it from the Remastered HD files."
---

StarCraft FP is a first-person view of StarCraft: Brood War. The game itself (units, orders, combat, pathing) is not reimplemented: [OpenBW](https://github.com/OpenBW/openbw) runs it, and a new renderer draws its state from inside the map using the Remastered HD art.

This first post covers the base: how the parts fit and what the HD files hold.

## The parts

| Part | Job |
|---|---|
| OpenBW | Brood War 1.16.1 simulation: loads maps and replays, steps 24 frames a second, owns every unit |
| `fp_render.h` | CPU renderer: terrain raycaster, sprite billboards, 3D models, one depth buffer for all |
| `fp_play` | SDL2 window, input, HUD, modes (replay, game sandbox, FPS) |
| `fp_view` | the same renderer to a still image, for tests and comparisons |
| Remastered data | extracted from my own install (CASC), never committed |

The renderer draws into a 640x400 buffer on 12 threads (one band of screen columns each) and SDL scales it to the window. A frame costs 2-5 ms on the CPU, so there is no GPU code at all.

OpenBW stays the authority: the renderer only reads `st.visible_units`, unit positions, headings and the current frame of each unit's image. The only thing it ever writes back is orders, the same way a player would.

## The HD files

Remastered keeps its art in CASC archives. Two kinds of files matter here.

**Terrain** (`TileSet/<name>.dds.vr4`): one 128x128 DXT1 image per megatile, in the same index space as the classic `.vf4`/`.vx4ex` tables OpenBW already reads. A megatile is 32x32 game pixels, so HD terrain is 4 texels per game pixel.

**Sprites** (`anim/main_NNN.anim`, NNN = the image id OpenBW uses): one atlas per layer plus a frame table.

```
"ANIM", u16 version @4, u16 layers @8, 10 x 32-byte layer names @12
sprite record @0x14c: u16 frames, u16 box_w, u16 box_h, u32 frame_table,
                      then per layer {u32 dds_offset, u32 dds_size, u16 w, u16 h}
frame record (16 bytes): u16 x, u16 y, i16 xoff, i16 yoff, u16 w, u16 h, u32 pad
```

Each unit carries 7 layers: diffuse (DXT5), bright, teamcolor (DXT1 mask), emissive, normal, specular and ao_depth (occlusion in G, depth along the view ray in A). The first renderer only needs diffuse and teamcolor; the normal and depth layers became important later (posts #5 and #7).

![The Marine's HD layers: diffuse, teamcolor, normal, depth and occlusion, facing the camera and facing east](/assets/images/starcraft-fp/anim-layers-marine.jpg)

## Billboards that turn with the camera

A unit that turns is stored as 17 frames per pose: direction 0 faces north, 16 faces south, and the other 15 directions are the same frames mirrored. In the original game the camera always looks north, so the frame only depends on the unit's heading.

In first person the camera can stand anywhere, so the heading is taken relative to the bearing from the camera to the unit before OpenBW's own direction rule is applied:

```cpp
double bearing = std::atan2(un.x - cam.x, -(un.y - cam.y)) * 256.0 / (2 * PI);
int rel = (((un.heading - (int)std::lround(bearing)) % 256) + 256) % 256;
int off = (rel + 4) / 8; flip = false;
if (off > 16) { off = 32 - off; flip = true; }   // mirrored directions
frame = un.frame_base + off;
```

Walking around a Marine now shows its back, side and front in turn.

The original renderer centres a sprite's box on the unit's position. Standing upright on a floor with depth, that sinks the lower half of the art into the ground, so each sprite is anchored on the median bottom row of its frames instead (the same for every frame, so animations do not bob).

## Tooling

- **Golden views** (`tools/golden.sh`): fixed camera spots on one stock map per tileset, rendered before and after a change into contact sheets.
- **Headless tests**: terrain against OpenBW's walkability, orders and determinism, the FPS layer, asset decoding.
- **Window self-tests** (`--selftest-input`): scripted SDL input events drive the real game loop and check the results.
- **`tools/hd_units.py`**: every unit's HD sprites gathered per unit type, decoded to PNG, with the images its scripts create (shadows, deaths, turrets).

The next posts cover the FPS layer, the terrain, 3D models, Remastered textures on those models, multiplayer, and making the sprites read correctly at eye level.
