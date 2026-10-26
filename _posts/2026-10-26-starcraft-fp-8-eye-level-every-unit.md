---
title: "StarCraft FP #8: Eye Level for Every Unit"
date: 2026-10-26
categories: [gamedev, projects]
tags: [starcraft, sprites, voxels, calibration, turrets, python]
toc: true
toc_label: "Contents"
toc_icon: "users"
excerpt: "Running the Marine's process on the core Terran, Zerg and Protoss units: per-unit cameras, the cone under every unit, turrets, and a relief fallback for units that do not turn."
---

Post #7 rebuilt the Marine. Running the same process over the rest of the roster (SCV, Firebat, Medic, Siege Tank, Vulture, Zergling, Overlord, Drone, Hydralisk, Lurker, Probe, Zealot, Dragoon) broke most of its assumptions. This post lists what changed.

![Terran units at eye level: original billboards (top) and the rebuilt frames (bottom)](/assets/images/starcraft-fp/eyelevel-terran.jpg)

## Every unit has its own camera

The units were not drawn from one height. Calibrated tilts:

| Unit | Tilt | Unit | Tilt |
|---|---|---|---|
| Marine | 31 | Siege Tank | 45 |
| Zergling | 38.5 | Overlord | 46 |
| Medic | 41 | Vulture | 46 |
| Hydralisk | 42 | Drone | 47 |
| Firebat | 44 | SCV | 49 |

The SCV's hull fit peaks at 50 degrees as clearly as the Marine's at 31, and its normal map agrees. Steep art costs at eye level: about half of what the SCV shows from 5 degrees is surface no frame ever drew. A relaxed visibility test, which takes a frame's pixel for a point at most 16 px behind what that frame shows, cuts that to about a fifth.

Two units broke the pipeline itself. The Medic has no depth layer at all (all zeros), and carving read 0 as "far" and cut it into slivers. Depth 0 now means "no depth", and such a unit gets the silhouette hull only. The Firebat has frames that stick out of their box, so the box now grows evenly until every frame fits.

## The cone under everything

The Marine's cone was 9 voxels deep. Under a Siege Tank at 45 degrees it is about 115. A per-foot rule (cut below the first layer with 95% of the foot's section) took a running Zergling's legs, because legs and belly are one part near the ground.

The rule that works is per column. In the lower part of the model, everything below the lowest surface some direction actually sees goes. Where a column has no seen surface low down (inside a leg, under a belly), the heights of the seen rims around it are filled in, so an underside becomes a membrane between its rims. Flyers and hovering units keep theirs.

![A running Zergling, the Siege Tank hull and its turret at eye level: the per-foot cone rule (left three) and the underside rule (right three)](/assets/images/starcraft-fp/eyelevel-underside.jpg)

## Turrets

The game did not draw tank turrets at all: OpenBW keeps the turret as a unit of its own (a subunit). It is now drawn on its hull, at the hull's box centre plus OpenBW's turret offset.

That offset is a table per hull frame, made for the original camera, and at eye level the turret floated. The table's 17 entries are the projection of one point fixed on the hull, so the game fits that point in 3D by least squares:

```
x = ax cos h + ay sin h
y = ax sin h sin t - ay cos h sin t - az cos t        (h: direction, t: the art's tilt)
```

For the Siege Tank the point is 13 px behind the hull's centre and 14 up. It is redrawn from 5 degrees for each frame. The turret is cut flat at the hull roof under that point (`turret_seat.py`), not by the cone rule, since a turret is wider at its barrels than at its base ring.

![Siege Tanks: original (top) and eye level (bottom), turret seated on the hull at every heading](/assets/images/starcraft-fp/eyelevel-tank.jpg)

## Units that do not turn: relief

Some poses are not a turntable. The Dragoon's body faces the camera in every direction (true in the original game too), many Lurker groups repeat one frame, burrowing poses change shape, and the Overlord's dangling tentacles fill in as one curtain when carved. A group whose directions agree below IoU 0.9 is redrawn frame by frame from its own depth instead (`relief_eye.py`).

Lowering the camera from tilt T to 5 degrees only turns it about the screen's horizontal axis, so every pixel column stays a column:

```
row' = row cos(T - 5) + w sin(T - 5)       (w: depth along the view ray)
```

Each column is warped on its own, neighbours within 10 px of depth are joined so stretched surfaces do not open gaps, stray pixels are dropped, and small holes inside the unit are filled from around them.

![The Overlord by relief: tentacles stay strands](/assets/images/starcraft-fp/eyelevel-overlord-relief.jpg)

![Zerg in the game (Lurker, Hydralisk, Drone, Zergling): original (top) and eye level (bottom)](/assets/images/starcraft-fp/eyelevel-zerg.jpg)

![Protoss in the game (Probe, Zealot, Dragoon): original (top) and eye level (bottom)](/assets/images/starcraft-fp/eyelevel-protoss.jpg)

## Image ids without a file

The Lurker drew as a flat box. Its image (921) has no HD file of its own: it shares a picture with its remnants, whose file is `main_920.anim`. Images now fall back to the file of the first image with the same GRP name, compared ignoring case as Windows does (`zerg\Zlurker.grp` is `zerg\zLurker.grp`).

## Memory

The Siege Tank's grid bounds are 306x306x633 voxels, 59 million and about 5 GB per pose, and three in parallel ran the machine out of memory. A coarse hull on a 4 px grid first finds the box the unit is actually in (13.7 million, 2 GB), and the batch picks its process count from the free memory.
