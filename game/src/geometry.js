// Pure geometry for The Velvet Vault: vision cones, line of sight,
// collision and BFS pathfinding. No DOM, no game state — unit-testable.
export function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

export function angleDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Is point (px,py) inside a vision cone from (ox,oy), facing dirAngle,
// with half-angle halfAngle and range?
export function pointInCone(px, py, ox, oy, dirAngle, halfAngle, range) {
  const dx = px - ox;
  const dy = py - oy;
  const d = Math.hypot(dx, dy);
  if (d > range || d < 1) return d < 1;
  const ang = Math.atan2(dy, dx);
  return Math.abs(angleDiff(ang, dirAngle)) <= halfAngle;
}

function segmentIntersectsSegment(x1, y1, x2, y2, x3, y3, x4, y4) {
  const d1 = (x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1);
  const d2 = (x2 - x1) * (y4 - y1) - (y2 - y1) * (x4 - x1);
  const d3 = (x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3);
  const d4 = (x4 - x3) * (y2 - y3) - (y4 - y3) * (x2 - x3);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

export function segmentIntersectsRect(x1, y1, x2, y2, rect) {
  // Inside the rect counts as intersecting.
  const inside = (x, y) => x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  if (inside(x1, y1) || inside(x2, y2)) return true;
  const { x, y, w, h } = rect;
  return (
    segmentIntersectsSegment(x1, y1, x2, y2, x, y, x + w, y) ||
    segmentIntersectsSegment(x1, y1, x2, y2, x + w, y, x + w, y + h) ||
    segmentIntersectsSegment(x1, y1, x2, y2, x + w, y + h, x, y + h) ||
    segmentIntersectsSegment(x1, y1, x2, y2, x, y + h, x, y)
  );
}

export function segmentIntersectsCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((cx - x1) * dx + (cy - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const nx = x1 + t * dx;
  const ny = y1 + t * dy;
  return Math.hypot(cx - nx, cy - ny) < r;
}

// True when no wall rect blocks the straight line between two points.
export function lineOfSight(x1, y1, x2, y2, walls) {
  for (const wall of walls) {
    if (segmentIntersectsRect(x1, y1, x2, y2, wall)) return false;
  }
  return true;
}

export function circleRectCollide(cx, cy, r, rect) {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  return (cx - nx) * (cx - nx) + (cy - ny) * (cy - ny) < r * r;
}

// BFS on a tile grid. walkable(x, y) answers whether tile (x,y) is open.
// Returns an array of {x, y} tile steps from start to target, or null.
export function findPath(walkable, cols, rows, sx, sy, tx, ty) {
  if (sx === tx && sy === ty) return [{ x: sx, y: sy }];
  if (!walkable(sx, sy) || !walkable(tx, ty)) return null;
  const key = (x, y) => y * cols + x;
  const prev = new Map();
  const seen = new Set([key(sx, sy)]);
  const queue = [[sx, sy]];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (queue.length > 0) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      if (!walkable(nx, ny) || seen.has(key(nx, ny))) continue;
      seen.add(key(nx, ny));
      prev.set(key(nx, ny), [x, y]);
      if (nx === tx && ny === ty) {
        const path = [[tx, ty]];
        let cur = [x, y];
        while (!(cur[0] === sx && cur[1] === sy)) {
          path.unshift(cur);
          cur = prev.get(key(cur[0], cur[1]));
        }
        path.unshift([sx, sy]);
        return path.map(([px, py]) => ({ x: px, y: py }));
      }
      queue.push([nx, ny]);
    }
  }
  return null;
}
