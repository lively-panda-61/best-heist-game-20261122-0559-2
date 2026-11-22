// Guards for The Velvet Vault: patrol loops, a forgiving detection grace
// period, suspicion, alert chase and search-and-return.
import { pointInCone, lineOfSight, segmentIntersectsCircle, circleRectCollide, angleDiff } from './geometry.js';

export const CONE_RANGE = 220;
export const CONE_HALF_ANGLE = 0.55;
export const DETECT_RATE = 170; // suspicion per second inside the cone
export const DECAY_RATE = 25; // suspicion per second while hidden
export const SUSPICIOUS_AT = 35;
export const ALERT_AT = 100;
export const ALERT_LOSE_SIGHT_S = 2.5;
export const SEARCH_LOOK_S = 3;

export class Guard {
  constructor(def) {
    this.x = def.x;
    this.y = def.y;
    this.r = 12;
    this.waypoints = def.waypoints;
    this.speed = def.speed ?? 60;
    this.waypointIndex = 1 % this.waypoints.length;
    const [nx, ny] = this.waypoints[this.waypointIndex];
    this.dir = Math.atan2(ny - this.y, nx - this.x);
    this.suspicion = 0;
    this.state = 'patrol';
    this.lastSeen = { x: this.x, y: this.y };
    this.alertTimer = 0;
    this.searchTimer = 0;
    this.lookTimer = 0;
    this.startX = def.x;
    this.startY = def.y;
  }

  // True when the guard can see the player right now.
  canSee(player, walls, smoke) {
    if (!pointInCone(player.x, player.y, this.x, this.y, this.dir, CONE_HALF_ANGLE, CONE_RANGE)) return false;
    if (!lineOfSight(this.x, this.y, player.x, player.y, walls)) return false;
    for (const cloud of smoke) {
      if (segmentIntersectsCircle(this.x, this.y, player.x, player.y, cloud.x, cloud.y, cloud.r)) return false;
    }
    return true;
  }

  moveToward(tx, ty, speed, dt, walls) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) return true;
    const step = Math.min(d, speed * dt);
    const nx = this.x + (dx / d) * step;
    const ny = this.y + (dy / d) * step;
    this.dir = Math.atan2(dy, dx);
    if (!walls.some((w) => circleRectCollide(nx, this.y, this.r, w))) this.x = nx;
    if (!walls.some((w) => circleRectCollide(this.x, ny, this.r, w))) this.y = ny;
    return d <= step;
  }

  reset() {
    this.x = this.startX;
    this.y = this.startY;
    this.waypointIndex = 1 % this.waypoints.length;
    const [nx, ny] = this.waypoints[this.waypointIndex];
    this.dir = Math.atan2(ny - this.y, nx - this.x);
    this.suspicion = 0;
    this.state = 'patrol';
    this.alertTimer = 0;
    this.searchTimer = 0;
    this.lookTimer = 0;
  }

  update(dt, player, walls, smoke) {
    const visible = this.canSee(player, walls, smoke);
    if (visible) {
      this.suspicion = Math.min(ALERT_AT, this.suspicion + DETECT_RATE * dt);
      this.lastSeen = { x: player.x, y: player.y };
      this.alertTimer = 0;
    } else {
      this.suspicion = Math.max(0, this.suspicion - DECAY_RATE * dt);
    }
    if (this.suspicion >= ALERT_AT) this.state = 'alert';

    switch (this.state) {
      case 'patrol': {
        if (this.suspicion >= SUSPICIOUS_AT) {
          this.state = 'suspicious';
          break;
        }
        const [wx, wy] = this.waypoints[this.waypointIndex];
        if (this.moveToward(wx, wy, this.speed, dt, walls)) {
          this.waypointIndex = (this.waypointIndex + 1) % this.waypoints.length;
        }
        break;
      }
      case 'suspicious': {
        if (this.suspicion <= 5) {
          this.state = 'patrol';
          break;
        }
        this.moveToward(this.lastSeen.x, this.lastSeen.y, this.speed * 1.2, dt, walls);
        break;
      }
      case 'alert': {
        if (visible) {
          this.moveToward(player.x, player.y, this.speed * 1.6, dt, walls);
        } else {
          this.alertTimer += dt;
          if (this.alertTimer >= ALERT_LOSE_SIGHT_S) {
            this.state = 'search';
            this.searchTimer = 0;
            this.lookTimer = 0;
          }
        }
        break;
      }
      case 'search': {
        if (this.searchTimer === 0) {
          const arrived = this.moveToward(this.lastSeen.x, this.lastSeen.y, this.speed * 1.2, dt, walls);
          if (arrived) this.searchTimer += dt;
        } else {
          this.lookTimer += dt;
          this.dir += dt * 1.5; // scan the room, then give up
          if (this.lookTimer >= SEARCH_LOOK_S || this.suspicion <= 0) {
            this.state = 'patrol';
            this.suspicion = 0;
          }
        }
        break;
      }
      default:
        break;
    }
    // Keep guards inside the arena.
    this.x = Math.max(this.r, Math.min(1280 - this.r, this.x));
    this.y = Math.max(this.r, Math.min(720 - this.r, this.y));
  }
}
