// Isla Verde — input.js
// Keyboard + on-screen touch buttons. Single source of input state.
export function createInput() {
  const keys = new Set();
  const state = {
    forward: false, back: false, left: false, right: false,
    sprint: false, brake: false, jump: false,
    interact: false, attack: false, wheel: false, pause: false,
    horn: false, nitro: false, hack: false, reload: false,
    camera: false, anyKey: false,
  };
  const pressed = new Set(); // edge-triggered, consumed by game each tick
  const map = {
    KeyW: 'forward', ArrowUp: 'forward',
    KeyS: 'back', ArrowDown: 'back',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'sprint', ShiftRight: 'sprint',
    Space: 'jump', KeyE: 'interact', KeyF: 'attack',
    KeyQ: 'wheel', KeyP: 'pause', Escape: 'pause',
    KeyH: 'horn', KeyR: 'reload', KeyX: 'hack',
    KeyC: 'camera', KeyN: 'nitro',
  };
  function down(e) {
    if (map[e.code]) {
      if (!keys.has(e.code)) pressed.add(map[e.code]);
      keys.add(e.code);
      state[map[e.code]] = true;
      state.anyKey = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    }
  }
  function up(e) {
    if (map[e.code]) {
      keys.delete(e.code);
      // recompute held state for that action
      state[map[e.code]] = [...keys].some((k) => map[k] === map[e.code]);
    }
  }
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', () => { keys.clear(); for (const k of Object.keys(state)) state[k] = false; });

  return {
    state,
    wasPressed(action) { const hit = pressed.has(action); if (hit) pressed.delete(action); return hit; },
    consumeAll() { pressed.clear(); },
    setTouch(action, on) {
      state[action] = on;
      if (on) pressed.add(action);
      state.anyKey = state.anyKey || on;
    },
    // mouse: click = attack / interact on HUD buttons handled by DOM
    bindMouse(canvas, onAttack) {
      canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { state.attack = true; pressed.add('attack'); if (onAttack) onAttack(); } });
      canvas.addEventListener('mouseup', () => { state.attack = false; });
    },
  };
}
