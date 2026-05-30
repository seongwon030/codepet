# Pet Art Spec (for your PNGs)

You provide the art; the app loads it via a manifest. **512px PNG is great.**
There are two accepted formats — pick whichever is easier for you.

## Format A — Sprite sheet (recommended, animated)

One PNG per pet, frames laid out in a **4×4 grid**:

```
512 × 512 PNG  →  128 × 128 per frame
 row 0 = idle      (4 frames)
 row 1 = walk      (4 frames)
 row 2 = working   (4 frames)   ← shown while Claude/Codex runs
 row 3 = sleeping  (4 frames)
```

- Transparent background (PNG alpha).
- Pet faces **right** (the app mirrors it horizontally when walking left).
- Frame count per row can differ from 4 — just tell me and I set it in the manifest.

## Format B — Single static image (simplest)

One 512×512 PNG of the pet, no grid. The app downscales it (~110px on screen)
and adds gentle motion in code (bob, horizontal flip when walking). Less lively,
but zero spritework. You can upgrade to Format A later without code changes.

## Where to put files

```
assets/pets/<id>.png          e.g. assets/pets/cat.png
```

Drop the PNG in `assets/pets/` and tell me the id + format. I generate the
manifest entry, e.g. for a sheet:

```json
{
  "id": "cat",
  "name": "Cat",
  "source": "sheet",
  "displaySize": 112,
  "sheet": "pets/cat.png",
  "frameWidth": 128,
  "frameHeight": 128,
  "animations": {
    "idle":     { "row": 0, "frames": 4, "fps": 6 },
    "walk":     { "row": 1, "frames": 6, "fps": 10 },
    "working":  { "row": 2, "frames": 4, "fps": 8 },
    "sleeping": { "row": 3, "frames": 2, "fps": 2 }
  },
  "license": { "source": "<where it came from>", "type": "CC0", "author": "<name>" }
}
```

## On-screen size

Pets render at ~96–128px (`displaySize`). A 512px source stays crisp on Retina.

## Notes

- 5 pets total for v0.2 (cat, dog, + 3). v0.1 ships with a code-drawn placeholder
  cat so the app runs before any art exists.
- Always include the `license` block (even "my own work") so redistribution is clear.
