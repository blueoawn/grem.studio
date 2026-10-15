// FFT background canvas - runs standalone on margins
const canvas = document.getElementById('c');
if (!canvas) throw new Error('Canvas #c not found');
const ctx = canvas.getContext('2d');

// Get adaptive settings from performance detection (fallback to defaults)
const perfSettings = window.PerfSettings?.settings || { waveSamples: 600, particleCount: 300, targetFps: 30 };
const frameLimiter = window.PerfSettings?.createFrameLimiter(perfSettings.targetFps) || (() => true);

// Adaptive sample and particle counts
const SAMPLES = perfSettings.waveSamples;
const PARTICLE_COUNT = perfSettings.particleCount;

// Optional controls, only for the demo page
const noiseSlider = document.getElementById('noise');
const harmSlider = document.getElementById('harmonics');
const speedSlider = document.getElementById('speed');
const resetBtn = document.getElementById('reset');

// Defaults if sliders not present
let harmonics = harmSlider ? parseInt(harmSlider.value) : 8;
let noiseTarget = noiseSlider ? parseFloat(noiseSlider.value) : 0.7;
let transSpeed = (speedSlider ? parseFloat(speedSlider.value) : 0.3) * 3;

// Setup optional event listeners
if (harmSlider) harmSlider.oninput = () => { harmonics = parseInt(harmSlider.value); regenerate(); };
if (noiseSlider) noiseSlider.oninput = () => { noiseTarget = parseFloat(noiseSlider.value); };
if (speedSlider) speedSlider.oninput = () => { transSpeed = parseFloat(speedSlider.value) * 3; };
if (resetBtn) resetBtn.onclick = () => { regenerate(); };

let W = 0, H = 0, DPR = Math.max(1, window.devicePixelRatio || 1);
function resize() {
  W = Math.floor(innerWidth * DPR);
  H = Math.floor(innerHeight * DPR);
  canvas.width = W;
  canvas.height = H;
  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;
}
// Gradient cache (rebuilt on resize)
let cachedGradients = null;
function buildGradients() {
  cachedGradients = {
    waveA: ctx.createLinearGradient(0, 0, W, 0),
    waveB: ctx.createLinearGradient(0, 0, 0, H),
    waveC: ctx.createLinearGradient(0, 0, W, H),
    waveD: ctx.createLinearGradient(0, 0, W, 0)
  };
  // Wave A gradient
  cachedGradients.waveA.addColorStop(0, 'rgba(167, 14, 238, 0.3)');
  cachedGradients.waveA.addColorStop(0.5, 'rgba(23, 143, 255, 0.7)');
  cachedGradients.waveA.addColorStop(1, 'rgba(51, 34, 77, 0.4)');
  // Wave B gradient
  cachedGradients.waveB.addColorStop(0, 'rgba(255, 176, 58, 0.25)');
  cachedGradients.waveB.addColorStop(0.5, 'rgba(255, 99, 102, 0.55)');
  cachedGradients.waveB.addColorStop(1, 'rgba(176, 61, 255, 0.35)');
  // Wave C gradient
  cachedGradients.waveC.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
  cachedGradients.waveC.addColorStop(0.5, 'rgba(45, 212, 191, 0.6)');
  cachedGradients.waveC.addColorStop(1, 'rgba(20, 184, 166, 0.3)');
  // Wave D gradient
  cachedGradients.waveD.addColorStop(0, 'rgba(99, 102, 241, 0.35)');
  cachedGradients.waveD.addColorStop(0.5, 'rgba(168, 85, 247, 0.55)');
  cachedGradients.waveD.addColorStop(1, 'rgba(59, 130, 246, 0.35)');
}

addEventListener('resize', () => {
  resize();
  buildGradients(); // Rebuild gradients on resize
});
resize();
buildGradients(); // Initial gradient build

let phases = [];
let targetAmps = [];
let currentAmps = [];
let baseAmps = [];

// Use adaptive particle count
const px = new Float32Array(PARTICLE_COUNT);
const py = new Float32Array(PARTICLE_COUNT);
for (let i = 0; i < PARTICLE_COUNT; i++) px[i] = i / (PARTICLE_COUNT - 1);

function lerp(a, b, t) { return a + (b - a) * t; }

function regenerate() {
  phases = new Array(harmonics);
  targetAmps = new Array(harmonics);
  currentAmps = new Array(harmonics);
  baseAmps = new Array(harmonics);
  for (let k = 0; k < harmonics; k++) {
    phases[k] = Math.random() * Math.PI * 2;
    const falloff = 1 / (1 + k * 0.13);
    const randomness = Math.pow(Math.random(), 1.6);
    targetAmps[k] = randomness * falloff;
    baseAmps[k] = 0;
    currentAmps[k] = baseAmps[k];
  }
}
regenerate();

let t = 0;
let last = performance.now();

function draw(now) {
  // Frame rate limiting for 30fps
  if (!frameLimiter(now)) {
    requestAnimationFrame(draw);
    return;
  }

  const dt = Math.min(40, now - last) / 1000;
  last = now;
  t += dt * transSpeed;

  // Clear canvas to transparent so the parallax grid shows through
  ctx.clearRect(0, 0, W, H);

  const cy = H / 2;
  const amplitude = Math.min(H, 420 * DPR);

  const growth = Math.sin(1, (Math.sin(t) * 0.5 + 0.5) + (1 - Math.exp(-t * 0.08)));
  for (let k = 0; k < harmonics; k++) {
    const desired = targetAmps[k] * noiseTarget * growth;
    currentAmps[k] = lerp(currentAmps[k], desired, Math.min(1, dt * 1.5));
  }

  // Use adaptive sample count
  const samples = SAMPLES;

  // Wave A (original style)
  ctx.lineWidth = 1.5 * DPR;
  ctx.beginPath();
  for (let i = 0; i <= samples; i++) {
    const x = (i / samples) * W;
    let yOff = 0;
    const space = x / W;
    for (let k = 0; k < harmonics; k++) {
      const freq = (k + 1);
      yOff += currentAmps[k] * Math.sin((space * freq * Math.PI * 2) + phases[k] + t * 0.6 * (0.3 + k * 0.01));
    }
    const edgeEnv = Math.pow(Math.cos((i / samples - 0.5) * Math.PI), 2);
    const y = cy + yOff * amplitude * 0.6 * edgeEnv;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = cachedGradients.waveA;
  ctx.stroke();

  // Wave B (saw-like blend, warm gradient)
  ctx.lineWidth = 1.2 * DPR;
  ctx.beginPath();
  for (let i = 0; i <= samples; i++) {
    const x = (i / samples) * W;
    const space = x / W;
    let yOff = 0;
    for (let k = 0; k < harmonics; k++) {
      const freq = (k + 1) * 1.2;
      // mix sine with a sharper profile
      const s = Math.sin((space * freq * Math.PI * 2) + phases[k] * 0.9 + t * 0.7 * (0.25 + k * 0.015));
      const sharp = Math.sign(s) * Math.pow(Math.abs(s), 0.6);
      yOff += currentAmps[k] * (0.6 * s + 0.4 * sharp);
    }
    const edgeEnv = Math.pow(Math.cos((i / samples - 0.5) * Math.PI), 2);
    const y = cy + yOff * amplitude * 0.48 * edgeEnv;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = cachedGradients.waveB;
  ctx.stroke();

  // Wave C (noise-modulated, emerald/teal)
  ctx.setLineDash([6 * DPR, 6 * DPR]);
  ctx.lineWidth = 1.8 * DPR;
  ctx.beginPath();
  for (let i = 0; i <= samples; i++) {
    const x = (i / samples) * W;
    const space = x / W;
    let yOff = 0;
    for (let k = 0; k < harmonics; k++) {
      const freq = (k + 1) * 0.9;
      const base = Math.sin((space * freq * Math.PI * 2) + phases[k] + t * 0.5 * (0.35 + k * 0.02));
      const mod = Math.sin(t * 0.8 + k * 1.7) * 0.4 + 0.6;
      yOff += currentAmps[k] * base * mod;
    }
    const y = cy + yOff * amplitude * 0.52;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = cachedGradients.waveC;
  ctx.stroke();
  ctx.setLineDash([]);

  // Wave D (thin overlay, violet/indigo)
  ctx.lineWidth = 0.9 * DPR;
  ctx.beginPath();
  for (let i = 0; i <= samples; i++) {
    const x = (i / samples) * W;
    const space = x / W;
    let yOff = 0;
    for (let k = 0; k < harmonics; k++) {
      const freq = (k + 1) * (1.5 + 0.02 * k);
      yOff += currentAmps[k] * Math.sin((space * freq * Math.PI * 2) + phases[k] * 1.15 + t * 0.85 * (0.22 + k * 0.01));
    }
    const y = cy + yOff * amplitude * 0.38;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = cachedGradients.waveD;
  ctx.stroke();

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const norm = px[i];
    let yOff = 0;
    for (let k = 0; k < harmonics; k++) {
      const freq = (k + 1);
      yOff += currentAmps[k] * Math.sin((norm * freq * Math.PI * 2) + phases[k] + t * 0.6 * (0.2 + k * 0.008));
    }
    const jitter = Math.sin(t * 1.2 + i * 0.07) * 0.6 * (1 - (i / PARTICLE_COUNT));
    const xx = norm * W;
    const yy = cy + (yOff * amplitude * 0.62) + jitter * 8 * DPR;
    const localAmp = Math.abs(yOff);
    const size = (2 + localAmp * 6) * DPR;
    ctx.beginPath();
    ctx.fillStyle = `rgba(110,231,183,${0.05 + localAmp * 0.5})`;
    ctx.arc(xx, yy, size * 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = `rgba(255,255,255,${0.6 + localAmp * 0.4})`;
    ctx.arc(xx, yy, size, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let k = 0; k < harmonics; k++) phases[k] += 0.0008 + 0.0012 * Math.sin(t * 0.2 + k);

  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
