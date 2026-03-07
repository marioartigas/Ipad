/**
 * app.js — Controlador principal de la aplicación
 * Gestiona la UI, el ciclo de animación y las interacciones táctiles
 */

'use strict';

/* ============================================================
   ESTADO GLOBAL
   ============================================================ */
const App = {
  currentMode: null,
  modeIndex: 0,
  animFrameId: null,
  paused: false,
  word: '',
  palette: [],
  canvas: null,
  ctx: null,
  lastPinchDist: null,
};

/* ============================================================
   INICIALIZACIÓN
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  App.canvas = document.getElementById('main-canvas');
  App.ctx    = App.canvas.getContext('2d');

  setupCanvas();
  setupInputScreen();
  setupAnimationControls();
  setupTouchGestures();

  window.addEventListener('resize', () => {
    setupCanvas();
    if (App.currentMode) {
      App.currentMode.canvas = App.canvas;
      App.currentMode.ctx    = App.ctx;
    }
  });

  // Orientación en iPad
  window.addEventListener('orientationchange', () => {
    setTimeout(setupCanvas, 300);
  });
});

/* ============================================================
   CANVAS
   ============================================================ */
function setupCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const W   = window.innerWidth;
  const H   = window.innerHeight;
  App.canvas.width  = W * dpr;
  App.canvas.height = H * dpr;
  App.canvas.style.width  = W + 'px';
  App.canvas.style.height = H + 'px';
  App.ctx.scale(dpr, dpr);

  // Limpiar canvas
  App.ctx.fillStyle = '#000';
  App.ctx.fillRect(0, 0, App.canvas.width, App.canvas.height);
}

/* ============================================================
   PANTALLA DE ENTRADA
   ============================================================ */
function setupInputScreen() {
  const input      = document.getElementById('word-input');
  const btn        = document.getElementById('generate-btn');
  const charCount  = document.getElementById('char-count');
  const exampleBtns = document.querySelectorAll('.example-btn');

  input.addEventListener('input', () => {
    const val = input.value.trim();
    charCount.textContent = val.length;
    btn.disabled = val.length === 0;
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim().length > 0) {
      startAnimation(input.value.trim());
    }
  });

  btn.addEventListener('click', () => {
    const val = input.value.trim();
    if (val.length > 0) startAnimation(val);
  });

  exampleBtns.forEach(b => {
    b.addEventListener('click', () => {
      const w = b.dataset.word;
      input.value = w;
      charCount.textContent = w.length;
      btn.disabled = false;
      startAnimation(w);
    });
  });
}

/* ============================================================
   CONTROLES DE ANIMACIÓN
   ============================================================ */
function setupAnimationControls() {
  document.getElementById('back-btn').addEventListener('click', () => {
    stopAnimation();
    switchScreen('input-screen');
    // Limpiar input para nueva palabra
    document.getElementById('word-input').focus();
  });

  document.getElementById('cycle-btn').addEventListener('click', () => {
    App.modeIndex = (App.modeIndex + 1) % window.AnimationModes.length;
    loadMode(App.word, App.modeIndex);
  });

  document.getElementById('pause-btn').addEventListener('click', () => {
    App.paused = !App.paused;
    const btn = document.getElementById('pause-btn');
    btn.textContent = App.paused ? '▶ Reanudar' : '⏸ Pausar';
    if (!App.paused) loop();
  });
}

/* ============================================================
   GESTOS TÁCTILES (iPad)
   ============================================================ */
function setupTouchGestures() {
  const animScreen = document.getElementById('animation-screen');
  let touchStart = null;
  let touchTimer = null;

  // Swipe horizontal → cambiar modo
  animScreen.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
    }
    // Pinch = salir
    if (e.touches.length === 2) {
      App.lastPinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }, { passive: true });

  animScreen.addEventListener('touchend', (e) => {
    if (!touchStart || e.touches.length > 0) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    const dt = Date.now() - touchStart.t;

    if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 400) {
      // Swipe izquierda → siguiente modo
      // Swipe derecha → modo anterior
      const dir = dx < 0 ? 1 : -1;
      App.modeIndex = ((App.modeIndex + dir) + window.AnimationModes.length) % window.AnimationModes.length;
      loadMode(App.word, App.modeIndex);
      showHint(dx < 0 ? '→ Siguiente modo' : '← Modo anterior');
    }

    // Double tap → pause
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
      if (touchTimer) {
        clearTimeout(touchTimer);
        touchTimer = null;
        App.paused = !App.paused;
        const btn = document.getElementById('pause-btn');
        btn.textContent = App.paused ? '▶ Reanudar' : '⏸ Pausar';
        if (!App.paused) loop();
        showHint(App.paused ? 'Pausado' : 'Reanudado');
      } else {
        touchTimer = setTimeout(() => { touchTimer = null; }, 300);
      }
    }

    touchStart = null;
  }, { passive: true });

  animScreen.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (App.lastPinchDist && dist < App.lastPinchDist * 0.6) {
        // Pinch in → volver
        stopAnimation();
        switchScreen('input-screen');
      }
      App.lastPinchDist = dist;
    }
  }, { passive: true });
}

/* ============================================================
   ANIMACIÓN
   ============================================================ */
function startAnimation(word) {
  App.word     = word.toLowerCase();
  App.paused   = false;
  App.modeIndex = 0;

  // Elegir modo inicial según hash de la palabra
  const seed = window.hashWord(App.word);
  App.modeIndex = Math.floor(seed * window.AnimationModes.length);

  // Actualizar UI
  document.getElementById('word-display').textContent = word;
  document.getElementById('pause-btn').textContent = '⏸ Pausar';

  // Colorear el texto de la palabra según la paleta
  App.palette = window.buildPalette(App.word);
  const c0 = App.palette[0];
  const c1 = App.palette[1] || App.palette[0];
  const wordDisplay = document.getElementById('word-display');
  wordDisplay.style.color = `hsl(${c0.h},${c0.s}%,${c0.l}%)`;

  switchScreen('animation-screen');

  // Limpiar canvas y empezar
  setupCanvas();
  loadMode(App.word, App.modeIndex);
}

function loadMode(word, modeIndex) {
  stopAnimation();

  // Limpiar canvas
  App.ctx.fillStyle = '#000';
  App.ctx.fillRect(0, 0, App.canvas.width, App.canvas.height);

  const ModeClass = window.AnimationModes[modeIndex];
  App.palette     = window.buildPalette(word);
  App.currentMode = new ModeClass(word, App.canvas, App.palette);

  // Mostrar nombre del modo
  document.getElementById('algo-info').textContent =
    `Modo ${modeIndex + 1}/${window.AnimationModes.length}: ${App.currentMode.name}  •  Swipe para cambiar`;

  // Reiniciar bucle
  App.paused = false;
  loop();
}

function loop() {
  if (App.paused) return;
  if (!App.currentMode) return;

  App.currentMode.update();
  App.currentMode.draw();

  App.animFrameId = requestAnimationFrame(loop);
}

function stopAnimation() {
  if (App.animFrameId) {
    cancelAnimationFrame(App.animFrameId);
    App.animFrameId = null;
  }
}

/* ============================================================
   NAVEGACIÓN DE PANTALLAS
   ============================================================ */
function switchScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

/* ============================================================
   HINT TOAST
   ============================================================ */
function showHint(msg) {
  let hint = document.getElementById('hint-toast');
  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'hint-toast';
    hint.style.cssText = `
      position: fixed;
      bottom: 120px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.7);
      color: rgba(255,255,255,0.9);
      padding: 10px 24px;
      border-radius: 50px;
      font-size: 15px;
      font-weight: 600;
      backdrop-filter: blur(10px);
      pointer-events: none;
      z-index: 1000;
      transition: opacity 0.4s ease;
    `;
    document.body.appendChild(hint);
  }
  hint.textContent = msg;
  hint.style.opacity = '1';
  clearTimeout(hint._timer);
  hint._timer = setTimeout(() => { hint.style.opacity = '0'; }, 1500);
}
