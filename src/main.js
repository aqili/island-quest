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
import { createLettersCastleScene }  from "./scenes/LettersCastleScene.js";
import { createNumbersCastleScene }  from "./scenes/NumbersCastleScene.js";
import { SaveManager }              from "./utils/SaveManager.js";
import { initI18n, setLang, getLang, t } from "./utils/i18n.js";
import { SoundManager }             from "./utils/SoundManager.js";
import { CHARACTER_REGISTRY, DEFAULT_CHARACTER_ID } from "./data/characters.js";

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
  SoundManager.startAmbient();
  switchScene(
    createWorldScene(
      engine,
      () => goToMathCastle(),      // onEnterMath
      () => goToLangCastle(),      // onEnterLang
      () => goToLettersCastle(),   // onEnterLetters
      () => goToNumbersCastle()    // onEnterNumbers
    )
  );
}

function goToMathCastle() {
  SoundManager.stopAmbient();
  SoundManager.playEnterCastle();
  switchScene(
    createMathCastleScene(engine, () => goToWorld())
  );
}

function goToLangCastle() {
  SoundManager.stopAmbient();
  SoundManager.playEnterCastle();
  switchScene(
    createLangCastleScene(engine, () => goToWorld())
  );
}

function goToLettersCastle() {
  SoundManager.stopAmbient();
  SoundManager.playEnterCastle();
  switchScene(
    createLettersCastleScene(engine, () => goToWorld())
  );
}

function goToNumbersCastle() {
  SoundManager.stopAmbient();
  SoundManager.playEnterCastle();
  switchScene(
    createNumbersCastleScene(engine, () => goToWorld())
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

// ── Language toggle button ────────────────────────────────────────────────────

const btnLang = document.getElementById("btn-lang");
if (btnLang) {
  btnLang.addEventListener("click", () => {
    const next = getLang() === "en" ? "ar" : "en";
    setLang(next);
    btnLang.textContent = next === "ar" ? "English" : "عربي";
  });
}

// ── Boot ─────────────────────────────────────────────────────────────────────

// Ensure save data exists
SaveManager.load();

// Initialise i18n (reads saved language from localStorage)
initI18n();

// Show loading → avatar selector → start world
const loadingScreen = _buildLoadingScreen();
document.body.appendChild(loadingScreen);

setTimeout(() => {
  loadingScreen.classList.add("hidden");
  setTimeout(() => {
    loadingScreen.remove();
    // Show avatar selector — resolves when player clicks Play
    const avatarUI = _buildAvatarSelector();
    document.body.appendChild(avatarUI);
  }, 700);
}, 1800);

// ── Helpers ───────────────────────────────────────────────────────────────────

function _buildLoadingScreen() {
  const div = document.createElement("div");
  div.id = "loading-screen";
  div.innerHTML = `
    <p class="logo">🏝️ Island Quest</p>
    <p class="subtitle">Loading your adventure… please wait!</p>
  `;
  return div;
}

// ── Avatar Selector ───────────────────────────────────────────────────────────

const AVATAR_PALETTES = {
  skin: [
    { label: "Light",     rgb: [1.0,  0.88, 0.76] },
    { label: "Fair",      rgb: [0.95, 0.76, 0.55] },
    { label: "Tan",       rgb: [0.82, 0.60, 0.36] },
    { label: "Brown",     rgb: [0.60, 0.38, 0.18] },
    { label: "Deep",      rgb: [0.36, 0.22, 0.10] },
  ],
  shirt: [
    { label: "Blue",      rgb: [0.18, 0.52, 0.92] },
    { label: "Red",       rgb: [0.88, 0.20, 0.20] },
    { label: "Green",     rgb: [0.18, 0.72, 0.30] },
    { label: "Purple",    rgb: [0.55, 0.20, 0.80] },
    { label: "Orange",    rgb: [0.95, 0.52, 0.10] },
    { label: "White",     rgb: [0.95, 0.95, 0.95] },
  ],
  pants: [
    { label: "Navy",      rgb: [0.18, 0.18, 0.55] },
    { label: "Black",     rgb: [0.12, 0.12, 0.14] },
    { label: "Brown",     rgb: [0.45, 0.28, 0.12] },
    { label: "Grey",      rgb: [0.50, 0.52, 0.55] },
  ],
  hair: [
    { label: "Brown",     rgb: [0.28, 0.16, 0.05] },
    { label: "Black",     rgb: [0.10, 0.08, 0.06] },
    { label: "Blonde",    rgb: [0.90, 0.76, 0.30] },
    { label: "Red",       rgb: [0.72, 0.24, 0.08] },
    { label: "White",     rgb: [0.92, 0.92, 0.92] },
  ],
};

function _buildAvatarSelector() {
  const overlay = document.createElement("div");
  overlay.id = "avatar-screen";

  // Selected values (default: first of each palette)
  const sel = {
    skin:  AVATAR_PALETTES.skin[1].rgb,
    shirt: AVATAR_PALETTES.shirt[0].rgb,
    pants: AVATAR_PALETTES.pants[0].rgb,
    hair:  AVATAR_PALETTES.hair[0].rgb,
  };

  // Try to restore saved choice
  try {
    const saved = JSON.parse(localStorage.getItem("iq_avatar") || "{}");
    if (saved.skin)  sel.skin  = saved.skin;
    if (saved.shirt) sel.shirt = saved.shirt;
    if (saved.pants) sel.pants = saved.pants;
    if (saved.hair)  sel.hair  = saved.hair;
  } catch(e) {}

  function _hex(rgb) {
    return "#" + rgb.map(v => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
  }

  function _buildSection(key, labelKey, palette) {
    const section = document.createElement("div");
    section.className = "avatar-section";

    const lbl = document.createElement("div");
    lbl.className = "avatar-label";
    lbl.textContent = t("avatar." + labelKey);
    section.appendChild(lbl);

    const swatches = document.createElement("div");
    swatches.className = "avatar-swatches";

    palette.forEach(opt => {
      const sw = document.createElement("button");
      sw.className = "swatch";
      sw.style.background = _hex(opt.rgb);
      sw.title = opt.label;
      sw.setAttribute("aria-label", opt.label);

      // Show selection ring if matches current
      if (JSON.stringify(sel[key]) === JSON.stringify(opt.rgb)) {
        sw.classList.add("selected");
      }

      sw.addEventListener("click", () => {
        sel[key] = opt.rgb;
        // Update preview character
        _updatePreview();
        // Update ring
        swatches.querySelectorAll(".swatch").forEach(s => s.classList.remove("selected"));
        sw.classList.add("selected");
      });

      swatches.appendChild(sw);
    });

    section.appendChild(swatches);
    return section;
  }

  // ── Character preview (CSS art) ──────────────────────────────────────────
  const preview = document.createElement("div");
  preview.className = "avatar-preview";
  preview.innerHTML = `
    <div class="av-hair"></div>
    <div class="av-head"></div>
    <div class="av-torso"></div>
    <div class="av-arm av-larm"></div>
    <div class="av-arm av-rarm"></div>
    <div class="av-leg av-lleg"></div>
    <div class="av-leg av-rleg"></div>
  `;

  function _updatePreview() {
    const hair  = preview.querySelector(".av-hair");
    const head  = preview.querySelector(".av-head");
    const torso = preview.querySelector(".av-torso");
    const arms  = preview.querySelectorAll(".av-arm");
    const legs  = preview.querySelectorAll(".av-leg");
    if (hair)  hair.style.background  = _hex(sel.hair);
    if (head)  head.style.background  = _hex(sel.skin);
    arms.forEach(a => a.style.background = _hex(sel.shirt));
    if (torso) torso.style.background = _hex(sel.shirt);
    legs.forEach(l => l.style.background = _hex(sel.pants));
  }
  _updatePreview();

  // ── Layout ───────────────────────────────────────────────────────────────
  const card = document.createElement("div");
  card.className = "avatar-card";

  const title = document.createElement("h2");
  title.className = "avatar-title";
  title.textContent = t("avatar.title");
  card.appendChild(title);

  const body = document.createElement("div");
  body.className = "avatar-body";

  const options = document.createElement("div");
  options.className = "avatar-options";
  options.appendChild(_buildSection("skin",  "skin",  AVATAR_PALETTES.skin));
  options.appendChild(_buildSection("shirt", "shirt", AVATAR_PALETTES.shirt));
  options.appendChild(_buildSection("pants", "pants", AVATAR_PALETTES.pants));
  options.appendChild(_buildSection("hair",  "hair",  AVATAR_PALETTES.hair));

  body.appendChild(preview);
  body.appendChild(options);
  card.appendChild(body);

  // ── Character Selection ──────────────────────────────────────────────────
  let _selectedCharId;
  try { _selectedCharId = localStorage.getItem("iq_character") || DEFAULT_CHARACTER_ID; } catch(e) { _selectedCharId = DEFAULT_CHARACTER_ID; }

  const charSectionLabel = document.createElement("div");
  charSectionLabel.className = "avatar-label";
  charSectionLabel.textContent = "Choose Character";
  charSectionLabel.style.cssText = "margin-top:14px;";
  options.appendChild(charSectionLabel);

  const charGrid = document.createElement("div");
  charGrid.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;";
  options.appendChild(charGrid);

  function _buildCharCards() {
    charGrid.innerHTML = "";
    CHARACTER_REGISTRY.forEach(ch => {
      const btn = document.createElement("button");
      btn.style.cssText = [
        "display:flex;flex-direction:column;align-items:center;justify-content:center;",
        "width:72px;min-height:72px;border-radius:12px;cursor:pointer;",
        "font-family:inherit;font-size:0.75rem;padding:6px 4px;gap:3px;",
        "border:3px solid transparent;transition:border-color 0.15s,transform 0.15s;",
        "background:rgba(255,255,255,0.12);color:#fff;",
        ch.id === _selectedCharId ? "border-color:#ffe066;transform:scale(1.1);background:rgba(255,224,102,0.18);" : "",
      ].join("");
      btn.title = ch.description;

      const icon = document.createElement("span");
      icon.style.cssText = "font-size:1.6rem;line-height:1;";
      icon.textContent   = ch.thumbnail || "🧑";

      const lbl = document.createElement("span");
      lbl.style.cssText  = "font-size:0.68rem;text-align:center;line-height:1.2;";
      lbl.textContent    = ch.name;

      const src = document.createElement("span");
      src.style.cssText  = "font-size:0.58rem;opacity:0.65;";
      src.textContent    = ch.source === "builtin" ? "built-in" : ch.source;

      btn.appendChild(icon);
      btn.appendChild(lbl);
      btn.appendChild(src);

      btn.addEventListener("click", () => {
        _selectedCharId = ch.id;
        _buildCharCards();   // re-render to update highlight
        // Also update CSS preview if the procedural char is chosen
        if (ch.id === "procedural") _updatePreview();
      });

      charGrid.appendChild(btn);
    });
  }
  _buildCharCards();

  // Sound toggle
  const soundRow = document.createElement("div");
  soundRow.className = "avatar-sound-row";
  const soundBtn = document.createElement("button");
  soundBtn.className = "btn-sound";
  let soundOn = true;
  soundBtn.textContent = "🔊 Sound On";
  soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    SoundManager.setEnabled(soundOn);
    soundBtn.textContent = soundOn ? "🔊 Sound On" : "🔇 Sound Off";
  });
  soundRow.appendChild(soundBtn);
  card.appendChild(soundRow);

  const playBtn = document.createElement("button");
  playBtn.className = "btn-play";
  playBtn.textContent = t("avatar.play");
  playBtn.addEventListener("click", () => {
    // Save avatar colours
    try { localStorage.setItem("iq_avatar",     JSON.stringify(sel));             } catch(e) {}
    // Save selected character
    try { localStorage.setItem("iq_character",  _selectedCharId);                } catch(e) {}
    // Start ambient sound
    SoundManager.startAmbient();
    overlay.classList.add("hidden");
    setTimeout(() => {
      overlay.remove();
      goToWorld();
    }, 500);
  });
  card.appendChild(playBtn);

  overlay.appendChild(card);
  return overlay;
}
