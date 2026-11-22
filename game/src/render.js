// Canvas renderer: paints the room, its patrols and cones, the loot, the thief
// and the HUD, plus the title, pause and end screens. One logical playfield,
// 1280x720, scaled to whatever window the canvas sits in.
import { FIELD, FONT, PALETTE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';
export const SCREEN_CAUGHT = 'caught';

function roundRect(ctx, x, y, w, h, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawCone(ctx, x, y, angle, halfAngle, distance, fill) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, distance, angle - halfAngle, angle + halfAngle);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawLootGlyph(ctx, item, time) {
  const pulse = 1 + Math.sin(time * 3 + item.x) * 0.08;
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.scale(pulse, pulse);
  ctx.shadowColor = item.required ? PALETTE.lootRequired : PALETTE.loot;
  ctx.shadowBlur = 16;
  switch (item.kind) {
    case 'diamond': {
      ctx.fillStyle = PALETTE.lootRequired;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(12, 0);
      ctx.lineTo(0, 14);
      ctx.lineTo(-12, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(6, 0);
      ctx.lineTo(0, 14);
      ctx.lineTo(-6, 0);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'painting': {
      ctx.fillStyle = '#8a6d2f';
      ctx.fillRect(-16, -12, 32, 24);
      ctx.fillStyle = '#2b4a6b';
      ctx.fillRect(-13, -9, 26, 18);
      ctx.fillStyle = '#e8d27a';
      ctx.beginPath();
      ctx.arc(-4, -2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3f6b4f';
      ctx.fillRect(-13, 4, 26, 5);
      break;
    }
    case 'bars': {
      ctx.fillStyle = PALETTE.loot;
      ctx.fillRect(-14, -8, 12, 8);
      ctx.fillRect(2, -8, 12, 8);
      ctx.fillRect(-6, 2, 12, 8);
      break;
    }
    case 'coins': {
      ctx.fillStyle = PALETTE.loot;
      for (const [cx, cy] of [[-7, 4], [7, 4], [0, -4]]) {
        ctx.beginPath();
        ctx.arc(cx, cy, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'cash': {
      ctx.fillStyle = '#7fc97f';
      ctx.fillRect(-14, -9, 28, 18);
      ctx.fillStyle = '#2f6b34';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    default: {
      ctx.fillStyle = PALETTE.loot;
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a5c00';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
  ctx.restore();
  if (item.required) {
    ctx.strokeStyle = 'rgba(55, 224, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(item.x, item.y, 24 + Math.sin(time * 3) * 3, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth || FIELD.width;
    const height = canvas.clientHeight || FIELD.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const scale = Math.min(canvas.width / FIELD.width, canvas.height / FIELD.height);
    ctx.setTransform(scale, 0, 0, scale, (canvas.width - FIELD.width * scale) / 2, (canvas.height - FIELD.height * scale) / 2);
  }

  function drawFloor(state) {
    ctx.fillStyle = PALETTE.floor;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = PALETTE.floorTile;
    for (let x = 0; x < FIELD.width; x += 80) {
      for (let y = 0; y < FIELD.height; y += 80) {
        if (((x + y) / 80) % 2 === 0) ctx.fillRect(x, y, 80, 80);
      }
    }
    ctx.strokeStyle = PALETTE.floorLine;
    ctx.lineWidth = 1;
    for (let x = 0; x <= FIELD.width; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, FIELD.height);
      ctx.stroke();
    }
    for (let y = 0; y <= FIELD.height; y += 80) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(FIELD.width, y);
      ctx.stroke();
    }
    // A soft pool of light over the middle of the room.
    const glow = ctx.createRadialGradient(640, 360, 60, 640, 360, 620);
    glow.addColorStop(0, 'rgba(255, 240, 200, 0.07)');
    glow.addColorStop(1, 'rgba(255, 240, 200, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawExit(state) {
    const exit = state.exit;
    const pulse = 0.5 + Math.sin(performance.now() / 400) * 0.2;
    ctx.save();
    ctx.shadowColor = PALETTE.exit;
    ctx.shadowBlur = 18;
    ctx.fillStyle = `rgba(47, 214, 122, ${0.25 + pulse * 0.25})`;
    ctx.fillRect(exit.x, exit.y, exit.w, exit.h);
    ctx.restore();
    ctx.strokeStyle = PALETTE.exit;
    ctx.lineWidth = 3;
    ctx.strokeRect(exit.x, exit.y, exit.w, exit.h);
    ctx.fillStyle = PALETTE.exit;
    ctx.font = `bold 15px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(exit.label, exit.x + exit.w / 2, exit.y + exit.h / 2 + 5);
  }

  function drawWalls(state) {
    for (const wall of state.walls) {
      ctx.fillStyle = PALETTE.wallShadow;
      ctx.fillRect(wall.x + 4, wall.y + 5, wall.w, wall.h);
      ctx.fillStyle = PALETTE.wall;
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.fillStyle = PALETTE.wallTop;
      ctx.fillRect(wall.x, wall.y, wall.w, 4);
    }
  }

  function drawCameras(state, time) {
    for (const camera of state.cameras) {
      const disabled = camera.disabledTimer > 0;
      if (!disabled) {
        drawCone(ctx, camera.x, camera.y, camera.angle, 0.44, 260, PALETTE.cameraCone);
      }
      ctx.fillStyle = '#20242f';
      ctx.beginPath();
      ctx.arc(camera.x, camera.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = disabled ? '#5a6274' : PALETTE.camera;
      ctx.beginPath();
      ctx.arc(camera.x, camera.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = disabled ? '#8b93a3' : '#ffd9a0';
      ctx.beginPath();
      ctx.arc(camera.x + Math.cos(camera.angle) * 4, camera.y + Math.sin(camera.angle) * 4, 2.5, 0, Math.PI * 2);
      ctx.fill();
      if (disabled) {
        ctx.fillStyle = PALETTE.muted;
        ctx.font = `bold 11px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('OFF', camera.x, camera.y - 16);
      }
    }
  }

  function drawGuards(state, time) {
    for (const guard of state.guards) {
      const alerted = guard.mode === 'chase';
      drawCone(
        ctx,
        guard.x,
        guard.y,
        guard.angle,
        0.61,
        220,
        alerted ? PALETTE.guardConeAlert : PALETTE.guardCone,
      );
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(guard.x + 3, guard.y + 4, 15, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = alerted ? '#ff6b61' : PALETTE.guard;
      ctx.beginPath();
      ctx.arc(guard.x, guard.y, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2b0d0b';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Cap brim shows which way the guard faces.
      ctx.fillStyle = '#7a1d17';
      ctx.beginPath();
      ctx.arc(guard.x + Math.cos(guard.angle) * 6, guard.y + Math.sin(guard.angle) * 6, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(guard.x + Math.cos(guard.angle) * 9, guard.y + Math.sin(guard.angle) * 9, 2.5, 0, Math.PI * 2);
      ctx.fill();
      if (guard.mode !== 'patrol') {
        ctx.fillStyle = alerted ? PALETTE.danger : PALETTE.loot;
        ctx.font = `bold 20px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(alerted ? '!' : '?', guard.x, guard.y - 24);
      }
    }
  }

  function drawPlayer(state, time) {
    const player = state.player;
    if (state.smokeTimer > 0) {
      ctx.fillStyle = PALETTE.smoke;
      ctx.beginPath();
      ctx.arc(state.smokeX, state.smokeY, 130, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(player.x + 3, player.y + 5, 14, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = player.sneaking ? PALETTE.playerDark : PALETTE.player;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0b3d36';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Hood point and shoulders show the facing direction.
    ctx.fillStyle = '#0b3d36';
    ctx.beginPath();
    ctx.moveTo(player.x + Math.cos(player.angle) * 16, player.y + Math.sin(player.angle) * 16);
    ctx.lineTo(
      player.x + Math.cos(player.angle + 2.5) * 10,
      player.y + Math.sin(player.angle + 2.5) * 10,
    );
    ctx.lineTo(
      player.x + Math.cos(player.angle - 2.5) * 10,
      player.y + Math.sin(player.angle - 2.5) * 10,
    );
    ctx.closePath();
    ctx.fill();
    if (player.sneaking) {
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('sneaking', player.x, player.y - 22);
    }
  }

  function drawAlarmMeter(state) {
    const x = 980;
    const y = 14;
    const width = 220;
    const height = 18;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, x - 8, y - 8, width + 74, height + 16, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('ALARM', x, y + 14);
    const fillWidth = (state.alarm / 100) * width;
    const color = state.alarm > 70 ? PALETTE.danger : state.alarm > 35 ? PALETTE.loot : '#2fd67a';
    ctx.fillStyle = '#10131c';
    roundRect(ctx, x + 62, y, width - 62, height, 4);
    ctx.fill();
    if (fillWidth > 0) {
      ctx.fillStyle = state.alarm > 70 && Math.floor(performance.now() / 200) % 2 === 0 ? '#ff8a80' : color;
      roundRect(ctx, x + 62, y, Math.max(6, fillWidth - 62 * (fillWidth / width)), height, 4);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    roundRect(ctx, x + 62, y, width - 62, height, 4);
    ctx.stroke();
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 12px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(state.alarm)}%`, x + width + 58, y + 14);
  }

  function drawHud(state, best, toast) {
    ctx.fillStyle = PALETTE.hud;
    ctx.fillRect(0, 0, FIELD.width, 56);
    ctx.fillStyle = PALETTE.hudPanel;
    ctx.fillRect(0, 56, FIELD.width, 2);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 17px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(state.levelName.toUpperCase(), 16, 24);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `13px ${FONT}`;
    ctx.fillText(state.levelSubtitle, 16, 44);
    const taken = state.loot.filter((item) => item.taken).length;
    ctx.fillStyle = PALETTE.text;
    ctx.font = `bold 15px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(`LOOT ${taken}/${state.loot.length}`, 560, 24);
    ctx.fillText(`SCORE ${state.score}`, 560, 44);
    const minutes = Math.floor(state.time / 60);
    const seconds = Math.floor(state.time % 60);
    ctx.fillText(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`, 700, 24);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `13px ${FONT}`;
    ctx.fillText(`BEST ${best}`, 700, 44);
    ctx.textAlign = 'left';
    ctx.fillStyle = state.tools.smoke > 0 ? PALETTE.text : PALETTE.muted;
    ctx.font = `bold 13px ${FONT}`;
    ctx.fillText(`SMOKE x${state.tools.smoke} [1]`, 800, 24);
    ctx.fillStyle = state.tools.emp > 0 ? PALETTE.text : PALETTE.muted;
    ctx.fillText(`EMP x${state.tools.emp} [2]`, 800, 44);
    drawAlarmMeter(state);
    if (toast) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      const width = ctx.measureText(toast).width + 32;
      roundRect(ctx, (FIELD.width - width) / 2, 70, width, 34, 8);
      ctx.fill();
      ctx.fillStyle = PALETTE.text;
      ctx.font = `bold 15px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(toast, FIELD.width / 2, 92);
    }
    // Red edge glow while the alarm is high.
    if (state.alarm > 70) {
      const alpha = ((state.alarm - 70) / 30) * 0.35;
      const edge = ctx.createRadialGradient(640, 360, 300, 640, 360, 720);
      edge.addColorStop(0, 'rgba(255, 60, 40, 0)');
      edge.addColorStop(1, `rgba(255, 60, 40, ${alpha})`);
      ctx.fillStyle = edge;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
  }

  function drawOverlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(8, 10, 16, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = accent;
    ctx.font = `bold 54px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(title, FIELD.width / 2, 250);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `20px ${FONT}`;
    lines.forEach((line, index) => {
      ctx.fillText(line, FIELD.width / 2, 310 + index * 34);
    });
  }

  function draw(state, screen, best, toast = '') {
    fit();
    const time = performance.now() / 1000;
    ctx.clearRect(0, 0, FIELD.width, FIELD.height);
    drawFloor(state);
    drawExit(state);
    for (const item of state.loot) {
      if (!item.taken) drawLootGlyph(ctx, item, time);
    }
    drawCameras(state, time);
    drawGuards(state, time);
    drawWalls(state);
    drawPlayer(state, time);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      drawHud(state, best, toast);
    }
    if (screen === SCREEN_TITLE) {
      drawHud(state, best, '');
      drawOverlay('THE MIDNIGHT VAULT', [
        'A top-down stealth heist in three rooms.',
        'Grab the marked loot, dodge the cones, reach the exit.',
        '',
        'Move WASD / Arrows   Run Shift   Sneak C   Smoke 1   EMP 2   Pause P',
        '',
        'Press SPACE or click to start',
      ], PALETTE.loot);
    } else if (screen === SCREEN_PAUSED) {
      drawOverlay('PAUSED', ['Press P or SPACE to keep sneaking.'], PALETTE.text);
    } else if (screen === SCREEN_WIN) {
      drawOverlay('CLEAN GETAWAY', [
        `Haul: ${state.score} points in ${Math.floor(state.time)} seconds.`,
        'Press SPACE for the next heist.',
      ], PALETTE.exit);
    } else if (screen === SCREEN_CAUGHT) {
      drawOverlay('BUSTED!', [
        'A guard caught you red-handed.',
        `The haul so far: ${state.score} points.`,
        'Press SPACE to try the room again.',
      ], PALETTE.danger);
    }
  }

  return { draw };
}
