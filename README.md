# Desktop Pet 🐾

A macOS desktop pet that roams your wallpaper and **reacts to your Claude Code / Codex
sessions** — when an agent is running, the pet gets to work; when things go quiet, it
naps. Built with Electron + TypeScript.

> Status: **v0.1 (MVP)** — single procedural placeholder pet, primary display, process-based
> session detection. Roadmap (5 pets, precise hook integration, multi-monitor, code signing)
> in `docs/superpowers/specs/2026-05-30-desktop-pet-design.md`.

## Features (v0.1)

- Transparent, always-on-top overlay; the pet wanders the desktop.
- **Click-through everywhere except the pet** — your desktop clicks pass through; hover the
  pet (no click needed) and you can **drag** it around.
- **Reacts to Claude Code / Codex**: detects a running `claude` / `codex` process and switches
  the pet to a "working" animation; idle → wander → (after a while) sleep.
- Menu-bar tray: pick pet, pause/resume, launch-at-login, quit. (No Dock icon.)
- Battery-aware: the animation loop drops to a low frame rate when the pet is idle/sleeping.

## Requirements

- macOS
- Node.js 20+ (24 is fine)

## Develop

```bash
npm install
npm start          # builds and launches
npm test           # unit tests (state machine, movement, detector)
```

Quit a running instance with **Cmd+Shift+P** or the tray → Quit.

## Build a distributable .dmg

```bash
npm run dist       # -> release/Desktop Pet-0.1.0-*.dmg   (unsigned)
```

This is **not** an App Store build and needs no Apple Developer account.

### First run (unsigned app)

Because v0.1 is unsigned, macOS Gatekeeper warns on first launch. Open it once via:

1. **Right-click** (or Control-click) `Desktop Pet.app` → **Open** → **Open**.

   *or* System Settings → Privacy & Security → scroll down → **Open Anyway**.

   *or* from a terminal:

   ```bash
   xattr -dr com.apple.quarantine "/Applications/Desktop Pet.app"
   ```

After the first open, it launches normally. (A signed + notarized build — which removes
this prompt — is on the v0.3 roadmap and requires a $99/yr Apple Developer account.)

## Add your own pets

You provide the art; the app loads it via a manifest. See **[ASSETS.md](ASSETS.md)** —
512px PNG works great (a 4×4 sprite sheet, or a single static image).

## How session detection works

v0.1 polls the process list (via `ps-list`) and matches `claude` / `codex` by command line.
This is a zero-config heuristic. The precise version — a small connector that hooks Claude
Code / Codex events for exact "typing / tool / done" states — is the v0.2 feature
(`Connector`), per the design doc.

## Privacy

The app periodically reads your process list (to detect Claude/Codex) and, in a future
version, would modify `~/.claude` / `~/.codex` only with your explicit consent. v0.1 does
**not** modify any config files.
