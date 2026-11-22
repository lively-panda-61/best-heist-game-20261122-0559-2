// Geometry tests for The Velvet Vault (heist v2).
// Pure math: vision cones, line of sight, collision, BFS pathfinding.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dist, pointInCone, segmentIntersectsRect, lineOfSight,
  circleRectCollide, findPath,
} from '../game/src/geometry.js';

test('pointInCone: inside the cone, in range, facing it', () => {
  assert.equal(pointInCone(100, 0, 0, 0, 0, 0.6, 150), true);
  assert.equal(pointInCone(100, 40, 0, 0, 0, 0.6, 150), true);
});

test('pointInCone: outside the angle, beyond range, or behind', () => {
  assert.equal(pointInCone(0, 100, 0, 0, 0, 0.6, 150), false);
  assert.equal(pointInCone(200, 0, 0, 0, 0, 0.6, 150), false);
  assert.equal(pointInCone(-50, 0, 0, 0, 0, 0.6, 150), false);
});

test('segmentIntersectsRect: a wall between two points blocks the segment', () => {
  const wall = { x: 40, y: -10, w: 20, h: 20 };
  assert.equal(segmentIntersectsRect(0, 0, 100, 0, wall), true);
  assert.equal(segmentIntersectsRect(0, 50, 100, 50, wall), false);
  assert.equal(segmentIntersectsRect(0, 0, 30, 0, wall), false);
});

test('lineOfSight: clear when no wall crosses, blocked otherwise', () => {
  const walls = [{ x: 40, y: -10, w: 20, h: 20 }];
  assert.equal(lineOfSight(0, 0, 100, 0, walls), false);
  assert.equal(lineOfSight(0, 50, 100, 50, walls), true);
  assert.equal(lineOfSight(0, 0, 100, 0, []), true);
});

test('circleRectCollide: overlap, touch and separation', () => {
  const rect = { x: 100, y: 100, w: 40, h: 40 };
  assert.equal(circleRectCollide(110, 110, 12, rect), true);
  assert.equal(circleRectCollide(90, 110, 12, rect), true);
  assert.equal(circleRectCollide(50, 110, 12, rect), false);
});

test('findPath: finds a route around a wall on an open grid', () => {
  const walkable = (x, y) => !(x === 5 && y >= 2 && y <= 7);
  const path = findPath(walkable, 10, 10, 1, 5, 8, 5);
  assert.ok(Array.isArray(path));
  assert.ok(path.length > 0);
  assert.deepEqual(path[0], { x: 1, y: 5 });
  assert.deepEqual(path[path.length - 1], { x: 8, y: 5 });
  for (const step of path) assert.equal(walkable(step.x, step.y), true);
});

test('findPath: returns null when the target is fully walled off', () => {
  const walkable = (x, y) => x !== 5;
  assert.equal(findPath(walkable, 10, 10, 1, 5, 8, 5), null);
});

test('findPath: start equals target is a one-step path', () => {
  const path = findPath(() => true, 10, 10, 3, 3, 3, 3);
  assert.deepEqual(path, [{ x: 3, y: 3 }]);
});
