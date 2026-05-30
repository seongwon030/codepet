# Desktop Pet 🐾

A macOS desktop pet that roams your wallpaper and **reacts to your Claude Code / Codex
sessions** — when an agent is running, the pet gets to work; when things go quiet, it
naps. Built with Electron + TypeScript.

> Status: **v0.1+** — **5 selectable pets** (cat, dog, duck, seal, whale), **multi-monitor**,
> process-based detection **plus opt-in precise Claude Code hook integration**. Remaining
> roadmap: Codex hooks, code signing/notarization
> (`docs/superpowers/specs/2026-05-30-desktop-pet-design.md`).

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

## Pets & art

The 5 bundled pets are single 512px PNGs (in `assets/pets/`), animated by code
(`StaticSprite`: bob/flip while moving, dots while working, a "Z" while sleeping).
Toggle which pets are visible from the tray → Pet submenu.

To add or replace art, see **[ASSETS.md](ASSETS.md)** — a 512px PNG works great
(single static image, or a 4×4 sprite sheet for frame animation).

> ⚠️ **Attribution:** the bundled icons are Flaticon "free" icons, which **require
> attribution** before public distribution. See **[CREDITS.md](CREDITS.md)**.

## Session detection — two layers

1. **Zero-config (default):** polls the process list (`ps-list`) and matches `claude` / `codex`
   by command line. Coarse "running vs idle."
2. **Precise (opt-in):** tray → **Connect Claude Code** installs hooks into
   `~/.claude/settings.json` (backed up to `…/settings.json.desktop-pet-backup`; reversible via
   **Disconnect Claude Code**). The pet then reacts to exact events — prompt submitted →
   *working*, tool running → *tool*, response done → *idle* — delivered to a localhost-only
   server on `127.0.0.1:38917`. Fresh hook events take precedence over polling.

Connecting only edits your settings after you confirm a dialog, merges non-destructively
(your existing hooks are preserved), and is fully removable. Codex precise integration (its
`notify` only signals turn-complete) is a follow-up.

## Privacy

The app periodically reads your process list (to detect Claude/Codex) and, in a future
version, would modify `~/.claude` / `~/.codex` only with your explicit consent. v0.1 does
**not** modify any config files.
