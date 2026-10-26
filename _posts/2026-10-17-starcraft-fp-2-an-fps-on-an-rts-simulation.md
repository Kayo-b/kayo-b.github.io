---
title: "StarCraft FP #2: An FPS on Top of an RTS Simulation"
date: 2026-10-17
categories: [gamedev, projects]
tags: [starcraft, openbw, fps, game-design, cpp]
toc: true
toc_label: "Contents"
toc_icon: "crosshairs"
excerpt: "Turning a StarCraft unit into a first-person hero: movement, shooting, picking and enemy waves without forking the simulation."
---

The FPS mode puts the player in one unit and sends waves of enemies at it. Combat stays OpenBW's: range, cooldown, damage and projectiles are the game's own. The work is in making an RTS unit answer to a mouse and keyboard.

## The hero

A regular Marine loses a one-on-one against a Zergling: a StarCraft unit cannot kite on its own. The player gets a hero unit instead (Jim Raynor's Marine, Fenix's Dragoon or the Hunter-Killer), which has more HP and damage.

Fire rate and range are tuned by editing the hero's own weapon entry, which no other unit on the map uses:

```cpp
weapon_type_t* w = const_cast<weapon_type_t*>(u->unit_type->ground_weapon.operator->());
w->cooldown  = std::max(1, w->cooldown * 100 / fire_rate);          // --fire-rate 200 = twice as fast
w->max_range = (unsigned)((uint64_t)w->max_range * range_pct / 100); // --range 200 = twice as far
```

OpenBW's attack logic and `weapon_max_range()` read these fields, so everything downstream follows.

## Two movement models

**Order-driven** (the default). WASD issues short StarCraft move orders in the direction the camera faces. A leg starts 140 px long and is shortened in steps of 20 px until it ends on walkable floor, and a new order goes out every 6 frames while a key is held. Pathing and unit collision stay OpenBW's. The catch: a StarCraft unit cannot move and shoot at once.

**Free movement** (`--fps-move-shoot`). WASD drives the hero directly: velocity, acceleration, friction and wall slide, capped at 192 px/s. The first attempt kept giving the hero orders as well, and OpenBW and the input fought over its position every frame. The working version gives the hero no orders at all. Its position is set each frame, and a shot goes straight into OpenBW's weapon hit resolution, so the hero can strafe while firing.

## The trigger

StarCraft units attack anything in range on their own. Here the hero only fires while the left button is held on a target. Each frame the game decides:

- what is under the crosshair: the renderer's per-pixel depth buffer says which sprite or model pixel is nearest at the centre of the screen;
- aim assist: if nothing is there, the nearest enemy whose billboard centre lies within 4.5% of the screen width and is not behind a wall;
- in range or not: the crosshair turns green on an enemy in weapon range and red out of range. Firing out of range still shoots and always misses, with an impact sound.

## Waves

OpenBW has no AI, so the enemy logic is small:

- each wave spawns 420-760 px from the hero, only on floor that is reachable from the hero, with at least 72 px between spawns;
- a wave has lead units from the first wave and an extra type from wave 3. Against Protoss that is Zealots, then Dragoons; against Terran it is Marines, then Firebats;
- every 6 frames each enemy is ordered to attack the hero again if it is doing anything else;
- the next wave comes once the last one is cleared and 8 s have passed.

## Testing feel without a person

Feel needs a person, but behaviour does not. `fp_fpstest` runs headless fights and checks them:

```
ok   wave 1 at frame 48: 2 enemies, 2 Zerglings, 2 reachable from the player
ok   enemy AI: all 2 enemies are ordered to attack the player
ok   trigger up: the hero does not auto-fire at an enemy in range
ok   determinism: two identical fights end the same way
ok   from a cliff edge the hero sees and targets an enemy below
```

The window self-test (`--selftest-input`) pushes SDL key and mouse events into the real loop: aim, hold fire, take damage, die, restart. It also checks the sounds that played.

## Inspect mode

Looking at art from every side became a recurring need (posts #7 and #8), so there is an inspect mode: `--inspect` places one idle unit on a bare map and circles the camera around it. The mouse or A/D orbit, W/S or the wheel change the distance, Space stops the circling and Up/Down move the eye.
