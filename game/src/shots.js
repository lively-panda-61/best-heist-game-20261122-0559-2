// Deterministic screenshot scenes behind ?shot=start|play|alarm|win|end.
// Each one plays the real rules forward from a fresh world, then freezes a
// frame that shows what a short game really looks like. The same seed always
// gives the same frame.
import { STEP } from './config.js';
import { EVENT_CAUGHT, EVENT_WIN } from './world.js';
import { SCREEN_CAUGHT, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const IDLE_SECONDS = 6;

/** Let the guards patrol and the cameras sweep with no input. */
function idle(world, seconds) {
  for (let index = 0; index < seconds / STEP; index += 1) {
    world.step(STEP, { x: 0, y: 0 });
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it and
 * the best haul to show. Names: start, play, alarm, win, end.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'play') {
    idle(world, IDLE_SECONDS);
    // Mid-heist: the thief is deep in the room, the alarm is half raised, and
    // the loot target still glows — room, cones, cameras, loot and meter in
    // one frame.
    world.debugPlace(700, 380);
    world.state.alarm = 38;
    world.step(STEP, { x: 0, y: 0 });
    return { screen: SCREEN_PLAY, best: 1250 };
  }
  if (name === 'alarm') {
    idle(world, 4);
    const guard = world.state.guards[0];
    world.debugPlace(guard.x + Math.cos(guard.angle) * 90, guard.y + Math.sin(guard.angle) * 90);
    world.state.alarm = 82;
    for (let index = 0; index < 12; index += 1) world.step(STEP, { x: 0, y: 0 });
    return { screen: SCREEN_PLAY, best: 1250 };
  }
  if (name === 'win') {
    for (const loot of world.state.loot.filter((item) => item.required)) {
      world.debugPlace(loot.x, loot.y);
      world.step(STEP, { x: 0, y: 0 });
    }
    // A getaway that reads like one: a minute and a half in, haul counted.
    world.state.time = 87;
    const exit = world.state.exit;
    world.debugPlace(exit.x + exit.w / 2, exit.y + exit.h / 2);
    const events = world.step(STEP, { x: 0, y: 0 });
    return { screen: events & EVENT_WIN ? SCREEN_WIN : SCREEN_PLAY, best: 2400 };
  }
  if (name === 'end') {
    world.state.alarm = 100;
    const guard = world.state.guards[0];
    world.debugPlace(guard.x + 20, guard.y);
    const events = world.step(STEP, { x: 0, y: 0 });
    return { screen: events & EVENT_CAUGHT ? SCREEN_CAUGHT : SCREEN_PLAY, best: 1250 };
  }
  idle(world, 5);
  return { screen: SCREEN_TITLE, best: 1250 };
}
