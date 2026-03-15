/**
 * Player.js
 * Creates the player avatar, handles WASD / Arrow-key movement, and sets up
 * the third-person ArcRotateCamera that follows the player.
 *
 * Export:
 *   createPlayer(scene) → { mesh, update() }
 */

import { createVirtualJoystick, destroyVirtualJoystick, getJoystickInput }
  from "../ui/VirtualJoystick.js";

/**
 * @param {BABYLON.Scene} scene
 * @returns {{ mesh: BABYLON.Mesh, update: Function, camera: BABYLON.ArcRotateCamera }}
 */
export function createPlayer(scene) {
  const BABYLON = window.BABYLON;

  // ── Root pivot (invisible) ────────────────────────────────────────────────
  const root = BABYLON.MeshBuilder.CreateBox("playerRoot", { size: 0.01 }, scene);
  root.isVisible = false;
  root.position = new BABYLON.Vector3(0, 0.5, 0);

  function _mat(name, hexOrColor3) {
    const m = new BABYLON.StandardMaterial(name, scene);
    if (typeof hexOrColor3 === "string") {
      const r = parseInt(hexOrColor3.slice(1, 3), 16) / 255;
      const g = parseInt(hexOrColor3.slice(3, 5), 16) / 255;
      const b = parseInt(hexOrColor3.slice(5, 7), 16) / 255;
      m.diffuseColor = new BABYLON.Color3(r, g, b);
    } else {
      m.diffuseColor = hexOrColor3;
    }
    return m;
  }

  // ── Body (cylinder, warm orange) ─────────────────────────────────────────
  const body = BABYLON.MeshBuilder.CreateCylinder("playerBody",
    { diameter: 1.0, height: 1.4, tessellation: 12 }, scene);
  body.position.y = 0.7;
  body.material = _mat("bodyMat", "#FF8C00");
  body.parent = root;

  // ── Head (sphere, skin tone) ──────────────────────────────────────────────
  const head = BABYLON.MeshBuilder.CreateSphere("playerHead",
    { diameter: 0.9, segments: 8 }, scene);
  head.position.y = 1.85;
  head.material = _mat("headMat", "#FFDAB9");
  head.parent = root;

  // ── Eyes (2 small dark spheres) ───────────────────────────────────────────
  const eyeMat = _mat("eyeMat", "#1a1a1a");
  [-0.17, 0.17].forEach((ex, i) => {
    const eye = BABYLON.MeshBuilder.CreateSphere("eye" + i,
      { diameter: 0.15, segments: 4 }, scene);
    eye.position = new BABYLON.Vector3(ex, 1.9, 0.4);
    eye.material = eyeMat;
    eye.parent = root;
  });

  // ── Smile (torus arc) ─────────────────────────────────────────────────────
  const smile = BABYLON.MeshBuilder.CreateTorus("smile",
    { diameter: 0.3, thickness: 0.06, tessellation: 16 }, scene);
  smile.position = new BABYLON.Vector3(0, 1.72, 0.41);
  smile.rotation.x = Math.PI / 2.8;
  smile.rotation.z = Math.PI;
  smile.material = _mat("smileMat", "#c0392b");
  smile.parent = root;

  // ── Hair (flattened sphere, brown) ────────────────────────────────────────
  const hair = BABYLON.MeshBuilder.CreateSphere("hair",
    { diameter: 0.95, segments: 6 }, scene);
  hair.scaling.y = 0.45;
  hair.position.y = 2.25;
  hair.material = _mat("hairMat", "#8B4513");
  hair.parent = root;

  // ── Arms (thin cylinders, orange) ────────────────────────────────────────
  const armMat = _mat("armMat", "#FF8C00");
  [[-0.65, 0], [0.65, 0]].forEach(([ax], i) => {
    const arm = BABYLON.MeshBuilder.CreateCylinder("arm" + i,
      { diameter: 0.28, height: 0.9, tessellation: 8 }, scene);
    arm.position = new BABYLON.Vector3(ax, 1.05, 0);
    arm.rotation.z = (i === 0 ? 1 : -1) * 0.45;
    arm.material = armMat;
    arm.parent = root;
  });

  // ── Legs (thin cylinders, dark blue) ─────────────────────────────────────
  const legMat = _mat("legMat", "#00008B");
  [[-0.25, 0], [0.25, 0]].forEach(([lx], i) => {
    const leg = BABYLON.MeshBuilder.CreateCylinder("leg" + i,
      { diameter: 0.3, height: 0.9, tessellation: 8 }, scene);
    leg.position = new BABYLON.Vector3(lx, 0.0, 0);
    leg.material = legMat;
    leg.parent = root;
  });

  // ── Shoes (small dark-gray boxes) ────────────────────────────────────────
  const shoeMat = _mat("shoeMat", "#333333");
  [[-0.25, 0], [0.25, 0]].forEach(([sx], i) => {
    const shoe = BABYLON.MeshBuilder.CreateBox("shoe" + i,
      { width: 0.38, height: 0.18, depth: 0.52 }, scene);
    shoe.position = new BABYLON.Vector3(sx, -0.44, 0.07);
    shoe.material = shoeMat;
    shoe.parent = root;
  });

  // ── Camera ───────────────────────────────────────────────────────────────
  const camera = new BABYLON.ArcRotateCamera(
    "playerCam",
    -Math.PI / 2,
    Math.PI / 3.2,
    14,
    root.position,
    scene
  );
  camera.lowerRadiusLimit = 6;
  camera.upperRadiusLimit = 20;
  camera.lowerBetaLimit   = 0.15;   // can look more overhead
  camera.upperBetaLimit   = Math.PI / 2.1;
  camera.attachControl(scene.getEngine().getRenderingCanvas(), true);

  // ── Keyboard input ───────────────────────────────────────────────────────
  const keys = {};
  const onKeyDown = e => {
    keys[e.code] = true;
    if (e.code.startsWith("Arrow")) e.preventDefault();
  };
  const onKeyUp = e => { keys[e.code] = false; };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup",   onKeyUp);

  // Mount the on-screen joystick
  createVirtualJoystick();

  scene.onDisposeObservable.addOnce(() => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup",   onKeyUp);
    destroyVirtualJoystick();
  });

  const SPEED   = 0.25;
  const CAM_ROT = 0.035;

  // ── Update ───────────────────────────────────────────────────────────────
  function update() {
    // Lock player on ground — never drift on Y
    root.position.y = 0.5;

    // Directly mutate camera.target's internal Vector3 so it follows the player
    // at chest height. (ArcRotateCamera.setTarget clones, so a separate variable
    // would be disconnected — we must mutate the _target the getter returns.)
    camera.target.x = root.position.x;
    camera.target.y = root.position.y + 0.9;
    camera.target.z = root.position.z;

    // Arrow keys orbit/tilt the camera (L/R flipped for natural feel)
    if (keys["ArrowLeft"])  camera.alpha += CAM_ROT;
    if (keys["ArrowRight"]) camera.alpha -= CAM_ROT;
    if (keys["ArrowUp"])    camera.beta = Math.max(camera.lowerBetaLimit, camera.beta - 0.025);
    if (keys["ArrowDown"])  camera.beta = Math.min(camera.upperBetaLimit, camera.beta + 0.025);

    // Player movement — WASD + on-screen joystick only
    let dx = 0, dz = 0;
    if (keys["KeyW"]) dz =  1;
    if (keys["KeyS"]) dz = -1;
    if (keys["KeyA"]) dx = -1;
    if (keys["KeyD"]) dx =  1;

    const joy = getJoystickInput();
    if (dx === 0) dx =  joy.x;
    if (dz === 0) dz = -joy.y;  // joystick Y is inverted: up → forward

    if (dx !== 0 || dz !== 0) {
      // Transform movement to world space based on camera yaw
      const camYaw = camera.alpha + Math.PI / 2;
      const worldDx = dx * Math.cos(camYaw) - dz * Math.sin(camYaw);
      const worldDz = dx * Math.sin(camYaw) + dz * Math.cos(camYaw);

      root.position.x += worldDx * SPEED;
      root.position.z += worldDz * SPEED;

      if (worldDx !== 0 || worldDz !== 0) {
        root.rotation.y = Math.atan2(worldDx, worldDz);
      }

      // Walk bob animation
      body.position.y = 0.7 + Math.sin(Date.now() * 0.012) * 0.08;
    }
  }

  return { mesh: root, update, camera };
}
