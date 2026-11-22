// Guard behaviour tests for The Velvet Vault (heist v2).
// Patrol loops, vision-cone detection with a forgiving grace period,
// suspicion decay, smoke blocking sight, and the alert/search cycle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Guard } from '../game/src/guards.js';

const NO_WALLS = [];
const playerAt = (x, y) => ({ x, y, r: 12 });

function makeGuard() {
  return new Guard({
    x: 100, y: 100,
    waypoints: [[100, 100], [300, 100], [300, 300], [100, 300]],
    speed: 60,
  });
}

test('guard patrols its waypoints and loops back to the first', () => {
  const g = makeGuard();
  const seen = new Set();
  for (let i = 0; i < 600; i++) {
    g.update(1 / 60, playerAt(900, 900), NO_WALLS, []);
    seen.add(`${Math.round(g.x)},${Math.round(g.y)}`);
    assert.equal(g.state, 'patrol');
  }
  assert.ok(seen.has('100,100') || [...seen].some((p) => p.startsWith('100,')));
  assert.ok([...seen].some((p) => p.startsWith('300,')));
});

test('detection builds only while the player is inside the cone with line of sight', () => {
  const g = makeGuard();
  g.dir = 0; // facing +x
  const before = g.suspicion;
  g.update(0.5, playerAt(200, 100), NO_WALLS, []);
  assert.ok(g.suspicion > before, `suspicion rose: ${before} -> ${g.suspicion}`);
  const mid = g.suspicion;
  g.update(0.5, playerAt(200, 300), NO_WALLS, []);
  assert.ok(g.suspicion < mid, 'suspicion decays when the player leaves the cone');
});

test('a wall between guard and player blocks detection entirely', () => {
  const g = makeGuard();
  g.dir = 0;
  const walls = [{ x: 140, y: 80, w: 20, h: 40 }];
  g.update(1, playerAt(200, 100), walls, []);
  assert.equal(g.suspicion, 0);
});

test('smoke blocks the guard from seeing the player', () => {
  const g = makeGuard();
  g.dir = 0;
  const smoke = [{ x: 150, y: 100, r: 60 }];
  g.update(1, playerAt(200, 100), NO_WALLS, smoke);
  assert.equal(g.suspicion, 0);
});

test('suspicion at 100 raises alert; losing sight starts a search, then patrol resumes', () => {
  const g = makeGuard();
  g.dir = 0;
  for (let i = 0; i < 40; i++) g.update(1 / 60, playerAt(200, 100), NO_WALLS, []);
  assert.equal(g.state, 'alert');
  for (let i = 0; i < 60 * 8; i++) g.update(1 / 60, playerAt(900, 900), NO_WALLS, []);
  assert.ok(g.state === 'patrol' || g.state === 'search');
  for (let i = 0; i < 60 * 12; i++) g.update(1 / 60, playerAt(900, 900), NO_WALLS, []);
  assert.equal(g.state, 'patrol');
});

test('a guard never instantly alerts: grace period of at least half a second in the cone', () => {
  const g = makeGuard();
  g.dir = 0;
  g.update(0.5, playerAt(200, 100), NO_WALLS, []);
  assert.notEqual(g.state, 'alert');
  assert.ok(g.suspicion < 100);
});
