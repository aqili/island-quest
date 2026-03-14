/**
 * VirtualJoystick.js
 * On-screen D-pad joystick for mobile/tablet/desktop players.
 *
 * Exports:
 *   createVirtualJoystick()   – mount D-pad DOM elements into document.body
 *   destroyVirtualJoystick()  – remove D-pad DOM elements
 *   getJoystickInput()        – returns { x, y } each -1, 0, or 1
 */

// ── Module-level state ────────────────────────────────────────────────────────
let _wrapper   = null;   // #virtual-joystick wrapper element
let _observer  = null;   // MutationObserver watching #ui-overlay

// Current discrete direction (each -1, 0, or 1)
let _inputX = 0;
let _inputY = 0;

// Track which directions are currently pressed
const _pressed = { up: false, down: false, left: false, right: false };

// ── Internal helpers ──────────────────────────────────────────────────────────

function _update() {
  _inputX = (_pressed.right ? 1 : 0) - (_pressed.left ? 1 : 0);
  _inputY = (_pressed.down  ? 1 : 0) - (_pressed.up   ? 1 : 0);
}

function _press(dir) {
  _pressed[dir] = true;
  _update();
  const btn = _wrapper && _wrapper.querySelector('[data-dir="' + dir + '"]');
  if (btn) btn.classList.add("pressed");
}

function _release(dir) {
  _pressed[dir] = false;
  _update();
  const btn = _wrapper && _wrapper.querySelector('[data-dir="' + dir + '"]');
  if (btn) btn.classList.remove("pressed");
}

function _releaseAll() {
  ["up", "down", "left", "right"].forEach(function(d) {
    _pressed[d] = false;
    const btn = _wrapper && _wrapper.querySelector('[data-dir="' + d + '"]');
    if (btn) btn.classList.remove("pressed");
  });
  _update();
}

function _makeButton(dir, arrow) {
  const btn = document.createElement("div");
  btn.className = "joy-btn";
  btn.setAttribute("data-dir", dir);
  btn.textContent = arrow;

  // Touch events
  btn.addEventListener("touchstart", function(e) {
    e.preventDefault();
    _press(dir);
  }, { passive: false });
  btn.addEventListener("touchend", function(e) {
    e.preventDefault();
    _release(dir);
  }, { passive: false });
  btn.addEventListener("touchcancel", function(e) {
    e.preventDefault();
    _release(dir);
  }, { passive: false });

  // Mouse events (for desktop testing)
  btn.addEventListener("mousedown", function(e) {
    e.preventDefault();
    _press(dir);
  });
  btn.addEventListener("mouseup", function(e) {
    e.preventDefault();
    _release(dir);
  });
  btn.addEventListener("mouseleave", function() {
    _release(dir);
  });

  return btn;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the current joystick direction.
 * @returns {{ x: number, y: number }}  each -1, 0, or 1
 */
export function getJoystickInput() {
  return { x: _inputX, y: _inputY };
}

/**
 * Create and mount the D-pad joystick into document.body.
 * Safe to call multiple times — won't add duplicates.
 */
export function createVirtualJoystick() {
  if (_wrapper) return; // already mounted

  _wrapper    = document.createElement("div");
  _wrapper.id = "virtual-joystick";

  _wrapper.appendChild(_makeButton("up",    "▲"));
  _wrapper.appendChild(_makeButton("left",  "◄"));
  _wrapper.appendChild(_makeButton("right", "►"));
  _wrapper.appendChild(_makeButton("down",  "▼"));

  document.body.appendChild(_wrapper);

  // Release all directions if mouse button lifted anywhere on the page
  window.addEventListener("mouseup", _releaseAll);

  // Watch #ui-overlay for class changes so we can hide the joystick while
  // a puzzle overlay is active.
  const overlay = document.getElementById("ui-overlay");
  if (overlay) {
    _observer = new MutationObserver(function() {
      if (!_wrapper) return;
      if (overlay.classList.contains("active")) {
        _wrapper.classList.add("joystick-hidden");
        _releaseAll();
      } else {
        _wrapper.classList.remove("joystick-hidden");
      }
    });
    _observer.observe(overlay, { attributes: true, attributeFilter: ["class"] });
  }
}

/**
 * Remove the D-pad from the DOM and reset all state.
 * Call this from scene.onDisposeObservable.
 */
export function destroyVirtualJoystick() {
  if (_wrapper) {
    _wrapper.remove();
    _wrapper = null;
  }
  if (_observer) {
    _observer.disconnect();
    _observer = null;
  }
  window.removeEventListener("mouseup", _releaseAll);
  _releaseAll();
}
