// Isla Verde — police.js
// Wanted 0–5, cop cars that chase + ram, helicopter at 3+, roadblocks at 4+.
import * as THREE from 'three';
import { makeCarMesh } from './player.js';
import { groundHeight } from './world.js';
import { mulberry32, range } from './random.js';

export function createPolice(scene) {
  return {
    wanted: 0,
    heat: 0,            // 0..100, decays when hidden
    cars: [],
    heli: null,
    heliMesh: null,
    roadblocks: [],
    jamUntil: 0,        // hacker jam timer (game time)
    spawnTimer: 0,
    bustedTimer: 0,
    scene,
  };
}

function spawnCopCar(police, x, z, rng) {
  const mesh = makeCarMesh(0x111111, true);
  police.scene.add(mesh);
  const car = { x, z, y: groundHeight(x, z), yaw: 0, speed: 0, hp: 60, mesh, isCop: true };
  police.cars.push(car);
  return car;
}

function spawnHeli(police, x = 0, z = 0) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 5),
    new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.4, metalness: 0.5 }));
  g.add(body);
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.12, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x111111 }));
  rotor.position.y = 1.1; rotor.name = 'rotor';
  g.add(rotor);
  const light = new THREE.Mesh(new THREE.ConeGeometry(6, 22, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.14, side: THREE.DoubleSide }));
  light.position.y = -11; light.rotation.x = Math.PI;
  g.add(light);
  police.scene.add(g);
  police.heli = { x, z, y: 60, yaw: 0, mesh: g };
  police.heliMesh = g;
}

export function addWanted(police, amount, game) {
  if (game.time < police.jamUntil) return; // scanner jammed
  police.wanted = Math.max(0, Math.min(5, police.wanted + amount));
  police.heat = Math.min(100, police.heat + amount * 22);
  if (police.wanted > 0) game.events.push({ type: 'wanted', text: `WANTED ★${police.wanted}` });
}

export function updatePolice(police, p, dt, game, rng) {
  const now = game.time;
  const jammed = now < police.jamUntil;
  // decay when player is slow / hidden in jungle
  const hiding = Math.abs(p.speed) < 2 && p.x < -60 && p.z < -40;
  if (police.wanted > 0 && (hiding || jammed)) police.heat = Math.max(0, police.heat - 6 * dt);
  if (police.heat <= 0 && police.wanted > 0) {
    police.wanted = 0;
    game.events.push({ type: 'info', text: 'You lost the cops. Heat is off.' });
  }
  // desired cop count by wanted level
  const want = police.wanted === 0 ? 0 : police.wanted <= 2 ? 2 : police.wanted <= 3 ? 3 : 4;
  police.spawnTimer -= dt;
  if (police.cars.length < want && police.spawnTimer <= 0 && !jammed) {
    police.spawnTimer = 2.5;
    const a = rng() * Math.PI * 2;
    spawnCopCar(police, p.x + Math.cos(a) * 70, p.z + Math.sin(a) * 70, rng);
  }
  // helicopter at 3+ — spawns near the player so it is visible immediately
  if (police.wanted >= 3 && !police.heli && !jammed) spawnHeli(police, p.x + 70, p.z - 55);
  if (police.wanted < 3 && police.heli) {
    police.scene.remove(police.heli.mesh);
    police.heli = null;
  }
  // roadblocks at 4+
  if (police.wanted >= 4 && police.roadblocks.length === 0) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      const x = p.x + Math.cos(a) * 55, z = p.z + Math.sin(a) * 55;
      const mesh = new THREE.Group();
      for (let j = -1; j <= 1; j++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 1.2),
          new THREE.MeshStandardMaterial({ color: j === 0 ? 0xff5533 : 0xffffff }));
        b.position.set(j * 2.2, 0.55, 0);
        mesh.add(b);
      }
      mesh.position.set(x, groundHeight(x, z), z);
      police.scene.add(mesh);
      police.roadblocks.push({ x, z, mesh });
    }
    game.events.push({ type: 'wanted', text: 'ROADBLOCKS AHEAD!' });
  }
  if (police.wanted < 4) {
    for (const rb of police.roadblocks) police.scene.remove(rb.mesh);
    police.roadblocks.length = 0;
  }
  // chase + ram
  for (let i = police.cars.length - 1; i >= 0; i--) {
    const c = police.cars[i];
    const dx = p.x - c.x, dz = p.z - c.z;
    const d = Math.hypot(dx, dz) || 1;
    const targetYaw = Math.atan2(dx, dz);
    let dy = targetYaw - c.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    c.yaw += Math.max(-2.2 * dt, Math.min(2.2 * dt, dy));
    const top = 26 + police.wanted * 3;
    c.speed = Math.min(top, c.speed + 18 * dt);
    c.x += Math.sin(c.yaw) * c.speed * dt;
    c.z += Math.cos(c.yaw) * c.speed * dt;
    c.y = groundHeight(c.x, c.z);
    c.mesh.position.set(c.x, c.y, c.z);
    c.mesh.rotation.y = c.yaw;
    // ram: hit player car / player
    if (d < 3.4) {
      if (p.inCar) {
        p.inCar.hp -= 12 * dt * 10;
        p.speed *= 0.92;
        game.shake = 0.35;
      } else {
        p.health -= 18 * dt;
        game.events.push({ type: 'damage', text: 'Cop rammed you!' });
      }
      // cop bounces back a little
      c.speed *= 0.5;
    }
    if (c.hp <= 0) {
      police.scene.remove(c.mesh);
      police.cars.splice(i, 1);
      p.money += 50;
      game.events.push({ type: 'info', text: 'Cop car wrecked +$50' });
    }
  }
  // heli follows + spotlight
  if (police.heli) {
    const h = police.heli;
    const dx = p.x - h.x, dz = p.z - h.z;
    const d = Math.hypot(dx, dz) || 1;
    h.x += (dx / d) * 20 * dt;
    h.z += (dz / d) * 20 * dt;
    h.y = 42 + Math.sin(now * 0.8) * 3;
    h.mesh.position.set(h.x, h.y, h.z);
    h.mesh.rotation.y = Math.atan2(dx, dz);
    const rotor = h.mesh.getObjectByName('rotor');
    if (rotor) rotor.rotation.y += dt * 22;
    if (d < 8) police.heat = Math.min(100, police.heat + 4 * dt); // spotlight keeps heat up
  }
  // busted: health 0 with cops near
  if (p.health <= 0) {
    p.health = 100;
    p.money = Math.max(0, p.money - 200);
    police.wanted = 0; police.heat = 0;
    for (const c of police.cars) police.scene.remove(c.mesh);
    police.cars.length = 0;
    p.x = 118; p.z = 62; p.y = groundHeight(p.x, p.z);
    if (p.inCar) { p.inCar = null; }
    game.events.push({ type: 'wanted', text: 'BUSTED! -$200, respawned at the port.' });
  }
}

export function jamScanner(police, game, seconds = 20) {
  police.jamUntil = game.time + seconds;
  game.events.push({ type: 'crew', text: `Luna jammed the police scanner for ${seconds}s!` });
}
