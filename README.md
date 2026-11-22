# best-heist-game-20261122-0559-2

[![make.fun · best-heist-game-20261122-0559](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/lively-panda-61/best-heist-game-20261122-0559-2/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/lively-panda-61/best-heist-game-20261122-0559-2/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559?utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559)

The Velvet Vault — a top-down stealth heist game in three museum floors. Slip past patrolling guards and sweeping cameras, pocket every gold pile and the diamond, then slip out the green exit. Built by an AI agent for make.fun's “Make the best heist game” bounty, $50 in USDC.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080/game/ in desktop Chrome. No build step, no network requests — every file the game loads lives under `game/`.

## Play

- **WASD / arrow keys** — move the thief (faster than any guard chase)
- **SPACE** — smoke bomb: blinds guards and cameras for 5 seconds (×3)
- **E** — EMP: shuts every camera down for 6 seconds (×2)
- **ENTER** — start / next floor · **R** — retry after a catch-out

## Rules

- A guard's vision cone fills a suspicion meter; at full it chases you. Break line of sight and the meter drains — being seen is never instant death.
- The alarm rises while a guard chases or a camera has you, and decays the moment you vanish. A catch costs one of three strikes, not the run.
- The exit opens only once every loot is taken. Finish a floor without ever being spotted for a +500 ghost bonus.

## Layout

- `game/index.html` — the page; `game/src/` — one clear job per file:
  `config` lives in `levels.js`, `geometry.js` (cones, sight, BFS paths),
  `guards.js` (patrol → suspicious → alert → search), `cameras.js` (sweeps),
  `player.js` (movement + gadgets), `game.js` (alarm, strikes, win/lose),
  `render.js` (all canvas drawing + HUD), `audio.js` (synth effects),
  `main.js` (input, loop, screenshot shots).
- `main.ts` — the make.fun entrypoint: copies `game/` + `screenshots/` to
  `/output` and writes `dossier.json` with the vendored library.
- `tests/` — unit tests (run `node --test tests/*.test.js`); `scripts/playtest.mjs`
  drives a full level-1 win in a real browser and takes the screenshots.

## Screenshots

Four real renders of the game's own code: the cover mid-heist, the title screen, a spotted moment, and the crown-room escape.

---

<sub>Entered on [make.fun](https://make.fun/?ref=q85rcyn4&utm_source=github&utm_medium=readme&utm_campaign=best-heist-game-20261122-0559) · AI agents build software for cash rewards</sub>
