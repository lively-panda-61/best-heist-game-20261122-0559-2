// Game state for The Velvet Vault: levels, alarm, strikes, loot, gadgets,
// win and lose. Forgiving by design: detection has a grace period, the
// alarm decays when you break line of sight, a catch costs a strike
// instead of the run, and there is no fail timer at all.
import { LEVELS, wallsPixels } from './levels.js';
import { Guard } from './guards.js';
import { Camera } from './cameras.js';
import { Player } from './player.js';

export const ALARM_RISE_RATE = 25;
export const ALARM_DECAY_RATE = 12;
export const LEVEL_BONUS = 200;
export const GHOST_BONUS = 500;
export const MAX_STRIKES = 3;

export class Game {
  constructor() {
    this.score = 0;
    this.strikes = 0;
    this.state = 'title';
    this.startLevel(0);
  }

  startLevel(index) {
    this.levelIndex = index;
    this.level = LEVELS[index];
    this.walls = wallsPixels(this.level);
    this.player = new Player(this.level.spawn.x, this.level.spawn.y);
    this.guards = this.level.guards.map((g) => new Guard(g));
    this.cameras = this.level.cameras.map((c) => new Camera(c));
    this.loot = this.level.loot.map((l) => ({ ...l, taken: false }));
    this.totalLoot = this.loot.length;
    this.lootCollected = 0;
    this.exit = this.level.exit;
    this.exitOpen = false;
    this.alarm = 0;
    this.smoke = [];
    this.time = 0;
    this.ghost = true;
    this.invulnerable = 0;
    this.lastEvent = '';
  }

  newGame() {
    this.score = 0;
    this.strikes = 0;
    this.startLevel(0);
    this.state = 'playing';
  }

  nextLevel() {
    this.startLevel(this.levelIndex + 1);
    this.state = 'playing';
  }

  useGadget(kind) {
    if (this.state !== 'playing') return false;
    if (kind === 'smoke') {
      if (this.player.gadgets.smoke <= 0) return false;
      this.player.gadgets.smoke -= 1;
      this.smoke.push({ x: this.player.x, y: this.player.y, r: 70, until: this.time + 5 });
      this.lastEvent = 'smoke';
      return true;
    }
    if (kind === 'emp') {
      if (this.player.gadgets.emp <= 0) return false;
      this.player.gadgets.emp -= 1;
      for (const cam of this.cameras) cam.disabledUntil = this.time + 6;
      this.lastEvent = 'emp';
      return true;
    }
    return false;
  }

  onCaught() {
    if (this.state !== 'playing') return;
    this.strikes += 1;
    this.ghost = false;
    if (this.strikes >= MAX_STRIKES) {
      this.state = 'gameOver';
      this.lastEvent = 'caught-out';
      return;
    }
    // A catch costs a strike, not the run: back to spawn, alarm eased,
    // guards reset, two seconds of grace to get moving again.
    this.alarm = Math.min(this.alarm, 20);
    this.player.reset(this.level.spawn.x, this.level.spawn.y);
    for (const guard of this.guards) guard.reset();
    for (const cam of this.cameras) cam.reset();
    this.smoke = [];
    this.invulnerable = 2;
    this.lastEvent = 'caught';
  }

  // Ambient motion for title / end screens: patrols sweep, cameras turn.
  tickAmbient(dt) {
    this.time += dt;
    const farAway = { x: -9999, y: -9999, r: 12 };
    for (const guard of this.guards) guard.update(dt, farAway, this.walls, []);
    for (const cam of this.cameras) cam.update(dt, farAway, this.walls, [], this.time);
  }

  update(dt, input = {}) {
    if (this.state !== 'playing') return;
    this.time += dt;
    if (this.invulnerable > 0) this.invulnerable -= dt;
    this.smoke = this.smoke.filter((c) => c.until > this.time);

    const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (dx !== 0 || dy !== 0) this.player.move(dx, dy, dt, this.walls);

    for (const guard of this.guards) guard.update(dt, this.player, this.walls, this.smoke);
    for (const cam of this.cameras) cam.update(dt, this.player, this.walls, this.smoke, this.time);

    // Loot pickup.
    for (const item of this.loot) {
      if (item.taken) continue;
      if (Math.hypot(this.player.x - item.x, this.player.y - item.y) < 28) {
        item.taken = true;
        this.lootCollected += 1;
        this.score += item.value;
        this.lastEvent = item.kind === 'diamond' ? 'diamond' : 'loot';
      }
    }
    this.exitOpen = this.lootCollected >= this.totalLoot;

    // Reaching the open exit completes the level.
    const ex = this.exit;
    if (
      this.exitOpen &&
      this.player.x > ex.x && this.player.x < ex.x + ex.w &&
      this.player.y > ex.y && this.player.y < ex.y + ex.h
    ) {
      this.score += LEVEL_BONUS;
      if (this.ghost) this.score += GHOST_BONUS;
      this.lastEvent = 'exit';
      this.state = this.levelIndex >= LEVELS.length - 1 ? 'win' : 'levelComplete';
      return;
    }

    // Alarm: rises while any guard is alert or a camera is hot, decays
    // the moment you break contact.
    const anyAlert = this.guards.some((g) => g.state === 'alert');
    const anyHotCamera = this.cameras.some((c) => c.detection >= 50);
    if (anyAlert) this.ghost = false;
    if (this.cameras.some((c) => c.detection >= 100)) this.ghost = false;
    if (anyAlert || anyHotCamera) {
      this.alarm = Math.min(100, this.alarm + ALARM_RISE_RATE * dt);
    } else {
      this.alarm = Math.max(0, this.alarm - ALARM_DECAY_RATE * dt);
    }

    // Caught: an alert guard touches the thief.
    if (this.invulnerable <= 0) {
      for (const guard of this.guards) {
        if (guard.state === 'alert' && Math.hypot(guard.x - this.player.x, guard.y - this.player.y) < 26) {
          this.onCaught();
          break;
        }
      }
    }
  }
}
