// Isla Verde — shots.js
// Deterministic screenshot scenes (?shot=start|play|chase|end&seed=1).
// Each shot places the player, cars, cops and HUD state, then renders one frame.
export const SHOT_DEFS = {
  start: { label: 'Isla Verde — title', wanted: 0, inCar: false, pos: [118, 62], cops: 0, traffic: 4 },
  play: { label: 'Driving the coast road', wanted: 1, inCar: true, pos: [60, 140], cops: 1, traffic: 8 },
  chase: { label: 'High-speed police chase', wanted: 4, inCar: true, pos: [170, 170], cops: 4, traffic: 10, heli: true },
  end: { label: 'King of Isla Verde', wanted: 0, inCar: true, pos: [90, 100], cops: 0, traffic: 6, missionDone: true },
};

export function applyShot(game, shotName) {
  const def = SHOT_DEFS[shotName];
  if (!def) return false;
  const p = game.player;
  p.x = def.pos[0]; p.z = def.pos[1];
  p.yaw = 0.6; p.y = 0;
  game.police.wanted = def.wanted;
  game.police.heat = def.wanted * 20;
  // seed traffic deterministically around the player
  game.traffic.length = 0;
  for (let i = 0; i < def.traffic; i++) {
    const a = (i / def.traffic) * Math.PI * 2;
    game.spawnTrafficCar(p.x + Math.cos(a) * (18 + i * 4), p.z + Math.sin(a) * (18 + i * 4), a);
  }
  // cops for chase shots — ahead and to the sides, never between camera and player
  for (let i = 0; i < def.cops; i++) {
    const a = (i / Math.max(1, def.cops)) * Math.PI * 2 + 2.4;
    game.spawnCopAt(p.x + Math.cos(a) * 30, p.z + Math.sin(a) * 30);
  }
  if (def.heli) game.forceHeli();
  if (shotName === 'chase') { game.shotCamDist = 10.5; game.shotCamHeight = 4.5; }
  if (def.inCar) {
    const car = game.spawnPlayerCar(p.x, p.z, 0.6);
    game.enterPlayerCar(car);
    p.speed = 22;
  }
  if (def.missionDone) {
    game.missions.index = 10;
    game.missions.done = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10'];
    game.territory = { port: true, beach: true, jungle: true, volcano: true, town: true };
    game.standing = { port: 100, beach: 100, jungle: 100, volcano: 100, town: 100 };
    p.money = 12840;
    game.stats.earned = 12840;
  } else if (shotName === 'play' || shotName === 'chase') {
    game.startStoryMission(0);
  }
  game.shotMode = shotName;
  game.started = true;
  game.paused = false;
  return true;
}
