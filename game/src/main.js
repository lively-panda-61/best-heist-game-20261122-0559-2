// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between five screens: title, play,
// paused, win and caught, across three heist levels.
//
// ?seed=N fixes the patrol jitter. ?shot=start|play|alarm|win|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { LEVELS } from './levels.js';
import { createWorld, EVENT_CAUGHT, EVENT_LOOT, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_EMP, ACTION_PAUSE, ACTION_SMOKE, createInput } from './input.js';
import { createRenderer, SCREEN_CAUGHT, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);

let levelIndex = 0;
let totalScore = 0;
let world = createWorld(levelIndex, createRandom(seed));

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best haul then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let toast = '';
  let toastUntil = 0;

  // Screen readers (and anyone watching the page's text) hear screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function showToast(message) {
    toast = message;
    toastUntil = performance.now() + 3500;
  }

  function startLevel(index) {
    levelIndex = index;
    world = createWorld(levelIndex, createRandom(seed + index));
    screen = SCREEN_PLAY;
    const level = LEVELS[index];
    showToast(`${level.name} — ${level.subtitle}`);
    announce(`Level ${index + 1}: ${level.name}. ${level.subtitle}`);
  }

  function startGame() {
    totalScore = 0;
    startLevel(0);
  }

  function endRun(won) {
    totalScore += world.state.score;
    if (won && levelIndex < LEVELS.length - 1) {
      announce(`Level clear. Haul ${world.state.score}. Next heist.`);
      startLevel(levelIndex + 1);
      return;
    }
    screen = won ? SCREEN_WIN : SCREEN_CAUGHT;
    if (won) {
      const finalScore = totalScore;
      if (finalScore > best) {
        best = finalScore;
        saveBest(best);
      }
      announce(`Clean getaway. Total haul ${finalScore}. Best ${best}.`);
    } else {
      announce(`Busted. Haul ${world.state.score}. Best ${best}.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE) startGame();
      else if (screen === SCREEN_WIN || screen === SCREEN_CAUGHT) startGame();
      else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_SMOKE) world.step(STEP, { x: 0, y: 0, smoke: true });
      if (actions & ACTION_EMP) world.step(STEP, { x: 0, y: 0, emp: true });
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 });
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const direction = input.direction();
    const events = world.step(STEP, {
      x: direction.x,
      y: direction.y,
      run: input.running(),
      sneak: input.sneaking(),
    });
    if (events & EVENT_LOOT) {
      const taken = world.state.loot.filter((item) => item.taken).length;
      announce(`Loot taken. ${taken} of ${world.state.loot.length}. Score ${world.state.score}.`);
    }
    if (events & EVENT_WIN) endRun(true);
    else if (events & EVENT_CAUGHT) endRun(false);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    if (toast && performance.now() > toastUntil) toast = '';
    renderer.draw(world.state, screen, best, screen === SCREEN_PLAY ? toast : '');
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // Playtests drive the real game through this handle: state is read-only
  // observation, debugPlace is the same hook the screenshot stager uses.
  window.__game = {
    get world() {
      return world;
    },
    get screen() {
      return screen;
    },
    get levelIndex() {
      return levelIndex;
    },
    get totalScore() {
      return totalScore;
    },
    startGame,
  };

  announce('The Midnight Vault. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
