---
title: "StarCraft FP #6: Lockstep Multiplayer over OpenBW's sync.h"
date: 2026-10-25
categories: [gamedev, projects]
tags: [starcraft, openbw, networking, lockstep, determinism, cpp]
toc: true
toc_label: "Contents"
toc_icon: "network-wired"
excerpt: "A 1v1 mode where both games run the whole simulation and only commands travel: deterministic free movement, a predicted camera, fog of war and exact recordings."
---

StarCraft's multiplayer is lockstep: every player runs the full simulation, and only commands cross the network. OpenBW reimplements that layer in `sync.h`. The 1v1 mode here (`--host` / `--join HOST`) is built on it: each player gets a melee start and their race's FPS hero.

## One path for every command

Lockstep only works if both games apply the same commands on the same frame. So every human action, in single player too, goes through one function as replay-format bytes:

```
input -> Game::command(bytes) -> scheduled for frame now + latency
      -> both games apply it in Game::apply() on that frame -> recorded
```

Single player applies at once; multiplayer sends the bytes to both games. Because single player uses the same path, the existing determinism test (a checksum of a scripted game) guards multiplayer too.

Every frame each game hashes its state and sends the hash. A difference stops the game with "out of sync at frame N". Start checks compare the program version, the map's CRC, the latency and the FPS settings.

## Free movement has to be deterministic

The single-player free movement from post #2 used floating point and ran once per rendered frame. In lockstep it has to give the same result on both machines, so it was rewritten:

- runs once per simulation frame for every hero, in integers (1/256 px);
- directions come from OpenBW's own direction table, not `sin`/`cos`;
- wall slide moves in steps of at most 4 px;
- walking direction, the walk target, halting and shots are commands like any other.

That alone would make your own hero react a latency late (2 to 4 frames). So the local camera runs the same movement code ahead, over your inputs that are still in flight, and draws between frames. Because it is the same code on the same inputs, the simulation ends up exactly where the camera already is. The test compares the two on every frame.

One bug this caught: walking direction 255 was sent as the one-byte "no input" value, braking the hero for one frame while the camera kept going. The prediction check failed in 3 of 4 runs until directions became two bytes.

## Latency from the round trip

The host pings the joiner in the lobby and picks the latency from the 90th percentile of the round trip:

```
latency_frames = max(2, 1 + ceil((rtt / 2 + 25 ms) / 42 ms))
```

LAN gets 2 frames (83 ms), a 100 ms round trip 3, 200 ms 4. Two other things made it feel smooth: units are drawn between the last two simulation frames, and a blocked game drops the lost time instead of stepping in pairs to catch up. One plain fix mattered most: `TCP_NODELAY` on the sockets took localhost lockstep from about 50 to 4600 frames per second.

## Fog of war per player

The renderer draws what the viewer's units see:

- terrain lit where they see, 0.55 where they have seen, 0.3 where they never have, blended between tile centres and faded over 0.25 s;
- an enemy building stays drawn, dimmed and untargetable, where it was last seen, until that spot is in sight again;
- an undetected cloaked enemy is a shimmer (the pixels behind it displaced), burrowed ones are not drawn, and a free-movement shot at an undetected unit does nothing.

## Recordings

Every 1v1 game is recorded: the lobby's setup, every command of both players with the frame it took effect, and the state hash after every frame. About 13 bytes a frame, 400 KB for 20 minutes. Playback runs the same game and stops with a message if its state ever differs from the recorded one.

## Testing it

`fp_nettest` runs two games over localhost in an AddressSanitizer build. It checks the same state on every frame of a 2400-frame game, commands landing on the same frame in both, a deliberate change being caught on the next frame, a player leaving, prediction against the simulation, and games over a relay that holds every message 50 ms each way. AddressSanitizer found two memory bugs in OpenBW's server code: a client freed twice at exit, and an expired lobby timer whose callback wrote into a finished stack frame.
