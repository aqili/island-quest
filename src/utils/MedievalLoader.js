/**
 * MedievalLoader.js
 * Helpers for using the Medieval Village MegaKit assets.
 *
 * Two main tools:
 *   medMaterial(scene, type, name, uScale, vScale)
 *       → creates a StandardMaterial with the pack's PBR textures applied.
 *         Types: "Brick", "UnevenBrick", "RedBrick", "Plaster",
 *                "RoundTiles", "WoodTrim", "RockTrim"
 *
 *   placeMedieval(scene, name, x, y, z, ry, scale)
 *       → async: loads the named gltf from /assets/medieval/ and places it.
 *         Fire-and-forget safe — failures are logged, never thrown.
 *
 *   placeMany(scene, items)
 *       → async: load several models in one call.
 *         items = [{ name, x, y, z, ry, scale }, ...]
 */

const BABYLON = window.BABYLON;
const BASE    = "/public/assets/medieval/";

// ── Types that have a Normal map in the pack ─────────────────────────────────
const HAS_NORMAL = new Set(["Brick", "UnevenBrick", "Plaster", "RoundTiles", "WoodTrim", "RockTrim"]);

/**
 * Create a StandardMaterial textured with the medieval pack's PNG files.
 * @param {BABYLON.Scene} scene
 * @param {string} type  e.g. "UnevenBrick"
 * @param {string} name  material name (unique per scene)
 * @param {number} uScale horizontal repeat (default 3)
 * @param {number} vScale vertical repeat   (default 3)
 */
export function medMaterial(scene, type, name, uScale = 3, vScale = 3) {
  const mat = new BABYLON.StandardMaterial(name, scene);

  const diff = new BABYLON.Texture(`${BASE}T_${type}_BaseColor.png`, scene);
  diff.uScale = uScale;
  diff.vScale = vScale;
  mat.diffuseTexture = diff;

  if (HAS_NORMAL.has(type)) {
    try {
      const norm = new BABYLON.Texture(`${BASE}T_${type}_Normal.png`, scene);
      norm.uScale = uScale;
      norm.vScale = vScale;
      mat.bumpTexture  = norm;
      mat.bumpTexture.level = 0.65;
    } catch (_) { /* normal map optional */ }
  }

  mat.specularColor = new BABYLON.Color3(0.06, 0.06, 0.06);
  mat.specularPower = 40;
  return mat;
}

/**
 * Async: load a medieval gltf model and place it in the scene.
 * @param {BABYLON.Scene} scene
 * @param {string} name   filename without extension, e.g. "Prop_Crate"
 * @param {number} x y z  world position
 * @param {number} ry     Y-axis rotation in radians (default 0)
 * @param {number} scale  uniform scale (default 1)
 * @returns {Promise<BABYLON.TransformNode|null>}
 */
export async function placeMedieval(scene, name, x, y, z, ry = 0, scale = 1) {
  try {
    const result = await BABYLON.SceneLoader.ImportMeshAsync("", BASE, name + ".gltf", scene);
    const root   = result.meshes[0];   // the __root__ TransformNode
    root.position.set(x, y, z);
    root.rotation.y = ry;
    root.scaling.setAll(scale);
    return root;
  } catch (e) {
    console.warn("[MedievalLoader] Could not load:", name, "-", e.message);
    return null;
  }
}

/**
 * Async: place several models at once.
 * @param {BABYLON.Scene} scene
 * @param {Array<{name:string, x:number, y:number, z:number, ry?:number, scale?:number}>} items
 * @returns {Promise<Array>}
 */
export async function placeMany(scene, items) {
  return Promise.all(
    items.map(({ name, x, y, z, ry = 0, scale = 1 }) =>
      placeMedieval(scene, name, x, y, z, ry, scale)
    )
  );
}
