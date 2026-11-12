/**
 * Grid Run - Spatial Puzzle Game
 * by Kria Games
 * Canvas Renderer & Tauri IPC Client
 */

// Helper to convert HEX color to RGBA
function hexToRgba(hex, alpha = 1) {
  if (!hex) return `rgba(59, 130, 246, ${alpha})`;
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

// Procedural Web Audio Sound & Lofi Music Engine (Zero external files, zero latency)
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.musicGain = null;
    this.sfxGain = null;

    // Load saved 10-level settings (defaults: Music=8, SFX=8)
    this.musicLevel = parseInt(localStorage.getItem('gridrun_music_level') ?? '8', 10);
    this.sfxLevel = parseInt(localStorage.getItem('gridrun_sfx_level') ?? '8', 10);

    this.isPlayingMusic = false;
    this.musicTimer = null;
    this.chordStep = 0;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.setValueAtTime(this.sfxLevel / 10, this.ctx.currentTime);
        this.sfxGain.connect(this.ctx.destination);

        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.setValueAtTime((this.musicLevel / 10) * 0.32, this.ctx.currentTime);
        this.musicGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMusicLevel(level) {
    this.musicLevel = Math.max(0, Math.min(10, level));
    localStorage.setItem('gridrun_music_level', this.musicLevel.toString());
    this.init();
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime((this.musicLevel / 10) * 0.32, this.ctx.currentTime, 0.05);
    }
    if (!this.isPlayingMusic && this.musicLevel > 0) {
      this.startLofiMusic();
    }
  }

  setSfxLevel(level) {
    this.sfxLevel = Math.max(0, Math.min(10, level));
    localStorage.setItem('gridrun_sfx_level', this.sfxLevel.toString());
    this.init();
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.sfxLevel / 10, this.ctx.currentTime, 0.05);
    }
  }

  // Soft, velvety, game-like bubble pop (warm lowpass filtered sine drop)
  playSoftPop() {
    if (this.sfxLevel === 0) return;
    try {
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      // Warm lowpass filter to remove harsh edge and give a rounded tactile pop
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now);

      osc.type = 'sine';
      // Softer, rounder pitch drop: 440Hz -> 260Hz
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(250, now + 0.065);

      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.07);
    } catch (e) {
      // Audio might be muted or blocked by browser policy
    }
  }

  // Game-like line clear explosion sound (playful, arcade, juicy punch + ascending chime burst)
  playLineClearExplosion(linesCleared = 1, comboCount = 1) {
    if (this.sfxLevel === 0) return;
    try {
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;

      // 1. Bass / Mid Thump Body (Punchy tactile pop drop)
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = 'triangle';
      subOsc.frequency.setValueAtTime(220, now);
      subOsc.frequency.exponentialRampToValueAtTime(55, now + 0.16);

      subGain.gain.setValueAtTime(0.38, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      subOsc.connect(subGain);
      subGain.connect(this.sfxGain);
      subOsc.start(now);
      subOsc.stop(now + 0.19);

      // 2. Playful Ascending Musical Pop Chime / Sparkle
      // Frequency offsets based on combo/lines cleared
      const baseFreq = 523.25 * Math.pow(1.059463, Math.min(12, (comboCount - 1) * 2)); // C5 root
      const intervals = [1, 1.25, 1.5, 1.875, 2]; // Major arpeggio notes
      const notesToPlay = Math.min(5, Math.max(3, linesCleared + 2));

      for (let i = 0; i < notesToPlay; i++) {
        const noteOsc = this.ctx.createOscillator();
        const noteGain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        const noteTime = now + (i * 0.042);
        const freq = baseFreq * intervals[i % intervals.length] * (i >= 4 ? 2 : 1);

        noteOsc.type = i % 2 === 0 ? 'sine' : 'triangle';
        noteOsc.frequency.setValueAtTime(freq, noteTime);
        noteOsc.frequency.exponentialRampToValueAtTime(freq * 1.08, noteTime + 0.08);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(freq * 1.2, noteTime);
        filter.Q.setValueAtTime(3.0, noteTime);

        noteGain.gain.setValueAtTime(0.0001, noteTime);
        noteGain.gain.linearRampToValueAtTime(0.28, noteTime + 0.015);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.22);

        noteOsc.connect(filter);
        filter.connect(noteGain);
        noteGain.connect(this.sfxGain);

        noteOsc.start(noteTime);
        noteOsc.stop(noteTime + 0.25);
      }

      // 3. Crisp Sparkle Fizz (White noise burst filtered for crisp crackle / game-feel)
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.12);
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * 0.5;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(2400, now);
      noiseFilter.Q.setValueAtTime(1.5, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.22, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      whiteNoise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.sfxGain);

      whiteNoise.start(now);
      whiteNoise.stop(now + 0.13);
    } catch (e) {
      // Audio fallback
    }
  }

  // Crisp pleasant chime ding when score energy is absorbed into the SCORE display
  playScoreAbsorb() {
    if (this.sfxLevel === 0) return;
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.08);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(gain);
      gain.connect(this.sfxGain);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {}
  }

  // Calming, ambient Lo-Fi chord progression (Procedural Electric Piano / Rhodes)
  startLofiMusic() {
    if (this.isPlayingMusic) return;
    this.init();
    if (!this.ctx) return;
    this.isPlayingMusic = true;

    // Lofi Chord Progression (Fmaj7 -> Em7 -> Dm7 -> Cmaj7) in Hz
    const chords = [
      [174.61, 220.00, 261.63, 329.63], // Fmaj7 (F3, A3, C4, E4)
      [164.81, 196.00, 246.94, 293.66], // Em7   (E3, G3, B3, D4)
      [146.83, 174.61, 220.00, 261.63], // Dm7   (D3, F3, A3, C4)
      [130.81, 164.81, 196.00, 246.94]  // Cmaj7 (C3, E3, G3, B3)
    ];

    const playChordStep = () => {
      if (!this.isPlayingMusic || !this.ctx) return;
      const notes = chords[this.chordStep % chords.length];
      this.chordStep++;

      const now = this.ctx.currentTime;
      const duration = 2.4;

      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const noteGain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        // Warm tape-like filter
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(650 + i * 80, now);

        // Sine/Triangle warm Rhodes feel
        osc.type = i === 0 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        // Soft gentle attack, long soothing decay
        const noteTime = now + i * 0.06;
        noteGain.gain.setValueAtTime(0.0001, noteTime);
        noteGain.gain.linearRampToValueAtTime(0.18, noteTime + 0.14);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, noteTime + duration);

        osc.connect(filter);
        filter.connect(noteGain);
        noteGain.connect(this.musicGain);

        osc.start(noteTime);
        osc.stop(noteTime + duration + 0.1);
      });

      this.musicTimer = setTimeout(playChordStep, 2500);
    };

    playChordStep();
  }

  stopLofiMusic() {
    this.isPlayingMusic = false;
    if (this.musicTimer) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

const soundEngine = new SoundEngine();

// Global button pop sound trigger for every button click/tap
window.addEventListener('pointerdown', (e) => {
  soundEngine.init();
  if (!soundEngine.isPlayingMusic && soundEngine.musicLevel > 0) {
    soundEngine.startLofiMusic();
  }
  const btn = e.target.closest('button, .header-back-btn, .header-restart-btn, .menu-play-btn, .menu-settings-btn, .action-btn');
  if (btn) {
    soundEngine.playSoftPop();
  }
}, { passive: true });

// Tauri IPC Bridge with Fallback Mock for Standalone Browser Dev
const hasTauri = typeof window.__TAURI__ !== 'undefined';
let tauriInvoke = null;

if (hasTauri) {
  tauriInvoke = window.__TAURI__.core ? window.__TAURI__.core.invoke : window.__TAURI__.invoke;
}

// Fallback Mock Engine for instant browser preview
class BrowserMockEngine {
  constructor() {
    this.board = 0n;
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('gridrun_high_score') || '0', 10);
    this.combo = 0;
    this.history = [];
    this.tray = this.generateTray();
  }

  generateTray() {
    const catalog = [
      // 1x1 Dot
      { id: 0, name: "Dot", width: 1, height: 1, cells: [[0, 0]], color: "#3B82F6" },

      // 2-blocks
      { id: 1, name: "DominoH", width: 2, height: 1, cells: [[0, 0], [0, 1]], color: "#F59E0B" },
      { id: 2, name: "DominoV", width: 1, height: 2, cells: [[0, 0], [1, 0]], color: "#F59E0B" },

      // 3-blocks
      { id: 3, name: "Tromino3H", width: 3, height: 1, cells: [[0, 0], [0, 1], [0, 2]], color: "#06B6D4" },
      { id: 4, name: "Tromino3V", width: 1, height: 3, cells: [[0, 0], [1, 0], [2, 0]], color: "#06B6D4" },
      { id: 5, name: "CornerUL", width: 2, height: 2, cells: [[0, 0], [0, 1], [1, 0]], color: "#8B5CF6" },
      { id: 6, name: "CornerUR", width: 2, height: 2, cells: [[0, 0], [0, 1], [1, 1]], color: "#8B5CF6" },
      { id: 7, name: "CornerDL", width: 2, height: 2, cells: [[0, 0], [1, 0], [1, 1]], color: "#8B5CF6" },
      { id: 8, name: "CornerDR", width: 2, height: 2, cells: [[0, 1], [1, 0], [1, 1]], color: "#8B5CF6" },

      // 4-blocks: Square
      { id: 9, name: "Square2x2", width: 2, height: 2, cells: [[0, 0], [0, 1], [1, 0], [1, 1]], color: "#10B981" },

      // 4-blocks: Lines
      { id: 10, name: "Line4H", width: 4, height: 1, cells: [[0, 0], [0, 1], [0, 2], [0, 3]], color: "#3B82F6" },
      { id: 11, name: "Line4V", width: 1, height: 4, cells: [[0, 0], [1, 0], [2, 0], [3, 0]], color: "#3B82F6" },

      // 4-blocks: T-Shapes
      { id: 12, name: "T_Up", width: 3, height: 2, cells: [[0, 1], [1, 0], [1, 1], [1, 2]], color: "#A855F7" },
      { id: 19, name: "T_Down", width: 3, height: 2, cells: [[0, 0], [0, 1], [0, 2], [1, 1]], color: "#A855F7" },
      { id: 20, name: "T_Left", width: 2, height: 3, cells: [[0, 1], [1, 0], [1, 1], [2, 1]], color: "#A855F7" },
      { id: 21, name: "T_Right", width: 2, height: 3, cells: [[0, 0], [1, 0], [2, 0], [1, 1]], color: "#A855F7" },

      // 4-blocks: L-Shapes
      { id: 13, name: "L_Shape_V1", width: 2, height: 3, cells: [[0, 0], [1, 0], [2, 0], [2, 1]], color: "#6366F1" },
      { id: 22, name: "L_Shape_V2", width: 2, height: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]], color: "#6366F1" },
      { id: 23, name: "L_Shape_H1", width: 3, height: 2, cells: [[0, 0], [0, 1], [0, 2], [1, 0]], color: "#6366F1" },
      { id: 24, name: "L_Shape_H2", width: 3, height: 2, cells: [[0, 2], [1, 0], [1, 1], [1, 2]], color: "#6366F1" },

      // 4-blocks: J-Shapes
      { id: 14, name: "J_Shape_V1", width: 2, height: 3, cells: [[0, 1], [1, 1], [2, 0], [2, 1]], color: "#3B82F6" },
      { id: 25, name: "J_Shape_V2", width: 2, height: 3, cells: [[0, 0], [0, 1], [1, 0], [2, 0]], color: "#3B82F6" },
      { id: 26, name: "J_Shape_H1", width: 3, height: 2, cells: [[0, 0], [0, 1], [0, 2], [1, 2]], color: "#3B82F6" },
      { id: 27, name: "J_Shape_H2", width: 3, height: 2, cells: [[0, 0], [1, 0], [1, 1], [1, 2]], color: "#3B82F6" },

      // 4-blocks: Z & S Shapes
      { id: 28, name: "Z_Shape_H", width: 3, height: 2, cells: [[0, 0], [0, 1], [1, 1], [1, 2]], color: "#EF4444" },
      { id: 29, name: "Z_Shape_V", width: 2, height: 3, cells: [[0, 1], [1, 0], [1, 1], [2, 0]], color: "#EF4444" },
      { id: 30, name: "S_Shape_H", width: 3, height: 2, cells: [[0, 1], [0, 2], [1, 0], [1, 1]], color: "#10B981" },
      { id: 31, name: "S_Shape_V", width: 2, height: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]], color: "#10B981" },

      // 5-blocks: Lines
      { id: 15, name: "Line5H", width: 5, height: 1, cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], color: "#06B6D4" },
      { id: 16, name: "Line5V", width: 1, height: 5, cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], color: "#06B6D4" },

      // Big Blocks
      { id: 17, name: "Square3x3", width: 3, height: 3, cells: [
        [0, 0], [0, 1], [0, 2],
        [1, 0], [1, 1], [1, 2],
        [2, 0], [2, 1], [2, 2]
      ], color: "#F97316" },

      // Big 3x3 L Corners
      { id: 32, name: "BigL_UL", width: 3, height: 3, cells: [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]], color: "#F59E0B" },
      { id: 33, name: "BigL_UR", width: 3, height: 3, cells: [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]], color: "#F59E0B" },
      { id: 34, name: "BigL_DL", width: 3, height: 3, cells: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]], color: "#F59E0B" },
      { id: 35, name: "BigL_DR", width: 3, height: 3, cells: [[0, 2], [1, 2], [2, 0], [2, 1], [2, 2]], color: "#F59E0B" }
    ];
    return [0, 1, 2].map(idx => ({
      slot_index: idx,
      piece: { ...catalog[Math.floor(Math.random() * catalog.length)] }
    }));
  }

  getState() {
    const grid_array = Array.from({ length: 8 }, (_, r) =>
      Array.from({ length: 8 }, (_, c) => (this.board & (1n << BigInt(r * 8 + c))) !== 0n)
    );
    return {
      board: { 0: Number(this.board) },
      grid_array,
      current_score: this.score,
      high_score: this.highScore,
      combo_count: this.combo,
      tray: this.tray,
      is_game_over: false,
      move_history: this.history
    };
  }

  placePiece(slotIndex, col, row) {
    const slot = this.tray[slotIndex];
    if (!slot || !slot.piece) throw new Error("Slot empty");
    const piece = slot.piece;
    if (row + piece.height > 8 || col + piece.width > 8) throw new Error("Out of bounds");

    let mask = 0n;
    for (const [r, c] of piece.cells) {
      const bit = 1n << BigInt((row + r) * 8 + (col + c));
      if ((this.board & bit) !== 0n) throw new Error("Collision");
      mask |= bit;
    }

    this.board |= mask;
    slot.piece = null;
    let scoreDelta = piece.cells.length;

    // Check lines
    const clearedRows = [];
    const clearedCols = [];
    let clearMask = 0n;

    for (let r = 0; r < 8; r++) {
      let full = true;
      for (let c = 0; c < 8; c++) {
        if ((this.board & (1n << BigInt(r * 8 + c))) === 0n) { full = false; break; }
      }
      if (full) {
        clearedRows.push(r);
        for (let c = 0; c < 8; c++) clearMask |= (1n << BigInt(r * 8 + c));
      }
    }

    for (let c = 0; c < 8; c++) {
      let full = true;
      for (let r = 0; r < 8; r++) {
        if ((this.board & (1n << BigInt(r * 8 + c))) === 0n) { full = false; break; }
      }
      if (full) {
        clearedCols.push(c);
        for (let r = 0; r < 8; r++) clearMask |= (1n << BigInt(r * 8 + c));
      }
    }

    const lines = clearedRows.length + clearedCols.length;
    if (lines > 0) {
      this.combo++;
      scoreDelta += 10 * (lines * (lines + 1) / 2) * this.combo;
      this.board &= ~clearMask;
    } else {
      this.combo = 0;
    }

    this.score += scoreDelta;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('gridrun_high_score', this.highScore.toString());
    }

    if (this.tray.every(s => !s.piece)) {
      this.tray = this.generateTray();
    }

    this.history.push({
      step: this.history.length + 1,
      piece_id: piece.id,
      slot_index: slotIndex,
      row,
      col,
      timestamp_ms: Date.now(),
      lines_cleared: lines,
      score_delta: scoreDelta,
      board_after: Number(this.board)
    });

    return {
      success: true,
      score_delta: scoreDelta,
      lines_cleared: lines,
      cleared_rows: clearedRows,
      cleared_cols: clearedCols,
      is_game_over: false,
      current_score: this.score,
      high_score: this.highScore,
      combo_count: this.combo,
      game_state: this.getState()
    };
  }

  reset() {
    this.board = 0n;
    this.score = 0;
    this.combo = 0;
    this.history = [];
    this.tray = this.generateTray();
    return this.getState();
  }
}

const mockEngine = new BrowserMockEngine();

async function callIPC(command, payload = {}) {
  if (hasTauri && tauriInvoke) {
    return await tauriInvoke(command, payload);
  }
  // Standalone fallback
  if (command === 'get_initial_state') return mockEngine.getState();
  if (command === 'validate_and_place_piece') {
    return mockEngine.placePiece(payload.piece_id, payload.x, payload.y);
  }
  if (command === 'reset_game') return mockEngine.reset();
  throw new Error(`Unknown command ${command}`);
}

// Particle System - Clean, subtle particles without blinding neon glows
class ParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.rings = [];
  }

  resize(w, h, dpr) {
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.scale(dpr, dpr);
    this.dpr = dpr;
  }

  spawnLineClear(cells, cellSize) {
    for (const { r, c, color } of cells) {
      const cx = (c + 0.5) * cellSize;
      const cy = (r + 0.5) * cellSize;
      const pColor = color || '#3B82F6';

      // Expanding explosion ring on the cell
      this.rings.push({
        x: cx,
        y: cy,
        radius: 6,
        maxRadius: cellSize * 1.05,
        color: pColor,
        alpha: 0.9,
        decay: 0.045
      });

      for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4.5 + 1.8;
        this.particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.2,
          size: Math.random() * 5 + 2,
          color: pColor,
          alpha: 1.0,
          life: 1.0,
          decay: Math.random() * 0.035 + 0.02
        });
      }
    }
  }

  updateAndRender() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Render expanding shockwave rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      ring.radius += 2.2;
      ring.alpha -= ring.decay;
      if (ring.alpha <= 0 || ring.radius >= ring.maxRadius) {
        this.rings.splice(i, 1);
        continue;
      }
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, ring.alpha);
      this.ctx.strokeStyle = ring.color;
      this.ctx.lineWidth = 2.5;
      this.ctx.beginPath();
      this.ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();
    }

    // Render particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1; // gravity
      p.life -= p.decay;
      p.alpha = Math.max(0, p.life);

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
  }
}

// Main Game Controller
class GridRunGame {
  constructor() {
    this.appContainer = document.getElementById('app');
    this.state = null;
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.fxCanvas = document.getElementById('fx-canvas');
    this.fx = new ParticleSystem(this.fxCanvas);

    // Full viewport drag canvas
    this.dragCanvas = document.getElementById('drag-canvas');
    this.dragCtx = this.dragCanvas.getContext('2d');

    this.boardWrapper = document.getElementById('board-container');
    this.slotCanvases = [
      document.getElementById('slot-canvas-0'),
      document.getElementById('slot-canvas-1'),
      document.getElementById('slot-canvas-2')
    ];
    this.slotCtxs = this.slotCanvases.map(c => c.getContext('2d'));

    // Persistent Color Map for Grid Cells
    this.gridColors = Array.from({ length: 8 }, () => Array(8).fill(null));

    // UI elements
    this.scoreEl = document.getElementById('current-score');
    this.highScoreEl = document.getElementById('high-score');
    this.comboBadge = document.getElementById('combo-badge');
    this.comboCountEl = document.getElementById('combo-count');
    this.gameoverModal = document.getElementById('modal-gameover');
    this.goScoreEl = document.getElementById('go-score');
    this.goHighEl = document.getElementById('go-high');
    this.fxContainer = document.getElementById('fx-overlay-container');

    // Splash and Menu elements
    this.splashScreen = document.getElementById('splash-screen');
    this.splashPhaseLogo = document.getElementById('splash-phase-logo');
    this.kriaLogoImg = document.getElementById('kria-logo-img');
    this.splashPhaseLoading = document.getElementById('splash-phase-loading');
    this.splashLoaderProgress = document.getElementById('splash-loader-progress');

    // Unified Menu System
    this.menuOverlay = document.getElementById('menu-overlay');
    this.menuViewMain = document.getElementById('menu-view-main');
    this.menuViewSettings = document.getElementById('menu-view-settings');
    this.menuHighScoreVal = document.getElementById('menu-high-score-val');
    this.btnMenuPlay = document.getElementById('btn-menu-play');
    this.btnMenuSettings = document.getElementById('btn-menu-settings');
    this.btnSettingsBack = document.getElementById('btn-settings-back');

    // Audio Sliders (10 stepped levels)
    this.sliderMusic = document.getElementById('slider-music');
    this.musicVolVal = document.getElementById('music-vol-val');
    this.sliderSfx = document.getElementById('slider-sfx');
    this.sfxVolVal = document.getElementById('sfx-vol-val');

    // Drag State
    this.activeDrag = null;

    this.init();
  }

  async init() {
    this.bindEvents();
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());

    // Start FX loop
    const loop = () => {
      this.fx.updateAndRender();
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    // Initial load from backend
    try {
      this.state = await callIPC('get_initial_state');
      this.updateUI();
    } catch (e) {
      console.error("Failed to load initial state:", e);
    }

    // Run Splash Flow
    this.runSplashSequence();
  }

  /**
   * Opening Sequence:
   * Phase 1: Enlarged Kria Games Logo appears and stays longer (~2.8 seconds)
   * Phase 2: gridrun-loading.png Artwork + Enlarged Loading Bar (~2.7 seconds)
   * Phase 3: Smooth transition to Main Menu
   */
  runSplashSequence() {
    // Phase 1: Fade-in Kria Games logo
    setTimeout(() => {
      if (this.kriaLogoImg) {
        this.kriaLogoImg.style.opacity = '1';
      }
    }, 200);

    // Fade-out Kria Games logo (stays comfortably on screen)
    setTimeout(() => {
      if (this.kriaLogoImg) {
        this.kriaLogoImg.style.opacity = '0';
      }
    }, 2000);

    // Phase 2: Switch to Loading Screen with gridrun-loading.png (starts at 2800ms)
    setTimeout(() => {
      this.splashPhaseLogo.classList.add('hidden');
      this.splashPhaseLoading.classList.remove('hidden');

      // Extended Smooth Loading Bar Sequence (duration ~2.7s)
      setTimeout(() => {
        if (this.splashLoaderProgress) this.splashLoaderProgress.style.width = '28%';
      }, 200);

      setTimeout(() => {
        if (this.splashLoaderProgress) this.splashLoaderProgress.style.width = '58%';
      }, 900);

      setTimeout(() => {
        if (this.splashLoaderProgress) this.splashLoaderProgress.style.width = '88%';
      }, 1700);

      setTimeout(() => {
        if (this.splashLoaderProgress) this.splashLoaderProgress.style.width = '100%';
      }, 2300);

      // Transition to Main Menu when loading bar finishes
      setTimeout(() => {
        this.openMainMenu();
      }, 2700);

    }, 2800);
  }

  openMainMenu() {
    // Hide splash screen smoothly
    if (this.splashScreen) {
      this.splashScreen.style.opacity = '0';
      setTimeout(() => {
        this.splashScreen.classList.add('hidden');
      }, 500);
    }

    // Ensure main view is active and settings view is inactive
    if (this.menuViewMain && this.menuViewSettings) {
      this.menuViewMain.classList.add('active');
      this.menuViewSettings.classList.remove('active');
    }

    // Update highest score on main menu
    const currentHigh = this.state ? this.state.high_score : (parseInt(localStorage.getItem('gridrun_high_score') || '0', 10));
    if (this.menuHighScoreVal) {
      this.menuHighScoreVal.textContent = currentHigh;
    }

    // Show menu overlay with solid background
    if (this.menuOverlay) {
      this.menuOverlay.classList.remove('hidden');
      this.menuOverlay.style.opacity = '1';
    }
  }

  startGameFromMenu() {
    if (this.menuOverlay) {
      this.menuOverlay.style.opacity = '0';
      setTimeout(() => {
        this.menuOverlay.classList.add('hidden');
      }, 350);
    }
  }

  // Smooth subview transition inside the solid menu overlay - ZERO background glitch
  openSettingsMenu() {
    if (this.sliderMusic) this.sliderMusic.value = soundEngine.musicLevel;
    if (this.musicVolVal) this.musicVolVal.textContent = soundEngine.musicLevel;
    if (this.sliderSfx) this.sliderSfx.value = soundEngine.sfxLevel;
    if (this.sfxVolVal) this.sfxVolVal.textContent = soundEngine.sfxLevel;

    if (this.menuViewMain && this.menuViewSettings) {
      this.menuViewMain.classList.remove('active');
      this.menuViewSettings.classList.add('active');
    }
  }

  closeSettingsMenu() {
    if (this.menuViewMain && this.menuViewSettings) {
      this.menuViewSettings.classList.remove('active');
      this.menuViewMain.classList.add('active');
    }
  }

  handleResize() {
    const rect = this.boardWrapper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.gridPixelSize = rect.width;
    this.cellSize = this.gridPixelSize / 8;

    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);

    this.fx.resize(rect.width, rect.height, dpr);

    // Resize full drag canvas
    const appRect = this.appContainer.getBoundingClientRect();
    this.dragCanvas.width = appRect.width * dpr;
    this.dragCanvas.height = appRect.height * dpr;
    this.dragCtx.resetTransform();
    this.dragCtx.scale(dpr, dpr);
    this.appWidth = appRect.width;
    this.appHeight = appRect.height;

    // Resize tray slots
    this.slotCanvases.forEach((c, idx) => {
      const sRect = c.parentElement.getBoundingClientRect();
      c.width = sRect.width * dpr;
      c.height = sRect.height * dpr;
      this.slotCtxs[idx].resetTransform();
      this.slotCtxs[idx].scale(dpr, dpr);
    });

    this.render();
    this.renderTray();
    if (this.activeDrag) {
      this.renderDragPiece();
    }
  }

  bindEvents() {
    // Play button on Main Menu
    if (this.btnMenuPlay) {
      this.btnMenuPlay.addEventListener('click', () => this.startGameFromMenu());
    }

    // Settings buttons
    if (this.btnMenuSettings) {
      this.btnMenuSettings.addEventListener('click', () => this.openSettingsMenu());
    }
    if (this.btnSettingsBack) {
      this.btnSettingsBack.addEventListener('click', () => this.closeSettingsMenu());
    }

    // Audio Sliders (10-step stepped levels)
    if (this.sliderMusic) {
      this.sliderMusic.value = soundEngine.musicLevel;
      if (this.musicVolVal) this.musicVolVal.textContent = soundEngine.musicLevel;

      const handleMusicChange = (e) => {
        const val = parseInt(e.target.value, 10);
        soundEngine.setMusicLevel(val);
        if (this.musicVolVal) this.musicVolVal.textContent = val;
        soundEngine.playSoftPop();
      };
      this.sliderMusic.addEventListener('input', handleMusicChange);
      this.sliderMusic.addEventListener('change', handleMusicChange);
    }

    if (this.sliderSfx) {
      this.sliderSfx.value = soundEngine.sfxLevel;
      if (this.sfxVolVal) this.sfxVolVal.textContent = soundEngine.sfxLevel;

      const handleSfxChange = (e) => {
        const val = parseInt(e.target.value, 10);
        soundEngine.setSfxLevel(val);
        if (this.sfxVolVal) this.sfxVolVal.textContent = val;
        soundEngine.playSoftPop();
      };
      this.sliderSfx.addEventListener('input', handleSfxChange);
      this.sliderSfx.addEventListener('change', handleSfxChange);
    }

    // Navigation buttons
    const btnBackMenu = document.getElementById('btn-back-menu');
    if (btnBackMenu) {
      btnBackMenu.addEventListener('click', () => this.openMainMenu());
    }

    const btnRestartNav = document.getElementById('btn-restart-nav');
    if (btnRestartNav) {
      btnRestartNav.addEventListener('click', () => this.resetGame());
    }

    // Modal restart / menu
    document.getElementById('btn-restart').addEventListener('click', () => {
      this.gameoverModal.classList.add('hidden');
      this.resetGame();
    });

    const btnMenuFromGo = document.getElementById('btn-menu-from-go');
    if (btnMenuFromGo) {
      btnMenuFromGo.addEventListener('click', () => {
        this.gameoverModal.classList.add('hidden');
        this.openMainMenu();
      });
    }

    // Tray Drag Handling (Unified Pointer Events)
    const traySlots = document.querySelectorAll('.piece-slot');
    traySlots.forEach(slotEl => {
      slotEl.addEventListener('pointerdown', (e) => this.onPointerDown(e, slotEl));
    });

    window.addEventListener('pointermove', (e) => this.onPointerMove(e));
    window.addEventListener('pointerup', (e) => this.onPointerUp(e));
    window.addEventListener('pointercancel', (e) => this.onPointerCancel(e));
  }

  onPointerDown(e, slotEl) {
    if (!this.state || this.state.is_game_over) return;
    const slotIdx = parseInt(slotEl.dataset.slot, 10);
    const slotData = this.state.tray[slotIdx];
    if (!slotData || !slotData.piece) return;

    soundEngine.playSoftPop();
    e.preventDefault();
    slotEl.classList.add('dragging');

    const isTouch = e.pointerType === 'touch';
    const touchLiftY = isTouch ? 70 : 0;

    this.activeDrag = {
      slotIndex: slotIdx,
      piece: slotData.piece,
      clientX: e.clientX,
      clientY: e.clientY - touchLiftY,
      touchLiftY,
      targetCol: null,
      targetRow: null,
      isValid: false
    };

    this.renderDragPiece();
  }

  onPointerMove(e) {
    if (!this.activeDrag) return;
    e.preventDefault();
    this.activeDrag.clientX = e.clientX;
    this.activeDrag.clientY = e.clientY - this.activeDrag.touchLiftY;

    // Project coordinates onto the 8x8 Board
    const boardRect = this.boardWrapper.getBoundingClientRect();
    
    const piece = this.activeDrag.piece;
    const halfW = (piece.width * this.cellSize) / 2;
    const halfH = (piece.height * this.cellSize) / 2;

    const pieceTopLeftX = this.activeDrag.clientX - halfW;
    const pieceTopLeftY = this.activeDrag.clientY - halfH;

    const relX = pieceTopLeftX - boardRect.left + (this.cellSize / 2);
    const relY = pieceTopLeftY - boardRect.top + (this.cellSize / 2);

    const col = Math.floor(relX / this.cellSize);
    const row = Math.floor(relY / this.cellSize);

    if (row >= 0 && row + piece.height <= 8 &&
        col >= 0 && col + piece.width <= 8) {
      this.activeDrag.targetCol = col;
      this.activeDrag.targetRow = row;
      this.activeDrag.isValid = this.checkPlacementValidity(piece, row, col);
    } else {
      this.activeDrag.targetCol = null;
      this.activeDrag.targetRow = null;
      this.activeDrag.isValid = false;
    }

    this.renderDragPiece();
  }

  checkPlacementValidity(piece, row, col) {
    if (!this.state || !this.state.grid_array) return false;
    for (const [r, c] of piece.cells) {
      const targetR = row + r;
      const targetC = col + c;
      if (targetR >= 8 || targetC >= 8 || this.state.grid_array[targetR][targetC]) {
        return false;
      }
    }
    return true;
  }

  // Draw the dragged piece smoothly across the entire screen on dragCanvas
  renderDragPiece() {
    this.clearDragCanvas();
    if (!this.activeDrag) return;

    const { piece, clientX, clientY } = this.activeDrag;
    const appRect = this.appContainer.getBoundingClientRect();
    
    // Convert client coords to app container local coords
    const localX = clientX - appRect.left;
    const localY = clientY - appRect.top;

    const cs = this.cellSize;
    const totalW = piece.width * cs;
    const totalH = piece.height * cs;
    const startX = localX - totalW / 2;
    const startY = localY - totalH / 2;

    const ctx = this.dragCtx;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;

    for (const [r, c] of piece.cells) {
      const x = startX + c * cs;
      const y = startY + r * cs;
      this.drawCell(ctx, x, y, cs, piece.color);
    }
    ctx.restore();
  }

  clearDragCanvas() {
    this.dragCtx.clearRect(0, 0, this.appWidth || 1000, this.appHeight || 2000);
  }

  async onPointerUp(e) {
    if (!this.activeDrag) return;
    const drag = this.activeDrag;
    this.activeDrag = null;
    this.clearDragCanvas();

    document.querySelectorAll('.piece-slot').forEach(s => s.classList.remove('dragging'));

    if (drag.isValid && drag.targetCol !== null && drag.targetRow !== null) {
      try {
        const result = await callIPC('validate_and_place_piece', {
          piece_id: drag.slotIndex,
          x: drag.targetCol,
          y: drag.targetRow
        });

        if (result.success) {
          // Record the placed piece's original color into gridColors map
          for (const [r, c] of drag.piece.cells) {
            const tr = drag.targetRow + r;
            const tc = drag.targetCol + c;
            if (tr < 8 && tc < 8) {
              this.gridColors[tr][tc] = drag.piece.color;
            }
          }

          const previousScore = this.state ? this.state.current_score : 0;
          this.state = result.game_state;

          // Particle burst, sound & flying score effect for cleared lines
          if (result.lines_cleared > 0) {
            soundEngine.playLineClearExplosion(result.lines_cleared, result.combo_count || 1);

            const clearedCells = [];
            result.cleared_rows.forEach(r => {
              for (let c = 0; c < 8; c++) {
                clearedCells.push({ r, c, color: this.gridColors[r][c] });
                this.gridColors[r][c] = null;
              }
            });
            result.cleared_cols.forEach(c => {
              for (let r = 0; r < 8; r++) {
                clearedCells.push({ r, c, color: this.gridColors[r][c] });
                this.gridColors[r][c] = null;
              }
            });
            this.fx.spawnLineClear(clearedCells, this.cellSize);

            // Screen shake
            this.boardWrapper.classList.remove('shake-heavy');
            void this.boardWrapper.offsetWidth; // trigger reflow
            this.boardWrapper.classList.add('shake-heavy');

            // Trigger flying score energy orbs & combo floater towards hero score
            this.triggerScoreFlyEffect(clearedCells, result.score_delta, previousScore, this.state.current_score, result.combo_count || 1);
          } else {
            soundEngine.playSoftPop();
            this.updateUI();
          }

          if (result.is_game_over) {
            this.triggerGameOver();
          }
        }
      } catch (err) {
        console.warn("Placement rejected:", err);
      }
    }

    this.render();
    this.renderTray();
  }

  onPointerCancel(e) {
    if (this.activeDrag) {
      this.activeDrag = null;
      this.clearDragCanvas();
      document.querySelectorAll('.piece-slot').forEach(s => s.classList.remove('dragging'));
      this.render();
      this.renderTray();
    }
  }

  // Visual Score FX: Flying energy beads and score floater that arc into the SCORE display
  triggerScoreFlyEffect(clearedCells, scoreDelta, oldScore, newScore, comboCount) {
    if (!this.scoreEl) {
      this.updateUI();
      return;
    }

    // Set score to oldScore initially and update high score / combo badge
    this.scoreEl.textContent = oldScore;
    if (this.highScoreEl && this.state) {
      this.highScoreEl.textContent = this.state.high_score;
    }
    if (comboCount > 1) {
      this.comboCountEl.textContent = comboCount;
      this.comboBadge.classList.remove('hidden');
    } else {
      this.comboBadge.classList.add('hidden');
    }

    if (!this.fxContainer) {
      this.updateUI();
      return;
    }

    const appRect = this.appContainer.getBoundingClientRect();
    const scoreRect = this.scoreEl.getBoundingClientRect();
    const targetX = scoreRect.left + scoreRect.width / 2 - appRect.left;
    const targetY = scoreRect.top + scoreRect.height / 2 - appRect.top;

    const boardRect = this.canvas.getBoundingClientRect();

    // Calculate center of cleared explosion for floating score text
    let avgX = 0;
    let avgY = 0;
    clearedCells.forEach(({ r, c }) => {
      avgX += boardRect.left + (c + 0.5) * this.cellSize - appRect.left;
      avgY += boardRect.top + (r + 0.5) * this.cellSize - appRect.top;
    });
    if (clearedCells.length > 0) {
      avgX /= clearedCells.length;
      avgY /= clearedCells.length;
    } else {
      avgX = appRect.width / 2;
      avgY = appRect.height / 2;
    }

    // 1. Spawn floating score delta badge (+120 / COMBO x2 +240)
    const floater = document.createElement('div');
    floater.className = 'floating-score-delta';
    floater.textContent = comboCount > 1 ? `+${scoreDelta} (x${comboCount})` : `+${scoreDelta}`;
    floater.style.left = `${avgX}px`;
    floater.style.top = `${avgY}px`;
    floater.style.transform = 'translate(-50%, -50%) scale(0.6)';
    floater.style.opacity = '0';
    this.fxContainer.appendChild(floater);

    requestAnimationFrame(() => {
      floater.style.transition = 'transform 0.52s cubic-bezier(0.18, 0.9, 0.3, 1), opacity 0.52s ease';
      floater.style.transform = `translate(${targetX - avgX}px, ${targetY - avgY + 30}px) scale(1.15)`;
      floater.style.opacity = '1';
    });

    setTimeout(() => {
      floater.style.opacity = '0';
      setTimeout(() => floater.remove(), 250);
    }, 620);

    // 2. Select distinct sample cells to spawn radiant flying energy orbs
    const sampleCells = clearedCells.filter((_, idx) => idx % Math.max(1, Math.floor(clearedCells.length / 8)) === 0).slice(0, 10);

    sampleCells.forEach(({ r, c, color }, idx) => {
      const orb = document.createElement('div');
      orb.className = 'score-energy-orb';
      const orbColor = color || '#38bdf8';
      orb.style.background = `radial-gradient(circle, #ffffff 20%, ${orbColor} 70%, rgba(255,255,255,0) 100%)`;
      orb.style.boxShadow = `0 0 12px ${orbColor}, 0 0 22px rgba(255, 255, 255, 0.8)`;

      const startX = boardRect.left + (c + 0.5) * this.cellSize - appRect.left;
      const startY = boardRect.top + (r + 0.5) * this.cellSize - appRect.top;

      orb.style.left = `${startX}px`;
      orb.style.top = `${startY}px`;
      orb.style.transform = 'translate(-50%, -50%) scale(0.4)';
      orb.style.opacity = '0';
      this.fxContainer.appendChild(orb);

      // Stagger slightly for organic flurry effect
      setTimeout(() => {
        orb.style.transition = 'transform 0.40s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.40s ease';
        const spreadX = (Math.random() - 0.5) * 18;
        orb.style.transform = `translate(${targetX - startX + spreadX}px, ${targetY - startY}px) scale(1.2)`;
        orb.style.opacity = '1';
      }, idx * 25);

      // When orb arrives at the score
      setTimeout(() => {
        orb.style.opacity = '0';
        setTimeout(() => orb.remove(), 120);
      }, 360 + idx * 25);
    });

    // 3. When orbs hit SCORE: score punch + count up animation + absorb chime
    setTimeout(() => {
      soundEngine.playScoreAbsorb();
      this.scoreEl.classList.remove('score-pop-punch');
      void this.scoreEl.offsetWidth; // trigger reflow
      this.scoreEl.classList.add('score-pop-punch');

      this.animateScoreCounter(oldScore, newScore);
    }, 340);
  }

  animateScoreCounter(startVal, endVal) {
    if (startVal === endVal) {
      this.scoreEl.textContent = endVal;
      return;
    }
    const duration = 260; // ms
    const startTime = performance.now();

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease out quad
      const current = Math.round(startVal + (endVal - startVal) * (1 - (1 - progress) * (1 - progress)));
      this.scoreEl.textContent = current;

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        this.scoreEl.textContent = endVal;
        this.updateUI();
      }
    };
    requestAnimationFrame(step);
  }

  async resetGame() {
    try {
      this.gridColors = Array.from({ length: 8 }, () => Array(8).fill(null));
      this.state = await callIPC('reset_game');
      this.updateUI();
      this.render();
      this.renderTray();
    } catch (e) {
      console.error("Reset failed:", e);
    }
  }

  triggerGameOver() {
    this.goScoreEl.textContent = this.state.current_score;
    this.goHighEl.textContent = this.state.high_score;
    if (this.menuHighScoreVal) {
      this.menuHighScoreVal.textContent = this.state.high_score;
    }
    this.gameoverModal.classList.remove('hidden');
  }

  updateUI() {
    if (!this.state) return;
    this.scoreEl.textContent = this.state.current_score;
    this.highScoreEl.textContent = this.state.high_score;

    if (this.menuHighScoreVal) {
      this.menuHighScoreVal.textContent = this.state.high_score;
    }

    if (this.state.combo_count > 1) {
      this.comboCountEl.textContent = this.state.combo_count;
      this.comboBadge.classList.remove('hidden');
    } else {
      this.comboBadge.classList.add('hidden');
    }

    this.render();
    this.renderTray();
  }

  // Render 8x8 Grid and Drag Ghost in actual piece colors
  render() {
    const ctx = this.ctx;
    const w = this.gridPixelSize;
    const cs = this.cellSize;
    ctx.clearRect(0, 0, w, w);

    // Draw background empty slots & placed blocks in their authentic colors
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const x = c * cs;
        const y = r * cs;
        const isOccupied = this.state && this.state.grid_array && this.state.grid_array[r][c];

        if (isOccupied) {
          const cellColor = (this.gridColors[r] && this.gridColors[r][c]) || '#3B82F6';
          this.drawCell(ctx, x, y, cs, cellColor);
        } else {
          this.drawEmptyCell(ctx, x, y, cs);
        }
      }
    }

    // Draw Ghost Preview if dragging over grid with piece's original color
    if (this.activeDrag && this.activeDrag.targetCol !== null && this.activeDrag.targetRow !== null) {
      const { piece, targetCol, targetRow, isValid } = this.activeDrag;
      const ghostFill = isValid ? hexToRgba(piece.color, 0.45) : 'rgba(239, 68, 68, 0.4)';
      const ghostStroke = isValid ? piece.color : '#EF4444';

      for (const [r, c] of piece.cells) {
        const gx = (targetCol + c) * cs;
        const gy = (targetRow + r) * cs;
        this.drawCell(ctx, gx, gy, cs, ghostFill, ghostStroke);
      }
    }
  }

  drawEmptyCell(ctx, x, y, size) {
    const pad = 2;
    const innerSize = size - pad * 2;
    const rx = x + pad;
    const ry = y + pad;
    const r = 6;

    ctx.save();
    // Base dark recessed slot
    ctx.fillStyle = '#121828';
    ctx.beginPath();
    ctx.roundRect(rx, ry, innerSize, innerSize, r);
    ctx.fill();

    // Subtle inner top-shadow for recessed depth
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.roundRect(rx + 1, ry + 1, innerSize - 2, 4, [r, r, 0, 0]);
    ctx.fill();

    // Sleek border outline
    ctx.strokeStyle = '#1a2338';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(rx, ry, innerSize, innerSize, r);
    ctx.stroke();
    ctx.restore();
  }

  // Modern physical block rendering with tactile depth & bevel highlight
  drawCell(ctx, x, y, size, color, strokeColor = null) {
    const pad = 2;
    const innerSize = size - pad * 2;
    const rx = x + pad;
    const ry = y + pad;
    const r = 7;

    ctx.save();
    // Base block color
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(rx, ry, innerSize, innerSize, r);
    ctx.fill();

    // Subtle top highlight for 3D elevation
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.beginPath();
    ctx.roundRect(rx + 1, ry + 1, innerSize - 2, innerSize * 0.35, [r - 1, r - 1, 2, 2]);
    ctx.fill();

    // Subtle bottom shadow inside block
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.roundRect(rx + 1, ry + innerSize * 0.75, innerSize - 2, innerSize * 0.25 - 1, [0, 0, r - 1, r - 1]);
    ctx.fill();

    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(rx, ry, innerSize, innerSize, r);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Render Mini Pieces in Tray Slots
  renderTray() {
    if (!this.state || !this.state.tray) return;

    this.state.tray.forEach((slot, idx) => {
      const c = this.slotCanvases[idx];
      const ctx = this.slotCtxs[idx];
      const sRect = c.parentElement.getBoundingClientRect();
      ctx.clearRect(0, 0, sRect.width, sRect.height);

      if (!slot.piece) return;

      const piece = slot.piece;
      const pieceW = piece.width;
      const pieceH = piece.height;
      const blockSize = Math.min(sRect.width / 5, sRect.height / 5);

      const totalW = pieceW * blockSize;
      const totalH = pieceH * blockSize;
      const startX = (sRect.width - totalW) / 2;
      const startY = (sRect.height - totalH) / 2;

      for (const [r, col] of piece.cells) {
        const x = startX + col * blockSize;
        const y = startY + r * blockSize;
        this.drawCell(ctx, x, y, blockSize, piece.color);
      }
    });
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new GridRunGame();
});
