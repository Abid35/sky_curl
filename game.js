/* Roadster Loop - plain JS + three.js r128. World unit = 1 ft.
   Speeds and gravity share one arcade scale (SPD) so the ramp, thrust and landing numbers stay playable:
   world speed = real mph * 1.4667 * SPD, gravity = 32.2 * SPD. */
(() => {
'use strict';
const $ = i => document.getElementById(i);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const TAU = Math.PI * 2, MPH = 1.4667;
const SPD = 0.5, GRAV = 32.2 * SPD, STEP = 1 / 120;
const R_PIPE = 22, WALL = 14, R_CURL = 9, CURL = 22 * Math.PI / 180;
const ROAD_D = 150, HH = 0.75;                       // run-up length, car centre height
const THRUST = 26, DRAIN = 0.28, RING_GAS = 0.35, ANG_ACC = 11, ANG_DAMP = 1.4;
const LAND_SINK = 39, LAND_TILT = 28 * Math.PI / 180, RING_R = 6.5;
const wrap = a => { a = ((a + Math.PI) % TAU + TAU) % TAU - Math.PI; return a; };
{ // WebGL check: show a friendly message instead of a blank screen
  let ok = false; try { const c = document.createElement('canvas'); ok = !!(c.getContext('webgl') || c.getContext('experimental-webgl')); } catch (e) { }
  if (!ok) { $('nogl').hidden = false; $('bStart').hidden = true; return; }
}

/* ---------- ramp path, parameterised by arc length ---------- */
const L1 = R_PIPE * Math.PI / 2, L2 = WALL, L3 = R_CURL * CURL, PL = L1 + L2 + L3;
function pt(s) {
  s = clamp(s, 0, PL);
  if (s <= L1) { const t = s / R_PIPE; return { x: R_PIPE * Math.sin(t), y: R_PIPE * (1 - Math.cos(t)), a: t }; }
  if (s <= L1 + L2) return { x: R_PIPE, y: R_PIPE + (s - L1), a: Math.PI / 2 };
  const t = (s - L1 - L2) / R_CURL;
  return { x: R_PIPE - R_CURL + R_CURL * Math.cos(t), y: R_PIPE + WALL + R_CURL * Math.sin(t), a: Math.PI / 2 + t };
}
const rhoAt = s => s <= L1 ? R_PIPE : s <= L1 + L2 ? Infinity : R_CURL;

/* ---------- three.js scene ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
$('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050813);
scene.fog = new THREE.Fog(0x050813, 180, 1100);
const cam = new THREE.PerspectiveCamera(50, 1, 0.5, 4000);
function resize() { renderer.setSize(innerWidth, innerHeight); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

scene.add(new THREE.HemisphereLight(0x7a93ff, 0x0a0a18, 0.75));
const moon = new THREE.DirectionalLight(0xaec6ff, 0.9); moon.position.set(-60, 120, 90); scene.add(moon);

const M4 = new THREE.Matrix4();
function inst(geo, mat, list) {
  const m = new THREE.InstancedMesh(geo, mat, list.length);
  list.forEach((p, i) => { M4.makeTranslation(p[0], p[1], p[2]); m.setMatrixAt(i, M4); });
  m.frustumCulled = false; scene.add(m); return m;
}
const basic = c => new THREE.MeshBasicMaterial({ color: c });

// ground, road, markings
const base = new THREE.Mesh(new THREE.PlaneGeometry(4000, 1200), new THREE.MeshStandardMaterial({ color: 0x07091a, roughness: 1 }));
base.rotation.x = -Math.PI / 2; base.position.set(-500, -0.15, 0); scene.add(base);
const road = new THREE.Mesh(new THREE.PlaneGeometry(1100, 40), new THREE.MeshStandardMaterial({ color: 0x151826, roughness: 0.35, metalness: 0.3 }));
road.rotation.x = -Math.PI / 2; road.position.set(-450, 0, 0); scene.add(road);
inst(new THREE.BoxGeometry(8, 0.05, 0.5), basic(0xdfe8ff), Array.from({ length: 46 }, (_, i) => [-900 + i * 20, 0.04, 0]));
[[-17.5, 0x35e6ff], [17.5, 0xff4fd8]].forEach(([z, c]) => { const e = new THREE.Mesh(new THREE.BoxGeometry(1100, 0.08, 0.35), basic(c)); e.position.set(-450, 0.05, z); scene.add(e); });
// distance marks on the landing strip
for (let x = -100; x > -800; x -= 100) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 34), basic(0x2a3a70)); b.position.set(x, 0.05, 0); scene.add(b); }
// lamps
const lampPos = [], headPos = [];
for (let x = -900; x <= 60; x += 40) [-21, 21].forEach(z => { lampPos.push([x, 7, z]); headPos.push([x, 14.2, z]); });
inst(new THREE.CylinderGeometry(0.25, 0.3, 14, 6), basic(0x1c2340), lampPos);
inst(new THREE.SphereGeometry(0.9, 8, 6), basic(0xffe2a8), headPos);
// skyline + lit windows
const win = [];
for (let x = -1000; x < 260; x += 34) {
  const w = 18 + Math.random() * 20, h = 40 + Math.random() * 130, z = -75 - Math.random() * 70;
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 22), new THREE.MeshStandardMaterial({ color: 0x0b1030 + ((Math.random() * 12) | 0) * 0x010102, roughness: 0.8 }));
  b.position.set(x + Math.random() * 10, h / 2, z); scene.add(b);
  for (let r = 0; r < h / 7 - 1; r++) for (let c = 0; c < w / 5 - 1; c++)
    if (Math.random() < 0.33) win.push([b.position.x - w / 2 + 4 + c * 5, 5 + r * 7, z + 11.1]);
}
inst(new THREE.PlaneGeometry(1.8, 2.6), basic(0xffd98a), win);
// stars + moon
const sg = new THREE.BufferGeometry(), sp = [];
for (let i = 0; i < 500; i++) { const a = Math.random() * TAU, e = 0.12 + Math.random() * 1.2, r = 1800; sp.push(Math.cos(a) * r * Math.cos(e) * 0.9, Math.sin(e) * r * 0.5 + 60, -r * 0.6 - Math.random() * 400); }
sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false })); scene.add(stars);
const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(40, 20, 14), new THREE.MeshBasicMaterial({ color: 0xdfe8ff, fog: false })); moonMesh.position.set(-300, 500, -1500); scene.add(moonMesh);

// ramp: solid profile extruded across the road, neon trim along both edges
{
  const sh = new THREE.Shape(); sh.moveTo(0, 0);
  for (let s = 0; s <= PL; s += 0.5) { const p = pt(s); sh.lineTo(p.x, p.y); }
  const e = pt(PL); sh.lineTo(e.x, e.y); sh.lineTo(e.x + 6, e.y); sh.lineTo(e.x + 6, 0); sh.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 18, bevelEnabled: false }); g.translate(0, 0, -9);
  scene.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x1b2340, roughness: 0.45, metalness: 0.5 })));
  [-9.05, 9.05].forEach(z => {
    const pts = []; for (let s = 0; s <= PL; s += 1) { const p = pt(s); pts.push(new THREE.Vector3(p.x, p.y, z)); }
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 0.2, 6), basic(0x35e6ff)));
  });
}

/* ---------- original car: "Arc Roadster" ---------- */
const bodyMat = new THREE.MeshStandardMaterial({ color: 0xcfd8ea, metalness: 0.7, roughness: 0.22 });
const carGroup = new THREE.Group(), plumes = [];
{
  const sh = new THREE.Shape(); sh.moveTo(-7, -0.45); sh.lineTo(7, -0.45);
  sh.quadraticCurveTo(7.5, -0.3, 7.3, 0.1); sh.quadraticCurveTo(5.6, 0.4, 3.6, 0.7);
  sh.quadraticCurveTo(2.2, 1.1, 1.2, 1.5); sh.quadraticCurveTo(0, 1.8, -1.4, 1.6);
  sh.quadraticCurveTo(-3.6, 1.2, -4.4, 0.8); sh.quadraticCurveTo(-6.4, 0.7, -7.1, 0.2); sh.lineTo(-7, -0.45);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 5.2, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.3, bevelSegments: 3 });
  g.translate(0, 0, -2.6); carGroup.add(new THREE.Mesh(g, bodyMat));
  const gl = new THREE.Shape(); gl.moveTo(3.1, 0.74); gl.lineTo(1.2, 1.46); gl.quadraticCurveTo(0, 1.76, -1.4, 1.6); gl.lineTo(-4.1, 0.9); gl.lineTo(-3.4, 0.74); gl.lineTo(3.1, 0.74);
  const g2 = new THREE.ExtrudeGeometry(gl, { depth: 5.9, bevelEnabled: false }); g2.translate(0, 0, -2.95);
  carGroup.add(new THREE.Mesh(g2, new THREE.MeshStandardMaterial({ color: 0x08101f, metalness: 0.9, roughness: 0.08 })));
  const wm = new THREE.MeshStandardMaterial({ color: 0x0c0c12, roughness: 0.6 }), rm = basic(0x35e6ff);
  [[-4.5, 3], [-4.5, -3], [4.5, 3], [4.5, -3]].forEach(([x, z]) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.9, 20), wm); w.rotation.x = Math.PI / 2; w.position.set(x, 0.25, z); carGroup.add(w);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.95, 14), rm); r.rotation.x = Math.PI / 2; r.position.set(x, 0.25, z * 1.01); carGroup.add(r);
  });
  const hl = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.22, 5.6), basic(0xeaffff)); hl.position.set(7.35, 0.0, 0); carGroup.add(hl);
  const tl = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 6), basic(0xff2a3c)); tl.position.set(-7.4, 0.15, 0); carGroup.add(tl);
  const pg = new THREE.ConeGeometry(0.6, 5, 12); pg.rotateX(Math.PI); pg.translate(0, -2.5 - 0.45, 0);
  const pm = new THREE.MeshBasicMaterial({ color: 0x4aa8ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
  [[-5, 2.1], [-5, -2.1], [5, 2.1], [5, -2.1]].forEach(([x, z]) => {
    const port = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.2, 10), basic(0x1b2a55)); port.position.set(x, -0.5, z); carGroup.add(port);
    const p = new THREE.Mesh(pg, pm); p.position.set(x, 0, z); p.visible = false; carGroup.add(p); plumes.push(p);
  });
  const glow = new THREE.PointLight(0x35e6ff, 1.2, 40); glow.position.set(0, -2, 0); carGroup.add(glow);
  scene.add(carGroup);
}
const HULL = [[-6.8, -0.75], [6.8, -0.75], [-2, 1.6], [2, 1.6]];

/* ---------- audio ---------- */
let AC = null;
function audio() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } } if (AC && AC.state === 'suspended') AC.resume(); }
function beep(f, d, type, vol) {
  if (!AC) return;
  const o = AC.createOscillator(), g = AC.createGain(); o.type = type || 'sine'; o.frequency.value = f;
  g.gain.value = vol || 0.12; g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + d);
  o.connect(g); g.connect(AC.destination); o.start(); o.stop(AC.currentTime + d);
}
function boomSound() {
  if (!AC) return; const n = AC.sampleRate * 0.8, b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
  const s = AC.createBufferSource(), g = AC.createGain(); g.gain.value = 0.4; s.buffer = b; s.connect(g); g.connect(AC.destination); s.start();
}

/* ---------- game state ---------- */
let state = 'title';
const keys = { l: false, r: false, t: false }, touch = { l: false, r: false, t: false };
const car = { x: -ROAD_D, y: HH, vx: 0, vy: 0, v: 0, s: 0, th: 0, w: 0 };
let R = {}, cnt = {}, acc = 0, drvA = 0, gas = 1, rings = [], visited = new Set(), landedT = 0, crashT = 0, shake = 0, msgT = 0, lockUntil = 0;
const parts = []; let flash = null;
let bestCache = best();
const lamps = [...document.querySelectorAll('#lights em')];

function best() { try { return +localStorage.getItem('roadsterLoopBest') || 0; } catch (e) { return 0; } }
function saveBest(v) { try { localStorage.setItem('roadsterLoopBest', String(v)); } catch (e) { } }
function say(t, warn, secs) { const m = $('msg'); m.textContent = t; m.className = warn ? 'warn' : ''; msgT = secs || 0; }

function clearRun() {
  rings.forEach(r => scene.remove(r.mesh)); rings = [];
  parts.forEach(p => scene.remove(p.mesh)); parts.length = 0;
  if (flash) { scene.remove(flash); flash = null; }
}
function resetRun() {
  clearRun();
  R = { react: 0, mph: 0, vT: 0, rings: 0, flips: 0, maxAlt: 0, air: 0, peakG: 1, soft: 0, td: 0, crashed: false, reason: '' };
  Object.assign(car, { x: -ROAD_D, y: HH, vx: 0, vy: 0, v: 0, s: 0, th: 0, w: 0 });
  gas = 1; visited = new Set(); landedT = 0; crashT = 0; shake = 0; acc = 0;
  carGroup.visible = true; plumes.forEach(p => p.visible = false);
  cam.position.set(car.x + 10, 9, 80);
}
function startCount() {
  audio(); resetRun(); state = 'count';
  cnt = { t: 0, lit: 0, green: false, wait: 0, delay: 0.8 + Math.random() * 1.6, gAt: 0 };
  lockUntil = 0; lamps.forEach(l => l.className = '');
  $('title').hidden = true; $('results').hidden = true; $('hud').hidden = false; $('lights').hidden = false;
  say(document.body.classList.contains('touch') ? 'Tap on green' : 'Press Space on green'); $('hint').hidden = false;
}

/* ---------- input ---------- */
function press() {
  audio();
  if (state === 'title') { startCount(); return; }
  if (state === 'results') { if (performance.now() - resultsAt > 500) startCount(); return; }
  if (state !== 'count') return;
  const now = performance.now();
  if (now < lockUntil) return;                                   // 0.4 s input lock
  if (!cnt.green) {                                              // too early: never launches
    lockUntil = now + 400; beep(170, 0.3, 'square', 0.15); say('Too early, wait for green', true, 1.4); return;
  }
  launch((now - cnt.gAt) / 1000);
}
function launch(sec) {
  R.react = sec; R.mph = clamp(90 - 5 * sec, 76, 90); R.vT = R.mph * MPH * SPD;
  drvA = R.vT * R.vT / (2 * ROAD_D); car.v = 0; state = 'drive'; say('', false); beep(300, 0.15, 'sawtooth', 0.1);
}
addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (e.code === 'ArrowLeft') keys.l = true;
  if (e.code === 'ArrowRight') keys.r = true;
  if (e.code === 'Space') { keys.t = true; if (!e.repeat) press(); }
  if (e.code === 'Enter' && state === 'results' && performance.now() - resultsAt > 500) startCount();
});
addEventListener('keyup', e => {
  if (e.code === 'ArrowLeft') keys.l = false;
  if (e.code === 'ArrowRight') keys.r = false;
  if (e.code === 'Space') keys.t = false;
});
$('stage').addEventListener('pointerdown', press);
$('bStart').onclick = startCount;
let resultsAt = 0;
$('bAgain').onclick = startCount;
const hold = (id, k, tap) => { const b = $(id); const on = e => { e.preventDefault(); touch[k] = true; if (tap) press(); }, off = () => touch[k] = false;
  b.addEventListener('pointerdown', on); ['pointerup', 'pointerleave', 'pointercancel'].forEach(n => b.addEventListener(n, off)); };
hold('tL', 'l'); hold('tR', 'r'); hold('tT', 't', true);
if ('ontouchstart' in window || matchMedia('(pointer:coarse)').matches) document.body.classList.add('touch');
window.addEventListener('blur', () => { keys.l = keys.r = keys.t = false; });

/* ---------- physics (fixed 1/120 s) ---------- */
const peak = g => { if (g > R.peakG) R.peakG = g; };
function lowest() {
  const s = Math.sin(car.th), c = Math.cos(car.th); let m = 1e9;
  for (const [lx, ly] of HULL) m = Math.min(m, car.y + lx * s + ly * c); return m;
}
function placeRings() {
  const T = (car.vy + Math.sqrt(car.vy * car.vy + 2 * GRAV * car.y)) / GRAV;
  [0.1, 0.22, 0.35, 0.48, 0.6, 0.72, 0.84].forEach((f, i) => {
    const t = T * f, x = car.x + car.vx * t, y = car.y + car.vy * t - 0.5 * GRAV * t * t + f * 12;
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(5, 0.4, 10, 36), new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true }));
    mesh.position.set(x, Math.max(y, 8), 0); scene.add(mesh); rings.push({ mesh, got: false, t: 0 });
  });
}
function step() {
  const dt = STEP;
  if (state === 'drive') {
    car.v += drvA * dt; car.x += car.v * dt; car.y = HH; peak(Math.hypot(GRAV, drvA) / 32.2);
    if (car.x >= 0) { car.v = R.vT; car.s = 0; state = 'ramp'; $('lights').hidden = true; }
  } else if (state === 'ramp') {
    const p = pt(car.s), N = (isFinite(rhoAt(car.s)) ? car.v * car.v / rhoAt(car.s) : 0) + GRAV * Math.cos(p.a), aT = -GRAV * Math.sin(p.a);
    peak(Math.hypot(N, aT) / 32.2);
    car.v += aT * dt; car.s += car.v * dt;
    const q = pt(car.s); car.th = q.a;
    car.x = q.x - Math.sin(q.a) * HH; car.y = q.y + Math.cos(q.a) * HH;
    R.maxAlt = Math.max(R.maxAlt, car.y - HH);
    if (car.s >= PL) {                                           // leave the curl
      car.vx = car.v * Math.cos(q.a); car.vy = car.v * Math.sin(q.a); car.w = 0;
      visited.add(Math.floor((car.th - Math.PI) / TAU)); placeRings(); state = 'air';
    }
  } else if (state === 'air') {
    const th = car.th, ux = -Math.sin(th), uy = Math.cos(th);
    let ax = 0, ay = -GRAV;
    const thrusting = (keys.t || touch.t) && gas > 0;
    if (thrusting) { ax += ux * THRUST; ay += uy * THRUST; gas = Math.max(0, gas - DRAIN * dt); peak(THRUST / 32.2); }
    car.vx += ax * dt; car.vy += ay * dt; car.x += car.vx * dt; car.y += car.vy * dt;
    const inp = ((keys.l || touch.l) ? 1 : 0) - ((keys.r || touch.r) ? 1 : 0);
    car.w += inp * ANG_ACC * dt; car.w *= Math.exp(-ANG_DAMP * dt); car.w = clamp(car.w, -7, 7); car.th += car.w * dt;
    const idx = Math.floor((car.th - Math.PI) / TAU);            // each new upside-down pass = one flip
    if (!visited.has(idx)) { visited.add(idx); R.flips++; say('Flip x' + R.flips, false, 0.9); beep(660, 0.12, 'triangle'); }
    R.air += dt; R.maxAlt = Math.max(R.maxAlt, car.y - HH);
    for (const r of rings) if (!r.got && Math.hypot(r.mesh.position.x - car.x, r.mesh.position.y - car.y) < RING_R) {
      r.got = true; R.rings++; gas = Math.min(1, gas + RING_GAS); say('+500', false, 0.7); beep(990, 0.15, 'sine', 0.15);
    }
    plumes.forEach(p => { p.visible = thrusting; if (thrusting) p.scale.set(1, 0.8 + Math.random() * 0.5, 1); });
    const low = lowest();
    if (low <= 0) touchdown(low);
  } else if (state === 'landed') {
    landedT += dt;
    const tgt = Math.round(car.th / TAU) * TAU, k = Math.min(1, 10 * dt);
    car.th += (tgt - car.th) * k; car.y += (HH - car.y) * k;
    const sgn = Math.sign(car.vx); car.vx -= sgn * 30 * dt; if (Math.sign(car.vx) !== sgn) car.vx = 0;
    car.x += car.vx * dt;
    if ((Math.abs(car.vx) < 0.3 && landedT > 0.6) || landedT > 3.5) finish();
  }
}
function touchdown(low) {
  plumes.forEach(p => p.visible = false);
  const sink = Math.max(0, -car.vy), tilt = Math.abs(wrap(car.th));
  R.td = sink; peak(sink / 0.15 / 32.2);
  const ok = sink <= LAND_SINK && tilt <= LAND_TILT;
  if (ok) {
    car.y -= low; car.vy = 0; R.soft = 1000 + Math.round((LAND_SINK - sink) * 20);
    state = 'landed'; shake = 0.3; say('Stuck the landing', false, 0); beep(240, 0.2, 'triangle', 0.2);
  } else {
    R.crashed = true; R.reason = sink > LAND_SINK ? 'Too fast: ' + sink.toFixed(0) + ' ft/s' : 'Not upright: ' + (tilt * 180 / Math.PI).toFixed(0) + '\u00b0 off';
    explode(car.x, Math.max(car.y, 1)); state = 'crashed'; crashT = 0; say('Crash!', true, 0); boomSound();
  }
}
function explode(x, y) {
  carGroup.visible = false; shake = 1.4;
  for (let i = 0; i < 70; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.4 + Math.random() * 0.8, 6, 5), new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? 0xff7a1a : 0xffd23a, transparent: true }));
    const a = Math.random() * TAU, sp = 8 + Math.random() * 38;
    m.position.set(x, y, (Math.random() - 0.5) * 4); scene.add(m);
    parts.push({ mesh: m, vx: Math.cos(a) * sp, vy: Math.abs(Math.sin(a)) * sp + 6, vz: (Math.random() - 0.5) * 20, life: 0.6 + Math.random() * 0.9, max: 1.5, debris: false, rs: 0 });
  }
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.8 + Math.random() * 2, 0.4 + Math.random(), 0.8 + Math.random() * 1.6), bodyMat);
    const a = Math.random() * TAU, sp = 10 + Math.random() * 30;
    m.position.set(x, y, 0); scene.add(m);
    parts.push({ mesh: m, vx: Math.cos(a) * sp, vy: 8 + Math.random() * 30, vz: (Math.random() - 0.5) * 16, life: 3, max: 3, debris: true, rs: (Math.random() - 0.5) * 12 });
  }
  flash = new THREE.PointLight(0xff8a2a, 6, 160); flash.position.set(x, y + 4, 8); scene.add(flash);
}

/* ---------- results ---------- */
const calcScore = () => R.rings * 500 + R.flips * 1500 + Math.round(R.maxAlt * 10) + Math.round(R.air * 100) + R.soft;
function finish() {
  if (state === 'results') return;
  state = 'results'; resultsAt = performance.now();
  const sc = calcScore(), prev = best(), isBest = sc > prev; if (isBest) saveBest(sc);
  const g = R.crashed ? 'F' : sc >= 10000 ? 'S' : sc >= 7000 ? 'A' : sc >= 5000 ? 'B' : sc >= 3000 ? 'C' : 'D';
  $('rGrade').textContent = g; $('rGrade').classList.toggle('bad', R.crashed);
  $('rTitle').textContent = R.crashed ? 'Crashed. ' + R.reason : 'Clean landing';
  $('rScore').textContent = sc.toLocaleString(); $('rBadge').hidden = !isBest;
  $('rReact').textContent = R.react.toFixed(3) + ' s'; $('rRamp').textContent = R.mph.toFixed(1) + ' mph';
  $('rG').textContent = R.peakG.toFixed(1) + ' g'; $('rAlt').textContent = Math.round(R.maxAlt) + ' ft';
  $('rAir').textContent = R.air.toFixed(1) + ' s'; $('rFlips').textContent = R.flips; $('rRings').textContent = R.rings;
  $('rTd').textContent = R.td.toFixed(1) + ' ft/s'; bestCache = Math.max(prev, sc); $('tBest').textContent = bestCache.toLocaleString(); $('rBest').textContent = bestCache.toLocaleString(); $('hint').hidden = true;
  $('results').hidden = false; $('hud').hidden = true; say('');
}

/* ---------- per-frame update + render ---------- */
let last = performance.now();
function update(dt) {
  if (msgT > 0) { msgT -= dt; if (msgT <= 0) say(''); }
  if (state === 'count') {
    cnt.t += dt;
    while (cnt.lit < 4 && cnt.t >= 0.8 * (cnt.lit + 1)) { lamps[cnt.lit].className = 'red'; cnt.lit++; beep(520, 0.12, 'sine'); }
    if (cnt.lit === 4 && !cnt.green) {
      cnt.wait += dt;
      if (cnt.wait >= cnt.delay) { lamps[3].className = 'green'; cnt.green = true; cnt.gAt = performance.now(); beep(880, 0.35, 'sine', 0.18); say('GO!'); msgT = 0.8; }
    }
  }
  if (state === 'drive' || state === 'ramp' || state === 'air' || state === 'landed') {
    acc += Math.min(dt, 0.1);
    while (acc >= STEP) { step(); acc -= STEP; }
  }
  if (state === 'crashed') { crashT += dt; if (crashT > 2.4) finish(); }
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life -= dt; p.vy -= GRAV * dt;
    p.mesh.position.x += p.vx * dt; p.mesh.position.y += p.vy * dt; p.mesh.position.z += p.vz * dt;
    if (p.debris) { p.mesh.rotation.x += p.rs * dt; p.mesh.rotation.z += p.rs * dt; if (p.mesh.position.y < 0.4) { p.mesh.position.y = 0.4; p.vy *= -0.3; p.vx *= 0.7; p.vz *= 0.7; p.rs *= 0.6; } }
    else p.mesh.material.opacity = Math.max(0, p.life / p.max);
    if (p.life <= 0) { scene.remove(p.mesh); parts.splice(i, 1); }
  }
  if (flash) { flash.intensity = Math.max(0, flash.intensity - dt * 8); if (flash.intensity <= 0) { scene.remove(flash); flash = null; } }
  shake = Math.max(0, shake - dt * 1.4);
  rings.forEach(r => { if (r.got) { r.t += dt; r.mesh.scale.setScalar(1 + r.t * 4); r.mesh.material.opacity = Math.max(0, 1 - r.t * 3); r.mesh.visible = r.t < 0.34; } else r.mesh.rotation.y += dt * 1.5; });
}
function hud() {
  const air = state === 'air' || state === 'landed' || state === 'crashed';
  const sp = (state === 'air' || state === 'landed') ? Math.hypot(car.vx, car.vy) : car.v;
  $('hScore').textContent = (air || state === 'ramp' ? calcScore() : 0).toLocaleString();
  $('hSpeed').textContent = Math.round(sp / (SPD * MPH));
  $('hAlt').textContent = Math.max(0, Math.round(car.y - HH));
  $('hG').textContent = (state === 'air' ? ((keys.t || touch.t) && gas > 0 ? THRUST / 32.2 : 0) : state === 'ramp' ? R.peakG : 1).toFixed(1);
  const sink = state === 'air' ? Math.max(0, -car.vy) : 0;
  $('hSink').textContent = sink.toFixed(0); $('hSink').classList.toggle('over', sink > LAND_SINK);
  $('hBest').textContent = Math.max(bestCache, state === 'air' || state === 'landed' ? calcScore() : 0).toLocaleString();
  $('hRings').textContent = (R ? R.rings : 0) + '/7'; $('hFlips').textContent = R ? R.flips : 0;
  $('hGas').style.width = (gas * 100).toFixed(0) + '%';
}
function render(dt) {
  carGroup.position.set(car.x, car.y, 0); carGroup.rotation.z = car.th;
  const cy = Math.max(car.y, 0), k = 1 - Math.exp(-4 * dt);
  const tx = car.x + (state === 'air' ? 0 : 10), ty = 9 + cy * 0.75, tz = 80 + cy * 0.95;
  cam.position.x += (tx - cam.position.x) * k; cam.position.y += (ty - cam.position.y) * k; cam.position.z += (tz - cam.position.z) * k;
  const sx = (Math.random() - 0.5) * shake * 3, sy = (Math.random() - 0.5) * shake * 3;
  cam.position.x += sx; cam.position.y += sy;
  cam.lookAt(cam.position.x - sx, 6 + cy * 0.8, 0);
  cam.position.x -= sx; cam.position.y -= sy;
  stars.position.x = cam.position.x; moonMesh.position.x = cam.position.x - 300;
  renderer.render(scene, cam);
}
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (t - last) / 1000); last = t;
  update(dt); if (state !== 'title') hud(); render(dt);
}
R = { rings: 0, flips: 0 }; $('tBest').textContent = best().toLocaleString();
resetRun(); requestAnimationFrame(frame);
})();
