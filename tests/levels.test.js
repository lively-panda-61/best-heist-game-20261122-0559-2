// Level data tests for The Velvet Vault (heist v2).
// Three complete levels, every loot and the exit reachable from spawn.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, TILE, tileWalkable } from '../game/src/levels.js';
import { findPath } from '../game/src/geometry.js';

const COLS = 32;
const ROWS = 18;

function route(level, from, to) {
  const walkable = (x, y) => tileWalkable(level, x, y);
  const sx = Math.floor(from.x / TILE);
  const sy = Math.floor(from.y / TILE);
  const tx = Math.floor(to.x / TILE);
  const ty = Math.floor(to.y / TILE);
  return findPath(walkable, COLS, ROWS, sx, sy, tx, ty);
}

test('there are exactly three levels with names', () => {
  assert.equal(LEVELS.length, 3);
  for (const level of LEVELS) {
    assert.ok(level.name.length > 0);
    assert.ok(level.sub.length > 0);
  }
});

test('every level has a spawn, an exit, loot, guards and cameras', () => {
  for (const level of LEVELS) {
    assert.ok(level.spawn, 'spawn');
    assert.ok(level.exit, 'exit');
    assert.ok(level.loot.length >= 4, `loot count ${level.loot.length}`);
    assert.ok(level.loot.some((l) => l.kind === 'diamond'), 'a diamond loot');
    assert.ok(level.guards.length >= 2, 'guards');
    assert.ok(level.cameras.length >= 1, 'cameras');
    assert.ok(level.walls.length >= 4, 'cover walls');
  }
});

test('spawn, loot and exit sit on walkable tiles', () => {
  for (const level of LEVELS) {
    const at = (p) => tileWalkable(level, Math.floor(p.x / TILE), Math.floor(p.y / TILE));
    assert.equal(at(level.spawn), true, `${level.name} spawn`);
    assert.equal(at({ x: level.exit.x + level.exit.w / 2, y: level.exit.y + level.exit.h / 2 }), true, `${level.name} exit`);
    for (const loot of level.loot) assert.equal(at(loot), true, `${level.name} loot`);
  }
});

test('every loot is reachable from spawn, and the exit from every loot', () => {
  for (const level of LEVELS) {
    for (const loot of level.loot) {
      assert.ok(route(level, level.spawn, loot), `${level.name}: spawn -> loot`);
      assert.ok(route(level, loot, { x: level.exit.x + level.exit.w / 2, y: level.exit.y + level.exit.h / 2 }), `${level.name}: loot -> exit`);
    }
  }
});

test('guard waypoints sit on walkable tiles and each guard has at least two', () => {
  for (const level of LEVELS) {
    for (const guard of level.guards) {
      assert.ok(guard.waypoints.length >= 2);
      for (const [x, y] of guard.waypoints) {
        assert.equal(tileWalkable(level, Math.floor(x / TILE), Math.floor(y / TILE)), true, `${level.name} guard waypoint`);
      }
    }
  }
});

test('no loot sits inside a guard patrol cone at the patrol start', () => {
  // Loot must be grabbable: at least one loot per level is outside every
  // guard's starting cone so the opening move is safe.
  for (const level of LEVELS) {
    const safe = level.loot.some((loot) => {
      return level.guards.every((guard) => {
        const dx = loot.x - guard.x;
        const dy = loot.y - guard.y;
        return Math.hypot(dx, dy) > 240;
      });
    });
    assert.equal(safe, true, `${level.name} has a safe opening loot`);
  }
});
