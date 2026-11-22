// The heist simulation: pure logic, no DOM, no canvas. The browser loop and the
// screenshot stager both drive this same world, and the unit tests import it
// directly. Everything the player, the guards and the cameras do lives here.
import { ALARM, CAMERA, FIELD, GUARD, LOOT, PLAYER, STEP, TOOLS } from './config.js';
import { LEVELS } from './levels.js';

export const EVENT_LOOT = 1;
export const EVENT_SPOTTED = 2;
export const EVENT_LOCKDOWN = 4;
export const EVENT_CAUGHT = 8;
export const EVENT_WIN = 16;
export const EVENT_TOOL = 32;

/** Smallest signed angle from `from` to `to`, in (-PI, PI]. */
export function angleDifference(from, to) {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff <= -Math.PI) diff += Math.PI * 2;
  return diff;
}

/** True when the segment (x1,y1)-(x2,y2) touches the rectangle. */
export function segmentHitsRect(x1, y1, x2, y2, rect) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tMin = 0;
  let tMax = 1;
  for (const [p, q] of [
    [-dx, x1 - rect.x],
    [dx, rect.x + rect.w - x1],
    [-dy, y1 - rect.y],
    [dy, rect.y + rect.h - y1],
  ]) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const t = q / p;
      if (p < 0) {
        if (t > tMax) return false;
        if (t > tMin) tMin = t;
      } else {
        if (t < tMin) return false;
        if (t < tMax) tMax = t;
      }
    }
  }
  return true;
}

/** True when no wall stands between the two points. */
export function lineOfSight(x1, y1, x2, y2, walls) {
  for (const wall of walls) {
    if (segmentHitsRect(x1, y1, x2, y2, wall)) return false;
  }
  return true;
}

/**
 * Can an observer at (ox, oy) facing `angle` see the target? Checks distance,
 * cone angle and line of sight. `sneak` shrinks the observer's view distance.
 */
export function canSee(observer, target, walls, sneak) {
  const dx = target.x - observer.x;
  const dy = target.y - observer.y;
  const distance = Math.hypot(dx, dy);
  const viewDistance = observer.viewDistance * (sneak ? observer.sneakFactor : 1);
  if (distance > viewDistance) return false;
  if (distance < 1) return true;
  const targetAngle = Math.atan2(dy, dx);
  if (Math.abs(angleDifference(observer.angle, targetAngle)) > observer.halfAngle) return false;
  return lineOfSight(observer.x, observer.y, target.x, target.y, walls);
}

/** Move a circle by (dx, dy), sliding along walls instead of passing through. */
function moveCircle(body, dx, dy, walls) {
  const radius = body.radius;
  body.x += dx;
  for (const wall of walls) {
    if (circleHitsRect(body, radius, wall)) {
      if (dx > 0) body.x = wall.x - radius;
      else if (dx < 0) body.x = wall.x + wall.w + radius;
    }
  }
  body.x = Math.min(FIELD.width - radius, Math.max(radius, body.x));
  body.y += dy;
  for (const wall of walls) {
    if (circleHitsRect(body, radius, wall)) {
      if (dy > 0) body.y = wall.y - radius;
      else if (dy < 0) body.y = wall.y + wall.h + radius;
    }
  }
  body.y = Math.min(FIELD.height - radius, Math.max(radius, body.y));
}

function circleHitsRect(body, radius, rect) {
  const nearestX = Math.min(rect.x + rect.w, Math.max(rect.x, body.x));
  const nearestY = Math.min(rect.y + rect.h, Math.max(rect.y, body.y));
  const dx = body.x - nearestX;
  const dy = body.y - nearestY;
  return dx * dx + dy * dy < radius * radius;
}

function buildState(levelIndex, random) {
  const level = LEVELS[levelIndex];
  const guards = level.guards.map((guard, index) => {
    const [first, second] = guard.waypoints;
    return {
      id: index,
      x: first.x,
      y: first.y,
      radius: GUARD.radius,
      angle: Math.atan2(second.y - first.y, second.x - first.x),
      waypoints: guard.waypoints.map((point) => ({ ...point })),
      waypointIndex: 1,
      mode: 'patrol',
      target: null,
      waitTimer: 0,
      seenTimer: 0,
      viewDistance: GUARD.viewDistance,
      sneakFactor: GUARD.sneakFactor,
      halfAngle: GUARD.halfAngle,
    };
  });
  const cameras = level.cameras.map((camera, index) => ({
    id: index,
    x: camera.x,
    y: camera.y,
    baseAngle: camera.angle,
    angle: camera.angle,
    phase: random() * Math.PI * 2,
    disabledTimer: 0,
    viewDistance: CAMERA.viewDistance,
    sneakFactor: CAMERA.sneakFactor,
    halfAngle: CAMERA.halfAngle,
  }));
  return {
    levelIndex,
    levelName: level.name,
    levelSubtitle: level.subtitle,
    walls: level.walls.map((wall) => ({ ...wall })),
    exit: { ...level.exit },
    player: {
      x: level.playerStart.x,
      y: level.playerStart.y,
      radius: PLAYER.radius,
      angle: 0,
      moving: false,
      running: false,
      sneaking: false,
    },
    guards,
    cameras,
    loot: level.loot.map((item) => ({ ...item, taken: false })),
    alarm: 0,
    score: 0,
    time: 0,
    status: 'playing',
    tools: { smoke: TOOLS.smokePerLevel, emp: TOOLS.empPerLevel },
    smokeTimer: 0,
    smokeX: 0,
    smokeY: 0,
    spotted: false,
    lockdown: false,
  };
}

export function createWorld(levelIndex, random) {
  const safeRandom = typeof random === 'function' ? random : Math.random;
  let state = buildState(levelIndex, safeRandom);

  function reset() {
    state = buildState(levelIndex, safeRandom);
  }

  /** Test and screenshot hook: place the player at an exact spot. */
  function debugPlace(x, y) {
    state.player.x = x;
    state.player.y = y;
  }

  function useSmoke() {
    if (state.tools.smoke <= 0 || state.smokeTimer > 0) return false;
    state.tools.smoke -= 1;
    state.smokeTimer = TOOLS.smokeDuration;
    state.smokeX = state.player.x;
    state.smokeY = state.player.y;
    state.score = Math.max(0, state.score - TOOLS.smokeCost);
    return true;
  }

  function useEmp() {
    if (state.tools.emp <= 0) return false;
    state.tools.emp -= 1;
    for (const camera of state.cameras) camera.disabledTimer = TOOLS.empDuration;
    state.score = Math.max(0, state.score - TOOLS.empCost);
    return true;
  }

  function stepGuard(guard, dt, player) {
    let speed = GUARD.patrolSpeed;
    let destination = guard.waypoints[guard.waypointIndex];
    if (guard.mode === 'chase') {
      speed = GUARD.chaseSpeed;
      destination = guard.target;
    } else if (guard.mode === 'investigate') {
      speed = GUARD.investigateSpeed;
      destination = guard.target;
    }
    if (guard.mode === 'investigate' && guard.waitTimer > 0) {
      guard.waitTimer -= dt;
      guard.angle += dt * 1.5;
      if (guard.waitTimer <= 0) {
        guard.mode = 'patrol';
        guard.target = null;
        let nearest = 0;
        let nearestDistance = Infinity;
        guard.waypoints.forEach((point, index) => {
          const distance = Math.hypot(point.x - guard.x, point.y - guard.y);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearest = index;
          }
        });
        guard.waypointIndex = nearest;
      }
      return;
    }
    if (!destination) return;
    const dx = destination.x - guard.x;
    const dy = destination.y - guard.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 4) {
      if (guard.mode === 'patrol') {
        guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
      } else if (guard.mode === 'investigate') {
        guard.waitTimer = GUARD.investigateTime;
      }
      return;
    }
    const stepDistance = Math.min(distance, speed * dt);
    const nx = (dx / distance) * stepDistance;
    const ny = (dy / distance) * stepDistance;
    guard.angle = Math.atan2(dy, dx);
    // Guards slide along walls like the player does: a chase that cuts
    // through a wall would be unfair, and a patrol that clips one looks broken.
    moveCircle(guard, nx, ny, state.walls);
  }

  /**
   * Advance the world by `dt` seconds. `input` is {x, y, run, sneak, smoke, emp}
   * with x/y in [-1, 1]. Long steps are split into fixed 1/60 s substeps so a
   * slow frame never jumps the simulation. Returns a bitmask of EVENT_* flags.
   */
  function step(dt, input = {}) {
    if (state.status !== 'playing') return 0;
    let events = 0;
    let remaining = Math.max(0, dt);
    while (remaining > 0) {
      const stepDt = Math.min(remaining, STEP);
      events |= stepOnce(stepDt, input);
      remaining -= stepDt;
      if (state.status !== 'playing') break;
    }
    return events;
  }

  function stepOnce(stepDt, input) {
    let events = 0;
    const player = state.player;

    if (input.smoke && useSmoke()) events |= EVENT_TOOL;
    if (input.emp && useEmp()) events |= EVENT_TOOL;

    const length = Math.hypot(input.x || 0, input.y || 0);
    const moving = length > 0.01;
    player.moving = moving;
    player.running = Boolean(input.run) && moving;
    // Holding sneak counts even standing still: a crouched thief is harder to see.
    player.sneaking = Boolean(input.sneak);
    if (moving) {
      const speed = player.running
        ? PLAYER.runSpeed
        : player.sneaking
          ? PLAYER.sneakSpeed
          : PLAYER.walkSpeed;
      const nx = (input.x / length) * speed * stepDt;
      const ny = (input.y / length) * speed * stepDt;
      player.angle = Math.atan2(input.y, input.x);
      moveCircle(player, nx, ny, state.walls);
    }

    if (state.smokeTimer > 0) state.smokeTimer -= stepDt;
    state.time += stepDt;

    // Loot pickup.
    for (const item of state.loot) {
      if (!item.taken && Math.hypot(item.x - player.x, item.y - player.y) < LOOT.pickupRadius) {
        item.taken = true;
        state.score += item.value;
        events |= EVENT_LOOT;
      }
    }

    const hiddenBySmoke =
      state.smokeTimer > 0 &&
      Math.hypot(player.x - state.smokeX, player.y - state.smokeY) < TOOLS.smokeRadius;

    // Running is loud: nearby guards come to look.
    if (player.running) {
      for (const guard of state.guards) {
        if (guard.mode === 'patrol' && Math.hypot(guard.x - player.x, guard.y - player.y) < PLAYER.noiseRadius) {
          guard.mode = 'investigate';
          guard.target = { x: player.x, y: player.y };
        }
      }
    }

    // Detection: guards and cameras raise the alarm while they see the player.
    let anyoneSees = false;
    for (const guard of state.guards) {
      const sees = !hiddenBySmoke && canSee(guard, player, state.walls, player.sneaking);
      if (sees) {
        anyoneSees = true;
        state.alarm = Math.min(ALARM.max, state.alarm + GUARD.alarmRate * stepDt);
        guard.mode = 'chase';
        guard.target = { x: player.x, y: player.y };
        guard.seenTimer = 0;
        events |= EVENT_SPOTTED;
      } else if (guard.mode === 'chase') {
        guard.seenTimer += stepDt;
        if (guard.seenTimer > GUARD.chaseMemory) {
          guard.mode = 'investigate';
          guard.target = { x: guard.target?.x ?? player.x, y: guard.target?.y ?? player.y };
        }
      }
    }
    for (const camera of state.cameras) {
      camera.phase += CAMERA.sweepSpeed * stepDt;
      camera.angle = camera.baseAngle + CAMERA.sweepAmplitude * Math.sin(camera.phase);
      if (camera.disabledTimer > 0) {
        camera.disabledTimer -= stepDt;
        continue;
      }
      if (!hiddenBySmoke && canSee(camera, player, state.walls, player.sneaking)) {
        anyoneSees = true;
        state.alarm = Math.min(ALARM.max, state.alarm + CAMERA.alarmRate * stepDt);
        events |= EVENT_SPOTTED;
      }
    }

    if (!anyoneSees) {
      state.alarm = Math.max(0, state.alarm - ALARM.decayRate * stepDt);
    }
    state.spotted = anyoneSees;

    if (state.alarm >= ALARM.max && !state.lockdown) {
      state.lockdown = true;
      events |= EVENT_LOCKDOWN;
      for (const guard of state.guards) {
        guard.mode = 'chase';
        guard.target = { x: player.x, y: player.y };
        guard.seenTimer = 0;
      }
    }

    for (const guard of state.guards) stepGuard(guard, stepDt, player);

    // Caught: a guard closes in on the player.
    for (const guard of state.guards) {
      if (Math.hypot(guard.x - player.x, guard.y - player.y) < GUARD.catchRadius) {
        state.status = 'caught';
        return events | EVENT_CAUGHT;
      }
    }

    // Win: every required piece of loot, then reach the exit.
    const requiredTaken = state.loot.filter((item) => item.required).every((item) => item.taken);
    const exit = state.exit;
    const inExit =
      player.x > exit.x && player.x < exit.x + exit.w && player.y > exit.y && player.y < exit.y + exit.h;
    if (requiredTaken && inExit) {
      state.status = 'won';
      state.score += Math.max(0, 1000 - Math.floor(state.time) * 2);
      return events | EVENT_WIN;
    }
    return events;
  }

  return { get state() { return state; }, step, reset, debugPlace };
}

export { STEP };
