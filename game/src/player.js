// The thief for The Velvet Vault: fast, quiet, and carrying two gadgets.
import { circleRectCollide } from './geometry.js';

export const PLAYER_SPEED = 200; // px per second — faster than any guard chase

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.r = 12;
    this.speed = PLAYER_SPEED;
    this.gadgets = { smoke: 3, emp: 2 };
    this.facing = 0;
  }

  // Axis-separated movement so the thief slides along walls instead of sticking.
  move(dx, dy, dt, walls) {
    const len = Math.hypot(dx, dy);
    if (len < 0.001) return;
    const nx = (dx / len) * this.speed * dt;
    const ny = (dy / len) * this.speed * dt;
    this.facing = Math.atan2(dy, dx);
    const tryX = this.x + nx;
    if (!walls.some((w) => circleRectCollide(tryX, this.y, this.r, w))) this.x = tryX;
    const tryY = this.y + ny;
    if (!walls.some((w) => circleRectCollide(this.x, tryY, this.r, w))) this.y = tryY;
    this.x = Math.max(this.r, Math.min(1280 - this.r, this.x));
    this.y = Math.max(this.r, Math.min(720 - this.r, this.y));
  }

  reset(x, y) {
    this.x = x;
    this.y = y;
    this.gadgets = { smoke: 3, emp: 2 };
    this.facing = 0;
  }
}
