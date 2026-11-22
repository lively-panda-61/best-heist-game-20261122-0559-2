// Every tuning number and colour in one place. The playfield is a fixed 1280x720
// logical area; the renderer scales it to the window, so no rule below depends
// on the screen size.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  walkSpeed: 175,
  runSpeed: 265,
  sneakSpeed: 92,
  /** Radius in which running is heard by guards. */
  noiseRadius: 180,
};

export const GUARD = {
  radius: 15,
  patrolSpeed: 72,
  chaseSpeed: 152,
  investigateSpeed: 110,
  /** How far a guard can see while the player walks. */
  viewDistance: 220,
  /** Sneaking shrinks a guard's view distance by this factor. */
  sneakFactor: 0.55,
  /** Half of the guard's vision cone, in radians. */
  halfAngle: 0.61,
  /** Alarm points per second while a guard has eyes on the player. */
  alarmRate: 55,
  /** Radius inside which a guard catches the player. */
  catchRadius: 27,
  /** Seconds a guard keeps chasing after losing sight. */
  chaseMemory: 3,
  /** Seconds a guard looks around an investigated spot. */
  investigateTime: 2,
};

export const CAMERA = {
  viewDistance: 260,
  sneakFactor: 0.8,
  halfAngle: 0.44,
  alarmRate: 40,
  /** Radians a camera sweeps either side of its base angle. */
  sweepAmplitude: 0.55,
  /** Radians per second of the sweep. */
  sweepSpeed: 0.55,
};

export const ALARM = {
  max: 100,
  /** Points per second the alarm falls while nobody sees the player. */
  decayRate: 6,
  /** At this level the building locks down and every guard hunts. */
  lockdown: 100,
};

export const TOOLS = {
  smokePerLevel: 3,
  empPerLevel: 2,
  smokeDuration: 6,
  smokeRadius: 130,
  empDuration: 6,
  /** Score a smoke bomb costs to throw. Tools are cheap, never free. */
  smokeCost: 25,
  empCost: 50,
};

export const LOOT = {
  pickupRadius: 30,
  requiredValue: 500,
};

export const PALETTE = {
  floor: '#171a24',
  floorTile: '#1d212e',
  floorLine: '#232839',
  wall: '#2e3448',
  wallTop: '#4a5470',
  wallShadow: '#12141d',
  exit: '#2fd67a',
  exitGlow: '#2fd67a',
  loot: '#ffd34d',
  lootRequired: '#37e0ff',
  guard: '#e5534b',
  guardCone: 'rgba(255, 214, 64, 0.20)',
  guardConeAlert: 'rgba(229, 83, 75, 0.34)',
  camera: '#ff9f43',
  cameraCone: 'rgba(255, 159, 67, 0.18)',
  player: '#39d0ba',
  playerDark: '#1d8a7c',
  smoke: 'rgba(200, 205, 220, 0.30)',
  hud: '#0d0f16',
  hudPanel: '#1c2130',
  text: '#eef1f5',
  muted: '#9aa3b5',
  danger: '#ff5a4e',
  gold: '#ffd34d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best haul is kept between visits (this browser only). */
export const BEST_KEY = 'midnight-vault.best';
