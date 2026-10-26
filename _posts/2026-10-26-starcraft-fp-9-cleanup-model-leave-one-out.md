---
title: "StarCraft FP #9: A Clean-up Model Trained on Leave-One-Out Renders"
date: 2026-10-26
categories: [gamedev, projects]
tags: [starcraft, pytorch, unet, image-restoration, kaggle, python]
toc: true
toc_label: "Contents"
toc_icon: "magic"
excerpt: "Training a small U-Net to repaint eye-level renders in the unit's own art, when no eye-level art exists to learn from. First results, and why the first version was not enough."
---

The eye-level frames from posts #7 and #8 are the original pixels on rebuilt geometry. Where no frame ever showed a surface they are filled from around it, and where neighbouring directions disagree they turn blotchy. Steep units suffer most: the Firebat's chest and the SCV's back. This post covers a clean-up model meant to repaint those areas in the unit's own art.

## No answers at eye level

Training an image model needs input/answer pairs, and there are no eye-level frames to serve as answers. The pairs come from the original camera instead (`refine_data.py`):

- **input:** the unit's voxel model drawn through the original camera in direction d, without using frame d (and, harder, without d's neighbours too);
- **answer:** frame d itself.

Those renders have the eye-level renders' faults (filled surfaces, pixels borrowed from a nearby surface, a neighbour's lighting and registration, stretching), but here the right answer is known. Input and answer share the viewpoint, so the model learns to mend art, not to change the view.

![A training pair: the Firebat rendered without its own frame (left), without it and both neighbours (middle), and the frame itself (right)](/assets/images/starcraft-fp/refine-pair.png)

## The model

`refine.py` is a 3.1M-parameter U-Net (4 levels, GroupNorm, SiLU). Its input has 6 channels: the render's RGB, coverage, and two masks from the renderer, for filled pixels and borrowed pixels. Its output is a correction added to the RGB; the last layer starts at zero, so an untrained model returns the render unchanged, and the outline always stays the render's.

```python
def loss_fn(out, x, y):
    m = inside both outlines
    w = m * (1 + filled + borrowed)           # the faulty pixels count double
    return L1(out, y, w) + 0.5 * L1(gradients(out), gradients(y), w)
```

It trains on random 128 px patches, so it mends locally instead of recalling whole poses. Directions 3 and 11 of every unit are held out for validation.

## Version 1: better numbers, same pictures

v1 trained on 2618 pairs from 77 poses for 20k steps (17 minutes on a laptop RTX 3060). On the held-out directions it improved the renders from 18.7 to 21.2 dB against the original frames. At eye level the Firebat stayed blotchy and the SCV got muddier.

![Firebat: original frames, eye-level render, eye-level render cleaned by v1](/assets/images/starcraft-fp/refine-firebat-v1.jpg)

Two reasons:

- **The training renders had almost nothing to fill.** With one neighbour 11 degrees away, a leave-one-out render through the original camera has 0% filled pixels. At eye level 20-30% of a steep unit is filled. The model learned to fix seams and registration, not to paint large unseen areas.
- **L1 loss averages.** Where the answer is uncertain, the L1-optimal output is the mean of the plausible answers, which is a blur.

## Version 2 (training)

Both problems have direct fixes:

- **Harder pairs:** besides leaving out d and its neighbours, a "blob" variant replaces random smooth blobs covering 20-35% of the unit with the renderer's fill and marks them as filled (28% on average, against 0% before).
- **An adversarial critic:** a conditional PatchGAN with spectral normalisation scores 34 px patches as real frames or cleaned renders, with a hinge loss weighted 0.03 after 2000 steps. It pushes the model to paint texture in the art's style instead of the average.

## Running it on Kaggle

To keep the local GPU free, the GPU work moved to a free Kaggle T4. A private dataset holds the tools, the units' anim files, their voxel models and the model files, plus a `todo.json` job list. A private kernel runs the jobs: build a unit, re-render one from given voxel models with a clean-up model, generate pairs, or train.

```bash
kaggle datasets version -p kaggle_eyelevel_in -m "pairs v2" --dir-mode zip
kaggle kernels push -p kaggle_eyelevel
kaggle kernels output kayo01/sc-eyelevel -p results/
```

The first run built the Protoss units (Probe, Zealot, Dragoon) and re-rendered ten units with v1 in 40 minutes. The next one trains v2 and re-renders the same units with it. Whether the critic helps at eye level, or only moves the numbers again, is what that run will show.
