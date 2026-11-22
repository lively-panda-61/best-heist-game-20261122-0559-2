// Level data for The Velvet Vault: three museum floors, each with cover
// walls, loot (gold + one diamond), guard patrols, sweeping cameras,
// a spawn and an exit. All coordinates are pixels on a 1280x720 floor
// (32 x 18 tiles of 40px). Every loot and the exit are reachable from
// spawn, and each level keeps one safe opening loot far from every guard.
export const TILE = 40;
export const COLS = 32;
export const ROWS = 18;
export const ARENA_W = 1280;
export const ARENA_H = 720;

// Tile-center helper: tc(2, 15) is the pixel center of tile (2, 15).
export const tc = (tx, ty) => [tx * TILE + TILE / 2, ty * TILE + TILE / 2];

// Walls are tile rects {x, y, w, h}; converted to pixels by wallPixels().
function wallsPx(walls) {
  return walls.map((w) => ({ x: w.x * TILE, y: w.y * TILE, w: w.w * TILE, h: w.h * TILE }));
}

export function tileWalkable(level, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return false;
  for (const w of level.walls) {
    if (tx >= w.x && tx < w.x + w.w && ty >= w.y && ty < w.y + w.h) return false;
  }
  return true;
}

export function wallsPixels(level) {
  return wallsPx(level.walls);
}

export const LEVELS = [
  {
    name: 'The Gallery',
    sub: 'Level 1 — slip past the night watch, take the gold, reach the green door',
    walls: [
      { x: 8, y: 4, w: 4, h: 1 },
      { x: 14, y: 9, w: 1, h: 4 },
      { x: 20, y: 4, w: 4, h: 1 },
      { x: 10, y: 13, w: 5, h: 1 },
      { x: 24, y: 12, w: 1, h: 4 },
      { x: 5, y: 12, w: 1, h: 4 },
    ],
    spawn: { x: 100, y: 620 },
    exit: { x: 1160, y: 80, w: 80, h: 40 },
    loot: [
      { x: 260, y: 580, kind: 'gold', value: 100 },
      { x: 500, y: 140, kind: 'gold', value: 100 },
      { x: 740, y: 540, kind: 'gold', value: 100 },
      { x: 1060, y: 340, kind: 'gold', value: 100 },
      { x: 660, y: 140, kind: 'diamond', value: 250 },
    ],
    guards: [
      { x: 660, y: 300, waypoints: [tc(16, 7), tc(22, 7), tc(22, 11), tc(16, 11)], speed: 60 },
      { x: 980, y: 180, waypoints: [tc(24, 4), tc(28, 4), tc(28, 10), tc(24, 10)], speed: 60 },
      { x: 180, y: 260, waypoints: [tc(4, 6), tc(12, 6)], speed: 55 },
    ],
    cameras: [
      { x: 660, y: 90, dir: Math.PI / 2, sweep: 0.6, range: 280, speed: 0.7 },
      { x: 1220, y: 380, dir: Math.PI, sweep: 0.5, range: 260, speed: 0.9 },
    ],
  },
  {
    name: 'The Vault Floor',
    sub: 'Level 2 — more walls, more eyes; the diamond sits in the middle of it all',
    walls: [
      { x: 6, y: 3, w: 8, h: 1 },
      { x: 18, y: 3, w: 8, h: 1 },
      { x: 6, y: 8, w: 1, h: 5 },
      { x: 12, y: 10, w: 6, h: 1 },
      { x: 20, y: 8, w: 1, h: 5 },
      { x: 24, y: 12, w: 5, h: 1 },
      { x: 10, y: 14, w: 1, h: 3 },
      { x: 26, y: 5, w: 1, h: 4 },
    ],
    spawn: { x: 100, y: 620 },
    exit: { x: 40, y: 80, w: 80, h: 40 },
    loot: [
      { x: 180, y: 260, kind: 'gold', value: 100 },
      { x: 420, y: 220, kind: 'gold', value: 100 },
      { x: 660, y: 500, kind: 'gold', value: 100 },
      { x: 900, y: 260, kind: 'gold', value: 100 },
      { x: 1220, y: 620, kind: 'gold', value: 100 },
      { x: 660, y: 260, kind: 'diamond', value: 250 },
    ],
    guards: [
      { x: 420, y: 180, waypoints: [tc(10, 4), tc(14, 4), tc(14, 8), tc(10, 8)], speed: 65 },
      { x: 900, y: 180, waypoints: [tc(22, 4), tc(24, 4), tc(24, 9), tc(22, 9)], speed: 65 },
      { x: 300, y: 500, waypoints: [tc(7, 12), tc(7, 16), tc(9, 16), tc(9, 12)], speed: 60 },
      { x: 900, y: 580, waypoints: [tc(22, 14), tc(28, 14), tc(28, 16), tc(22, 16)], speed: 60 },
    ],
    cameras: [
      { x: 660, y: 90, dir: Math.PI / 2, sweep: 0.6, range: 280, speed: 0.8 },
      { x: 1240, y: 340, dir: Math.PI, sweep: 0.5, range: 260, speed: 1.0 },
      { x: 60, y: 340, dir: 0, sweep: 0.4, range: 260, speed: 0.6 },
    ],
  },
  {
    name: 'The Crown Room',
    sub: 'Level 3 — the Crown Diamond, five guards, three cameras, one clean getaway',
    walls: [
      { x: 5, y: 5, w: 6, h: 1 },
      { x: 15, y: 2, w: 1, h: 5 },
      { x: 21, y: 5, w: 6, h: 1 },
      { x: 9, y: 11, w: 4, h: 1 },
      { x: 18, y: 11, w: 4, h: 1 },
      { x: 13, y: 7, w: 6, h: 1 },
      { x: 26, y: 11, w: 1, h: 4 },
      { x: 5, y: 13, w: 1, h: 3 },
    ],
    spawn: { x: 100, y: 620 },
    exit: { x: 1160, y: 80, w: 80, h: 40 },
    loot: [
      { x: 140, y: 340, kind: 'gold', value: 100 },
      { x: 340, y: 140, kind: 'gold', value: 100 },
      { x: 500, y: 580, kind: 'gold', value: 100 },
      { x: 780, y: 180, kind: 'gold', value: 100 },
      { x: 980, y: 580, kind: 'gold', value: 100 },
      { x: 1140, y: 300, kind: 'gold', value: 100 },
      { x: 660, y: 380, kind: 'diamond', value: 250 },
    ],
    guards: [
      { x: 300, y: 260, waypoints: [tc(7, 6), tc(12, 6), tc(12, 10), tc(7, 10)], speed: 70 },
      { x: 780, y: 260, waypoints: [tc(19, 6), tc(25, 6), tc(25, 10), tc(19, 10)], speed: 70 },
      { x: 460, y: 540, waypoints: [tc(11, 13), tc(16, 13), tc(16, 16), tc(11, 16)], speed: 65 },
      { x: 980, y: 100, waypoints: [tc(24, 2), tc(28, 2), tc(28, 4), tc(24, 4)], speed: 65 },
      { x: 140, y: 140, waypoints: [tc(3, 3), tc(7, 3)], speed: 60 },
    ],
    cameras: [
      { x: 660, y: 90, dir: Math.PI / 2, sweep: 0.6, range: 280, speed: 0.9 },
      { x: 1240, y: 500, dir: Math.PI, sweep: 0.5, range: 260, speed: 1.0 },
      { x: 60, y: 180, dir: 0, sweep: 0.4, range: 260, speed: 0.7 },
    ],
  },
];
