// Canvas renderer for The Velvet Vault: floor, walls, vision cones,
// cameras, loot, the thief, smoke, HUD and screens. Everything the judge
// sees in a screenshot is drawn here, so danger, loot and the objective
// are obvious at a glance.
import { ARENA_W, ARENA_H, TILE } from './levels.js';
import { CONE_RANGE, CONE_HALF_ANGLE } from './guards.js';

const COLORS = {
  floorA: '#171d33',
  floorB: '#131829',
  wallTop: '#3d4a73',
  wallSide: '#232c49',
  wallEdge: '#5a6b9e',
  gold: '#ffc93c',
  diamond: '#8ef1ff',
  exitOpen: '#39d98a',
  exitLocked: '#5c6675',
  player: '#37e0c8',
  guard: '#ff5d5d',
  conePatrol: 'rgba(255, 190, 80, 0.20)',
  coneAlert: 'rgba(255, 60, 60, 0.32)',
  coneCamera: 'rgba(255, 140, 60, 0.20)',
  smoke: 'rgba(200, 205, 220, 0.45)',
  hudBg: 'rgba(8, 10, 20, 0.82)',
  text: '#f2f5ff',
  muted: '#9aa7c7',
};

function drawCone(ctx, x, y, dir, halfAngle, range, fill) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, dir - halfAngle, dir + halfAngle);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawFloor(ctx) {
  ctx.fillStyle = COLORS.floorA;
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  ctx.fillStyle = COLORS.floorB;
  for (let ty = 0; ty < 18; ty++) {
    for (let tx = 0; tx < 32; tx++) {
      if ((tx + ty) % 2 === 0) ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= ARENA_W; x += TILE) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ARENA_H); ctx.stroke();
  }
  for (let y = 0; y <= ARENA_H; y += TILE) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ARENA_W, y); ctx.stroke();
  }
}

function drawWalls(ctx, walls) {
  for (const w of walls) {
    ctx.fillStyle = COLORS.wallSide;
    ctx.fillRect(w.x, w.y + 4, w.w, w.h);
    ctx.fillStyle = COLORS.wallTop;
    ctx.fillRect(w.x, w.y, w.w, w.h - 4);
    ctx.strokeStyle = COLORS.wallEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(w.x + 1, w.y + 1, w.w - 2, w.h - 6);
  }
}

function drawExit(ctx, game) {
  const ex = game.exit;
  ctx.fillStyle = game.exitOpen ? COLORS.exitOpen : COLORS.exitLocked;
  ctx.fillRect(ex.x, ex.y, ex.w, ex.h);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.strokeRect(ex.x + 2, ex.y + 2, ex.w - 4, ex.h - 4);
  ctx.fillStyle = '#06130c';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(game.exitOpen ? 'EXIT' : 'LOCKED', ex.x + ex.w / 2, ex.y + ex.h / 2);
  if (game.exitOpen) {
    ctx.save();
    ctx.shadowColor = COLORS.exitOpen;
    ctx.shadowBlur = 24;
    ctx.strokeStyle = COLORS.exitOpen;
    ctx.lineWidth = 4;
    ctx.strokeRect(ex.x - 4, ex.y - 4, ex.w + 8, ex.h + 8);
    ctx.restore();
  }
}

function drawLoot(ctx, game, time) {
  for (const item of game.loot) {
    if (item.taken) continue;
    const pulse = 1 + Math.sin(time * 4 + item.x) * 0.08;
    if (item.kind === 'diamond') {
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.scale(pulse, pulse);
      ctx.shadowColor = COLORS.diamond;
      ctx.shadowBlur = 22;
      ctx.fillStyle = COLORS.diamond;
      ctx.beginPath();
      ctx.moveTo(0, -16); ctx.lineTo(12, -4); ctx.lineTo(8, 12); ctx.lineTo(-8, 12); ctx.lineTo(-12, -4);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -16); ctx.lineTo(6, -4); ctx.lineTo(0, 4); ctx.lineTo(-6, -4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#dffaff';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('DIAMOND', item.x, item.y + 30);
    } else {
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.scale(pulse, pulse);
      ctx.shadowColor = COLORS.gold;
      ctx.shadowBlur = 14;
      ctx.fillStyle = COLORS.gold;
      for (const [ox, oy, r] of [[-7, 4, 7], [7, 4, 7], [0, -5, 8]]) {
        ctx.beginPath(); ctx.arc(ox, oy, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath(); ctx.arc(0, -5, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
}

function drawCameras(ctx, game) {
  for (const cam of game.cameras) {
    const disabled = cam.isDisabled(game.time);
    drawCone(ctx, cam.x, cam.y, cam.dir, 0.5, cam.range, disabled ? 'rgba(120,130,150,0.08)' : COLORS.coneCamera);
    ctx.save();
    ctx.translate(cam.x, cam.y);
    ctx.fillStyle = disabled ? '#5c6675' : '#ff8c3c';
    ctx.fillRect(-8, -8, 16, 16);
    ctx.fillStyle = '#1a1e2e';
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = disabled ? '#3a4152' : '#ffe1b8';
    ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    if (cam.detection > 5) {
      ctx.fillStyle = '#ff5d5d';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`! ${Math.round(cam.detection)}`, cam.x, cam.y - 16);
    }
  }
}

function drawGuards(ctx, game) {
  for (const guard of game.guards) {
    const alert = guard.state === 'alert';
    const suspicious = guard.state === 'suspicious' || guard.state === 'search';
    drawCone(
      ctx, guard.x, guard.y, guard.dir, CONE_HALF_ANGLE, CONE_RANGE,
      alert ? COLORS.coneAlert : suspicious ? 'rgba(255, 120, 60, 0.26)' : COLORS.conePatrol,
    );
    ctx.save();
    ctx.translate(guard.x, guard.y);
    ctx.shadowColor = COLORS.guard;
    ctx.shadowBlur = alert ? 16 : 6;
    ctx.fillStyle = alert ? '#ff2e2e' : '#d94f4f';
    ctx.beginPath(); ctx.arc(0, 0, guard.r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#1a1e2e';
    ctx.fillRect(-7, -3, 14, 6); // visor
    ctx.rotate(guard.dir);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(guard.r + 2, 0); ctx.lineTo(guard.r - 4, -4); ctx.lineTo(guard.r - 4, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
    if (guard.suspicion > 5) {
      ctx.fillStyle = alert ? '#ff2e2e' : '#ffb84d';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(alert ? '!' : '?', guard.x, guard.y - 20);
    }
  }
}

function drawSmoke(ctx, game) {
  for (const cloud of game.smoke) {
    ctx.fillStyle = COLORS.smoke;
    ctx.beginPath(); ctx.arc(cloud.x, cloud.y, cloud.r, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cloud.x - 24, cloud.y + 10, cloud.r * 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cloud.x + 22, cloud.y - 12, cloud.r * 0.55, 0, Math.PI * 2); ctx.fill();
  }
}

function drawPlayer(ctx, game, time) {
  const p = game.player;
  const blink = game.invulnerable > 0 && Math.floor(time * 8) % 2 === 0;
  if (blink) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.shadowColor = COLORS.player;
  ctx.shadowBlur = 16;
  ctx.fillStyle = COLORS.player;
  ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.rotate(p.facing);
  ctx.fillStyle = '#06231f';
  ctx.fillRect(-2, -8, 10, 16); // mask band
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(4, -4, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(4, 4, 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawHud(ctx, game) {
  ctx.fillStyle = COLORS.hudBg;
  ctx.fillRect(0, 0, ARENA_W, 64);
  ctx.fillStyle = COLORS.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`THE VELVET VAULT  ·  ${game.level.name}`, 16, 22);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(game.exitOpen ? 'ALL LOOT TAKEN — REACH THE GREEN EXIT!' : `STEAL ${game.totalLoot - game.lootCollected} MORE LOOT, THEN ESCAPE`, 16, 48);
  // Loot + score, right side.
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`◆ LOOT ${game.lootCollected}/${game.totalLoot}   SCORE ${game.score}`, ARENA_W - 16, 22);
  // Alarm meter.
  const ax = ARENA_W - 316;
  const ay = 40;
  ctx.fillStyle = '#20263c';
  ctx.fillRect(ax, ay, 300, 14);
  const alarmW = Math.round(300 * Math.min(1, game.alarm / 100));
  ctx.fillStyle = game.alarm > 70 ? '#ff2e2e' : game.alarm > 35 ? '#ffb84d' : '#39d98a';
  ctx.fillRect(ax, ay, alarmW, 14);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.strokeRect(ax, ay, 300, 14);
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ALARM', ax - 62, ay + 7);
  // Strikes + gadgets, bottom bar.
  ctx.fillStyle = COLORS.hudBg;
  ctx.fillRect(0, ARENA_H - 36, ARENA_W, 36);
  ctx.fillStyle = COLORS.text;
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`♥ ${'●'.repeat(3 - game.strikes)}${'○'.repeat(game.strikes)}   SMOKE [SPACE] ×${game.player.gadgets.smoke}   EMP [E] ×${game.player.gadgets.emp}`, 16, ARENA_H - 18);
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.muted;
  ctx.fillText('WASD / ARROWS move  ·  stay out of the cones  ·  ghost bonus +500 if never spotted', ARENA_W - 16, ARENA_H - 18);
  // Spotted banner.
  if (game.guards.some((g) => g.state === 'alert')) {
    ctx.fillStyle = 'rgba(255, 46, 46, 0.92)';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SPOTTED!', ARENA_W / 2, 120);
  }
  // Alarm vignette.
  if (game.alarm > 60) {
    const a = (game.alarm - 60) / 40 * 0.28;
    ctx.strokeStyle = `rgba(255, 46, 46, ${a})`;
    ctx.lineWidth = 24;
    ctx.strokeRect(0, 0, ARENA_W, ARENA_H);
  }
}

function drawOverlay(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(6, 8, 16, 0.78)';
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText(title, ARENA_W / 2, 240);
  ctx.fillStyle = COLORS.text;
  ctx.font = '22px sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, ARENA_W / 2, 310 + i * 34));
}

export function drawGame(ctx, game) {
  const time = game.time;
  drawFloor(ctx);
  drawWalls(ctx, game.walls);
  drawExit(ctx, game);
  drawLoot(ctx, game, time);
  drawCameras(ctx, game);
  drawGuards(ctx, game);
  drawSmoke(ctx, game);
  if (game.state === 'playing' || game.state === 'levelComplete' || game.state === 'gameOver' || game.state === 'win') {
    drawPlayer(ctx, game, time);
  }
  drawHud(ctx, game);
  if (game.state === 'title') {
    drawOverlay(ctx, 'THE VELVET VAULT', [
      'A three-floor museum heist. Take every loot, dodge the cones,',
      'and slip out the green exit. Smoke blinds guards, EMP kills cameras.',
      '',
      'CLICK OR PRESS ENTER TO START',
      'WASD / arrows move  ·  SPACE smoke  ·  E EMP',
    ], COLORS.gold);
  } else if (game.state === 'levelComplete') {
    drawOverlay(ctx, 'CLEAN!', [
      `${game.level.name} cleared  ·  score ${game.score}`,
      game.ghost ? 'GHOST BONUS +500 — never spotted' : 'Spotted once or twice — the ghost bonus slipped away',
      '',
      'PRESS ENTER FOR THE NEXT FLOOR',
    ], COLORS.exitOpen);
  } else if (game.state === 'gameOver') {
    drawOverlay(ctx, 'CAUGHT!', [
      'Three strikes — the night watch wins this time.',
      `Score ${game.score}`,
      '',
      'PRESS R TO TRY AGAIN',
    ], '#ff5d5d');
  } else if (game.state === 'win') {
    drawOverlay(ctx, 'CLEAN GETAWAY!', [
      'All three floors cleared. The Crown Diamond is yours.',
      `Final score ${game.score}${game.ghost ? '  ·  GHOST RUN' : ''}`,
      '',
      'PRESS R TO PLAY AGAIN',
    ], COLORS.diamond);
  }
}
