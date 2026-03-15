/**
 * characters.js
 * Character registry for Island Quest.
 *
 * "builtin" characters = procedural mesh with preset colours (work immediately).
 * "quaternius" / "kenney" = GLB files — place in public/assets/characters/.
 *
 * HOW TO ADD MORE CHARACTERS
 * ──────────────────────────
 * 1. Add a new entry below.
 * 2. For builtin: fill the `preset` colour object.
 * 3. For GLB: drop the file into public/assets/characters/<source>/ and set model path.
 * 4. Reload. Avatar screen shows it automatically.
 */

export const CHARACTER_REGISTRY = [
  // ── Built-in procedural characters ──────────────────────────────────────
  {
    id:          "procedural",
    name:        "Classic Hero",
    source:      "builtin",
    model:       null,
    thumbnail:   "🧑",
    description: "The classic customizable hero",
    scale:       1.0,
    yOffset:     0.0,
    animations:  {},
    preset:      null,   // null = uses avatar colour picker
  },
  {
    id:          "wizard",
    name:        "Wizard",
    source:      "builtin",
    model:       null,
    thumbnail:   "🧙",
    description: "A wise magical wizard",
    scale:       1.0,
    yOffset:     0.0,
    animations:  {},
    preset: {
      skin:  [0.95, 0.76, 0.55],
      shirt: [0.38, 0.10, 0.62],  // deep purple robe
      pants: [0.28, 0.06, 0.48],
      hair:  [0.92, 0.92, 0.92],  // white hair
    },
  },
  {
    id:          "knight",
    name:        "Knight",
    source:      "builtin",
    model:       null,
    thumbnail:   "⚔️",
    description: "A valiant silver knight",
    scale:       1.0,
    yOffset:     0.0,
    animations:  {},
    preset: {
      skin:  [0.85, 0.72, 0.58],
      shirt: [0.72, 0.72, 0.78],  // silver armour
      pants: [0.55, 0.55, 0.60],
      hair:  [0.18, 0.14, 0.08],
    },
  },
  {
    id:          "alien",
    name:        "Alien Explorer",
    source:      "builtin",
    model:       null,
    thumbnail:   "👽",
    description: "A mysterious alien explorer",
    scale:       1.0,
    yOffset:     0.0,
    animations:  {},
    preset: {
      skin:  [0.20, 0.80, 0.38],  // green skin
      shirt: [0.10, 0.38, 0.72],  // blue suit
      pants: [0.08, 0.28, 0.55],
      hair:  [0.08, 0.48, 0.20],  // dark green
    },
  },
  {
    id:          "pirate",
    name:        "Pirate",
    source:      "builtin",
    model:       null,
    thumbnail:   "🏴‍☠️",
    description: "A daring sea pirate",
    scale:       1.0,
    yOffset:     0.0,
    animations:  {},
    preset: {
      skin:  [0.82, 0.60, 0.36],
      shirt: [0.85, 0.82, 0.78],  // striped white
      pants: [0.12, 0.10, 0.08],  // black
      hair:  [0.10, 0.07, 0.04],  // very dark brown
    },
  },
  {
    id:          "explorer",
    name:        "Explorer",
    source:      "builtin",
    model:       null,
    thumbnail:   "🧭",
    description: "A seasoned jungle explorer",
    scale:       1.0,
    yOffset:     0.0,
    animations:  {},
    preset: {
      skin:  [0.72, 0.50, 0.30],
      shirt: [0.62, 0.48, 0.22],  // tan jacket
      pants: [0.30, 0.22, 0.10],
      hair:  [0.45, 0.25, 0.08],
    },
  },

  // ── Quaternius – Ultimate Platformer Characters ──────────────────────────
  {
    id:          "qt_hero",
    name:        "Platformer Hero",
    source:      "quaternius",
    model:       "assets/characters/quaternius/hero.glb",
    thumbnail:   "🦸",
    description: "Brave platformer hero (Quaternius)",
    scale:       0.80,
    yOffset:     0.0,
    animations:  { idle: "Idle", walk: "Walk", run: "Run", jump: "Jump" },
    preset:      null,
  },
  {
    id:          "qt_female",
    name:        "Platformer Heroine",
    source:      "quaternius",
    model:       "assets/characters/quaternius/female.glb",
    thumbnail:   "🦸‍♀️",
    description: "Courageous heroine (Quaternius)",
    scale:       0.80,
    yOffset:     0.0,
    animations:  { idle: "Idle", walk: "Walk", run: "Run", jump: "Jump" },
    preset:      null,
  },
  {
    id:          "qt_adventurer",
    name:        "Adventurer",
    source:      "quaternius",
    model:       "assets/characters/quaternius/adventurer.glb",
    thumbnail:   "🔭",
    description: "An explorer ready for adventure (Quaternius)",
    scale:       0.80,
    yOffset:     0.0,
    animations:  { idle: "Idle", walk: "Walk", run: "Run", jump: "Jump" },
    preset:      null,
  },

  // ── Kenney – Animated Characters ─────────────────────────────────────────
  {
    id:          "kn_robot",
    name:        "Robot",
    source:      "kenney",
    model:       "assets/characters/kenney/robot.glb",
    thumbnail:   "🤖",
    description: "A friendly robot explorer (Kenney)",
    scale:       0.70,
    yOffset:     0.0,
    animations:  { idle: "Idle", walk: "Walk", run: "Run", jump: "Jump" },
    preset:      null,
  },
  {
    id:          "kn_knight",
    name:        "3D Knight",
    source:      "kenney",
    model:       "assets/characters/kenney/knight.glb",
    thumbnail:   "🛡️",
    description: "A valiant knight (Kenney)",
    scale:       0.70,
    yOffset:     0.0,
    animations:  { idle: "Idle", walk: "Walk", run: "Run", jump: "Jump" },
    preset:      null,
  },

  // ── CDN Characters (jsDelivr — guaranteed CORS, no download needed) ─────────
  // All URLs go through cdn.jsdelivr.net which always sends
  // Access-Control-Allow-Origin: * so cross-origin loading never fails.
  {
    id:          "cdn_soldier",
    name:        "Soldier",
    source:      "cdn",
    model:       "https://cdn.jsdelivr.net/gh/mrdoob/three.js/examples/models/gltf/Soldier.glb",
    thumbnail:   "💂",
    description: "An animated soldier (Three.js CC0)",
    scale:       1.0,
    yOffset:     0.0,
    animations:  { idle: "Idle", walk: "Walk", run: "Run", jump: "Walk" },
    preset:      null,
  },
  {
    id:          "cdn_cesiumman",
    name:        "Cesium Man",
    source:      "cdn",
    model:       "https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets/Models/CesiumMan/glTF-Binary/CesiumMan.glb",
    thumbnail:   "🚶",
    description: "An animated walking figure (Khronos CC-BY 4.0)",
    scale:       0.90,
    yOffset:     0.0,
    animations:  { idle: "CesiumMan", walk: "CesiumMan", run: "CesiumMan", jump: "CesiumMan" },
    preset:      null,
  },
  {
    id:          "cdn_fox",
    name:        "Fox",
    source:      "cdn",
    model:       "https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets/Models/Fox/glTF-Binary/Fox.glb",
    thumbnail:   "🦊",
    description: "An animated fox (Khronos CC-BY 4.0)",
    scale:       1.0,   // model geometry is already in metres; 0.018 made it invisible
    yOffset:     0.0,
    animations:  { idle: "Survey", walk: "Walk", run: "Run", jump: "Walk" },
    preset:      null,
  },
];

/** Default character used when nothing is saved */
export const DEFAULT_CHARACTER_ID = "cdn_soldier";

/**
 * Look up a character by id, falling back to the default if not found.
 * @param {string} id
 * @returns {object}
 */
export function getCharacter(id) {
  return CHARACTER_REGISTRY.find(c => c.id === id) ?? CHARACTER_REGISTRY[0];
}

/**
 * NPC character pool for WorldScene decorative NPCs.
 * Built-in variants so NPCs always appear without needing GLB files.
 */
export const NPC_PRESETS = [
  { skin:[0.82,0.60,0.36], shirt:[0.62,0.48,0.22], pants:[0.30,0.22,0.10], hair:[0.45,0.25,0.08] }, // explorer
  { skin:[0.20,0.80,0.38], shirt:[0.10,0.38,0.72], pants:[0.08,0.28,0.55], hair:[0.08,0.48,0.20] }, // alien
  { skin:[0.85,0.72,0.58], shirt:[0.72,0.72,0.78], pants:[0.55,0.55,0.60], hair:[0.18,0.14,0.08] }, // knight
  { skin:[0.95,0.76,0.55], shirt:[0.38,0.10,0.62], pants:[0.28,0.06,0.48], hair:[0.92,0.92,0.92] }, // wizard
];

// Kept for GLB NPC loading (used only if GLB files exist)
export const NPC_CHARACTERS = [
  { model: "assets/characters/kenney/robot.glb",  scale: 0.70 },
  { model: "assets/characters/kenney/knight.glb", scale: 0.70 },
];
