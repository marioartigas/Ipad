/**
 * engine.js — Motor matemático de animación
 *
 * Algoritmos implementados:
 *  1. PARTICLES  – Sistema de partículas con atracción/repulsión
 *  2. LISSAJOUS  – Curvas de Lissajous multifrecuencia
 *  3. FOURIER    – Series de Fourier / epiciclos
 *  4. FLOW_FIELD – Campo de flujo con ruido Perlin simplificado
 *  5. MANDELBROT – Conjunto de Mandelbrot coloreado dinámicamente
 *  6. REACTION   – Reacción-difusión de Turing (Gray-Scott)
 */

'use strict';

/* ============================================================
   UTILIDADES MATEMÁTICAS
   ============================================================ */

/**
 * Hash determinístico de una cadena → número [0, 1)
 * Algoritmo: djb2 modificado
 */
function hashWord(word) {
  let h = 5381;
  for (let i = 0; i < word.length; i++) {
    h = ((h << 5) + h) ^ word.charCodeAt(i);
    h = h >>> 0; // uint32
  }
  return h / 0xFFFFFFFF;
}

/**
 * Generador de números pseudo-aleatorios seeded (xorshift32)
 */
class SeededRandom {
  constructor(seed) {
    // Aseguramos semilla no-cero
    this.state = (seed * 0xDEADBEEF | 1) >>> 0;
  }
  next() {
    let x = this.state;
    x ^= x << 13; x = x >>> 0;
    x ^= x >> 17;
    x ^= x << 5;  x = x >>> 0;
    this.state = x;
    return x / 0xFFFFFFFF;
  }
  range(a, b) { return a + this.next() * (b - a); }
  int(a, b)   { return Math.floor(this.range(a, b + 1)); }
}

/**
 * Paleta de colores derivada de la palabra
 * Cada carácter contribuye a H, S, L del espacio HSL
 */
function buildPalette(word, count = 6) {
  const rng = new SeededRandom(hashWord(word) * 0xFFFFFFFF);
  const baseH = (word.charCodeAt(0) * 13.7 + word.length * 47.3) % 360;
  const palette = [];
  for (let i = 0; i < count; i++) {
    const angle = baseH + i * (360 / count) + rng.range(-25, 25);
    const s = rng.range(65, 100);
    const l = rng.range(40, 70);
    palette.push({ h: ((angle % 360) + 360) % 360, s, l });
  }
  return palette;
}

function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0)*255), Math.round(f(8)*255), Math.round(f(4)*255)];
}

function colorStr(h, s, l, a = 1) {
  return `hsla(${h.toFixed(1)},${s.toFixed(1)}%,${l.toFixed(1)}%,${a})`;
}

/**
 * Ruido Perlin simplificado 2D (Value Noise con interpolación suave)
 */
class ValueNoise {
  constructor(seed) {
    const rng = new SeededRandom(seed);
    this.perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = rng.int(0, i);
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }

  lerp(a, b, t) { return a + t * (b - a); }

  grad(hash, x, y) {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }

  noise(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = this.fade(x);
    const v = this.fade(y);
    const p = this.perm;
    const a  = p[X] + Y,     aa = p[a],     ab = p[a + 1];
    const b  = p[X + 1] + Y, ba = p[b],     bb = p[b + 1];
    return this.lerp(
      this.lerp(this.grad(p[aa], x,   y),   this.grad(p[ba], x-1, y),   u),
      this.lerp(this.grad(p[ab], x,   y-1), this.grad(p[bb], x-1, y-1), u),
      v
    );
  }

  /** Ruido fractal (fBm) */
  fbm(x, y, octaves = 5) {
    let val = 0, amp = 0.5, freq = 1, max = 0;
    for (let i = 0; i < octaves; i++) {
      val += this.noise(x * freq, y * freq) * amp;
      max += amp;
      amp  *= 0.5;
      freq *= 2;
    }
    return val / max;
  }
}

/* ============================================================
   MODO 1: SISTEMA DE PARTÍCULAS
   ============================================================ */
class ParticleMode {
  constructor(word, canvas, palette) {
    this.name = 'Sistema de Partículas';
    this.word = word;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.palette = palette;
    this.rng = new SeededRandom(hashWord(word) * 0xFFFFFFFF);
    this.t = 0;

    const N = Math.min(400 + word.length * 20, 800);
    this.particles = [];

    // Atractores derivados de las letras
    this.attractors = [];
    for (let i = 0; i < word.length; i++) {
      const angle = (i / word.length) * Math.PI * 2;
      const r = 0.25 + this.rng.range(0, 0.1);
      this.attractors.push({
        x: 0.5 + Math.cos(angle) * r,
        y: 0.5 + Math.sin(angle) * r,
        strength: 0.3 + (word.charCodeAt(i) % 7) * 0.1,
        freq: 0.5 + (word.charCodeAt(i) % 5) * 0.3,
      });
    }

    for (let i = 0; i < N; i++) {
      const ci = this.rng.int(0, palette.length - 1);
      this.particles.push({
        x: this.rng.range(0.1, 0.9),
        y: this.rng.range(0.1, 0.9),
        vx: this.rng.range(-0.002, 0.002),
        vy: this.rng.range(-0.002, 0.002),
        size: this.rng.range(1.5, 4),
        life: this.rng.range(0, 1),
        speed: this.rng.range(0.0005, 0.002),
        ci,
        phase: this.rng.range(0, Math.PI * 2),
      });
    }
  }

  update() {
    this.t += 0.016;
    const W = this.canvas.width;
    const H = this.canvas.height;

    for (const p of this.particles) {
      let ax = 0, ay = 0;
      for (const att of this.attractors) {
        const tx = att.x * W;
        const ty = att.y * H;
        const ox = att.x + Math.cos(this.t * att.freq + p.phase) * 0.15;
        const oy = att.y + Math.sin(this.t * att.freq * 1.3 + p.phase) * 0.15;
        const dx = ox * W - p.x;
        const dy = oy * H - p.y;
        const dist2 = dx*dx + dy*dy + 1;
        const f = att.strength * 0.3 / dist2;
        ax += dx * f;
        ay += dy * f;
      }
      p.vx = p.vx * 0.97 + ax;
      p.vy = p.vy * 0.97 + ay;
      const speed = Math.sqrt(p.vx*p.vx + p.vy*p.vy);
      const maxSpeed = 3;
      if (speed > maxSpeed) {
        p.vx = (p.vx / speed) * maxSpeed;
        p.vy = (p.vy / speed) * maxSpeed;
      }
      p.x += p.vx;
      p.y += p.vy;
      p.life += p.speed;
      if (p.life > 1) { p.life = 0; }
      // Rebote suave
      if (p.x < 0) p.vx = Math.abs(p.vx);
      if (p.x > W) p.vx = -Math.abs(p.vx);
      if (p.y < 0) p.vy = Math.abs(p.vy);
      if (p.y > H) p.vy = -Math.abs(p.vy);
    }
  }

  draw() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, 0, W, H);

    for (const p of this.particles) {
      const c = this.palette[p.ci];
      const alpha = 0.5 + Math.sin(this.t * 2 + p.phase) * 0.3;
      const glow = p.size * 3;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glow);
      grad.addColorStop(0, colorStr(c.h, c.s, c.l, alpha));
      grad.addColorStop(1, colorStr(c.h, c.s, c.l, 0));
      ctx.beginPath();
      ctx.arc(p.x, p.y, glow, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }
}

/* ============================================================
   MODO 2: CURVAS DE LISSAJOUS
   ============================================================ */
class LissajousMode {
  constructor(word, canvas, palette) {
    this.name = 'Curvas de Lissajous';
    this.word = word;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.palette = palette;
    this.rng = new SeededRandom(hashWord(word) * 0xFFFFFFFF);
    this.t = 0;

    // Frecuencias derivadas de las letras
    this.curves = [];
    const primes = [2,3,5,7,11,13,17,19,23,29];
    for (let i = 0; i < Math.min(word.length, 8); i++) {
      const code = word.charCodeAt(i);
      this.curves.push({
        fx: primes[code % primes.length],
        fy: primes[(code * 3 + 2) % primes.length],
        delta: (code * 0.1) % (Math.PI * 2),
        amp: 0.3 + this.rng.range(0, 0.1),
        speed: 0.3 + this.rng.range(0, 0.5),
        ci: i % palette.length,
        trail: [],
        trailLen: 300 + this.rng.int(0, 200),
        lineWidth: 1 + this.rng.range(0, 1.5),
      });
    }
    this.history = [];
  }

  update() {
    this.t += 0.008;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const scale = Math.min(W, H) * 0.42;

    for (const c of this.curves) {
      const x = cx + Math.sin(c.fx * this.t * c.speed + c.delta) * scale * c.amp;
      const y = cy + Math.sin(c.fy * this.t * c.speed) * scale * c.amp;
      c.trail.push({ x, y });
      if (c.trail.length > c.trailLen) c.trail.shift();
    }
  }

  draw() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, 0, W, H);

    for (const c of this.curves) {
      if (c.trail.length < 2) continue;
      const col = this.palette[c.ci];
      for (let i = 1; i < c.trail.length; i++) {
        const alpha = (i / c.trail.length) * 0.9;
        const hShift = (this.t * 20 + i * 0.5) % 360;
        ctx.beginPath();
        ctx.moveTo(c.trail[i-1].x, c.trail[i-1].y);
        ctx.lineTo(c.trail[i].x,   c.trail[i].y);
        ctx.strokeStyle = colorStr((col.h + hShift) % 360, col.s, col.l, alpha);
        ctx.lineWidth = c.lineWidth * alpha;
        ctx.stroke();
      }
    }
  }
}

/* ============================================================
   MODO 3: EPICICLOS DE FOURIER
   ============================================================ */
class FourierMode {
  constructor(word, canvas, palette) {
    this.name = 'Epiciclos de Fourier';
    this.word = word;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.palette = palette;
    this.rng = new SeededRandom(hashWord(word) * 0xFFFFFFFF);
    this.t = 0;

    // Generar coeficientes de Fourier basados en la palabra
    const N = Math.min(word.length * 3 + 8, 40);
    this.epicycles = [];
    for (let k = 1; k <= N; k++) {
      const ci = (k - 1) % word.length;
      const code = word.charCodeAt(ci % word.length);
      const radius = (1 / k) * 180 * (0.7 + (code % 5) * 0.1);
      this.epicycles.push({
        radius,
        freq: k * (1 + (code % 3) * 0.1),
        phase: (code * k * 0.37) % (Math.PI * 2),
        ci: ci % palette.length,
      });
    }
    this.trail = [];
    this.maxTrail = 600;
  }

  update() {
    this.t += 0.012;
  }

  draw() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(0, 0, W, H);

    let x = W / 2;
    let y = H / 2;

    for (let i = 0; i < this.epicycles.length; i++) {
      const ep = this.epicycles[i];
      const angle = ep.freq * this.t + ep.phase;
      const nx = x + ep.radius * Math.cos(angle);
      const ny = y + ep.radius * Math.sin(angle);

      // Dibujar círculo del epiciclo (sutil)
      const col = this.palette[ep.ci];
      ctx.beginPath();
      ctx.arc(x, y, ep.radius, 0, Math.PI * 2);
      ctx.strokeStyle = colorStr(col.h, col.s, col.l, 0.08);
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Dibujar radio
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(nx, ny);
      ctx.strokeStyle = colorStr(col.h, col.s, col.l, 0.3);
      ctx.lineWidth = 1;
      ctx.stroke();

      x = nx;
      y = ny;
    }

    // Trazar punto final
    this.trail.push({ x, y, t: this.t });
    if (this.trail.length > this.maxTrail) this.trail.shift();

    // Dibujar trazo
    if (this.trail.length > 1) {
      for (let i = 1; i < this.trail.length; i++) {
        const alpha = (i / this.trail.length);
        const hue = (this.palette[0].h + i * 0.3) % 360;
        ctx.beginPath();
        ctx.moveTo(this.trail[i-1].x, this.trail[i-1].y);
        ctx.lineTo(this.trail[i].x,   this.trail[i].y);
        ctx.strokeStyle = colorStr(hue, 90, 65, alpha * 0.9);
        ctx.lineWidth = 2 * alpha;
        ctx.stroke();
      }
    }

    // Punto brillante en el extremo
    const grad = ctx.createRadialGradient(x, y, 0, x, y, 8);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }
}

/* ============================================================
   MODO 4: CAMPO DE FLUJO (FLOW FIELD)
   ============================================================ */
class FlowFieldMode {
  constructor(word, canvas, palette) {
    this.name = 'Campo de Flujo';
    this.word = word;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.palette = palette;
    this.rng = new SeededRandom(hashWord(word) * 0xFFFFFFFF);
    this.noise = new ValueNoise(Math.floor(hashWord(word) * 0xFFFF));
    this.t = 0;

    const seed = hashWord(word);
    this.noiseScale = 0.003 + seed * 0.003;
    this.timeScale  = 0.0003 + (word.length * 0.00005);

    const N = Math.min(500 + word.length * 30, 1200);
    this.streamers = [];
    for (let i = 0; i < N; i++) {
      this.streamers.push(this._newStreamer());
    }
  }

  _newStreamer() {
    const ci = this.rng.int(0, this.palette.length - 1);
    return {
      x: this.rng.range(0, this.canvas.width),
      y: this.rng.range(0, this.canvas.height),
      vx: 0, vy: 0,
      life: this.rng.range(0, 1),
      maxLife: this.rng.range(100, 300),
      ci,
      width: this.rng.range(0.5, 2.5),
    };
  }

  update() {
    this.t += 1;
    const W = this.canvas.width;
    const H = this.canvas.height;

    for (const s of this.streamers) {
      const nx = s.x * this.noiseScale;
      const ny = s.y * this.noiseScale;
      const n  = this.noise.fbm(nx, ny + this.t * this.timeScale, 4);
      const angle = n * Math.PI * 4;

      s.vx = s.vx * 0.9 + Math.cos(angle) * 2;
      s.vy = s.vy * 0.9 + Math.sin(angle) * 2;

      const prevX = s.x;
      const prevY = s.y;
      s.x += s.vx;
      s.y += s.vy;
      s.life++;

      const alpha = Math.sin((s.life / s.maxLife) * Math.PI) * 0.6;
      const c = this.palette[s.ci];
      const hShift = (n * 60 + this.t * 0.1) % 360;

      this.ctx.beginPath();
      this.ctx.moveTo(prevX, prevY);
      this.ctx.lineTo(s.x, s.y);
      this.ctx.strokeStyle = colorStr((c.h + hShift + 360) % 360, c.s, c.l, alpha);
      this.ctx.lineWidth = s.width;
      this.ctx.stroke();

      if (s.life > s.maxLife || s.x < 0 || s.x > W || s.y < 0 || s.y > H) {
        Object.assign(s, this._newStreamer());
      }
    }
  }

  draw() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.fillStyle = 'rgba(0,0,0,0.04)';
    ctx.fillRect(0, 0, W, H);
  }
}

/* ============================================================
   MODO 5: MANDELBROT DINÁMICO
   ============================================================ */
class MandelbrotMode {
  constructor(word, canvas, palette) {
    this.name = 'Conjunto de Mandelbrot';
    this.word = word;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.palette = palette;
    this.rng = new SeededRandom(hashWord(word) * 0xFFFFFFFF);
    this.t = 0;

    const seed = hashWord(word);
    // Zoom target derivado de la palabra
    this.targetRe = -0.7 + (seed - 0.5) * 0.6;
    this.targetIm = (hashWord(word + word) - 0.5) * 0.4;
    this.zoom = 1;
    this.maxZoom = 800;
    this.maxIter = 80;
    this.imageData = null;
    this.needsRedraw = true;
    this.zoomSpeed = 1.008 + word.length * 0.001;
    this.colorOffset = 0;
  }

  update() {
    this.t += 1;
    this.zoom *= this.zoomSpeed;
    if (this.zoom > this.maxZoom) this.zoom = 1;
    this.colorOffset = (this.colorOffset + 0.5) % 360;
    this.needsRedraw = true;
  }

  draw() {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;

    if (!this.needsRedraw) return;
    this.needsRedraw = false;

    const imgData = ctx.createImageData(W, H);
    const data = imgData.data;

    const scale = 3.5 / (this.zoom * Math.min(W, H));
    const re0 = this.targetRe - W / 2 * scale;
    const im0 = this.targetIm - H / 2 * scale;

    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const c_re = re0 + px * scale;
        const c_im = im0 + py * scale;

        let zr = 0, zi = 0;
        let iter = 0;
        while (zr*zr + zi*zi <= 4 && iter < this.maxIter) {
          const tmp = zr*zr - zi*zi + c_re;
          zi = 2 * zr * zi + c_im;
          zr = tmp;
          iter++;
        }

        const idx = (py * W + px) * 4;
        if (iter === this.maxIter) {
          data[idx] = 0; data[idx+1] = 0; data[idx+2] = 0; data[idx+3] = 255;
        } else {
          const smooth = iter + 1 - Math.log2(Math.log2(zr*zr + zi*zi));
          const t = smooth / this.maxIter;
          const hue = (this.palette[0].h + t * 280 + this.colorOffset) % 360;
          const [r,g,b] = hslToRgb(hue, 85, 40 + t * 40);
          data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 255;
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }
}

/* ============================================================
   MODO 6: REACCIÓN-DIFUSIÓN (Gray-Scott)
   ============================================================ */
class ReactionDiffusionMode {
  constructor(word, canvas, palette) {
    this.name = 'Reacción-Difusión';
    this.word = word;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.palette = palette;
    this.rng = new SeededRandom(hashWord(word) * 0xFFFFFFFF);
    this.t = 0;
    this.colorOffset = 0;

    // Usar resolución reducida para rendimiento
    this.W = 200;
    this.H = 150;

    const seed = hashWord(word);
    // Parámetros Gray-Scott derivados de la palabra
    // f (feed rate), k (kill rate) – diferentes patrones según la palabra
    const presets = [
      { f: 0.055, k: 0.062 }, // manchas
      { f: 0.037, k: 0.060 }, // laberinto
      { f: 0.025, k: 0.050 }, // burbujas
      { f: 0.035, k: 0.065 }, // mitosis
      { f: 0.012, k: 0.050 }, // ondas espirales
    ];
    const pi = Math.floor(seed * presets.length) % presets.length;
    this.f = presets[pi].f;
    this.k = presets[pi].k;
    this.dA = 1.0;
    this.dB = 0.5;

    const size = this.W * this.H;
    this.A = new Float32Array(size).fill(1);
    this.B = new Float32Array(size).fill(0);
    this.Anext = new Float32Array(size);
    this.Bnext = new Float32Array(size);

    // Sembrar con patrón basado en la palabra
    const cx = Math.floor(this.W / 2);
    const cy = Math.floor(this.H / 2);
    const patchR = 10;
    for (let dy = -patchR; dy <= patchR; dy++) {
      for (let dx = -patchR; dx <= patchR; dx++) {
        const px = cx + dx;
        const py = cy + dy;
        if (px >= 0 && px < this.W && py >= 0 && py < this.H) {
          const i = py * this.W + px;
          this.B[i] = 1;
        }
      }
    }
    // Más semillas para cada letra
    for (let li = 0; li < word.length; li++) {
      const angle = (li / word.length) * Math.PI * 2;
      const r = 30;
      const sx = Math.floor(cx + Math.cos(angle) * r);
      const sy = Math.floor(cy + Math.sin(angle) * r);
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const px = sx + dx;
          const py = sy + dy;
          if (px >= 0 && px < this.W && py >= 0 && py < this.H) {
            this.B[py * this.W + px] = 0.9;
          }
        }
      }
    }
  }

  step() {
    const W = this.W, H = this.H;
    const A = this.A, B = this.B;
    const An = this.Anext, Bn = this.Bnext;
    const f = this.f, k = this.k;
    const dA = this.dA, dB = this.dB;
    const dt = 1.0;

    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        const lA = A[i-1] + A[i+1] + A[i-W] + A[i+W] - 4*A[i];
        const lB = B[i-1] + B[i+1] + B[i-W] + B[i+W] - 4*B[i];
        const abb = A[i] * B[i] * B[i];
        An[i] = A[i] + (dA * lA - abb + f * (1 - A[i])) * dt;
        Bn[i] = B[i] + (dB * lB + abb - (k + f) * B[i]) * dt;
        An[i] = Math.max(0, Math.min(1, An[i]));
        Bn[i] = Math.max(0, Math.min(1, Bn[i]));
      }
    }
    // Swap buffers
    this.A = An;  this.Anext = A;
    this.B = Bn;  this.Bnext = B;
  }

  update() {
    this.t++;
    this.colorOffset = (this.colorOffset + 0.4) % 360;
    // Varios pasos por frame
    for (let i = 0; i < 8; i++) this.step();
  }

  draw() {
    const ctx = this.ctx;
    const CW = this.canvas.width;
    const CH = this.canvas.height;
    const W = this.W, H = this.H;

    const imgData = ctx.createImageData(W, H);
    const data = imgData.data;
    const c0 = this.palette[0];
    const c1 = this.palette[1 % this.palette.length];

    for (let i = 0; i < W * H; i++) {
      const v = this.B[i];
      const hue = (c0.h + v * (c1.h - c0.h + 120) + this.colorOffset) % 360;
      const [r,g,b] = hslToRgb(hue, 85, 20 + v * 50);
      data[i*4]   = r;
      data[i*4+1] = g;
      data[i*4+2] = b;
      data[i*4+3] = 255;
    }

    // Crear canvas temporal para escalar
    const tmp = document.createElement('canvas');
    tmp.width = W; tmp.height = H;
    tmp.getContext('2d').putImageData(imgData, 0, 0);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(tmp, 0, 0, CW, CH);
  }
}

/* ============================================================
   EXPORTACIONES
   ============================================================ */
window.AnimationModes = [
  ParticleMode,
  LissajousMode,
  FourierMode,
  FlowFieldMode,
  MandelbrotMode,
  ReactionDiffusionMode,
];

window.buildPalette   = buildPalette;
window.hashWord       = hashWord;
window.SeededRandom   = SeededRandom;
