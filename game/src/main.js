// Entry point for The Velvet Vault: canvas setup, keyboard input,
// the game loop, deterministic screenshot shots, and a debug hook
// (window.HEIST) the playtest drives the win path with.
import { Game } from './game.js';
import { drawGame } from './render.js';
import { ensureAudio, sfx } from './audio.js';
import { LEVELS, TILE, tileWalkable } from './levels.js';
import { findPath } from './geometry.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const game = new Game();
const input = { up: false, down: false, left: false, right: false };

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

let lastEventSeen = '';

function playEventSound() {
  if (game.lastEvent === lastEventSeen) return;
  lastEventSeen = game.lastEvent;
  if (game.lastEvent === 'loot') sfx.loot();
  else if (game.lastEvent === 'diamond') sfx.diamond();
  else if (game.lastEvent === 'smoke') sfx.smoke();
  else if (game.lastEvent === 'emp') sfx.emp();
  else if (game.lastEvent === 'caught' || game.lastEvent === 'caught-out') sfx.caught();
  else if (game.lastEvent === 'exit') sfx.exit();
  if (game.state === 'win') sfx.win();
}

function spottedNow() {
  return game.guards.some((g) => g.state === 'alert');
}
let wasSpotted = false;

window.addEventListener('keydown', (e) => {
  ensureAudio();
  if (KEYMAP[e.code] !== undefined) {
    input[KEYMAP[e.code]] = true;
    e.preventDefault();
  }
  if (e.code === 'Space') {
    if (game.state === 'playing') game.useGadget('smoke');
    e.preventDefault();
  }
  if (e.code === 'KeyE' && game.state === 'playing') game.useGadget('emp');
  if (e.code === 'Enter') {
    if (game.state === 'title') game.newGame();
    else if (game.state === 'levelComplete') game.nextLevel();
  }
  if (e.code === 'KeyR' && (game.state === 'gameOver' || game.state === 'win')) game.newGame();
});

window.addEventListener('keyup', (e) => {
  if (KEYMAP[e.code] !== undefined) input[KEYMAP[e.code]] = false;
});

canvas.addEventListener('click', () => {
  ensureAudio();
  if (game.state === 'title') game.newGame();
  else if (game.state === 'levelComplete') game.nextLevel();
  else if (game.state === 'gameOver' || game.state === 'win') game.newGame();
});

// Deterministic screenshot setups: fixed states, no randomness, so the
// cover frame always shows the room, cones, cameras, loot and alarm.
function setupShot(shot) {
  if (shot === 'title') {
    game.startLevel(0);
    game.state = 'title';
    for (let i = 0; i < 30; i++) game.tickAmbient(0.5);
    return;
  }
  if (shot === 'cover') {
    game.startLevel(0);
    game.state = 'playing';
    game.time = 3.7;
    // Two loot already pocketed; the thief mid-room, cones sweeping.
    game.loot[0].taken = true;
    game.loot[4].taken = true;
    game.lootCollected = 2;
    game.score = 350;
    game.player.x = 640;
    game.player.y = 430;
    game.player.facing = -Math.PI / 2;
    game.guards[0].x = 700; game.guards[0].y = 340; game.guards[0].dir = Math.PI;
    game.guards[0].suspicion = 55; game.guards[0].state = 'suspicious';
    game.guards[1].x = 1000; game.guards[1].y = 300; game.guards[1].dir = Math.PI * 0.75;
    game.alarm = 25;
    return;
  }
  if (shot === 'alarm') {
    game.startLevel(0);
    game.state = 'playing';
    game.time = 6.2;
    game.player.x = 700;
    game.player.y = 300;
    game.player.facing = Math.PI;
    game.guards[0].x = 660; game.guards[0].y = 300; game.guards[0].dir = 0;
    game.guards[0].suspicion = 100; game.guards[0].state = 'alert';
    game.guards[0].lastSeen = { x: 700, y: 300 };
    game.alarm = 78;
    game.ghost = false;
    return;
  }
  if (shot === 'escape') {
    game.startLevel(2);
    game.state = 'playing';
    game.time = 9.4;
    for (const item of game.loot) item.taken = true;
    game.lootCollected = game.totalLoot;
    game.exitOpen = true;
    game.score = 1450;
    game.player.x = 1080;
    game.player.y = 140;
    game.player.facing = Math.PI / 4;
    game.guards[0].x = 500; game.guards[0].y = 420; game.guards[0].dir = -Math.PI / 2;
    game.guards[1].x = 900; game.guards[1].y = 420; game.guards[1].dir = Math.PI;
    game.lastEvent = 'diamond';
    return;
  }
}

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  setupShot(shot);
  drawGame(ctx, game);
} else {
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (game.state === 'playing') {
      game.update(dt, input);
      if (spottedNow() && !wasSpotted) sfx.spotted();
      wasSpotted = spottedNow();
      playEventSound();
    } else {
      game.tickAmbient(dt);
    }
    drawGame(ctx, game);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// Debug / playtest hook: exposes the live game, the pathfinder and the
// level data so an automated driver can prove the win path end to end.
window.HEIST = {
  game,
  input,
  LEVELS,
  TILE,
  tileWalkable,
  findPath,
  newGame: () => game.newGame(),
};
