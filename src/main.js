/**
 * main.js
 * Entry point for Island Quest.
 *
 * Responsibilities:
 *  1. Initialize the Babylon.js engine on #renderCanvas
 *  2. Create a SceneManager that can switch between:
 *       - WorldScene      (overworld ocean + islands)
 *       - MathCastleScene (Math Island castle interior)
 *       - LangCastleScene (Language Island castle interior)
 *  3. Load save data from SaveManager on startup
 *  4. Run the Babylon render loop
 */

import { createWorldScene }        from "./scenes/WorldScene.js";
import { createMathCastleScene }   from "./scenes/MathCastleScene.js";
import { createLangCastleScene }   from "./scenes/LangCastleScene.js";
import { createLettersCastleScene } from "./scenes/LettersCastleScene.js";
import { SaveManager }             from "./utils/SaveManager.js";

// ── Engine setup ──────────────────────────────────────────────────────────────
const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });

// Ensure canvas fills the window on resize
engine.setHardwareScalingLevel(1 / window.devicePixelRatio);
window.addEventListener("resize", () => engine.resize());

// ── Scene manager ─────────────────────────────────────────────────────────────
/** @type {BABYLON.Scene|null} */
let activeScene = null;

/**
 * Dispose the current scene and activate a new one.
 * @param {BABYLON.Scene} newScene
 */
function switchScene(newScene) {
  if (activeScene) {
    // Stop render loop before disposing to avoid draw-on-disposed errors
    engine.stopRenderLoop();
    activeScene.dispose();
  }
  activeScene = newScene;
  engine.runRenderLoop(() => {
    if (activeScene) activeScene.render();
  });
}

// ── Scene factory functions ───────────────────────────────────────────────────

function goToWorld() {
  switchScene(
    createWorldScene(
      engine,
      () => goToMathCastle(),      // onEnterMath
      () => goToLangCastle(),      // onEnterLang
      () => goToLettersCastle()    // onEnterLetters
    )
  );
}

function goToMathCastle() {
  switchScene(
    createMathCastleScene(engine, () => goToWorld())
  );
}

function goToLangCastle() {
  switchScene(
    createLangCastleScene(engine, () => goToWorld())
  );
}

function goToLettersCastle() {
  switchScene(
    createLettersCastleScene(engine, () => goToWorld())
  );
}

// ── Respawn button ────────────────────────────────────────────────────────────
// Always visible in HUD; returns to world map at starting position
document.getElementById("btn-respawn").addEventListener("click", () => {
  // Clear any open puzzle overlay
  const overlay = document.getElementById("ui-overlay");
  if (overlay) { overlay.innerHTML = ""; overlay.classList.remove("active"); }
  goToWorld();
});

// ── Boot ─────────────────────────────────────────────────────────────────────

// Ensure save data exists
SaveManager.load();

// Show a brief loading screen, then start the world
const loadingScreen = _buildLoadingScreen();
document.body.appendChild(loadingScreen);

setTimeout(() => {
  loadingScreen.classList.add("hidden");
  setTimeout(() => loadingScreen.remove(), 700);
  goToWorld();
}, 1800);

// ── Helpers ───────────────────────────────────────────────────────────────────

function _buildLoadingScreen() {
  const div = document.createElement("div");
  div.id = "loading-screen";
  div.innerHTML = `
    <p class="logo">🏝️ Island Quest</p>
    <p class="subtitle">Loading your adventure… Use WASD or the on-screen arrows to move!</p>
  `;
  return div;
}
