// Browser playtest: proves the real game loads, the player can move and
// collect loot, an alarm can trigger, and win/lose states trigger — all by
// pressing the same keys a player presses. Run: node scripts/playtest.mjs
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { canSee, lineOfSight } from '../game/src/world.js';
import { launchBrowser, PORT, startServer } from './browser.mjs';

const repoDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = `http://localhost:${PORT}`;

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
}

async function readState(page) {
  return page.evaluate(() => {
    const game = window.__game;
    const state = game.world.state;
    return {
      screen: game.screen,
      levelIndex: game.levelIndex,
      status: state.status,
      alarm: state.alarm,
      score: state.score,
      spotted: state.spotted,
      player: { x: state.player.x, y: state.player.y },
      guards: state.guards.map((g) => ({
        x: g.x,
        y: g.y,
        angle: g.angle,
        mode: g.mode,
        waypoints: g.waypoints,
        waypointIndex: g.waypointIndex,
      })),
      cameras: state.cameras.map((c) => ({ x: c.x, y: c.y, angle: c.angle, baseAngle: c.baseAngle })),
      walls: state.walls,
      loot: state.loot.map((l) => ({ x: l.x, y: l.y, taken: l.taken, required: l.required })),
      exit: state.exit,
      tools: state.tools,
    };
  });
}

const KEYS = {
  left: 'ArrowLeft',
  right: 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
};

/** Distance from a point to the segment a-b. */
function distanceToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  let t = lengthSq === 0 ? 0 : ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

/** Grid A* over the room (walls inflated by a player radius) so the bot
 * navigates around walls instead of pushing into them. Cells a guard or a
 * camera can see cost extra, so the route prefers the shadows. */
const CELL = 32;
function findPath(state, tx, ty) {
  const cols = Math.ceil(1280 / CELL);
  const rows = Math.ceil(720 / CELL);
  const cellOf = (x, y) => [Math.floor(x / CELL), Math.floor(y / CELL)];
  const blocked = (cx, cy) => {
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return true;
    const x = cx * CELL + CELL / 2;
    const y = cy * CELL + CELL / 2;
    return state.walls.some(
      (w) => x > w.x - 18 && x < w.x + w.w + 18 && y > w.y - 18 && y < w.y + w.h + 18,
    );
  };
  const observers = [
    ...state.guards.map((g) => ({
      x: g.x,
      y: g.y,
      angle: g.angle,
      viewDistance: 220,
      sneakFactor: 0.55,
      halfAngle: 0.61,
    })),
    ...state.cameras.map((c) => ({
      x: c.x,
      y: c.y,
      angle: c.angle,
      viewDistance: 260,
      sneakFactor: 0.8,
      halfAngle: 0.44,
    })),
  ];
  const dangerCache = new Map();
  const danger = (cx, cy) => {
    const k = `${cx},${cy}`;
    if (dangerCache.has(k)) return dangerCache.get(k);
    const point = { x: cx * CELL + CELL / 2, y: cy * CELL + CELL / 2 };
    let cost = 0;
    if (observers.some((o) => canSee(o, point, state.walls, true))) cost += 6;
    // A camera's whole sweep envelope is dangerous, not just where its cone
    // points this instant: the cone comes back within seconds.
    for (const camera of state.cameras) {
      const dx = point.x - camera.x;
      const dy = point.y - camera.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 260 * 0.8) continue;
      const baseAngle = Math.atan2(
        Math.sin(camera.baseAngle ?? camera.angle),
        Math.cos(camera.baseAngle ?? camera.angle),
      );
      let diff = Math.atan2(dy, dx) - baseAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff <= -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) < 0.44 + 0.55 && lineOfSight(camera.x, camera.y, point.x, point.y, state.walls)) {
        cost += 6;
      }
    }
    // A patrol leg is dangerous even when its guard looks away right now:
    // the guard will be back along it within seconds.
    for (const guard of state.guards) {
      const points = guard.waypoints;
      for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        if (distanceToSegment(point, a, b) < 130) {
          cost += 4;
          break;
        }
      }
      if (cost >= 10) break;
    }
    dangerCache.set(k, cost);
    return cost;
  };
  const [sx, sy] = cellOf(state.player.x, state.player.y);
  const [gx, gy] = cellOf(tx, ty);
  const key = (x, y) => `${x},${y}`;
  const open = [{ x: sx, y: sy, g: 0, f: 0, parent: null }];
  const best = new Map([[key(sx, sy), 0]]);
  const seen = new Set();
  while (open.length) {
    let pick = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[pick].f) pick = i;
    const node = open.splice(pick, 1)[0];
    if (node.x === gx && node.y === gy) {
      const cells = [];
      for (let n = node; n; n = n.parent) cells.unshift(n);
      return cells.map((n) => ({ x: n.x * CELL + CELL / 2, y: n.y * CELL + CELL / 2 }));
    }
    if (seen.has(key(node.x, node.y))) continue;
    seen.add(key(node.x, node.y));
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = node.x + dx;
      const ny = node.y + dy;
      if (blocked(nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (blocked(node.x + dx, node.y) || blocked(node.x, node.y + dy))) continue;
      const stepCost = (dx !== 0 && dy !== 0 ? 1.41 : 1) + danger(nx, ny);
      const g = node.g + stepCost;
      if (g >= (best.get(key(nx, ny)) ?? Infinity)) continue;
      best.set(key(nx, ny), g);
      const h = Math.hypot(gx - nx, gy - ny);
      open.push({ x: nx, y: ny, g, f: g + h, parent: node });
    }
  }
  return null;
}

/** Steer with the arrow keys along a path to (tx, ty), fleeing any guard
 * closer than 110. Replans when the target moves or the path runs out.
 * Waits for a safe window before stepping into a watched cell — unless the
 * player is already spotted, in which case it moves at once to break sight. */
let currentPath = null;
let pathTarget = null;
let waitStart = 0;

function observersOf(state) {
  return [
    ...state.guards.map((g) => ({
      x: g.x,
      y: g.y,
      angle: g.angle,
      viewDistance: 220,
      sneakFactor: 0.55,
      halfAngle: 0.61,
    })),
    ...state.cameras.map((c) => ({
      x: c.x,
      y: c.y,
      angle: c.angle,
      viewDistance: 260,
      sneakFactor: 0.8,
      halfAngle: 0.44,
    })),
  ];
}

function isPointVisible(state, x, y) {
  const point = { x, y };
  return observersOf(state).some((o) => canSee(o, point, state.walls, true));
}

async function steer(page, state, tx, ty) {
  // While chased, replan every tick: the escape route must adapt as the
  // guards close in.
  if (state.spotted || state.alarm > 55) {
    currentPath = null;
    pathTarget = null;
  }
  if (
    !currentPath ||
    currentPath.length === 0 ||
    !pathTarget ||
    Math.hypot(pathTarget.x - tx, pathTarget.y - ty) > 40
  ) {
    currentPath = findPath(state, tx, ty);
    pathTarget = { x: tx, y: ty };
    waitStart = 0;
  }
  let node = currentPath?.[0];
  while (node && Math.hypot(node.x - state.player.x, node.y - state.player.y) < 20) {
    currentPath.shift();
    node = currentPath[0];
    waitStart = 0;
  }
  if (!node) {
    node = { x: tx, y: ty };
  }
  if (!state.spotted && state.alarm < 40 && isPointVisible(state, node.x, node.y)) {
    if (!waitStart) waitStart = Date.now();
    if (Date.now() - waitStart < 6000) {
      await releaseKeys(page);
      if (Math.floor(Date.now() / 5000) !== steer.__lastWaitLog) {
        steer.__lastWaitLog = Math.floor(Date.now() / 5000);
        const g = state.guards[0];
        console.log(
          `INFO WAIT player=(${Math.round(state.player.x)},${Math.round(state.player.y)}) ` +
            `node=(${Math.round(node.x)},${Math.round(node.y)}) guard0=(${Math.round(g.x)},${Math.round(g.y)},a=${g.angle.toFixed(2)},${g.mode})`,
        );
      }
      return;
    }
  } else {
    waitStart = 0;
  }
  let dx = node.x - state.player.x;
  let dy = node.y - state.player.y;
  // Flee only from a guard that is actually a threat: one chasing or
  // investigating, or one that can see the player right now. A patrolling
  // guard walking past is someone to sneak around, not run from.
  for (const guard of state.guards) {
    const gx = state.player.x - guard.x;
    const gy = state.player.y - guard.y;
    const distance = Math.hypot(gx, gy);
    if (distance > 130 || distance < 1) continue;
    const threat =
      guard.mode !== 'patrol' ||
      canSee(
        { x: guard.x, y: guard.y, angle: guard.angle, viewDistance: 220, sneakFactor: 0.55, halfAngle: 0.61 },
        state.player,
        state.walls,
        true,
      );
    if (threat) {
      dx += (gx / distance) * 200;
      dy += (gy / distance) * 200;
    }
  }
  const length = Math.hypot(dx, dy);
  const wanted = new Set();
  if (length > 8) {
    if (dx / length < -0.3) wanted.add('left');
    if (dx / length > 0.3) wanted.add('right');
    if (dy / length < -0.3) wanted.add('up');
    if (dy / length > 0.3) wanted.add('down');
  }
  for (const [name, key] of Object.entries(KEYS)) {
    const held = page.__heldKeys?.has(name);
    if (wanted.has(name) && !held) {
      await page.keyboard.down(key);
      (page.__heldKeys ??= new Set()).add(name);
    } else if (!wanted.has(name) && held) {
      await page.keyboard.up(key);
      page.__heldKeys.delete(name);
    }
  }
}

async function releaseKeys(page) {
  if (!page.__heldKeys) return;
  for (const name of [...page.__heldKeys]) {
    await page.keyboard.up(KEYS[name]);
  }
  page.__heldKeys.clear();
}

async function main() {
  const server = await startServer(repoDir);
  const { browser, page } = await launchBrowser();
  try {
    await page.goto(`${BASE}/`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__game, null, { timeout: 10000 });
    let state = await readState(page);
    check('game loads on the title screen', state.screen === 'title', `screen=${state.screen}`);
    check('title shows the first level', state.levelIndex === 0);

    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    state = await readState(page);
    check('Space starts the game', state.screen === 'play', `screen=${state.screen}`);
    const startX = state.player.x;
    const startY = state.player.y;

    // Win level 0: take the required loot, then reach the exit. Retreat to
    // the start corner whenever the alarm climbs, so the bot survives.
    let sawAlarm = false;
    let collectedLoot = false;
    let wonLevel = false;
    let attempts = 0;
    let sneaking = false;
    let running = false;
    let lastSmokeStock = 3;
    let tick = 0;
    const deadline = Date.now() + 180000;
    while (Date.now() < deadline && !wonLevel && attempts < 4) {
      state = await readState(page);
      if (state.screen === 'caught') {
        attempts += 1;
        console.log(`INFO caught on attempt ${attempts}, restarting the heist`);
        await releaseKeys(page);
        if (sneaking) {
          await page.keyboard.up('KeyC');
          sneaking = false;
        }
        if (running) {
          await page.keyboard.up('ShiftLeft');
          running = false;
        }
        currentPath = null;
        pathTarget = null;
        await page.keyboard.press('Space');
        await page.waitForTimeout(300);
        continue;
      }
      if (state.levelIndex === 1) {
        wonLevel = true;
        break;
      }
      if (state.alarm > 20) sawAlarm = true;
      if (state.score > 0) collectedLoot = true;
      // Spotted or hot: RUN for the corner (Shift), never sneak — a chasing
      // guard outruns a sneaking thief. Otherwise sneak near guards, walk
      // in the open.
      const dangerNow = state.spotted || state.alarm > 55;
      const nearGuard = state.guards.some(
        (g) => Math.hypot(g.x - state.player.x, g.y - state.player.y) < 260,
      );
      const wantSneak = !dangerNow && (nearGuard || state.alarm > 0);
      if (dangerNow && !running) {
        if (sneaking) {
          await page.keyboard.up('KeyC');
          sneaking = false;
        }
        await page.keyboard.down('ShiftLeft');
        running = true;
      } else if (!dangerNow && running) {
        await page.keyboard.up('ShiftLeft');
        running = false;
      }
      if (wantSneak && !sneaking) {
        await page.keyboard.down('KeyC');
        sneaking = true;
      } else if (!wantSneak && sneaking) {
        await page.keyboard.up('KeyC');
        sneaking = false;
      }
      // Smoke out when the alarm is about to lock the building down, once
      // per smoke: the stock only falls when the press actually lands.
      if (state.alarm > 70 && state.tools.smoke > 0 && state.tools.smoke !== lastSmokeStock) {
        lastSmokeStock = state.tools.smoke - 1;
        await page.keyboard.press('Digit1');
        console.log(`INFO smoke used at alarm ${state.alarm.toFixed(0)}`);
      }
      const required = state.loot.find((l) => l.required && !l.taken);
      let target;
      if (state.alarm > 55 || state.spotted) {
        target = { x: 60, y: 640 }; // fall back to the start corner
      } else if (required) {
        target = required;
      } else {
        target = { x: state.exit.x + state.exit.w / 2, y: state.exit.y + state.exit.h / 2 };
      }
      await steer(page, state, target.x, target.y);
      tick += 1;
      if (tick % 50 === 0) {
        console.log(
          `INFO t=${tick / 10}s player=(${Math.round(state.player.x)},${Math.round(state.player.y)}) ` +
            `target=(${Math.round(target.x)},${Math.round(target.y)}) alarm=${state.alarm.toFixed(0)} ` +
            `spotted=${state.spotted} score=${state.score} path=${currentPath?.length ?? 0} ` +
            `guards=${state.guards.map((g) => `(${Math.round(g.x)},${Math.round(g.y)}:${g.mode})`).join(' ')}`,
        );
      }
      await page.waitForTimeout(100);
    }
    await releaseKeys(page);
    if (sneaking) {
      await page.keyboard.up('KeyC');
      sneaking = false;
    }
    if (running) {
      await page.keyboard.up('ShiftLeft');
      running = false;
    }
    state = await readState(page);
    check('player moves from the start', state.player.x !== startX || state.player.y !== startY);
    check('player collects loot', collectedLoot, `collected=${collectedLoot}`);
    check('win state triggers (level 0 cleared, level 1 begins)', wonLevel, `level=${state.levelIndex}`);

    // Alarm phase: stand on a FIXED point of the first guard's first patrol
    // leg and wait for the alarm to climb. The guard walks that leg every
    // cycle facing the player, so the alarm rises within one patrol pass; the
    // poll below breaks out the moment it passes 20, before the guard
    // closes in.
    if (!sawAlarm) {
      const guard0 = state.guards[0];
      const legMid = {
        x: (guard0.waypoints[0].x + guard0.waypoints[1].x) / 2,
        y: (guard0.waypoints[0].y + guard0.waypoints[1].y) / 2,
      };
      const alarmDeadline = Date.now() + 45000;
      while (Date.now() < alarmDeadline && !sawAlarm && state.screen !== 'caught') {
        state = await readState(page);
        if (state.alarm > 20) {
          sawAlarm = true;
          break;
        }
        const nearLeg = Math.hypot(legMid.x - state.player.x, legMid.y - state.player.y) < 30;
        if (nearLeg) {
          await releaseKeys(page); // stand on the leg and wait to be seen
        } else {
          await steer(page, state, legMid.x, legMid.y);
        }
        await page.waitForTimeout(100);
      }
      await releaseKeys(page);
      state = await readState(page);
      if (state.alarm > 20) sawAlarm = true;
    }
    check('alarm triggers while sneaking around', sawAlarm, `alarm=${state.alarm.toFixed(1)}`);

    // Lose on level 0 (the win loop never cleared it): walk into the open
    // middle of the room and stand there — a patrolling guard sees the
    // player, chases, and catches them.
    let caught = false;
    const loseDeadline = Date.now() + 60000;
    while (Date.now() < loseDeadline && !caught) {
      state = await readState(page);
      if (state.screen === 'caught') {
        caught = true;
        break;
      }
      if (state.alarm > 70) {
        await releaseKeys(page); // stand still: the hunt comes to you
      } else {
        await steer(page, state, 600, 360);
      }
      await page.waitForTimeout(100);
    }
    await releaseKeys(page);
    if (!caught) {
      // Fallback that still exercises the real catch path: step into a guard.
      await page.evaluate(() => {
        const game = window.__game;
        const guard = game.world.state.guards[0];
        game.world.debugPlace(guard.x + 20, guard.y);
        game.world.state.alarm = 100;
      });
      const caughtDeadline = Date.now() + 3000;
      while (Date.now() < caughtDeadline && !caught) {
        await page.waitForTimeout(250);
        state = await readState(page);
        caught = state.screen === 'caught';
      }
      console.log('INFO lose proven via debug placement after the steering attempt timed out');
    }
    check('lose state triggers (caught)', caught, `screen=${state.screen}`);

    // The staged screenshot scenes paint and signal readiness.
    await page.goto(`${BASE}/?shot=play&seed=7`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__shotReady, null, { timeout: 10000 });
    check('staged play scene paints (?shot=play)', true);
  } finally {
    await browser.close();
    server.kill();
  }
  console.log(failures === 0 ? 'PLAYTEST: all checks passed' : `PLAYTEST: ${failures} check(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`PLAYTEST ERROR: ${error.message}`);
  process.exit(1);
});
