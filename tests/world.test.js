// Unit tests for the heist simulation (pure logic, no DOM).
// Run: node --test tests/world.test.js
// Written BEFORE the implementation (TDD red phase).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, EVENT_LOOT, EVENT_WIN, EVENT_CAUGHT, EVENT_SPOTTED } from '../game/src/world.js';
import { LEVELS } from '../game/src/levels.js';
import { createRandom } from '../game/src/random.js';

function fresh(level = 0) {
  return createWorld(level, createRandom(1234));
}

/** Park every guard in the far corner so a test reads camera vision alone. */
function parkGuards(world) {
  for (const guard of world.state.guards) {
    guard.x = 60;
    guard.y = 60;
    guard.waypoints = [{ x: 60, y: 60 }];
    guard.waypointIndex = 0;
  }
}

test('three levels exist, each with loot, guards, cameras and an exit', () => {
  assert.equal(LEVELS.length, 3);
  for (const level of LEVELS) {
    assert.ok(level.name.length > 0);
    assert.ok(level.loot.length >= 1, 'level needs loot');
    assert.ok(level.loot.some((l) => l.required), 'level needs required loot');
    assert.ok(level.guards.length >= 2, 'level needs guards');
    assert.ok(level.cameras.length >= 1, 'level needs cameras');
    assert.ok(level.exit.w > 0 && level.exit.h > 0, 'level needs an exit');
    assert.ok(level.playerStart.x > 0 && level.playerStart.y > 0);
  }
});

test('player moves with input and is stopped by walls', () => {
  const world = fresh(0);
  const startX = world.state.player.x;
  const startY = world.state.player.y;
  world.step(0.5, { x: 1, y: 0 });
  assert.ok(world.state.player.x > startX, 'player moves right');
  assert.equal(world.state.player.y, startY, 'no vertical drift');

  // Push the player into the left outer wall for a long time: it must not leave the field.
  for (let i = 0; i < 120; i++) world.step(1 / 60, { x: -1, y: 0 });
  assert.ok(world.state.player.x >= 14, 'player stays inside the field');
});

test('running is faster than walking, sneaking is slower', () => {
  const a = fresh(0);
  a.step(1, { x: 1, y: 0 });
  const walkDx = a.state.player.x;
  const b = fresh(0);
  b.step(1, { x: 1, y: 0, run: true });
  assert.ok(b.state.player.x > walkDx, 'running covers more ground');
  const c = fresh(0);
  c.step(1, { x: 1, y: 0, sneak: true });
  assert.ok(c.state.player.x < walkDx, 'sneaking covers less ground');
});

test('collecting loot raises score and marks it taken', () => {
  const world = fresh(0);
  const loot = world.state.loot[0];
  world.debugPlace(loot.x, loot.y);
  const events = world.step(1 / 60, { x: 0, y: 0 });
  assert.ok(events & EVENT_LOOT, 'loot event fires');
  assert.ok(loot.taken, 'loot is marked taken');
  assert.ok(world.state.score > 0, 'score increases');
});

test('win requires all required loot, then reaching the exit', () => {
  const world = fresh(0);
  const exit = world.state.exit;
  world.debugPlace(exit.x + exit.w / 2, exit.y + exit.h / 2);
  let events = world.step(1 / 60, { x: 0, y: 0 });
  assert.equal(events & EVENT_WIN, 0, 'no win without the loot');
  assert.equal(world.state.status, 'playing');

  for (const loot of world.state.loot.filter((l) => l.required)) {
    world.debugPlace(loot.x, loot.y);
    world.step(1 / 60, { x: 0, y: 0 });
  }
  world.debugPlace(exit.x + exit.w / 2, exit.y + exit.h / 2);
  events = world.step(1 / 60, { x: 0, y: 0 });
  assert.ok(events & EVENT_WIN, 'win fires at the exit with the loot');
  assert.equal(world.state.status, 'won');
});

test('a guard sees the player in its cone and the alarm rises', () => {
  const world = fresh(0);
  const guard = world.state.guards[0];
  // Stand directly in front of the guard, well inside its view distance.
  const fx = Math.cos(guard.angle);
  const fy = Math.sin(guard.angle);
  world.debugPlace(guard.x + fx * 80, guard.y + fy * 80);
  const alarmBefore = world.state.alarm;
  const events = world.step(0.5, { x: 0, y: 0 });
  assert.ok(events & EVENT_SPOTTED, 'spotted event fires');
  assert.ok(world.state.alarm > alarmBefore, 'alarm rises while seen');
});

test('a guard cannot see through a wall', () => {
  const world = fresh(0);
  // Level 0 has a wall between the first guard's start and a point behind it;
  // use the exported line-of-sight helper on a walled pair instead of guessing.
  const walls = world.state.walls;
  assert.ok(walls.length > 0, 'level has walls');
  const wall = walls[0];
  // Put the player just behind the wall, the guard just in front of it.
  const guard = world.state.guards[0];
  guard.x = wall.x - 60;
  guard.y = wall.y + wall.h / 2;
  guard.angle = 0; // facing right, straight at the wall
  world.debugPlace(wall.x + wall.w + 60, wall.y + wall.h / 2);
  const alarmBefore = world.state.alarm;
  world.step(0.5, { x: 0, y: 0 });
  assert.equal(world.state.alarm, alarmBefore, 'alarm stays flat behind a wall');
});

test('a camera raises the alarm when the player crosses its sweeping cone', () => {
  const world = fresh(0);
  parkGuards(world);
  const camera = world.state.cameras[0];
  const angle = camera.angle;
  world.debugPlace(camera.x + Math.cos(angle) * 100, camera.y + Math.sin(angle) * 100);
  const alarmBefore = world.state.alarm;
  world.step(0.5, { x: 0, y: 0 });
  assert.ok(world.state.alarm > alarmBefore, 'camera raises the alarm');
});

test('alarm decays when nobody sees the player', () => {
  const world = fresh(0);
  world.state.alarm = 50;
  // Hide the player in the starting corner, far from every cone.
  world.debugPlace(40, 680);
  for (let i = 0; i < 60; i++) world.step(1 / 60, { x: 0, y: 0 });
  assert.ok(world.state.alarm < 50, 'alarm decays while hidden');
});

test('smoke bomb hides the player from a guard', () => {
  const world = fresh(0);
  const guard = world.state.guards[0];
  const fx = Math.cos(guard.angle);
  const fy = Math.sin(guard.angle);
  world.debugPlace(guard.x + fx * 80, guard.y + fy * 80);
  const smokeBefore = world.state.tools.smoke;
  const events = world.step(1 / 60, { x: 0, y: 0, smoke: true });
  assert.equal(world.state.tools.smoke, smokeBefore - 1, 'smoke is spent');
  assert.ok(world.state.smokeTimer > 0, 'smoke cloud is active');
  const alarmBefore = world.state.alarm;
  world.step(0.5, { x: 0, y: 0 });
  assert.equal(events & EVENT_SPOTTED, 0, 'no spotted event under smoke');
  assert.equal(world.state.alarm, alarmBefore, 'alarm stays flat under smoke');
});

test('EMP disables cameras for a while', () => {
  const world = fresh(0);
  parkGuards(world);
  const camera = world.state.cameras[0];
  const angle = camera.angle;
  world.debugPlace(camera.x + Math.cos(angle) * 100, camera.y + Math.sin(angle) * 100);
  const empBefore = world.state.tools.emp;
  world.step(1 / 60, { x: 0, y: 0, emp: true });
  assert.equal(world.state.tools.emp, empBefore - 1, 'EMP is spent');
  assert.ok(camera.disabledTimer > 0, 'camera is disabled');
  const alarmBefore = world.state.alarm;
  world.step(0.5, { x: 0, y: 0 });
  assert.equal(world.state.alarm, alarmBefore, 'disabled camera raises no alarm');
});

test('at full alarm guards hunt, and a caught player loses', () => {
  const world = fresh(0);
  world.state.alarm = 100;
  const guard = world.state.guards[0];
  world.debugPlace(guard.x + 20, guard.y);
  const events = world.step(1 / 60, { x: 0, y: 0 });
  assert.ok(events & EVENT_CAUGHT, 'caught event fires on contact at full alarm');
  assert.equal(world.state.status, 'caught');
});

test('sneaking shrinks the distance at which a guard spots the player', () => {
  const world = fresh(0);
  // The second guard patrols the east room, far from every camera: a clean
  // read of guard vision alone.
  const guard = world.state.guards[1];
  const fx = Math.cos(guard.angle);
  const fy = Math.sin(guard.angle);
  // 200 away: inside a guard's normal view distance, outside the sneaking one.
  world.debugPlace(guard.x + fx * 200, guard.y + fy * 200);
  world.step(0.5, { x: 0, y: 0, sneak: true });
  assert.equal(world.state.alarm, 0, 'sneaking player is not spotted at 200');
  world.state.alarm = 0;
  world.step(0.5, { x: 0, y: 0 });
  assert.ok(world.state.alarm > 0, 'walking player is spotted at 200');
});

test('reset restores a fresh level', () => {
  const world = fresh(0);
  world.state.alarm = 80;
  world.state.score = 500;
  world.reset();
  assert.equal(world.state.alarm, 0, 'alarm resets');
  assert.equal(world.state.score, 0, 'score resets');
  assert.equal(world.state.status, 'playing');
  assert.ok(world.state.loot.every((l) => !l.taken), 'loot is restored');
});

test('every level is traversable: loot and exit reachable from the start', () => {
  // Flood-fill the walkable area (walls block) from the player start.
  for (let levelIndex = 0; levelIndex < LEVELS.length; levelIndex++) {
    const world = fresh(levelIndex);
    const { walls } = world.state;
    const blocked = (x, y) => {
      if (x < 16 || y < 16 || x > 1264 || y > 704) return true;
      return walls.some((w) => x > w.x - 14 && x < w.x + w.w + 14 && y > w.y - 14 && y < w.y + w.h + 14);
    };
    const seen = new Set();
    const queue = [[Math.round(world.state.player.x), Math.round(world.state.player.y)]];
    const key = (x, y) => `${x >> 4},${y >> 4}`;
    while (queue.length) {
      const [x, y] = queue.pop();
      const k = key(x, y);
      if (seen.has(k) || blocked(x, y)) continue;
      seen.add(k);
      queue.push([x + 16, y], [x - 16, y], [x, y + 16], [x, y - 16]);
    }
    const near = (x, y) => {
      for (let dx = -24; dx <= 24; dx += 8) {
        for (let dy = -24; dy <= 24; dy += 8) {
          if (seen.has(key(Math.round(x + dx), Math.round(y + dy)))) return true;
        }
      }
      return false;
    };
    for (const loot of world.state.loot) {
      assert.ok(near(loot.x, loot.y), `level ${levelIndex}: loot "${loot.name}" reachable`);
    }
    const exit = world.state.exit;
    assert.ok(near(exit.x + exit.w / 2, exit.y + exit.h / 2), `level ${levelIndex}: exit reachable`);
  }
});
