/**
 * characters.js
 * Character registry for Island Quest.
 *
 * Each entry describes a playable character (or NPC variant).
 * GLB files go in:
 *   public/assets/characters/quaternius/   ← Quaternius platformer models
 *   public/assets/characters/kenney/       ← Kenney animated character models
 *
 * HOW TO ADD MORE CHARACTERS
 * ──────────────────────────
 * 1. Drop the .glb file into the appropriate folder above.
 * 2. Add a new entry to CHARACTER_REGISTRY below.
 * 3. Reload – the avatar screen will show it automatically.
 */

export const CHARACTER_REGISTRY = [
  // ── Built-in procedural character (always available, supports color customization) ──
  {
    id:          "procedural",
    name:        "Classic Hero",
    source:      "builtin",
    model:       null,                     // null = use procedural code in Player.js
    thumbnail:   "🧑",
    description: "The classic customizable hero",
    scale:       1.0,
    yOffset:     0.0,
    animations:  { idle: null, walk: null, run: null, jump: null },
  },

  // ── Quaternius – Ultimate Platformer Characters ──────────────────────────────────
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
  },
  {
    id:          "qt_adventurer",
    name:        "Adventurer",
    source:      "quaternius",
    model:       "assets/characters/quaternius/adventurer.glb",
    thumbnail:   "🧭",
    description: "An explorer ready for adventure (Quaternius)",
    scale:       0.80,
    yOffset:     0.0,
    animations:  { idle: "Idle", walk: "Walk", run: "Run", jump: "Jump" },
  },

  // ── Kenney – Animated Characters ─────────────────────────────────────────────────
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
  },
  {
    id:          "kn_alien",
    name:        "Alien",
    source:      "kenney",
    model:       "assets/characters/kenney/alien.glb",
    thumbnail:   "👽",
    description: "An alien adventurer (Kenney)",
    scale:       0.70,
    yOffset:     0.0,
    animations:  { idle: "Idle", walk: "Walk", run: "Run", jump: "Jump" },
  },
  {
    id:          "kn_knight",
    name:        "Knight",
    source:      "kenney",
    model:       "assets/characters/kenney/knight.glb",
    thumbnail:   "⚔️",
    description: "A valiant knight (Kenney)",
    scale:       0.70,
    yOffset:     0.0,
    animations:  { idle: "Idle", walk: "Walk", run: "Run", jump: "Jump" },
  },
];

/** Default character used when nothing is saved */
export const DEFAULT_CHARACTER_ID = "procedural";

/**
 * Look up a character by id, falling back to the default if not found.
 * @param {string} id
 * @returns {object}
 */
export function getCharacter(id) {
  return CHARACTER_REGISTRY.find(c => c.id === id) ?? CHARACTER_REGISTRY[0];
}

/**
 * Return a list of character entries suitable for NPC spawning.
 * These are Kenney characters (decorative, no interactivity needed).
 */
export const NPC_CHARACTERS = [
  { model: "assets/characters/kenney/robot.glb",  scale: 0.70 },
  { model: "assets/characters/kenney/alien.glb",  scale: 0.70 },
  { model: "assets/characters/kenney/knight.glb", scale: 0.70 },
];
