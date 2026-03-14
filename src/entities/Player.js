/**
 * Player.js
 * Creates the player mesh, handles WASD / Arrow-key movement, and sets up
 * the third-person ArcRotateCamera that follows the player.
 *
 * Export:
 *   createPlayer(scene) → { mesh, update() }
 */

import { getJoystickInput } from "../ui/VirtualJoystick.js";

/**
 * @param {BABYLON.Scene} scene
 * @returns {{ mesh: BABYLON.Mesh, update: Function, camera: BABYLON.ArcRotateCamera }}
 */
export function createPlayer(scene) {
  const BABYLON = window.BABYLON;

  // ── Mesh ─────────────────────────────────────────────────────────────────
  // Body (box)
  const body = BABYLON.MeshBuilder.CreateBox("playerBody", { width: 0.6, height: 0.9, depth: 0.6 }, scene);
  const bodyMat = new BABYLON.StandardMaterial("playerBodyMat", scene);
  bodyMat.diffuseColor = new BABYLON.Color3(1, 0.6, 0.1); // warm orange
  body.material = bodyMat;

  // Head (sphere)
  const head = BABYLON.MeshBuilder.CreateSphere("playerHead", { diameter: 0.5 }, scene);
  head.position.y = 0.7;
  const headMat = new BABYLON.StandardMaterial("playerHeadMat", scene);
  headMat.diffuseColor = new BABYLON.Color3(1, 0.85, 0.65); // skin tone
  head.material = headMat;
  head.parent = body;

  // Root (invisible pivot for camera attachment)
  const root = BABYLON.MeshBuilder.CreateBox("playerRoot", { size: 0.01 }, scene);
  root.isVisible = false;
  root.position = new BABYLON.Vector3(0, 0.5, 0);
  body.parent = root;

  // ── Camera ───────────────────────────────────────────────────────────────
  const camera = new BABYLON.ArcRotateCamera(
    "playerCam",
    -Math.PI / 2,   // alpha  (behind)
    Math.PI / 3.5,  // beta   (slight downward angle)
    14,             // radius (distance)
    root.position,
    scene
  );
  // Don't attach control — we drive this camera ourselves
  camera.lowerRadiusLimit = 6;
  camera.upperRadiusLimit = 20;
  camera.lowerBetaLimit   = 0.3;
  camera.upperBetaLimit   = Math.PI / 2.2;

  // Allow mouse-wheel zoom & right-drag orbit
  camera.attachControl(scene.getEngine().getRenderingCanvas(), true);

  // ── Input tracking ───────────────────────────────────────────────────────
  const keys = {};
  const onKeyDown = (e) => { keys[e.code] = true; };
  const onKeyUp   = (e) => { keys[e.code] = false; };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup",   onKeyUp);

  // Clean up listeners when the scene is disposed to avoid memory leaks
  scene.onDisposeObservable.addOnce(() => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup",   onKeyUp);
  });

  const SPEED = 0.15;

  // ── Update (called every frame) ──────────────────────────────────────────
  function update() {
    // Camera is locked to look at player
    camera.target = root.position;

    // Compute move direction in camera-relative XZ space
    let dx = 0, dz = 0;

    if (keys["KeyW"] || keys["ArrowUp"])    dz =  1;
    if (keys["KeyS"] || keys["ArrowDown"])  dz = -1;
    if (keys["KeyA"] || keys["ArrowLeft"])  dx = -1;
    if (keys["KeyD"] || keys["ArrowRight"]) dx =  1;

    // Merge virtual joystick input (keyboard takes priority when active)
    const joystick = getJoystickInput();
    if (dx === 0) dx =  joystick.x;
    if (dz === 0) dz = -joystick.y; // joystick Y is inverted (up = forward)

    if (dx !== 0 || dz !== 0) {
      // Transform movement to world space based on camera yaw
      const camYaw = camera.alpha + Math.PI / 2;
      const worldDx = dx * Math.cos(camYaw) - dz * Math.sin(camYaw);
      const worldDz = dx * Math.sin(camYaw) + dz * Math.cos(camYaw);

      root.position.x += worldDx * SPEED;
      root.position.z += worldDz * SPEED;

      // Face direction of travel
      if (worldDx !== 0 || worldDz !== 0) {
        root.rotation.y = Math.atan2(worldDx, worldDz);
      }
    }
  }

  return { mesh: root, update, camera };
}
