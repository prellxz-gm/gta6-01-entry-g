// Isla Verde — player.js
// On-foot movement + arcade car driving, car theft (E), stunt ramps, garage.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { groundHeight } from './world.js';

const CAR_COLORS = [0xd83d3d, 0x3d7dd8, 0xe8c33d, 0x3dd87a, 0xd8d8d8, 0x2b2b2b, 0xe87ac9, 0x7a3dd8];

export function makeCarMesh(color, isPolice = false) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.4),
    new THREE.MeshStandardMaterial({ color: isPolice ? 0x1a1a1a : color, roughness: 0.35, metalness: 0.5 }));
  body.position.y = 0.65; body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.65, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x18242e, roughness: 0.15, metalness: 0.6 }));
  cabin.position.set(0, 1.3, -0.2); cabin.castShadow = true;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  for (const [x, z] of [[-1, 1.4], [1, 1.4], [-1, -1.4], [1, -1.4]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.42, z);
    g.add(w);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x3344ff, emissiveIntensity: 0.8 }));
    bar.position.set(0, 1.75, -0.2); bar.name = 'lightbar';
    g.add(bar);
  }
  return g;
}

export function makePersonMesh(shirt = 0xd8d8d8) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.9, 4, 8),
    new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.8 }));
  body.position.y = 1.05; body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xe8b88a, roughness: 0.7 }));
  head.position.y = 2.0;
  g.add(head);
  return g;
}

export function createPlayer(scene, rng) {
  const mesh = makePersonMesh(0x2ad8a0);
  mesh.name = 'player';
  scene.add(mesh);
  const state = {
    x: 118, z: 62, y: 0, yaw: 0, vy: 0, onGround: true,
    inCar: null, speed: 0, health: 100, armor: 0,
    money: CONFIG.moneyStart, weaponIdx: 2, ammo: { pistol: 120, smg: 240, shotgun: 48 },
    cooldown: 0, nitro: 100, stuntAir: 0,
    mesh,
  };
  state.y = groundHeight(state.x, state.z);
  return state;
}

export function updatePlayer(p, input, dt, world, game) {
  const s = input.state;
  p.cooldown = Math.max(0, p.cooldown - dt);
  if (p.inCar) {
    updateCar(p, s, dt, game);
  } else {
    const speed = s.sprint ? CONFIG.runSpeed : CONFIG.walkSpeed;
    let mx = 0, mz = 0;
    if (s.forward) mz -= 1;
    if (s.back) mz += 1;
    if (s.left) mx -= 1;
    if (s.right) mx += 1;
    const len = Math.hypot(mx, mz) || 1;
    if (mx || mz) {
      const dir = Math.atan2(mx, mz);
      // camera-relative: forward = away from camera yaw
      const moveYaw = game.camYaw + dir + Math.PI;
      p.x += Math.sin(moveYaw) * speed * dt * (mx || mz ? 1 : 0) * (len ? 1 : 0);
      p.z += Math.cos(moveYaw) * speed * dt;
      p.yaw = moveYaw;
      p.speed = speed;
    } else p.speed = 0;
    // jump + gravity (plain jumps never pay stunt money)
    if (s.jump && p.onGround) { p.vy = 8.5; p.onGround = false; p.rampAir = false; }
    p.vy -= CONFIG.gravity * dt;
    p.y += p.vy * dt;
    const g = groundHeight(p.x, p.z);
    if (p.y <= g) { p.y = g; p.vy = 0; p.onGround = true; }
    // stunt ramp launch — only ramp airtime pays
    for (const r of world.ramps) {
      if (Math.hypot(p.x - r.x, p.z - r.z) < 5 && p.onGround && p.speed > 6) {
        p.vy = 9; p.onGround = false; p.stuntAir = 0; p.rampAir = true;
        game.events.push({ type: 'stunt', text: 'STUNT JUMP!' });
      }
    }
    if (!p.onGround) p.stuntAir += dt;
    if (p.onGround && p.stuntAir > 0.7 && p.rampAir) {
      const bonus = Math.round(p.stuntAir * 50);
      p.money += bonus;
      game.events.push({ type: 'stunt', text: `AIR TIME +$${bonus}` });
      p.stuntAir = 0; p.rampAir = false;
    }
    // world bounds: swim back
    const r = Math.hypot(p.x, p.z);
    if (r > 445) { const k = 445 / r; p.x *= k; p.z *= k; }
  }
  // mesh sync
  p.mesh.position.set(p.x, p.y + (p.inCar ? -10 : 0), p.z);
  p.mesh.rotation.y = p.yaw;
  p.mesh.visible = !p.inCar;
  if (p.inCar) {
    p.inCar.mesh.position.set(p.x, p.y, p.z);
    p.inCar.mesh.rotation.y = p.yaw;
  }
}

function updateCar(p, s, dt, game) {
  const car = p.inCar;
  const up = game.upgrades.engine;
  const top = CONFIG.carMaxSpeed * (1 + 0.15 * up);
  let accel = 0;
  if (s.forward) accel += CONFIG.carAccel;
  if (s.back) accel -= CONFIG.carBrake * 0.7;
  if (s.brake) accel -= CONFIG.carBrake;
  // nitro
  if (s.nitro && p.nitro > 0) {
    accel += 22 * (1 + 0.25 * game.upgrades.nitro);
    p.nitro = Math.max(0, p.nitro - 30 * dt);
  } else {
    p.nitro = Math.min(100, p.nitro + 4 * dt);
  }
  p.speed += accel * dt;
  p.speed *= Math.pow(0.4, dt); // drag
  p.speed = Math.max(-12, Math.min(top, p.speed));
  const steer = (s.left ? 1 : 0) - (s.right ? 1 : 0);
  const dirSign = p.speed >= 0 ? 1 : -1;
  p.yaw += steer * CONFIG.carTurn * dt * Math.min(1, Math.abs(p.speed) / 8) * dirSign;
  p.x += Math.sin(p.yaw) * p.speed * dt;
  p.z += Math.cos(p.yaw) * p.speed * dt;
  // ramp launch in car — only ramp airtime pays the BIG AIR bonus
  for (const r of game.world.ramps) {
    if (Math.hypot(p.x - r.x, p.z - r.z) < 6 && Math.abs(p.speed) > 18 && p.vy === 0) {
      p.vy = 10; p.rampAir = true; game.events.push({ type: 'stunt', text: 'STUNT JUMP!' });
    }
  }
  p.vy -= CONFIG.gravity * dt;
  p.y += p.vy * dt;
  const g = groundHeight(p.x, p.z);
  if (p.y <= g) {
    if (p.vy < -12) { // hard landing damages car
      car.hp -= 8;
    }
    if (p.rampAir && p.vy < -4) {
      const bonus = Math.round(60 + Math.abs(p.vy) * 8);
      p.money += bonus;
      game.events.push({ type: 'stunt', text: `BIG AIR +$${bonus}` });
    }
    p.rampAir = false;
    p.y = g; p.vy = 0;
  }
  const r = Math.hypot(p.x, p.z);
  if (r > 445) { const k = 445 / r; p.x *= k; p.z *= k; p.speed *= 0.5; }
  // exit car
  if (game.input.wasPressed('interact')) {
    exitCar(p, game);
  }
}

export function enterCar(p, car, game) {
  p.inCar = car;
  car.driven = true;
  p.x = car.x; p.z = car.z; p.y = car.y; p.yaw = car.yaw;
  p.speed = 0;
  game.events.push({ type: 'info', text: car.stolen ? 'Car stolen — wanted +1' : 'Entered car' });
}

export function exitCar(p, game) {
  const car = p.inCar;
  p.inCar = null;
  p.x += Math.sin(p.yaw + Math.PI / 2) * 2.5;
  p.z += Math.cos(p.yaw + Math.PI / 2) * 2.5;
  p.y = groundHeight(p.x, p.z);
  p.speed = 0;
  if (car) car.driven = false;
}

export function nearestCar(p, cars, maxDist = 4.5) {
  let best = null, bd = maxDist;
  for (const c of cars) {
    const d = Math.hypot(c.x - p.x, c.z - p.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export { CAR_COLORS };
