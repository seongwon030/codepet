# Codepet 🐾

A macOS desktop pet that roams your wallpaper and **reacts to your Claude Code / Codex
sessions** — when an agent is working, the pet works; when things go quiet, it naps.
Electron + TypeScript.

## Features

- Transparent overlay pet that wanders your desktop. **Drag it** by hovering (no click
  needed); clicks anywhere else pass through to your desktop.
- **Reacts to Claude Code / Codex** — process detection out of the box, plus opt-in precise
  hook integration (working / tool / idle).
- 5 pets (cat, dog, duck, seal, whale) — pick one from the menu-bar tray.
- Multi-monitor, battery-aware (low frame rate when idle), menu-bar only (no Dock icon).

## Install

Download a `.dmg` from **[Releases](https://github.com/seongwon030/codepet/releases/latest)**
— Apple Silicon (`-arm64`) or Intel (`-x64`).

It's unsigned, so on first launch **right-click the app → Open → Open** (one time). Or:

```bash
xattr -dr com.apple.quarantine "/Applications/Desktop Pet.app"
```

## Session detection — two layers

1. **Zero-config:** polls the process list for `claude` / `codex`. Coarse "running vs idle".
2. **Precise (opt-in):** tray → **Connect Claude Code** installs hooks into
   `~/.claude/settings.json` (backed up, reversible via **Disconnect**) so the pet reacts to
   exact events — prompt → *working*, tool → *tool*, done → *idle* — via a localhost-only
   server (`127.0.0.1:38917`). Fresh hook events take precedence over polling.

   **Codex** works via polling; **Connect Codex** adds a `notify` (turn-complete → *idle*)
   only if you don't already have one — it never overwrites an existing notify.

Connecting edits config only after you confirm, merges non-destructively (your existing
hooks are kept), and is fully removable.

## Develop

```bash
npm install
npm start      # build + launch
npm test       # unit tests
npm run dist   # build .dmg for arm64 + x64 -> release/
```

Quit a running instance with **Cmd+Shift+P** or tray → Quit.

Custom pets: drop a 512px PNG in `assets/pets/` — see **[ASSETS.md](ASSETS.md)**.

## Privacy

The app reads your process list (to detect Claude/Codex) and edits
`~/.claude/settings.json` / `~/.codex/config.toml` **only** when you click a Connect action
and confirm — each change is backed up and reversible. Nothing leaves your machine.

## Credits

Pet icons — [Flaticon](https://www.flaticon.com) (free license, attribution required); full
details in **[CREDITS.md](CREDITS.md)**:

- Cat & Seal icons by [Miftahul Madani](https://www.flaticon.com/authors/miftahul-madani)
- Duck & Whale icons by [Freepik](https://www.flaticon.com/authors/freepik)
- Pawprint icons by [Vector Stall](https://www.flaticon.com/authors/vector-stall)
