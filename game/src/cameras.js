// Sweeping security cameras for The Velvet Vault.
// A camera sweeps a fixed arc; its detection meter builds while the
// thief is inside its cone with line of sight, and an EMP shuts it down.
import { pointInCone, lineOfSight, segmentIntersectsCircle } from './geometry.js';

export const CAMERA_HALF_ANGLE = 0.5;
export const CAMERA_DETECT_RATE = 120;
export const CAMERA_DECAY_RATE = 30;

export class Camera {
  constructor(def) {
    this.x = def.x;
    this.y = def.y;
    this.baseDir = def.dir;
    this.sweep = def.sweep ?? 0.5;
    this.range = def.range ?? 260;
    this.speed = def.speed ?? 0.8;
    this.dir = def.dir;
    this.detection = 0;
    this.disabledUntil = -1;
  }

  isDisabled(now) {
    return now < this.disabledUntil;
  }

  canSee(player, walls, smoke) {
    if (!pointInCone(player.x, player.y, this.x, this.y, this.dir, CAMERA_HALF_ANGLE, this.range)) return false;
    if (!lineOfSight(this.x, this.y, player.x, player.y, walls)) return false;
    for (const cloud of smoke) {
      if (segmentIntersectsCircle(this.x, this.y, player.x, player.y, cloud.x, cloud.y, cloud.r)) return false;
    }
    return true;
  }

  update(dt, player, walls, smoke, now) {
    this.dir = this.baseDir + Math.sin(now * this.speed) * this.sweep;
    if (this.isDisabled(now)) {
      this.detection = Math.max(0, this.detection - CAMERA_DECAY_RATE * dt);
      return;
    }
    if (this.canSee(player, walls, smoke)) {
      this.detection = Math.min(100, this.detection + CAMERA_DETECT_RATE * dt);
    } else {
      this.detection = Math.max(0, this.detection - CAMERA_DECAY_RATE * dt);
    }
  }

  reset() {
    this.detection = 0;
    this.disabledUntil = -1;
    this.dir = this.baseDir;
  }
}
