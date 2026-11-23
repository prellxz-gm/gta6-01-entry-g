// Isla Verde — missions.js
// 10 story missions + 5 syndicate contracts + street races.
// Objectives are checked against the player position / game state each tick.
import { MISSIONS, CONTRACTS, RACES } from './config.js';

export function createMissions() {
  return {
    list: MISSIONS,
    index: 0,                 // next story mission
    done: [],
    current: null,            // active mission object {def, kind, t, cp}
    contracts: CONTRACTS,
    contractIndex: 0,
    contractDone: [],
    race: null,               // active race {def, cp, t}
    raceBest: {},
    startTime: 0,
    marker: null,
  };
}

export function startMission(m, game, kind = 'story') {
  const def = kind === 'contract' ? CONTRACTS[m.contractIndex] : MISSIONS[m.index];
  m.current = { def, kind, t: 0, cp: 0, phase: 0 };
  m.startTime = game.time;
  game.events.push({ type: 'mission', text: `${kind === 'contract' ? 'CONTRACT' : 'MISSION'}: ${def.name}` });
  game.events.push({ type: 'mission', text: def.brief });
  game.audio.missionStart();
  return m.current;
}

export function completeMission(m, game) {
  const cur = m.current;
  if (!cur) return;
  const p = game.player;
  p.money += cur.def.reward;
  game.stats.earned += cur.def.reward;
  game.events.push({ type: 'mission', text: `✓ ${cur.def.name} complete! +$${cur.def.reward}` });
  game.audio.missionComplete();
  game.police.wanted = Math.max(0, game.police.wanted - 1);
  if (cur.kind === 'story') { m.done.push(cur.def.id); m.index = Math.min(MISSIONS.length, m.index + 1); }
  else { m.contractDone.push(cur.def.id); m.contractIndex = Math.min(CONTRACTS.length, m.contractIndex + 1); }
  // district standing + territory income unlock
  const d = cur.def.district;
  if (d) {
    game.standing[d] = Math.min(100, (game.standing[d] || 0) + 15);
    game.territory[d] = true;
  }
  m.current = null;
  game.saveGame();
}

export function failMission(m, game, why) {
  if (!m.current) return;
  game.events.push({ type: 'mission', text: `✗ ${m.current.def.name} failed — ${why}` });
  game.audio.missionFail();
  m.current = null;
}

export function markerTarget(m) {
  if (m.race) {
    const cp = m.race.def.checkpoints[m.race.cp];
    return cp || null;
  }
  if (m.current) return m.current.def.target;
  const next = MISSIONS[m.index];
  return next ? next.target : null;
}

export function updateMissions(m, game, dt) {
  const p = game.player;
  if (m.race) {
    const r = m.race;
    r.t += dt;
    const cp = r.def.checkpoints[r.cp];
    if (cp && Math.hypot(p.x - cp[0], p.z - cp[1]) < 14) {
      r.cp++;
      game.audio.checkpoint();
      game.events.push({ type: 'race', text: `Checkpoint ${r.cp}/${r.def.checkpoints.length}` });
      if (r.cp >= r.def.checkpoints.length) {
        const won = r.t <= r.def.par;
        const reward = won ? 600 : 150;
        p.money += reward;
        game.stats.earned += reward;
        const prev = m.raceBest[r.def.id];
        if (!prev || r.t < prev) m.raceBest[r.def.id] = Math.round(r.t * 10) / 10;
        game.events.push({ type: 'race', text: won ? `RACE WON ${r.t.toFixed(1)}s +$${reward}` : `Race done ${r.t.toFixed(1)}s (par ${r.def.par}s) +$${reward}` });
        m.race = null;
        game.saveGame();
      }
    }
    if (r.t > 240) { game.events.push({ type: 'race', text: 'Race timed out.' }); m.race = null; }
    return;
  }
  const cur = m.current;
  if (!cur) return;
  cur.t += dt;
  const [tx, tz] = cur.def.target;
  const d = Math.hypot(p.x - tx, p.z - tz);
  switch (cur.def.type) {
    case 'drive':
    case 'deliver':
    case 'finale':
      if (d < 12) completeMission(m, game);
      break;
    case 'race':
      if (d < 12) {
        if (cur.t <= 75) completeMission(m, game);
        else failMission(m, game, 'too slow — over 75s');
      }
      break;
    case 'steal':
      if (d < 12 && p.inCar && p.inCar.stolen) completeMission(m, game);
      else if (d < 12 && !p.inCar) game.hint = 'Steal the marked car first (E near a parked car)!';
      break;
    case 'chase': {
      // smuggler buggy flees; catch = get within 8
      const b = game.smuggler;
      if (b && Math.hypot(p.x - b.x, p.z - b.z) < 8) completeMission(m, game);
      if (cur.t > 150) failMission(m, game, 'smuggler got away');
      break;
    }
    case 'escape':
      if (game.police.wanted >= 3) cur.phase = 1;
      if (cur.phase === 1 && game.police.wanted === 0) completeMission(m, game);
      if (cur.t > 240) failMission(m, game, 'time up');
      break;
    case 'combat':
      if (cur.phase === 0 && d < 30) {
        cur.phase = 1;
        game.spawnAmbush(tx, tz);
        game.events.push({ type: 'mission', text: 'Ambush! Clear the crew!' });
      }
      if (cur.phase === 1 && game.ambushLeft <= 0) completeMission(m, game);
      break;
    default:
      if (d < 12) completeMission(m, game);
  }
  if (cur && cur.t > 600) failMission(m, game, 'time up');
}

export function startRace(m, game, raceId) {
  const def = RACES.find((r) => r.id === raceId) || RACES[0];
  m.race = { def, cp: 0, t: 0 };
  game.events.push({ type: 'race', text: `RACE: ${def.name} — par ${def.par}s` });
  game.audio.missionStart();
}
