// Game rules tests for The Velvet Vault (heist v2).
// Loot, exit gating, alarm rise/decay, strikes, gadgets, win/lose.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../game/src/game.js';
import { LEVELS } from '../game/src/levels.js';

function freshGame(level = 0) {
  const g = new Game();
  g.startLevel(level);
  g.state = 'playing';
  return g;
}

test('collecting loot raises the count and the score', () => {
  const g = freshGame();
  const loot = g.loot[0];
  g.player.x = loot.x;
  g.player.y = loot.y;
  g.update(1 / 60, {});
  assert.equal(g.lootCollected, 1);
  assert.ok(g.score > 0);
});

test('the exit stays locked until every loot is collected', () => {
  const g = freshGame();
  assert.equal(g.exitOpen, false);
  g.player.x = g.exit.x + g.exit.w / 2;
  g.player.y = g.exit.y + g.exit.h / 2;
  g.update(1 / 60, {});
  assert.notEqual(g.state, 'levelComplete');
  for (const loot of [...g.loot]) {
    g.player.x = loot.x;
    g.player.y = loot.y;
    g.update(1 / 60, {});
  }
  assert.equal(g.exitOpen, true);
});

test('reaching the open exit completes the level', () => {
  const g = freshGame();
  for (const loot of [...g.loot]) {
    g.player.x = loot.x;
    g.player.y = loot.y;
    g.update(1 / 60, {});
  }
  g.player.x = g.exit.x + g.exit.w / 2;
  g.player.y = g.exit.y + g.exit.h / 2;
  g.update(1 / 60, {});
  assert.equal(g.state, 'levelComplete');
});

test('finishing level 3 wins the whole game', () => {
  const g = freshGame(2);
  for (const loot of [...g.loot]) {
    g.player.x = loot.x;
    g.player.y = loot.y;
    g.update(1 / 60, {});
  }
  g.player.x = g.exit.x + g.exit.w / 2;
  g.player.y = g.exit.y + g.exit.h / 2;
  g.update(1 / 60, {});
  assert.equal(g.state, 'win');
});

test('alarm rises while a guard is alert and decays while hidden', () => {
  const g = freshGame();
  g.guards[0].state = 'alert';
  g.update(1, {});
  assert.ok(g.alarm > 0, `alarm rose to ${g.alarm}`);
  g.guards[0].state = 'patrol';
  g.guards[0].suspicion = 0;
  const peak = g.alarm;
  for (let i = 0; i < 120; i++) g.update(1 / 60, {});
  assert.ok(g.alarm < peak, `alarm decayed ${peak} -> ${g.alarm}`);
});

test('being caught costs a strike and resets the player; three strikes end the game', () => {
  const g = freshGame();
  g.onCaught();
  assert.equal(g.strikes, 1);
  assert.equal(g.state, 'playing');
  assert.ok(g.alarm < 50, 'alarm eases after a catch so the retry is fair');
  g.onCaught();
  g.onCaught();
  assert.equal(g.state, 'gameOver');
});

test('EMP disables every camera for its full duration', () => {
  const g = freshGame();
  g.useGadget('emp');
  for (const cam of g.cameras) assert.equal(cam.disabledUntil > g.time, true);
  const before = g.cameras[0].detection;
  g.update(1, {});
  assert.equal(g.cameras[0].detection, before);
});

test('smoke blocks camera detection while it lasts', () => {
  const g = freshGame();
  const cam = g.cameras[0];
  g.useGadget('smoke');
  g.update(1, {});
  assert.equal(cam.detection, 0);
});

test('gadgets are limited: using the last one leaves none', () => {
  const g = freshGame();
  const start = g.player.gadgets.smoke;
  assert.ok(start > 0);
  for (let i = 0; i < start; i++) assert.equal(g.useGadget('smoke'), true);
  assert.equal(g.useGadget('smoke'), false);
});

test('a ghost run (never detected) earns the ghost bonus on level complete', () => {
  const g = freshGame();
  for (const loot of [...g.loot]) {
    g.player.x = loot.x;
    g.player.y = loot.y;
    g.update(1 / 60, {});
  }
  const before = g.score;
  g.player.x = g.exit.x + g.exit.w / 2;
  g.player.y = g.exit.y + g.exit.h / 2;
  g.update(1 / 60, {});
  assert.equal(g.state, 'levelComplete');
  assert.ok(g.score > before + 400, 'ghost bonus applied');
  assert.equal(g.ghost, true);
});

test('the game never has a fail timer: standing still does not lose', () => {
  const g = freshGame();
  for (let i = 0; i < 60 * 60; i++) g.update(1 / 60, {});
  assert.equal(g.state, 'playing');
});
