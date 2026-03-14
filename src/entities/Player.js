/**
 * Player.js
 * Articulated character with walk-cycle animation.
 * Body parts: torso, head, left/right arms, left/right legs.
 * Arms and legs swing opposite each other while moving.
 */

export function createPlayer(scene) {
  const BABYLON = window.BABYLON;

  // ── Materials ────────────────────────────────────────────────────────────
  const skinMat = new BABYLON.StandardMaterial("skinMat", scene);
  skinMat.diffuseColor = new BABYLON.Color3(1.0, 0.82, 0.60);

  const shirtMat = new BABYLON.StandardMaterial("shirtMat", scene);
  shirtMat.diffuseColor = new BABYLON.Color3(0.18, 0.52, 0.92); // blue shirt

  const pantsMat = new BABYLON.StandardMaterial("pantsMat", scene);
  pantsMat.diffuseColor = new BABYLON.Color3(0.25, 0.22, 0.68); // dark blue pants

  const shoesMat = new BABYLON.StandardMaterial("shoesMat", scene);
  shoesMat.diffuseColor = new BABYLON.Color3(0.15, 0.10, 0.05); // dark brown shoes

  const hairMat = new BABYLON.StandardMaterial("hairMat", scene);
  hairMat.diffuseColor = new BABYLON.Color3(0.28, 0.16, 0.05); // brown hair

  // ── Root (invisible pivot) ──────────────────────────────────────────────
  const root = new BABYLON.TransformNode("playerRoot", scene);
  root.position = new BABYLON.Vector3(0, 0.5, 0);

  // ── Helper: create limb segment ─────────────────────────────────────────
  function makePart(name, w, h, d, mat, px, py, pz, parent) {
    const m = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
    m.material = mat;
    if (parent) m.parent = parent;
    m.position = new BABYLON.Vector3(px, py, pz);
    return m;
  }

  // ── Torso ────────────────────────────────────────────────────────────────
  const torso = makePart("torso", 0.55, 0.65, 0.30, shirtMat, 0, 0, 0, root);

  // ── Head group ──────────────────────────────────────────────────────────
  const headPivot = new BABYLON.TransformNode("headPivot", scene);
  headPivot.parent = torso;
  headPivot.position = new BABYLON.Vector3(0, 0.55, 0);

  const head = BABYLON.MeshBuilder.CreateBox("head", { width: 0.42, height: 0.42, depth: 0.38 }, scene);
  head.material = skinMat;
  head.parent = headPivot;
  head.position = new BABYLON.Vector3(0, 0.21, 0);

  // Hair (flat box on top)
  const hair = makePart("hair", 0.44, 0.10, 0.40, hairMat, 0, 0.43, 0, headPivot);

  // Eyes (two tiny dark boxes)
  const eyeMat = new BABYLON.StandardMaterial("eyeMat", scene);
  eyeMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.1);
  makePart("eyeL", 0.08, 0.08, 0.05, eyeMat, -0.10, 0.26, 0.18, headPivot);
  makePart("eyeR", 0.08, 0.08, 0.05, eyeMat,  0.10, 0.26, 0.18, headPivot);

  // ── Arm pivots (pivot at shoulder = top of arm) ──────────────────────────
  const lArmPivot = new BABYLON.TransformNode("lArmPivot", scene);
  lArmPivot.parent = torso;
  lArmPivot.position = new BABYLON.Vector3(-0.33, 0.28, 0);

  const rArmPivot = new BABYLON.TransformNode("rArmPivot", scene);
  rArmPivot.parent = torso;
  rArmPivot.position = new BABYLON.Vector3(0.33, 0.28, 0);

  // Upper arms
  makePart("lUpperArm", 0.16, 0.30, 0.16, shirtMat, 0, -0.15, 0, lArmPivot);
  makePart("rUpperArm", 0.16, 0.30, 0.16, shirtMat, 0, -0.15, 0, rArmPivot);

  // Forearms
  const lForeArm = makePart("lForeArm", 0.14, 0.28, 0.14, skinMat, 0, -0.29, 0, lArmPivot);
  const rForeArm = makePart("rForeArm", 0.14, 0.28, 0.14, skinMat, 0, -0.29, 0, rArmPivot);

  // ── Leg pivots (pivot at hip = top of leg) ───────────────────────────────
  const lLegPivot = new BABYLON.TransformNode("lLegPivot", scene);
  lLegPivot.parent = torso;
  lLegPivot.position = new BABYLON.Vector3(-0.15, -0.33, 0);

  const rLegPivot = new BABYLON.TransformNode("rLegPivot", scene);
  rLegPivot.parent = torso;
  rLegPivot.position = new BABYLON.Vector3(0.15, -0.33, 0);

  // Upper legs
  makePart("lUpperLeg", 0.20, 0.30, 0.20, pantsMat, 0, -0.15, 0, lLegPivot);
  makePart("rUpperLeg", 0.20, 0.30, 0.20, pantsMat, 0, -0.15, 0, rLegPivot);

  // Lower legs
  makePart("lLowerLeg", 0.18, 0.28, 0.18, pantsMat, 0, -0.44, 0, lLegPivot);
  makePart("rLowerLeg", 0.18, 0.28, 0.18, pantsMat, 0, -0.44, 0, rLegPivot);

  // Feet / shoes
  makePart("lFoot", 0.20, 0.10, 0.28, shoesMat, 0.0, -0.63, 0.04, lLegPivot);
  makePart("rFoot", 0.20, 0.10, 0.28, shoesMat, 0.0, -0.63, 0.04, rLegPivot);

  // Position torso so feet sit on y=0
  torso.position.y = 0.70;

  // ── Camera ───────────────────────────────────────────────────────────────
  const camera = new BABYLON.ArcRotateCamera(
    "playerCam",
    -Math.PI / 2,
    Math.PI / 3.5,
    14,
    root.position,
    scene
  );
  camera.lowerRadiusLimit = 6;
  camera.upperRadiusLimit = 20;
  camera.lowerBetaLimit   = 0.3;
  camera.upperBetaLimit   = Math.PI / 2.2;
  camera.attachControl(scene.getEngine().getRenderingCanvas(), true);

  // ── Input ────────────────────────────────────────────────────────────────
  const keys = {};
  const onKeyDown = e => { keys[e.code] = true; };
  const onKeyUp   = e => { keys[e.code] = false; };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup",   onKeyUp);
  scene.onDisposeObservable.addOnce(() => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup",   onKeyUp);
  });

  const SPEED = 0.15;
  let walkTime = 0;

  // ── Update ───────────────────────────────────────────────────────────────
  function update() {
    camera.target = root.position;

    let dx = 0, dz = 0;
    if (keys["KeyW"] || keys["ArrowUp"])    dz =  1;
    if (keys["KeyS"] || keys["ArrowDown"])  dz = -1;
    if (keys["KeyA"] || keys["ArrowLeft"])  dx = -1;
    if (keys["KeyD"] || keys["ArrowRight"]) dx =  1;

    const moving = dx !== 0 || dz !== 0;

    if (moving) {
      const camYaw = camera.alpha + Math.PI / 2;
      const worldDx = dx * Math.cos(camYaw) - dz * Math.sin(camYaw);
      const worldDz = dx * Math.sin(camYaw) + dz * Math.cos(camYaw);

      root.position.x += worldDx * SPEED;
      root.position.z += worldDz * SPEED;

      if (worldDx !== 0 || worldDz !== 0) {
        root.rotation.y = Math.atan2(worldDx, worldDz);
      }

      // Walk cycle
      walkTime += 0.18;
      const swing = Math.sin(walkTime) * 0.55;        // ±0.55 rad swing
      const legBob = Math.abs(Math.sin(walkTime)) * 0.04; // slight vertical bob

      lArmPivot.rotation.x =  swing;
      rArmPivot.rotation.x = -swing;
      lLegPivot.rotation.x = -swing;
      rLegPivot.rotation.x =  swing;

      // Body bob
      torso.position.y = 0.70 - legBob;

      // Head slight sway
      headPivot.rotation.z = Math.sin(walkTime * 0.5) * 0.04;

    } else {
      // Idle: gently return limbs to rest with lerp
      walkTime = 0;
      lArmPivot.rotation.x = BABYLON.Scalar.Lerp(lArmPivot.rotation.x, 0, 0.15);
      rArmPivot.rotation.x = BABYLON.Scalar.Lerp(rArmPivot.rotation.x, 0, 0.15);
      lLegPivot.rotation.x = BABYLON.Scalar.Lerp(lLegPivot.rotation.x, 0, 0.15);
      rLegPivot.rotation.x = BABYLON.Scalar.Lerp(rLegPivot.rotation.x, 0, 0.15);
      torso.position.y = BABYLON.Scalar.Lerp(torso.position.y, 0.70, 0.10);

      // Idle breathing
      const breathe = Math.sin(Date.now() * 0.001) * 0.015;
      torso.position.y += breathe;
    }
  }

  return { mesh: root, update, camera };
}
