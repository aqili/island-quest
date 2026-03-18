/**
 * loadCharacterModel.js
 * Reusable helper to load a GLB character from the assets folder.
 *
 * Usage:
 *   const result = await loadCharacterModel(scene, "assets/characters/kenney/robot.glb");
 *   if (result) {
 *     const { root, meshes, animationGroups } = result;
 *     // root is the top-level TransformNode/Mesh
 *   }
 *
 * Returns null on failure so callers can cleanly fall back to the
 * procedural character.
 */

/**
 * @param {BABYLON.Scene} scene
 * @param {string}        modelPath  relative path from the public/ root, e.g. "assets/characters/kenney/robot.glb"
 * @returns {Promise<{root: BABYLON.AbstractMesh, meshes: BABYLON.AbstractMesh[], animationGroups: BABYLON.AnimationGroup[]}|null>}
 */
export async function loadCharacterModel(scene, modelPath) {
  const BABYLON = window.BABYLON;
  if (!modelPath) return null;

  // Split into folder and filename for SceneLoader.
  // Works for both local paths ("assets/characters/kenney/robot.glb")
  // and full CDN URLs ("https://threejs.org/examples/models/gltf/Soldier.glb").
  const lastSlash = modelPath.lastIndexOf("/");
  const folder    = modelPath.substring(0, lastSlash + 1);
  const file      = modelPath.substring(lastSlash + 1);

  try {
    const result = await BABYLON.SceneLoader.ImportMeshAsync("", folder, file, scene);

    if (!result || !result.meshes || result.meshes.length === 0) {
      console.warn("[loadCharacterModel] No meshes returned for:", modelPath);
      return null;
    }

    return {
      root:            result.meshes[0],   // __root__ node from GLB
      meshes:          result.meshes,
      animationGroups: result.animationGroups ?? [],
    };
  } catch (err) {
    // Model file missing — graceful fallback to procedural character
    console.warn("[loadCharacterModel] Could not load model (file may not exist yet):", modelPath, err.message ?? err);
    return null;
  }
}

/**
 * Given a set of animation groups and a name map, find and start an animation.
 * @param {BABYLON.AnimationGroup[]} animGroups
 * @param {string} name  - the exact animation name to find
 * @param {boolean} loop
 * @returns {BABYLON.AnimationGroup|null}
 */
export function playAnimation(animGroups, name, loop = true) {
  if (!animGroups || !name) return null;
  const lname = name.toLowerCase();
  // Play ALL groups whose name matches: exact OR ends with "|<name>" (handles
  // both short "run" and Blender-exported "Root.001|Root|Run" duplicates)
  const matches = animGroups.filter(g =>
    g.name === name ||
    g.name.toLowerCase().endsWith('|' + lname)
  );
  if (matches.length === 0) return null;
  matches.forEach(g => g.start(loop));
  return matches[0];
}

/**
 * Stop all animation groups.
 * @param {BABYLON.AnimationGroup[]} animGroups
 */
export function stopAllAnimations(animGroups) {
  (animGroups || []).forEach(g => g.stop());
}
