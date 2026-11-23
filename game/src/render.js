// Isla Verde — render.js
// Renderer, lights, camera rig, and the 2D minimap.
import * as THREE from 'three';
import { CONFIG } from './config.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  return renderer;
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b8d8);
  scene.fog = new THREE.Fog(0x9fc4dd, 260, 900);
  const sun = new THREE.DirectionalLight(0xffe8b8, 2.4);
  sun.position.set(180, 260, 120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -320; sun.shadow.camera.right = 320;
  sun.shadow.camera.top = 320; sun.shadow.camera.bottom = -320;
  sun.shadow.camera.far = 800;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3a5a3a, 0.9);
  scene.add(hemi);
  // golden-hour-ish warm ambience over the volcanic island
  const warm = new THREE.AmbientLight(0xffe0b0, 0.25);
  scene.add(warm);
  return { scene, sun };
}

export function createCamera() {
  const cam = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 2000);
  return cam;
}

// Third-person chase camera with simple smoothing + collision floor.
export function updateCamera(cam, target, yaw, dist, height, dt, groundH) {
  const cx = target.x - Math.sin(yaw) * dist;
  const cz = target.z - Math.cos(yaw) * dist;
  const cy = Math.max(target.y + height, groundH(cx, cz) + 2.2);
  const k = 1 - Math.pow(0.0001, dt);
  cam.position.x += (cx - cam.position.x) * k;
  cam.position.y += (cy - cam.position.y) * k;
  cam.position.z += (cz - cam.position.z) * k;
  cam.lookAt(target.x, target.y + 1.6, target.z);
}

export function drawMinimap(canvas, state) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const S = CONFIG.worldSize;
  const toX = (x) => ((x + S / 2) / S) * W;
  const toY = (z) => ((z + S / 2) / S) * H;
  ctx.clearRect(0, 0, W, H);
  // island
  ctx.fillStyle = '#1d4a2a'; ctx.beginPath(); ctx.arc(W / 2, H / 2, W * 0.48, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3f8f3a'; ctx.beginPath(); ctx.arc(W / 2, H / 2, W * 0.42, 0, Math.PI * 2); ctx.fill();
  // volcano
  ctx.fillStyle = '#e83d3d'; ctx.beginPath(); ctx.arc(toX(0), toY(-40), 7, 0, Math.PI * 2); ctx.fill();
  // beach ring
  ctx.strokeStyle = '#e8d28a'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(W / 2, H / 2, W * 0.46, 0, Math.PI * 2); ctx.stroke();
  // districts
  for (const d of CONFIG.districts) {
    ctx.fillStyle = d.color; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.arc(toX(d.center[0]), toY(d.center[1]), 4, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // mission marker
  const m = state.missions.current;
  if (m) {
    const t = state.missions.markerTarget();
    if (t) {
      const pulse = 5 + Math.sin(state.time * 5) * 2;
      ctx.fillStyle = '#ffd23d'; ctx.strokeStyle = '#000';
      ctx.beginPath(); ctx.arc(toX(t[0]), toY(t[1]), pulse, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }
  // traffic (orange) + police (blue/red)
  ctx.fillStyle = '#ff9a3d';
  for (const c of state.traffic) { ctx.fillRect(toX(c.x) - 1.5, toY(c.z) - 1.5, 3, 3); }
  ctx.fillStyle = '#3d7dff';
  for (const c of state.police.cars) { ctx.fillRect(toX(c.x) - 2, toY(c.z) - 2, 4, 4); }
  // player arrow
  const p = state.player;
  ctx.save();
  ctx.translate(toX(p.x), toY(p.z));
  ctx.rotate(-p.yaw + Math.PI);
  ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(4.5, 5); ctx.lineTo(-4.5, 5); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
  // north tick
  ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.fillText('N', W / 2 - 3, 11);
}
