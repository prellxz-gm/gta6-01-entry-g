// Isla Verde — world.js
// Builds the volcanic island: terrain heightfield, volcano, beach ring,
// jungle, port village, roads, stunt ramps, traffic + pedestrian spawns.
// All placement is seeded — identical for a given seed.
import * as THREE from 'three';
import { CONFIG, STUNT_RAMPS } from './config.js';
import { mulberry32, fbm2, range } from './random.js';

export function groundHeight(x, z) {
  const r = Math.sqrt(x * x + z * z);
  const size = CONFIG.worldSize / 2;
  // island falloff: high centre (volcano), beach at rim, sea beyond
  const fall = Math.max(0, 1 - r / (size * 0.98));
  const base = fall * fall * 26;
  const volcano = Math.max(0, 1 - Math.hypot(x - 0, z + 40) / 150) * 55;
  const hills = fbm2(x * 0.008 + 31, z * 0.008 + 17, CONFIG.seed, 4) * 9 * fall;
  const beach = r > size * 0.82 ? 0.4 : 0;
  return Math.max(beach, base + volcano + hills - 1.2);
}

export function buildWorld(scene, seed) {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  group.name = 'world';
  const size = CONFIG.worldSize;

  // --- sea ---
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(size * 3, size * 3),
    new THREE.MeshStandardMaterial({ color: 0x0a5e8a, roughness: 0.25, metalness: 0.1 })
  );
  sea.rotation.x = -Math.PI / 2; sea.position.y = -0.4;
  group.add(sea);

  // --- terrain (vertex-coloured heightfield) ---
  const seg = 110;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cSand = new THREE.Color(0xe8d28a), cGrass = new THREE.Color(0x3f8f3a);
  const cRock = new THREE.Color(0x6b5a52), cAsh = new THREE.Color(0x4a4442);
  const cJungle = new THREE.Color(0x2a6b2a);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = groundHeight(x, z);
    pos.setY(i, h);
    const r = Math.hypot(x, z);
    if (h < 1.2) tmp.copy(cSand);
    else if (h > 42) tmp.copy(cAsh);
    else if (h > 24) tmp.copy(cRock);
    else if (x < -80 && z < -60) tmp.copy(cJungle);
    else tmp.copy(cGrass);
    // subtle variation
    const v = 0.92 + fbm2(x * 0.05, z * 0.05, seed + 7, 2) * 0.16;
    colors[i * 3] = tmp.r * v; colors[i * 3 + 1] = tmp.g * v; colors[i * 3 + 2] = tmp.b * v;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  terrain.receiveShadow = true;
  group.add(terrain);

  // --- volcano crater glow ---
  const lava = new THREE.Mesh(
    new THREE.CircleGeometry(16, 24),
    new THREE.MeshBasicMaterial({ color: 0xff5a00 })
  );
  lava.rotation.x = -Math.PI / 2;
  lava.position.set(0, groundHeight(0, -40) + 0.6, -40);
  lava.name = 'lava';
  group.add(lava);
  const smoke = new THREE.Mesh(
    new THREE.ConeGeometry(22, 46, 10),
    new THREE.MeshStandardMaterial({ color: 0x555555, transparent: true, opacity: 0.55, roughness: 1 })
  );
  smoke.position.set(0, groundHeight(0, -40) + 42, -40);
  smoke.name = 'smoke';
  group.add(smoke);

  // --- roads: ring + spokes (flat dark strips following terrain) ---
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2b2b30, roughness: 0.9 });
  function roadStrip(x1, z1, x2, z2, width) {
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(width, len), roadMat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -Math.atan2(dx, dz);
    const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
    m.position.set(mx, groundHeight(mx, mz) + 0.15, mz);
    m.receiveShadow = true;
    group.add(m);
  }
  // ring road
  const ringN = 20;
  for (let i = 0; i < ringN; i++) {
    const a1 = (i / ringN) * Math.PI * 2, a2 = ((i + 1) / ringN) * Math.PI * 2;
    roadStrip(Math.cos(a1) * 240, Math.sin(a1) * 240, Math.cos(a2) * 240, Math.sin(a2) * 240, 9);
  }
  // spokes
  roadStrip(0, 0, 240, 0, 9); roadStrip(0, 0, -240, 0, 9);
  roadStrip(0, 0, 0, 240, 9); roadStrip(0, 0, 0, -240, 9);
  roadStrip(-160, 180, 120, 40, 8); roadStrip(60, 200, 120, 40, 8);

  // --- port village + town buildings (seeded boxes with lit windows) ---
  const buildings = [];
  const wallColors = [0xd8c9a8, 0xc9d8d8, 0xe8b8a0, 0xb8c9e8, 0xd8d8d8];
  function building(x, z, w, d, h, color) {
    const y = groundHeight(x, z);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.85 }));
    m.position.set(x, y + h / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6),
      new THREE.MeshStandardMaterial({ color: 0x8a4a2a, roughness: 0.9 }));
    roof.position.set(x, y + h + 0.25, z);
    group.add(roof);
    buildings.push({ x, z, w, d, h });
    return m;
  }
  const villageSpots = [
    [120, 40], [145, 60], [100, 65], [160, 20], [95, 15], [135, 90], [175, 55],
    [60, 200], [85, 215], [40, 225], [90, 180], [35, 185],
    [-160, 180], [-135, 200], [-180, 155],
  ];
  for (const [x, z] of villageSpots) {
    building(x + range(rng, -8, 8), z + range(rng, -8, 8),
      range(rng, 10, 18), range(rng, 10, 16), range(rng, 7, 16),
      wallColors[Math.floor(rng() * wallColors.length)]);
  }
  // lighthouse at the port
  const light = new THREE.Mesh(new THREE.CylinderGeometry(3, 4.5, 26, 10),
    new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 }));
  light.position.set(205, groundHeight(205, 10) + 13, 10);
  group.add(light);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe27a }));
  beacon.position.set(205, groundHeight(205, 10) + 27, 10);
  beacon.name = 'beacon';
  group.add(beacon);

  // --- jungle trees (seeded, deterministic) ---
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f7a2f, roughness: 1 });
  const palmMat = new THREE.MeshStandardMaterial({ color: 0x3a9a3a, roughness: 1 });
  const trees = [];
  for (let i = 0; i < 420; i++) {
    const x = range(rng, -430, 430), z = range(rng, -430, 430);
    const r = Math.hypot(x, z);
    if (r > 420) continue;
    const jungle = x < -60 && z < -40;
    const beach = r > 360;
    if (!jungle && !beach && rng() < 0.75) continue;
    const h = groundHeight(x, z);
    if (h < 1.0) continue;
    const s = range(rng, 0.8, 1.7);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * s, 0.5 * s, 5 * s, 6), trunkMat);
    trunk.position.set(x, h + 2.5 * s, z);
    group.add(trunk);
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(3.2 * s, 7 * s, 7), beach ? palmMat : leafMat);
    leaves.position.set(x, h + (5 + 3) * s, z);
    group.add(leaves);
    trees.push({ x, z, r: 1.2 * s });
  }

  // --- stunt ramps ---
  const ramps = [];
  for (const { pos: [x, z], angle } of STUNT_RAMPS) {
    const y = groundHeight(x, z);
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 12),
      new THREE.MeshStandardMaterial({ color: 0xe8a33d, roughness: 0.7 }));
    ramp.position.set(x, y + 1.2, z);
    ramp.rotation.y = angle;
    ramp.rotation.x = -0.35;
    ramp.castShadow = true;
    group.add(ramp);
    ramps.push({ x, z, angle });
  }

  // --- palms along the beach ring ---
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2 + range(rng, -0.05, 0.05);
    const x = Math.cos(a) * range(rng, 380, 415), z = Math.sin(a) * range(rng, 380, 415);
    const h = groundHeight(x, z);
    if (h > 2) continue;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 6, 6), trunkMat);
    trunk.position.set(x, h + 3, z);
    trunk.rotation.z = range(rng, -0.2, 0.2);
    group.add(trunk);
    const top = new THREE.Mesh(new THREE.ConeGeometry(3, 5, 6), palmMat);
    top.position.set(x, h + 7.5, z);
    group.add(top);
  }

  scene.add(group);
  return {
    group, buildings, trees, ramps,
    // traffic + pedestrian spawn points on the ring road
    trafficSpawns: Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return [Math.cos(a) * 240, Math.sin(a) * 240, a + Math.PI / 2];
    }),
    pedSpawns: villageSpots.map(([x, z]) => [x + range(rng, -15, 15), z + range(rng, -15, 15)]),
  };
}
