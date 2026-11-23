// Isla Verde — config.js
// All tuning constants for the volcanic-island open world. Seeded, no clocks.
export const CONFIG = {
  seed: 20261124,
  worldSize: 900,            // island spans -450..450
  seaLevel: 0,
  gravity: 22,
  walkSpeed: 7,
  runSpeed: 11,
  carAccel: 26,
  carMaxSpeed: 42,
  carBrake: 40,
  carTurn: 1.9,
  fixedDt: 1 / 60,
  moneyStart: 250,
  wantedMax: 5,
  saveKey: 'isla-verde-save-v1',
  districts: [
    { id: 'port',    name: 'Porto Verde',   center: [120, 40],   radius: 110, color: '#e8a33d' },
    { id: 'beach',   name: 'Playa Sol',     center: [-160, 180], radius: 120, color: '#3dc7e8' },
    { id: 'jungle',  name: 'Selva Verde',   center: [-180, -160],radius: 130, color: '#3da33d' },
    { id: 'volcano', name: 'Monte Fuego',   center: [0, -40],    radius: 120, color: '#e83d3d' },
    { id: 'town',    name: 'Villa Luna',    center: [60, 200],   radius: 100, color: '#b83de8' },
  ],
  garageUpgrades: [
    { id: 'engine', name: 'Engine Turbo',   levels: 3, costs: [400, 900, 1800], desc: '+15% top speed / level' },
    { id: 'armor',  name: 'Armor Plating',  levels: 3, costs: [350, 800, 1500], desc: '+25% durability / level' },
    { id: 'nitro',  name: 'Nitro Boost',    levels: 3, costs: [500, 1100, 2200], desc: 'Shift = nitro burst / level' },
  ],
  weapons: [
    { id: 'fists',  name: 'Fists',   damage: 12,  range: 2.2,  ammo: Infinity, rate: 0.35, color: '#cccccc' },
    { id: 'bat',    name: 'Bat',     damage: 25,  range: 2.8,  ammo: Infinity, rate: 0.5,  color: '#c98a4b' },
    { id: 'pistol', name: 'Pistol',  damage: 22,  range: 55,   ammo: 120,      rate: 0.28, color: '#888888' },
    { id: 'smg',    name: 'SMG',     damage: 14,  range: 45,   ammo: 240,      rate: 0.09, color: '#444444' },
    { id: 'shotgun',name: 'Shotgun', damage: 16,  range: 22,   ammo: 48,       rate: 0.8,  color: '#7a3d1e', pellets: 6 },
  ],
  crew: [
    { id: 'rico',  name: 'Rico — Getaway Driver', desc: 'Getaway cars spawn closer; +20% escape speed', cost: 0 },
    { id: 'luna',  name: 'Luna — Hacker',         desc: 'H: jam police scanner 20s (cooldown 60s)',     cost: 0 },
  ],
};

export const MISSIONS = [
  { id: 'm1',  name: 'Welcome to Isla Verde',  district: 'port',    type: 'drive',   target: [120, 40],   reward: 300,  brief: 'Drive to Porto Verde dock and meet Rico.' },
  { id: 'm2',  name: 'Beach Delivery',         district: 'beach',   type: 'drive',   target: [-160, 180], reward: 450,  brief: 'Deliver the package to Playa Sol before the tide turns.' },
  { id: 'm3',  name: 'Jungle Drop',            district: 'jungle',  type: 'deliver', target: [-180, -160],reward: 600,  brief: 'Drop the crate deep in Selva Verde. Stay off the main road.' },
  { id: 'm4',  name: 'Volcano Run',            district: 'volcano', type: 'race',    target: [0, -40],    reward: 800,  brief: 'Race the ridge road around Monte Fuego. Beat 75s.' },
  { id: 'm5',  name: 'Port Heist',             district: 'port',    type: 'steal',   target: [150, 10],   reward: 1000, brief: 'Steal the marked car at the docks and lose the cops.' },
  { id: 'm6',  name: 'Town Pickup',            district: 'town',    type: 'drive',   target: [60, 200],   reward: 700,  brief: 'Pick up Luna in Villa Luna and bring her to the garage.' },
  { id: 'm7',  name: 'Smuggler Beach',         district: 'beach',   type: 'chase',   target: [-120, 140], reward: 1200, brief: 'Chase down the smuggler buggy on Playa Sol.' },
  { id: 'm8',  name: 'Ashfall Escape',         district: 'volcano', type: 'escape',  target: [40, -120],  reward: 1500, brief: 'Lose a 3-star wanted level near the volcano.' },
  { id: 'm9',  name: 'Jungle Ambush',          district: 'jungle',  type: 'combat',  target: [-140, -120],reward: 1800, brief: 'Clear the ambush crew in Selva Verde.' },
  { id: 'm10', name: 'King of Isla Verde',     district: 'port',    type: 'finale',  target: [120, 40],   reward: 5000, brief: 'Finale: take the syndicate convoy, hold the port, own the island.' },
];

export const CONTRACTS = [
  { id: 'c1', name: 'The Don\'s Errand',   chain: 1, reward: 900,  brief: 'Move Don Vega\'s goods from port to jungle. No cops.' },
  { id: 'c2', name: 'Silent Docks',        chain: 2, reward: 1400, brief: 'Sink the rival shipment at the docks. Quietly.' },
  { id: 'c3', name: 'Volcano Vault',       chain: 3, reward: 2200, brief: 'Crack the vault stash hidden on Monte Fuego.' },
  { id: 'c4', name: 'Beachfront War',      chain: 4, reward: 3200, brief: 'Take Playa Sol territory from the rival crew.' },
  { id: 'c5', name: 'El Patron',           chain: 5, reward: 6000, brief: 'Dethrone El Patron in a convoy ambush at the port.' },
];

export const RACES = [
  { id: 'r1', name: 'Coast Sprint',   checkpoints: [[-160, 180], [-40, 220], [120, 160], [200, 40]],  par: 70 },
  { id: 'r2', name: 'Volcano Loop',   checkpoints: [[0, -40], [90, -100], [-90, -100], [0, 40]],      par: 80 },
  { id: 'r3', name: 'Jungle Dash',    checkpoints: [[-180, -160], [-60, -200], [40, -140], [-100, -60]], par: 75 },
];

export const STUNT_RAMPS = [
  { pos: [40, 120],  angle: 0.6 },
  { pos: [-60, 60],  angle: -0.9 },
  { pos: [160, -60], angle: 2.2 },
  { pos: [-140, 40], angle: 1.4 },
];
