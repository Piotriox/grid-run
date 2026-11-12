# Grid Run

A fast, tactile 8x8 spatial puzzle game by **Kria Games**, built with **Rust** (Tauri v2) and **Vanilla Canvas** frontend.

---

## Features

- **High-Performance Bitboard Engine:** 64-bit Bitboard (`u64`) with $O(1)$ collision detection and bitwise line clears.
- **Dynamic Piece Catalog:** 35 balanced polyomino shapes including lines (1x1 to 5x1), squares (2x2, 3x3), corners, L & J formations, T-shapes, and Z/S twists.
- **Fluid Floating Drag & Drop:** Dual-canvas architecture with authentic block colors and physical tactile depth.
- **Juicy Audio & FX:** Procedural Web Audio engine with bubble pop SFX, arcade explosion chords, flying score energy orbs, and ambient Lo-Fi background music with 10-step stepped volume controls.
- **Persistence:** Local atomic high-score and settings persistence across sessions.
- **Cross-Platform:** Desktop (Windows, macOS, Linux) and Mobile (Android).

---

## Project Structure

```
Grid Run/
├── src/
│   ├── index.html            # Main game view, splash screen, and settings
│   ├── style.css             # Modern layout, Inter typography, animations
│   ├── main.js               # Canvas renderer, SoundEngine, and IPC bridge
│   ├── Kria-Games.png        # Studio splash logo
│   ├── gridrun-loading.png   # Fullscreen loading visual
│   └── gridrun.png           # App icon (1:1)
├── src-tauri/
│   ├── src/
│   │   ├── bitboard.rs       # 64-bit Bitboard core
│   │   ├── piece.rs          # Piece catalog and placement masks
│   │   ├── state.rs          # GameState and scoring logic
│   │   ├── storage.rs        # Local persistence manager
│   │   ├── commands.rs       # Tauri IPC commands
│   │   ├── lib.rs            # Application bootstrap & window icon setup
│   │   └── main.rs           # Desktop entrypoint
│   ├── Cargo.toml            # Rust dependencies & release profile
│   └── tauri.conf.json       # Tauri v2 configuration
├── package.json              # Scripts & dependencies
└── vite.config.js            # Vite build configuration
```

---

## Getting Started

### Development (Web Preview)
```bash
npm install
npm run dev
```

### Development (Desktop App)
```bash
npm run tauri dev
```

### Production Build
```bash
# Frontend bundle
npm run build

# Desktop package
npm run tauri build
```
