/**
 * VirtualJoystick.js
 * On-screen analog joystick (circle base + draggable knob) for
 * mobile/tablet and desktop players.
 *
 * Exports:
 *   createVirtualJoystick()   – mount joystick DOM elements into document.body
 *   destroyVirtualJoystick()  – release one usage; removes DOM when all callers have released
 *   getJoystickInput()        – returns { x, y } normalised to -1 … 1
 */

// ── Module-level state ────────────────────────────────────────────────────────
let _base      = null;   // #joystick-base element
let _knob      = null;   // #joystick-knob element
let _label     = null;   // "Move" label element
let _observer  = null;   // MutationObserver watching #ui-overlay

// Reference count – each scene calls create/destroy once
let _refCount  = 0;

// Current normalised direction (-1 … 1)
let _inputX = 0;
let _inputY = 0;

// Touch / mouse tracking
let _activeTouchId = null;  // identifier of the tracked touch
let _baseRect      = null;  // cached bounding rect of the base
let _isDragging    = false; // for mouse drag support

// ── Constants ─────────────────────────────────────────────────────────────────
const BASE_RADIUS = 55;   // half of 110 px diameter

// ── Helpers ───────────────────────────────────────────────────────────────────

function _clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function _updateKnob(clientX, clientY) {
  if (!_baseRect) return;
  const cx = _baseRect.left + _baseRect.width  / 2;
  const cy = _baseRect.top  + _baseRect.height / 2;
  let dx = clientX - cx;
  let dy = clientY - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > BASE_RADIUS) { dx = (dx / dist) * BASE_RADIUS; dy = (dy / dist) * BASE_RADIUS; }
  _inputX = _clamp(dx / BASE_RADIUS, -1, 1);
  _inputY = _clamp(dy / BASE_RADIUS, -1, 1);
  _knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}

function _resetKnob() {
  _inputX = 0; _inputY = 0;
  if (_knob) _knob.style.transform = "translate(-50%, -50%)";
}

// ── Touch handlers ────────────────────────────────────────────────────────────

function _onTouchStart(e) {
  if (_activeTouchId !== null) return;
  _baseRect = _base.getBoundingClientRect();
  const cx  = _baseRect.left + _baseRect.width  / 2;
  const cy  = _baseRect.top  + _baseRect.height / 2;
  for (const t of e.changedTouches) {
    if (Math.hypot(t.clientX - cx, t.clientY - cy) <= BASE_RADIUS) {
      _activeTouchId = t.identifier;
      _updateKnob(t.clientX, t.clientY);
      e.preventDefault();
      break;
    }
  }
}

function _onTouchMove(e) {
  if (_activeTouchId === null) return;
  for (const t of e.changedTouches) {
    if (t.identifier === _activeTouchId) {
      _updateKnob(t.clientX, t.clientY);
      e.preventDefault();
      break;
    }
  }
}

function _onTouchEnd(e) {
  if (_activeTouchId === null) return;
  for (const t of e.changedTouches) {
    if (t.identifier === _activeTouchId) {
      _activeTouchId = null;
      _resetKnob();
      break;
    }
  }
}

// ── Mouse handlers (desktop) ──────────────────────────────────────────────────

function _onMouseDown(e) {
  _baseRect   = _base.getBoundingClientRect();
  _isDragging = true;
  _updateKnob(e.clientX, e.clientY);
  e.preventDefault();
}

function _onMouseMove(e) {
  if (!_isDragging) return;
  _updateKnob(e.clientX, e.clientY);
}

function _onMouseUp() {
  if (!_isDragging) return;
  _isDragging = false;
  _resetKnob();
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
 * Create (or reuse) the joystick DOM elements.
 * Uses reference counting so multiple scenes can safely call this.
 */
export function createVirtualJoystick() {
  _refCount++;
  if (_base) return; // already mounted — just bumped refcount

  // Base circle
  _base       = document.createElement("div");
  _base.id    = "joystick-base";

  // Knob
  _knob             = document.createElement("div");
  _knob.id          = "joystick-knob";
  _knob.style.transform = "translate(-50%, -50%)";
  _base.appendChild(_knob);

  // Label above
  _label             = document.createElement("div");
  _label.id          = "joystick-label";
  _label.textContent = "Move";

  document.body.appendChild(_label);
  document.body.appendChild(_base);

  // Touch
  _base.addEventListener("touchstart",  _onTouchStart,  { passive: false });
  _base.addEventListener("touchmove",   _onTouchMove,   { passive: false });
  _base.addEventListener("touchend",    _onTouchEnd,    { passive: false });
  _base.addEventListener("touchcancel", _onTouchEnd,    { passive: false });

  // Mouse
  _base.addEventListener("mousedown",   _onMouseDown);
  window.addEventListener("mousemove",  _onMouseMove);
  window.addEventListener("mouseup",    _onMouseUp);

  // Hide when puzzle overlay is active
  const overlay = document.getElementById("ui-overlay");
  if (overlay) {
    _observer = new MutationObserver(function() {
      if (!_base) return;
      const hidden = overlay.classList.contains("active");
      _base.style.display  = hidden ? "none" : "";
      if (_label) _label.style.display = hidden ? "none" : "";
      if (hidden) { _activeTouchId = null; _isDragging = false; _resetKnob(); }
    });
    _observer.observe(overlay, { attributes: true, attributeFilter: ["class"] });
  }
}

/**
 * Release one usage of the joystick.
 * Only removes DOM elements when the last reference is released.
 */
export function destroyVirtualJoystick() {
  _refCount--;
  if (_refCount > 0) return; // other scenes still need it
  _refCount = 0; // safety clamp

  if (_base) {
    _base.removeEventListener("touchstart",  _onTouchStart);
    _base.removeEventListener("touchmove",   _onTouchMove);
    _base.removeEventListener("touchend",    _onTouchEnd);
    _base.removeEventListener("touchcancel", _onTouchEnd);
    _base.removeEventListener("mousedown",   _onMouseDown);
    _base.remove();
    _base = null;
    _knob = null;
  }
  if (_label) { _label.remove(); _label = null; }
  if (_observer) { _observer.disconnect(); _observer = null; }
  window.removeEventListener("mousemove", _onMouseMove);
  window.removeEventListener("mouseup",   _onMouseUp);
  _inputX = 0; _inputY = 0;
  _activeTouchId = null; _isDragging = false; _baseRect = null;
}
