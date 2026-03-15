/**
 * Player.js
 * Articulated character with walk-cycle animation.
 * Body parts: torso, head, left/right arms, left/right legs.
 * Arms and legs swing opposite each other while moving.
 */

export function createPlayer(scene) {
  const BABYLON = window.BABYLON;

  // ── Load avatar config from localStorage ─────────────────────────────────
  let _avatar = {};
  try { _avatar = JSON.parse(localStorage.getItem("iq_avatar") || "{}"); } catch(e) {}

  function _col(key, r, g, b) {
    const saved = _avatar[key];
    if (saved && saved.length === 3) return new BABYLON.Color3(saved[0], saved[1], saved[2]);
    return new BABYLON.Color3(r, g, b);
  }

  // ── Materials ────────────────────────────────────────────────────────────
  const skinMat = new BABYLON.StandardMaterial("skinMat", scene);
  skinMat.diffuseColor = _col("skin",  1.0, 0.82, 0.60);

  const shirtMat = new BABYLON.StandardMaterial("shirtMat", scene);
  shirtMat.diffuseColor = _col("shirt", 0.18, 0.52, 0.92);

  const pantsMat = new BABYLON.StandardMaterial("pantsMat", scene);
  pantsMat.diffuseColor = _col("pants", 0.25, 0.22, 0.68);

  const shoesMat = new BABYLON.StandardMaterial("shoesMat", scene);
  shoesMat.diffuseColor = new BABYLON.Color3(0.15, 0.10, 0.05);

  const hairMat = new BABYLON.StandardMaterial("hairMat", scene);
  hairMat.diffuseColor = _col("hair", 0.28, 0.16, 0.05);

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
  // Target tracks player at chest height for a better 3rd-person view
  const camTarget = new BABYLON.Vector3(0, 1.0, 0);

  const camera = new BABYLON.ArcRotateCamera(
    "playerCam",
    -Math.PI / 2,
    Math.PI / 3.2,   // slightly more horizontal — shows more world ahead
    14,
    camTarget,
    scene
  );
  camera.lowerRadiusLimit = 6;
  camera.upperRadiusLimit = 20;
  camera.lowerBetaLimit   = 0.15;   // can look more overhead
  camera.upperBetaLimit   = Math.PI / 2.1;
  camera.attachControl(scene.getEngine().getRenderingCanvas(), true);

  // ── Keyboard input ───────────────────────────────────────────────────────
  const keys = {};
  const onKeyDown = e => { keys[e.code] = true; };
  const onKeyUp   = e => { keys[e.code] = false; };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup",   onKeyUp);

  // ── Virtual joystick (touch devices) ────────────────────────────────────
  // Joystick state — updated by touch handlers, read by update()
  let joy = { dx: 0, dz: 0 };

  // ── Jump state ───────────────────────────────────────────────────────────
  const GROUND_Y    = 0.5;
  const JUMP_FORCE  = 0.22;
  const GRAVITY     = 0.013;
  let isJumping     = false;
  let jumpVelocity  = 0;

  const BASE_R  = 55;  // px radius of the outer ring
  const KNOB_R  = 26;  // px radius of the draggable knob
  const MAX_OFF = BASE_R - KNOB_R; // max knob travel from center

  // Build joystick DOM
  const joyWrap = document.createElement("div");
  joyWrap.id = "joy-wrap";

  const joyBase = document.createElement("div");
  joyBase.id = "joy-base";

  const joyKnob = document.createElement("div");
  joyKnob.id = "joy-knob";

  joyBase.appendChild(joyKnob);
  joyWrap.appendChild(joyBase);
  document.body.appendChild(joyWrap);

  // ── Mobile jump button ───────────────────────────────────────────────────
  const jumpBtn = document.createElement("button");
  jumpBtn.id = "btn-jump";
  jumpBtn.textContent = "⬆";
  document.body.appendChild(jumpBtn);
  jumpBtn.addEventListener("touchstart", e => {
    e.preventDefault();
    if (!isJumping) { isJumping = true; jumpVelocity = JUMP_FORCE; }
  }, { passive: false });

  let activeTouchId = null;
  let baseX = 0, baseY = 0;

  function _joyMove(clientX, clientY) {
    let offX = clientX - baseX;
    let offY = clientY - baseY;
    const dist = Math.sqrt(offX * offX + offY * offY);
    if (dist > MAX_OFF) {
      offX = offX / dist * MAX_OFF;
      offY = offY / dist * MAX_OFF;
    }
    joyKnob.style.transform = `translate(${offX}px, ${offY}px)`;
    joy.dx =  offX / MAX_OFF;   // -1 … +1  (left-right)
    joy.dz = -offY / MAX_OFF;   // -1 … +1  (forward-back, screen-Y is inverted)
  }

  function _joyReset() {
    joyKnob.style.transform = "translate(0px, 0px)";
    joy.dx = 0;
    joy.dz = 0;
    activeTouchId = null;
  }

  joyWrap.addEventListener("touchstart", e => {
    e.preventDefault();
    if (activeTouchId !== null) return;
    const t = e.changedTouches[0];
    activeTouchId = t.identifier;
    const rect = joyBase.getBoundingClientRect();
    baseX = rect.left + rect.width  / 2;
    baseY = rect.top  + rect.height / 2;
    _joyMove(t.clientX, t.clientY);
  }, { passive: false });

  window.addEventListener("touchmove", e => {
    if (activeTouchId === null) return;
    for (const t of e.changedTouches) {
      if (t.identifier === activeTouchId) {
        e.preventDefault();
        _joyMove(t.clientX, t.clientY);
        break;
      }
    }
  }, { passive: false });

  window.addEventListener("touchend", e => {
    for (const t of e.changedTouches) {
      if (t.identifier === activeTouchId) { _joyReset(); break; }
    }
  });
  window.addEventListener("touchcancel", _joyReset);

  // Clean up on scene dispose
  scene.onDisposeObservable.addOnce(() => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup",   onKeyUp);
    window.removeEventListener("touchmove", _joyMove);
    window.removeEventListener("touchend",  _joyReset);
    window.removeEventListener("touchcancel", _joyReset);
    if (joyWrap.parentNode) joyWrap.parentNode.removeChild(joyWrap);
    if (jumpBtn.parentNode) jumpBtn.parentNode.removeChild(jumpBtn);
  });

  const SPEED = 0.15;
  let walkTime = 0;

  const CAM_ROT = 0.035;   // radians per frame for arrow-key camera rotation

  // ── Update ───────────────────────────────────────────────────────────────
  function update() {
    // Jump physics
    if ((keys["Space"] || keys["KeyZ"]) && !isJumping) {
      isJumping = true;
      jumpVelocity = JUMP_FORCE;
    }
    if (isJumping) {
      root.position.y += jumpVelocity;
      jumpVelocity   -= GRAVITY;
      if (root.position.y <= GROUND_Y) {
        root.position.y = GROUND_Y;
        isJumping       = false;
        jumpVelocity    = 0;
      }
    } else {
      root.position.y = GROUND_Y;
    }

    // Camera target tracks player at chest height for better framing
    camTarget.x = root.position.x;
    camTarget.y = root.position.y + 0.9;
    camTarget.z = root.position.z;

    // Arrow keys rotate the camera (L/R directions flipped for natural feel)
    if (keys["ArrowLeft"])  camera.alpha += CAM_ROT;   // flipped: ← orbits right
    if (keys["ArrowRight"]) camera.alpha -= CAM_ROT;   // flipped: → orbits left
    if (keys["ArrowUp"])    camera.beta   = Math.max(camera.lowerBetaLimit, camera.beta - 0.025);
    if (keys["ArrowDown"])  camera.beta   = Math.min(camera.upperBetaLimit, camera.beta + 0.025);

    // Player movement — WASD + joystick only (arrow keys reserved for camera)
    let dx = 0, dz = 0;
    if (keys["KeyW"]) dz =  1;
    if (keys["KeyS"]) dz = -1;
    if (keys["KeyA"]) dx = -1;
    if (keys["KeyD"]) dx =  1;
    // Joystick overrides keyboard if touched
    if (joy.dx !== 0 || joy.dz !== 0) {
      dx = joy.dx;
      dz = joy.dz;
    }

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

      // Walk cycle (skip if mid-air)
      if (!isJumping) {
        walkTime += 0.18;
        const swing  = Math.sin(walkTime) * 0.55;
        const legBob = Math.abs(Math.sin(walkTime)) * 0.04;

        lArmPivot.rotation.x =  swing;
        rArmPivot.rotation.x = -swing;
        lLegPivot.rotation.x = -swing;
        rLegPivot.rotation.x =  swing;

        torso.position.y = 0.70 - legBob;
        headPivot.rotation.z = Math.sin(walkTime * 0.5) * 0.04;
      }

    } else {
      // Idle: gently return limbs to rest with lerp
      walkTime = 0;
      if (!isJumping) {
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

    // Jump pose — arms raised, legs tucked (overrides walk/idle)
    if (isJumping) {
      lArmPivot.rotation.x = BABYLON.Scalar.Lerp(lArmPivot.rotation.x, -1.1, 0.25);
      rArmPivot.rotation.x = BABYLON.Scalar.Lerp(rArmPivot.rotation.x, -1.1, 0.25);
      lLegPivot.rotation.x = BABYLON.Scalar.Lerp(lLegPivot.rotation.x,  0.45, 0.25);
      rLegPivot.rotation.x = BABYLON.Scalar.Lerp(rLegPivot.rotation.x,  0.45, 0.25);
    }
  }

  return { mesh: root, update, camera };
}
