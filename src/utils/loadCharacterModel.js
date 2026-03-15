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

  // Determine rootUrl + filename.
  //
  // For ABSOLUTE CDN URLs (http/https): pass the full URL as `sceneFilename`
  // with an empty rootUrl.  This is the only reliable way to load cross-origin
  // GLBs in Babylon.js — splitting the URL and passing it as rootUrl+file can
  // silently fail in certain Babylon.js versions.
  //
  // For LOCAL relative paths: split normally into folder + filename.
  let rootUrl, filename;
  if (/^https?:\/\//i.test(modelPath)) {
    rootUrl  = "";
    filename = modelPath;          // full URL e.g. "https://cdn.jsdelivr.net/..."
  } else {
    const lastSlash = modelPath.lastIndexOf("/");
    rootUrl  = modelPath.substring(0, lastSlash + 1);   // "assets/characters/kenney/"
    filename = modelPath.substring(lastSlash + 1);      // "robot.glb"
  }

  try {
    const result = await BABYLON.SceneLoader.ImportMeshAsync("", rootUrl, filename, scene);

    if (!result || !result.meshes || result.meshes.length === 0) {
      console.error("[loadCharacterModel] No meshes returned for:", modelPath);
      return null;
    }

    return {
      root:            result.meshes[0],   // __root__ node from GLB
      meshes:          result.meshes,
      animationGroups: result.animationGroups ?? [],
    };
  } catch (err) {
    console.error("[loadCharacterModel] Failed to load:", modelPath, "\nReason:", err.message ?? err);
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
  const group = animGroups.find(g => g.name === name);
  if (!group) return null;
  group.start(loop);
  return group;
}

/**
 * Stop all animation groups.
 * @param {BABYLON.AnimationGroup[]} animGroups
 */
export function stopAllAnimations(animGroups) {
  (animGroups || []).forEach(g => g.stop());
}
