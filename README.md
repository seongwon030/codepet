# Codepet 🐾

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
(your existing hooks are preserved), and is fully removable.

**Codex** is detected by process polling out of the box. Tray → **Connect Codex** adds a
`notify` to `~/.codex/config.toml` (turn-complete → *idle*) **only if you don't already have
one** — it never overwrites an existing notify (e.g. oh-my-codex / Computer Use); in that case
it tells you so and leaves Codex on polling. Because Codex `notify` only signals turn
completion, Codex "working" comes from polling.

## Privacy

The app periodically reads your process list (to detect Claude/Codex). It modifies
`~/.claude/settings.json` or `~/.codex/config.toml` **only** when you explicitly click a
Connect action in the tray and confirm — each change is backed up and reversible. Nothing
leaves your machine; hook events go to a localhost-only server (`127.0.0.1:38917`).

## Credits

Pet icons are Flaticon **free** icons and **require attribution** — full details in
**[CREDITS.md](CREDITS.md)**:

- Cat icons created by [Miftahul Madani](https://www.flaticon.com/authors/miftahul-madani) – [Flaticon](https://www.flaticon.com/free-icon/cat-animal_8417812)
- Pawprint icons created by [Vector Stall](https://www.flaticon.com/authors/vector-stall) – [Flaticon](https://www.flaticon.com/free-icon/pawprint_6481940)
- Duck icons created by [Freepik](https://www.flaticon.com/authors/freepik) – [Flaticon](https://www.flaticon.com/free-icon/animals_1717994)
- Seal icons created by [Miftahul Madani](https://www.flaticon.com/authors/miftahul-madani) – [Flaticon](https://www.flaticon.com/free-icon/seal_6018583)
- Whale icons created by [Freepik](https://www.flaticon.com/authors/freepik) – [Flaticon](https://www.flaticon.com/free-icon/whale_1045140)
