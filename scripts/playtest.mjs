// Playwright playtest for The Velvet Vault.
// 1. Proves a full level-1 win path in a real browser (title -> loot ->
//    exit -> levelComplete -> level 2 starts), steering with real keys.
// 2. Takes the 4 screenshots from shots.json (1280x720 JPEG, <= 256 KiB).
// Run: node scripts/playtest.mjs   (serves game/ on :8080 itself)
import { chromium } from '/home/hatch/workspace/makefun/tools/pw/node_modules/playwright-core/index.mjs';
import { spawn } from 'node:child_process';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const shots = JSON.parse(readFileSync(join(root, 'shots.json'), 'utf8'));

const server = spawn('node', ['serve.ts'], {
  cwd: root,
  env: { ...process.env, PORT: '8080' },
  stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 1200));

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`FAIL: ${msg}`);
};

try {
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (e) => fail(`page error: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') fail(`console error: ${m.text()}`);
  });

  // --- Playtest: win level 1 with real keyboard input. ---
  await page.goto('http://localhost:8080/game/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.HEIST && window.HEIST.game);
  const title = await page.evaluate(() => window.HEIST.game.state);
  if (title !== 'title') fail(`expected title screen, got ${title}`);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const started = await page.evaluate(() => window.HEIST.game.state);
  if (started !== 'playing') fail(`expected playing after Enter, got ${started}`);

  const keys = { up: 'w', down: 's', left: 'a', right: 'd' };
  // Multi-key hold: the driver steers diagonally toward the waypoint so it
  // never wedges against a wall corner pushing on one axis alone.
  const held = new Set();
  const holdKeys = async (want) => {
    for (const k of [...held]) {
      if (!want.has(k)) {
        await page.keyboard.up(keys[k]);
        held.delete(k);
      }
    }
    for (const k of want) {
      if (!held.has(k)) {
        await page.keyboard.down(keys[k]);
        held.add(k);
      }
    }
  };
  const hold = (key) => holdKeys(key ? new Set([key]) : new Set());

  const deadline = Date.now() + 150000;
  let won = false;
  let iter = 0;
  let lastLog = 0;
  let lastPos = { x: 0, y: 0 };
  let lastMoveAt = Date.now();
  while (Date.now() < deadline) {
    const s = await page.evaluate(() => {
      const g = window.HEIST.game;
      const H = window.HEIST;
      const level = H.LEVELS[g.levelIndex];
      const walkable = (x, y) => H.tileWalkable(level, x, y);
      const px = g.player.x;
      const py = g.player.y;
      const tx = Math.floor(px / H.TILE);
      const ty = Math.floor(py / H.TILE);
      // Next objective: nearest remaining loot, else the exit.
      let target = null;
      const remaining = g.loot.filter((l) => !l.taken);
      if (remaining.length > 0) {
        let best = null;
        for (const l of remaining) {
          const p = H.findPath(walkable, 32, 18, tx, ty, Math.floor(l.x / H.TILE), Math.floor(l.y / H.TILE));
          if (p && (!best || p.length < best.length)) best = p;
        }
        if (best) target = { path: best, kind: 'loot' };
      } else {
        const ex = g.exit;
        const p = H.findPath(walkable, 32, 18, tx, ty, Math.floor((ex.x + ex.w / 2) / H.TILE), Math.floor((ex.y + ex.h / 2) / H.TILE));
        if (p) target = { path: p, kind: 'exit' };
      }
      const nearAlertGuard = g.guards.some(
        (gd) => gd.state === 'alert' && Math.hypot(gd.x - px, gd.y - py) < 170,
      );
      return {
        state: g.state,
        levelIndex: g.levelIndex,
        px, py,
        lootCollected: g.lootCollected,
        path: target ? target.path : null,
        kind: target ? target.kind : null,
        nearAlertGuard,
        smoke: g.player.gadgets.smoke,
      };
    });
    if (s.state === 'levelComplete') { won = true; break; }
    if (s.state === 'gameOver') { fail('caught out (gameOver) during the level-1 win path'); break; }
    if (s.state !== 'playing') { fail(`unexpected state ${s.state} mid-run`); break; }
    iter += 1;
    if (Date.now() - lastLog > 2000) {
      lastLog = Date.now();
      console.log(`DBG iter=${iter} state=${s.state} pos=${Math.round(s.px)},${Math.round(s.py)} loot=${s.lootCollected} pathLen=${s.path ? s.path.length : null} nearAlert=${s.nearAlertGuard} smoke=${s.smoke} held=[${[...held].join(',')}]`);
    }
    if (s.nearAlertGuard && s.smoke > 0) await page.keyboard.press(' ');
    if (!s.path || s.path.length === 0) {
      await hold(null);
      await page.waitForTimeout(120);
      continue;
    }
    // Follow the BFS path diagonally toward the next tile center, so the
    // thief centers on waypoints instead of wedging on wall corners.
    const wp = s.path[Math.min(1, s.path.length - 1)];
    const wx = wp.x * 40 + 20;
    const wy = wp.y * 40 + 20;
    const dx = wx - s.px;
    const dy = wy - s.py;
    const want = new Set();
    if (Math.abs(dx) > 8) want.add(dx > 0 ? 'right' : 'left');
    if (Math.abs(dy) > 8) want.add(dy > 0 ? 'down' : 'up');
    // Unstick: no movement for a while means a corner caught us; step up.
    if (Math.hypot(s.px - lastPos.x, s.py - lastPos.y) > 4) {
      lastPos = { x: s.px, y: s.py };
      lastMoveAt = Date.now();
    } else if (Date.now() - lastMoveAt > 2500) {
      await holdKeys(new Set(['up']));
      await page.waitForTimeout(400);
      lastMoveAt = Date.now();
      lastPos = { x: s.px, y: s.py };
      continue;
    }
    await holdKeys(want);
    await page.waitForTimeout(60);
  }
  await hold(null);
  if (!won) fail('level 1 was not completed within 150s');
  else console.log('PLAYTEST: level 1 completed (loot -> exit -> levelComplete)');

  // Level 2 starts on Enter.
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  const l2 = await page.evaluate(() => ({ state: window.HEIST.game.state, level: window.HEIST.game.levelIndex }));
  if (l2.state !== 'playing' || l2.level !== 1) fail(`expected level 2 playing, got ${JSON.stringify(l2)}`);
  else console.log('PLAYTEST: level 2 started after levelComplete');

  // --- Screenshots from shots.json. ---
  for (const shot of shots) {
    await page.goto(`http://localhost:8080/game/${shot.query}`, { waitUntil: 'load' });
    await page.waitForTimeout(400);
    const out = join(root, 'screenshots', shot.name);
    await page.screenshot({ path: out, type: 'jpeg', quality: 82 });
    const size = statSync(out).size;
    console.log(`SHOT: ${shot.name} ${size} bytes`);
    if (size > 262144) fail(`${shot.name} is ${size} bytes, over the 256 KiB cap`);
    if (!existsSync(out)) fail(`${shot.name} was not written`);
  }
  await browser.close();
} finally {
  server.kill();
}

if (failures > 0) {
  console.error(`PLAYTEST: ${failures} failure(s)`);
  process.exit(1);
}
console.log('PLAYTEST: all green');
