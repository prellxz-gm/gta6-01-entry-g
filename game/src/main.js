// Isla Verde — main.js
// Game orchestrator: fixed-timestep loop, traffic, pedestrians, combat,
// weapon wheel, HUD + minimap, save, garage, crew, territory income.
import * as THREE from 'three';
import { CONFIG, MISSIONS, CONTRACTS, RACES } from './config.js';
import { mulberry32, range } from './random.js';
import { createInput } from './input.js';
import { buildWorld, groundHeight } from './world.js';
import { createRenderer, createScene, createCamera, updateCamera, drawMinimap } from './render.js';
import { createPlayer, updatePlayer, makeCarMesh, makePersonMesh, enterCar, exitCar, nearestCar, CAR_COLORS } from './player.js';
import { createPolice, updatePolice, addWanted, jamScanner } from './police.js';
import { createMissions, startMission, updateMissions, markerTarget, startRace } from './missions.js';
import { createAudio } from './audio.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SEED = parseInt(params.get('seed') || String(CONFIG.seed), 10);

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const { scene, sun } = createScene();
const camera = createCamera();
const rng = mulberry32(SEED);
const input = createInput();
const audio = createAudio();
const world = buildWorld(scene, SEED);
const player = createPlayer(scene, rng);
const police = createPolice(scene);
const missions = createMissions();

const game = {
  time: 0, started: false, paused: false, shotMode: null,
  camYaw: 0, camDist: 11, shake: 0, hint: '',
  events: [], stats: { earned: 0, kills: 0, carsStolen: 0, racesWon: 0 },
  standing: {}, territory: {},
  upgrades: { engine: 0, armor: 0, nitro: 0 },
  crewUnlocked: { rico: true, luna: true },
  hackCooldown: 0, incomeTimer: 0,
  traffic: [], peds: [], enemies: [], ambushLeft: 0,
  smuggler: null, world, player, police, missions, input, audio, rng,
  saveGame, spawnAmbush, spawnTrafficCar, spawnCopAt, forceHeli,
  spawnPlayerCar, enterPlayerCar, startStoryMission,
};
missions.markerTarget = () => markerTarget(missions);
game.missions = missions;

// ---------- traffic ----------
function spawnTrafficCar(x, z, yaw) {
  const color = CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)];
  const mesh = makeCarMesh(color);
  scene.add(mesh);
  const car = { x, z, y: groundHeight(x, z), yaw, speed: range(rng, 8, 14), hp: 40, mesh, stolen: false, driven: false, color, routeA: rng() * Math.PI * 2 };
  game.traffic.push(car);
  return car;
}
for (let i = 0; i < 10; i++) {
  const [x, z, a] = world.trafficSpawns[i % world.trafficSpawns.length];
  spawnTrafficCar(x + range(rng, -10, 10), z + range(rng, -10, 10), a);
}
function spawnCopAt(x, z) {
  const mesh = makeCarMesh(0x111111, true);
  scene.add(mesh);
  const car = { x, z, y: groundHeight(x, z), yaw: 0, speed: 0, hp: 60, mesh, isCop: true };
  police.cars.push(car);
  return car;
}
function forceHeli() { police.wanted = Math.max(3, police.wanted); }
function spawnPlayerCar(x, z, yaw) {
  const mesh = makeCarMesh(0xd83d3d);
  scene.add(mesh);
  const car = { x, z, y: groundHeight(x, z), yaw, speed: 0, hp: 100, mesh, stolen: false, driven: false, owned: true };
  game.traffic.push(car);
  return car;
}
function enterPlayerCar(car) { enterCar(player, car, game); }
function startStoryMission(i) { startMission(missions, game, 'story'); }

// ---------- pedestrians ----------
for (let i = 0; i < 24; i++) {
  const [x, z] = world.pedSpawns[i % world.pedSpawns.length];
  const mesh = makePersonMesh([0xd8d8d8, 0xe8a33d, 0x3d7dd8, 0xe87ac9][i % 4]);
  mesh.position.set(x, groundHeight(x, z), z);
  scene.add(mesh);
  game.peds.push({ x, z, yaw: rng() * Math.PI * 2, mesh, phase: rng() * 10, speed: range(rng, 1, 2) });
}

function spawnAmbush(x, z) {
  game.ambushLeft = 4;
  for (let i = 0; i < 4; i++) {
    const mesh = makePersonMesh(0x8a2a2a);
    const ex = x + range(rng, -12, 12), ez = z + range(rng, -12, 12);
    mesh.position.set(ex, groundHeight(ex, ez), ez);
    scene.add(mesh);
    game.enemies.push({ x: ex, z: ez, y: groundHeight(ex, ez), hp: 50, mesh });
  }
}
function spawnSmuggler(x, z) {
  const car = spawnTrafficCar(x, z, 0);
  car.smuggler = true;
  game.smuggler = car;
  return car;
}

// ---------- save / load ----------
function saveGame() {
  try {
    localStorage.setItem(CONFIG.saveKey, JSON.stringify({
      money: player.money, idx: missions.index, done: missions.done,
      cIdx: missions.contractIndex, cDone: missions.contractDone,
      standing: game.standing, territory: game.territory,
      upgrades: game.upgrades, raceBest: missions.raceBest, earned: game.stats.earned,
    }));
  } catch (e) { /* storage unavailable in some shells */ }
}
function loadGame() {
  try {
    const raw = localStorage.getItem(CONFIG.saveKey);
    if (!raw) return;
    const s = JSON.parse(raw);
    player.money = s.money ?? CONFIG.moneyStart;
    missions.index = s.idx ?? 0; missions.done = s.done ?? [];
    missions.contractIndex = s.cIdx ?? 0; missions.contractDone = s.cDone ?? [];
    game.standing = s.standing ?? {}; game.territory = s.territory ?? {};
    game.upgrades = s.upgrades ?? { engine: 0, armor: 0, nitro: 0 };
    missions.raceBest = s.raceBest ?? {}; game.stats.earned = s.earned ?? 0;
  } catch (e) { /* corrupted save: start fresh */ }
}
loadGame();

// ---------- HUD ----------
const $ = (id) => document.getElementById(id);
const hud = {
  money: $('money'), health: $('health-fill'), healthText: $('health-text'),
  wanted: $('wanted'), ammo: $('ammo'), weapon: $('weapon-name'),
  mission: $('mission-text'), missionTitle: $('mission-title'),
  feed: $('feed'), district: $('district'), standing: $('standing'),
  minimap: $('minimap'), speed: $('speed'), hint: $('hint'),
  crew: $('crew-status'), income: $('income'),
};
function pushEvent(text, kind = 'info') {
  game.events.push({ type: kind, text });
}
function renderFeed() {
  while (game.events.length) {
    const ev = game.events.shift();
    const div = document.createElement('div');
    div.className = 'feed-item ' + ev.type;
    div.textContent = ev.text;
    hud.feed.prepend(div);
    while (hud.feed.children.length > 6) hud.feed.removeChild(hud.feed.lastChild);
    if (ev.type === 'mission' || ev.type === 'wanted') setTimeout(() => { if (div.parentNode) div.parentNode.removeChild(div); }, 9000);
  }
}
function renderHUD() {
  hud.money.textContent = '$' + Math.floor(player.money).toLocaleString('en-US');
  hud.health.style.width = Math.max(0, player.health) + '%';
  hud.healthText.textContent = Math.ceil(player.health) + ' HP';
  const w = CONFIG.weapons[player.weaponIdx];
  hud.weapon.textContent = w.name;
  hud.ammo.textContent = w.ammo === Infinity ? '∞' : String(player.ammo[w.id] ?? 0);
  hud.wanted.textContent = '★'.repeat(police.wanted) + '☆'.repeat(5 - police.wanted);
  hud.wanted.style.color = police.wanted >= 3 ? '#ff5533' : '#ffd23d';
  hud.speed.textContent = Math.abs(Math.round((player.inCar ? player.speed : player.speed || 0) * 3.6)) + ' km/h';
  const cur = missions.current;
  if (cur) {
    hud.missionTitle.textContent = cur.def.name;
    hud.mission.textContent = cur.def.brief + '  •  ' + Math.floor(cur.t) + 's';
  } else if (missions.race) {
    hud.missionTitle.textContent = 'RACE: ' + missions.race.def.name;
    hud.mission.textContent = `Checkpoint ${missions.race.cp + 1}/${missions.race.def.checkpoints.length} • ${missions.race.t.toFixed(1)}s (par ${missions.race.def.par}s)`;
  } else {
    const next = MISSIONS[missions.index];
    hud.missionTitle.textContent = next ? 'Next: ' + next.name : 'All story missions complete!';
    hud.mission.textContent = next ? next.brief + ' — press M to start' : 'Free roam Isla Verde. Contracts available at the port (C).';
  }
  // district + standing
  let curD = null;
  for (const d of CONFIG.districts) {
    if (Math.hypot(player.x - d.center[0], player.z - d.center[1]) < d.radius) { curD = d; break; }
  }
  hud.district.textContent = curD ? curD.name : 'Open Sea / Wilds';
  hud.standing.textContent = curD ? `Standing ${game.standing[curD.id] || 0}/100` : '';
  const owned = Object.keys(game.territory).filter((k) => game.territory[k]).length;
  hud.income.textContent = owned ? `Territory income: +$${owned * 25}/min (${owned} zones)` : 'No territory yet — finish missions to claim zones';
  hud.crew.textContent = `Crew: Rico (getaway) • Luna (hacker${game.hackCooldown > 0 ? ' ' + Math.ceil(game.hackCooldown) + 's' : ' ready — X'})`;
  hud.hint.textContent = game.hint || '';
  game.hint = '';
  drawMinimap(hud.minimap, game);
}

// ---------- combat ----------
function shoot() {
  const w = CONFIG.weapons[player.weaponIdx];
  if (player.cooldown > 0) return;
  if (w.ammo !== Infinity && (player.ammo[w.id] ?? 0) <= 0) {
    pushEvent('Out of ammo — press R to buy more ($50)', 'damage');
    return;
  }
  player.cooldown = w.rate;
  if (w.ammo !== Infinity) player.ammo[w.id]--;
  audio.shoot(w.id);
  // tracer: short-lived line from player toward aim
  const origin = new THREE.Vector3(player.x, player.y + 1.5, player.z);
  const dir = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
  const end = origin.clone().addScaledVector(dir, w.range);
  const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe27a }));
  scene.add(line);
  setTimeout(() => scene.remove(line), 70);
  // hit test: nearest enemy / cop / ped in a forward cone
  const targets = [
    ...game.enemies.map((e) => ({ x: e.x, z: e.z, ref: e, kind: 'enemy' })),
    ...police.cars.map((c) => ({ x: c.x, z: c.z, ref: c, kind: 'cop' })),
    ...game.peds.map((e) => ({ x: e.x, z: e.z, ref: e, kind: 'ped' })),
  ];
  let best = null, bd = w.range;
  for (const t of targets) {
    const dx = t.x - player.x, dz = t.z - player.z;
    const d = Math.hypot(dx, dz);
    if (d > w.range) continue;
    const ang = Math.abs(Math.atan2(dx, dz) - player.yaw);
    const a = ang > Math.PI ? Math.PI * 2 - ang : ang;
    if (a < 0.35 && d < bd) { bd = d; best = t; }
  }
  if (best) {
    const pellets = w.pellets || 1;
    const dmg = w.damage * pellets;
    if (best.kind === 'enemy') {
      best.ref.hp -= dmg;
      audio.hit();
      if (best.ref.hp <= 0) {
        scene.remove(best.ref.mesh);
        game.enemies.splice(game.enemies.indexOf(best.ref), 1);
        game.ambushLeft = Math.max(0, game.ambushLeft - 1);
        game.stats.kills++;
        player.money += 100;
        pushEvent('Crew member down +$100', 'mission');
      }
    } else if (best.kind === 'cop') {
      best.ref.hp -= dmg;
      if (best.ref.hp <= 0) {
        scene.remove(best.ref.mesh);
        police.cars.splice(police.cars.indexOf(best.ref), 1);
        player.money += 50;
        addWanted(police, 1, game);
      } else addWanted(police, 0, game);
    } else {
      addWanted(police, 1, game);
      pushEvent('You hit a civilian! Wanted +1', 'wanted');
    }
  }
}

// ---------- weapon wheel ----------
let wheelOpen = false;
function renderWheel() {
  const wheel = $('wheel');
  wheel.innerHTML = '';
  CONFIG.weapons.forEach((w, i) => {
    const b = document.createElement('button');
    b.className = 'wheel-item' + (i === player.weaponIdx ? ' active' : '');
    b.textContent = `${i + 1} ${w.name}${w.ammo === Infinity ? '' : ' (' + (player.ammo[w.id] ?? 0) + ')'}`;
    b.addEventListener('click', () => { player.weaponIdx = i; wheelOpen = false; wheel.classList.add('hidden'); });
    wheel.appendChild(b);
  });
}

// ---------- garage ----------
function openGarage() {
  const panel = $('garage');
  panel.innerHTML = '<h2>Garage — Isla Verde Customs</h2>';
  CONFIG.garageUpgrades.forEach((u) => {
    const lvl = game.upgrades[u.id];
    const row = document.createElement('div');
    row.className = 'garage-row';
    const cost = lvl < u.levels ? u.costs[lvl] : null;
    row.innerHTML = `<b>${u.name}</b> Lv ${lvl}/${u.levels} — ${u.desc}<br>`;
    if (cost !== null) {
      const btn = document.createElement('button');
      btn.textContent = `Upgrade $${cost}`;
      btn.disabled = player.money < cost;
      btn.addEventListener('click', () => {
        player.money -= cost;
        game.upgrades[u.id]++;
        audio.cash(); saveGame(); openGarage(); renderHUD();
      });
      row.appendChild(btn);
    } else row.innerHTML += '<i>MAX</i>';
    panel.appendChild(row);
  });
  const close = document.createElement('button');
  close.textContent = 'Close (G)';
  close.addEventListener('click', () => panel.classList.add('hidden'));
  panel.appendChild(close);
  panel.classList.remove('hidden');
}

// ---------- traffic + peds update ----------
function updateTraffic(dt) {
  for (const c of game.traffic) {
    if (c.driven) continue;
    if (c.smuggler) {
      // flee from player
      const dx = c.x - player.x, dz = c.z - player.z;
      const d = Math.hypot(dx, dz) || 1;
      c.yaw = Math.atan2(dx, dz);
      c.speed = Math.min(30, c.speed + 10 * dt);
    } else {
      // follow ring road
      c.routeA += (c.speed * dt) / 240;
      const tx = Math.cos(c.routeA) * 240, tz = Math.sin(c.routeA) * 240;
      c.yaw = Math.atan2(tx - c.x, tz - c.z);
      const d = Math.hypot(tx - c.x, tz - c.z);
      if (d < 4) { c.routeA += 0.05; }
      c.speed = 10 + Math.sin(game.time * 0.3 + c.routeA * 7) * 2;
    }
    c.x += Math.sin(c.yaw) * c.speed * dt;
    c.z += Math.cos(c.yaw) * c.speed * dt;
    c.y = groundHeight(c.x, c.z);
    c.mesh.position.set(c.x, c.y, c.z);
    c.mesh.rotation.y = c.yaw;
    // collision with player car
    if (player.inCar && Math.hypot(c.x - player.x, c.z - player.z) < 3.2) {
      c.hp -= 20; player.inCar.hp -= 6; player.speed *= 0.6; audio.crash(); game.shake = 0.4;
      if (c.hp <= 0 && !c.counted) { c.counted = true; player.money += 25; }
    }
  }
  // keep traffic topped up
  if (game.traffic.length < 10 && !SHOT) {
    const [x, z, a] = world.trafficSpawns[Math.floor(rng() * world.trafficSpawns.length)];
    spawnTrafficCar(x, z, a);
  }
}
function updatePeds(dt) {
  for (const ped of game.peds) {
    ped.phase += dt;
    ped.yaw += Math.sin(ped.phase * 0.4) * 0.01;
    ped.x += Math.sin(ped.yaw) * ped.speed * dt;
    ped.z += Math.cos(ped.yaw) * ped.speed * dt;
    const r = Math.hypot(ped.x, ped.z);
    if (r > 430) ped.yaw += Math.PI;
    ped.mesh.position.set(ped.x, groundHeight(ped.x, ped.z), ped.z);
    ped.mesh.rotation.y = ped.yaw;
    // player car hits ped -> wanted
    if (player.inCar && Math.abs(player.speed) > 5 && Math.hypot(ped.x - player.x, ped.z - player.z) < 2.2) {
      addWanted(police, 1, game);
      ped.x += 30; ped.z += 30; // ped flees (respawn offset)
      pushEvent('You hit a pedestrian! Wanted +1', 'wanted');
    }
  }
}

// ---------- main loop ----------
let last = performance.now();
let acc = 0;
let frames = 0;
function tick(now) {
  requestAnimationFrame(tick);
  let dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!game.started || game.paused) {
    renderer.render(scene, camera);
    return;
  }
  acc += dt;
  const step = CONFIG.fixedDt;
  let guard = 0;
  while (acc >= step && guard < 5) {
    acc -= step;
    update(step);
    guard++;
  }
  // camera (shot mode can pull it closer for a tighter cover frame)
  const target = new THREE.Vector3(player.x, player.y, player.z);
  const dist = player.inCar ? (game.shotCamDist || 14) : 10;
  const height = player.inCar ? (game.shotCamHeight || 5.5) : 4.2;
  const shakeX = game.shake > 0 ? (rng() - 0.5) * game.shake : 0;
  game.shake = Math.max(0, game.shake - dt * 1.5);
  updateCamera(camera, target, game.camYaw, dist, height, dt, groundHeight);
  camera.position.x += shakeX;
  // sun + lava pulse
  const lava = scene.getObjectByName('lava');
  if (lava) lava.material.color.setHSL(0.05, 1, 0.5 + Math.sin(game.time * 1.5) * 0.08);
  const beacon = scene.getObjectByName('beacon');
  if (beacon) beacon.material.color.setHex(Math.sin(game.time * 3) > 0 ? 0xffe27a : 0xff5533);
  renderer.render(scene, camera);
  renderFeed();
  renderHUD();
  frames++;
  if (frames === 30) window.__ready = true;
}

function update(dt) {
  game.time += dt;
  game.hackCooldown = Math.max(0, game.hackCooldown - dt);
  // camera yaw follows player yaw loosely when driving
  if (player.inCar) game.camYaw += (player.yaw - game.camYaw) * 0.02;
  else if (input.state.left || input.state.right) game.camYaw += ((input.state.left ? 1 : -1) * 1.8 * dt);

  // interact: steal / enter nearest car (exit is handled inside updateCar,
  // so do NOT consume the press while in a car)
  if (!player.inCar && input.wasPressed('interact')) {
    const car = nearestCar(player, game.traffic.filter((c) => !c.isCop));
    if (car) {
      if (!car.owned && !car.stolen) {
        car.stolen = true;
        game.stats.carsStolen++;
        addWanted(police, 1, game);
        audio.pickup();
      }
      enterCar(player, car, game);
    }
  }
  if (input.wasPressed('attack')) shoot();
  if (input.state.attack && CONFIG.weapons[player.weaponIdx].id === 'smg') shoot();
  if (input.wasPressed('wheel')) { wheelOpen = !wheelOpen; $('wheel').classList.toggle('hidden', !wheelOpen); if (wheelOpen) renderWheel(); }
  if (input.wasPressed('pause')) { game.paused = !game.paused; $('pause-screen').classList.toggle('hidden', !game.paused); }
  if (input.wasPressed('horn') && player.inCar) audio.horn();
  if (input.wasPressed('hack')) {
    if (game.hackCooldown <= 0 && game.crewUnlocked.luna) {
      jamScanner(police, game, 20);
      game.hackCooldown = 60;
      audio.pickup();
    } else pushEvent('Hacker on cooldown — ' + Math.ceil(game.hackCooldown) + 's', 'crew');
  }
  if (input.wasPressed('reload')) {
    const w = CONFIG.weapons[player.weaponIdx];
    if (w.ammo !== Infinity && player.money >= 50) {
      player.money -= 50;
      player.ammo[w.id] = (player.ammo[w.id] ?? 0) + w.ammo;
      audio.pickup();
      pushEvent(`Bought ${w.name} ammo $50`, 'info');
    }
  }
  // number keys switch weapon
  for (let i = 1; i <= 5; i++) {
    if (input.wasPressed('digit' + i)) player.weaponIdx = i - 1;
  }
  // M = start next story mission, C = syndicate contract, R-race keys handled by buttons
  if (input.wasPressed('mission')) {
    if (!missions.current && missions.index < MISSIONS.length) startMission(missions, game, 'story');
  }
  if (input.wasPressed('contract')) {
    if (!missions.current && missions.contractIndex < CONTRACTS.length) {
      startMission(missions, game, 'contract');
      if (missions.current.def.id === 'c3') pushEvent('Vault stash is on the volcano — climb!', 'mission');
    }
  }
  updatePlayer(player, input, dt, world, game);
  updateTraffic(dt);
  updatePeds(dt);
  updatePolice(police, player, dt, game, rng);
  updateMissions(missions, game, dt);
  // smuggler spawn for chase mission
  const cur = missions.current;
  if (cur && cur.def.type === 'chase' && !game.smuggler) spawnSmuggler(-120, 140);
  if (cur && cur.def.type !== 'chase' && game.smuggler) { game.smuggler = null; }
  // territory income
  game.incomeTimer += dt;
  if (game.incomeTimer >= 60) {
    game.incomeTimer = 0;
    const owned = Object.keys(game.territory).filter((k) => game.territory[k]).length;
    if (owned > 0) {
      const pay = owned * 25;
      player.money += pay;
      game.stats.earned += pay;
      pushEvent(`Territory income +$${pay}`, 'mission');
      audio.cash();
    }
  }
  // siren follows wanted
  audio.siren(police.wanted > 0 && police.cars.length > 0);
  input.consumeAll();
}

// extra key bindings for M / C / digits (input.js maps only core keys)
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM') input.state.mission = true;
  if (e.code === 'KeyC') input.state.contract = true;
  if (e.code === 'KeyG') { const g = $('garage'); if (g.classList.contains('hidden')) openGarage(); else g.classList.add('hidden'); }
  if (/^Digit[1-5]$/.test(e.code)) input.state['digit' + e.code.slice(5)] = true;
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyM') input.state.mission = false;
  if (e.code === 'KeyC') input.state.contract = false;
  if (/^Digit[1-5]$/.test(e.code)) input.state['digit' + e.code.slice(5)] = false;
});
// input.wasPressed reads the pressed set; mirror M/C/digits into it via state flags
const _wasPressed = input.wasPressed.bind(input);
input.wasPressed = (action) => {
  if (action === 'mission' && input.state.mission) { input.state.mission = false; return true; }
  if (action === 'contract' && input.state.contract) { input.state.contract = false; return true; }
  if (action.startsWith('digit') && input.state[action]) { input.state[action] = false; return true; }
  return _wasPressed(action);
};

// ---------- UI wiring ----------
function bindButtons() {
  const bind = (id, action) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); input.setTouch(action, true); });
    el.addEventListener('pointerup', () => input.setTouch(action, false));
    el.addEventListener('pointerleave', () => input.setTouch(action, false));
  };
  bind('btn-up', 'forward'); bind('btn-down', 'back');
  bind('btn-left', 'left'); bind('btn-right', 'right');
  bind('btn-act', 'interact'); bind('btn-fire', 'attack');
  $('btn-wheel').addEventListener('click', () => { wheelOpen = !wheelOpen; $('wheel').classList.toggle('hidden', !wheelOpen); if (wheelOpen) renderWheel(); });
  $('btn-pause').addEventListener('click', () => { game.paused = !game.paused; $('pause-screen').classList.toggle('hidden', !game.paused); });
  $('btn-mission').addEventListener('click', () => { if (!missions.current && missions.index < MISSIONS.length) startMission(missions, game, 'story'); });
  $('btn-contract').addEventListener('click', () => { if (!missions.current && missions.contractIndex < CONTRACTS.length) startMission(missions, game, 'contract'); });
  $('btn-garage').addEventListener('click', openGarage);
  $('btn-race').addEventListener('click', () => { if (!missions.race) startRace(missions, game, RACES[game.stats.racesWon % RACES.length].id); });
  $('btn-hack').addEventListener('click', () => {
    if (game.hackCooldown <= 0) { jamScanner(police, game, 20); game.hackCooldown = 60; }
  });
  $('start-btn').addEventListener('click', () => {
    audio.unlock(); audio.setMusic(true);
    $('start-screen').classList.add('hidden');
    game.started = true;
    pushEvent('Welcome to Isla Verde — M: mission, C: contract, E: steal car, Q: weapons', 'mission');
  });
  $('resume-btn').addEventListener('click', () => { game.paused = false; $('pause-screen').classList.add('hidden'); });
  $('restart-btn').addEventListener('click', () => location.reload());
  input.bindMouse(canvas);
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}
bindButtons();
renderWheel();

// shot mode: skip start screen, place scene deterministically
if (SHOT) {
  audio.unlock = () => {};
  $('start-screen').classList.add('hidden');
  applyShot(game, SHOT);
  // render a few fixed steps so the chase scene is settled, then FREEZE the
  // simulation: the rAF loop keeps rendering this exact composed frame while
  // the headless shell's virtual clock runs out (otherwise 20 virtual seconds
  // of cops ramming would destroy the composition). 36 steps (0.6s) is enough
  // for cops + heli to close in without piling onto the player car.
  for (let i = 0; i < 36; i++) update(CONFIG.fixedDt);
  const target = new THREE.Vector3(player.x, player.y, player.z);
  // converge the chase camera fully (one call only moves ~37% from the far idle spot)
  for (let i = 0; i < 60; i++) {
    updateCamera(camera, target, 0.6, player.inCar ? (game.shotCamDist || 14) : 10, 5, 0.05, groundHeight);
  }
  renderer.render(scene, camera);
  renderHUD();
  game.paused = true;
  window.__ready = true;
} else {
  // idle camera orbit behind start screen
  camera.position.set(160, 90, 220);
  camera.lookAt(0, 20, 0);
  renderer.render(scene, camera);
}

requestAnimationFrame(tick);
window.__game = game;
