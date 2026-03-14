/**
 * VirtualJoystick.js
 * On-screen touch joystick for mobile/tablet players.
 *
 * Exports:
 *   createVirtualJoystick()   – mount joystick DOM elements
 *   destroyVirtualJoystick()  – remove joystick DOM elements (call on scene dispose)
 *   getJoystickInput()        – returns { x, y } each in range -1 to 1
 */

// ── Module-level state ────────────────────────────────────────────────────────
let _base  = null;   // #joystick-base element
let _knob  = null;   // #joystick-knob element
let _label = null;   // "Move" label element

// Current normalized direction (-1 … 1)
let _inputX = 0;
let _inputY = 0;

// Touch tracking
let _activeTouchId = null;  // identifier of the touch we're following
let _baseRect      = null;  // cached bounding rect of the base

// ── Constants ─────────────────────────────────────────────────────────────────
const BASE_RADIUS = 55;   // half of 110px diameter

// ── Helpers ───────────────────────────────────────────────────────────────────
function _clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function _onTouchStart(e) {
  // Only claim the first touch that lands on the base
  if (_activeTouchId !== null) return;

  _baseRect = _base.getBoundingClientRect();
  const cx = _baseRect.left + _baseRect.width  / 2;
  const cy = _baseRect.top  + _baseRect.height / 2;

  for (const touch of e.changedTouches) {
    const dx = touch.clientX - cx;
    const dy = touch.clientY - cy;

    if (Math.sqrt(dx * dx + dy * dy) <= BASE_RADIUS) {
      _activeTouchId = touch.identifier;
      _updateKnob(touch.clientX, touch.clientY);
      e.preventDefault();
      break;
    }
  }
}

function _onTouchMove(e) {
  if (_activeTouchId === null) return;

  for (const touch of e.changedTouches) {
    if (touch.identifier === _activeTouchId) {
      _updateKnob(touch.clientX, touch.clientY);
      e.preventDefault();
      break;
    }
  }
}

function _onTouchEnd(e) {
  if (_activeTouchId === null) return;

  for (const touch of e.changedTouches) {
    if (touch.identifier === _activeTouchId) {
      _activeTouchId = null;
      _inputX = 0;
      _inputY = 0;
      _knob.style.transform = "translate(-50%, -50%)";
      break;
    }
  }
}

function _updateKnob(clientX, clientY) {
  if (!_baseRect) return;

  const cx = _baseRect.left + _baseRect.width  / 2;
  const cy = _baseRect.top  + _baseRect.height / 2;

  let dx = clientX - cx;
  let dy = clientY - cy;

  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > BASE_RADIUS) {
    dx = (dx / dist) * BASE_RADIUS;
    dy = (dy / dist) * BASE_RADIUS;
  }

  // Normalize to -1 … 1
  _inputX = _clamp(dx / BASE_RADIUS, -1, 1);
  _inputY = _clamp(dy / BASE_RADIUS, -1, 1);

  // Position knob relative to base centre
  _knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the current joystick direction.
 * @returns {{ x: number, y: number }}  each in range -1 … 1
 */
export function getJoystickInput() {
  return { x: _inputX, y: _inputY };
}

/**
 * Create and mount the joystick DOM elements.
 * Safe to call multiple times — won't add duplicates.
 */
export function createVirtualJoystick() {
  if (_base) return; // already mounted

  // Base circle
  _base       = document.createElement("div");
  _base.id    = "joystick-base";

  // Knob
  _knob       = document.createElement("div");
  _knob.id    = "joystick-knob";
  _knob.style.transform = "translate(-50%, -50%)";
  _base.appendChild(_knob);

  // "Move" label above the base
  _label          = document.createElement("div");
  _label.id       = "joystick-label";
  _label.textContent = "Move";

  document.body.appendChild(_label);
  document.body.appendChild(_base);

  // Touch listeners on the base
  _base.addEventListener("touchstart", _onTouchStart, { passive: false });
  _base.addEventListener("touchmove",  _onTouchMove,  { passive: false });
  _base.addEventListener("touchend",   _onTouchEnd,   { passive: false });
  _base.addEventListener("touchcancel",_onTouchEnd,   { passive: false });
}

/**
 * Remove the joystick from the DOM and reset state.
 * Call this from scene.onDisposeObservable.
 */
export function destroyVirtualJoystick() {
  if (_base) {
    _base.removeEventListener("touchstart", _onTouchStart);
    _base.removeEventListener("touchmove",  _onTouchMove);
    _base.removeEventListener("touchend",   _onTouchEnd);
    _base.removeEventListener("touchcancel",_onTouchEnd);
    _base.remove();
    _base = null;
    _knob = null;
  }
  if (_label) {
    _label.remove();
    _label = null;
  }
  _inputX        = 0;
  _inputY        = 0;
  _activeTouchId = null;
  _baseRect      = null;
}
