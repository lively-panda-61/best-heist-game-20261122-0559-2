// Keyboard and mouse input. Keys are tracked as a set; the loop reads a
// direction vector and consumes one-shot actions (confirm, pause, tools).
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_SMOKE = 4;
export const ACTION_EMP = 8;

const DIRECTION_KEYS = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

export function createInput(canvas) {
  const pressed = new Set();
  let actions = 0;

  function onKeyDown(event) {
    if (event.code in DIRECTION_KEYS || event.code === 'Space') event.preventDefault();
    if (event.repeat) return;
    pressed.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') actions |= ACTION_CONFIRM;
    else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    else if (event.code === 'Digit1') actions |= ACTION_SMOKE;
    else if (event.code === 'Digit2') actions |= ACTION_EMP;
  }

  function onKeyUp(event) {
    pressed.delete(event.code);
  }

  function onPointerDown() {
    actions |= ACTION_CONFIRM;
  }

  function onBlur() {
    pressed.clear();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointerdown', onPointerDown);

  /** Normalised movement vector from the keys held right now. */
  function direction() {
    let x = 0;
    let y = 0;
    for (const code of pressed) {
      const vector = DIRECTION_KEYS[code];
      if (vector) {
        x += vector[0];
        y += vector[1];
      }
    }
    const length = Math.hypot(x, y);
    if (length === 0) return { x: 0, y: 0 };
    return { x: x / length, y: y / length };
  }

  function running() {
    return pressed.has('ShiftLeft') || pressed.has('ShiftRight');
  }

  function sneaking() {
    return pressed.has('KeyC') || pressed.has('ControlLeft') || pressed.has('ControlRight');
  }

  /** Take and clear the one-shot actions queued since the last call. */
  function takeActions() {
    const taken = actions;
    actions = 0;
    return taken;
  }

  return { direction, running, sneaking, takeActions };
}
