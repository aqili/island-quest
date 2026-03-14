/**
 * WorldScene.js
 * The overworld: an ocean with two islands the player can walk to.
 *
 * Math Island  → position (-60, 0, 0)  green/yellow theme
 * Language Island → position ( 60, 0, 0)  blue/purple theme
 *
 * When the player steps into a castle door trigger zone the scene manager
 * switches to the corresponding castle scene.
 */

import { createPlayer } from "../entities/Player.js";
import { SaveManager }   from "../utils/SaveManager.js";
import { createVirtualJoystick, destroyVirtualJoystick } from "../ui/VirtualJoystick.js";

const BABYLON = window.BABYLON;

/**
 * @param {BABYLON.Engine} engine
 * @param {Function} onEnterMath – callback to switch to MathCastleScene
 * @param {Function} onEnterLang – callback to switch to LangCastleScene
 * @returns {BABYLON.Scene}
 */
export function createWorldScene(engine, onEnterMath, onEnterLang) {
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.1, 0.42, 0.67, 1); // ocean sky blue

  createVirtualJoystick();
  scene.onDisposeObservable.addOnce(() => destroyVirtualJoystick());

  // Per-scene state (no module-level variables, so re-entering is clean)
  let lastNearIsland = null;
  let switching = false; // prevent double-trigger during scene transition

  // ── Lighting ──────────────────────────────────────────────────────────────
  const sun = new BABYLON.HemisphericLight("sun", new BABYLON.Vector3(0, 1, 0), scene);
  sun.intensity = 1.1;

  // ── Ocean floor plane ─────────────────────────────────────────────────────
  const ocean = BABYLON.MeshBuilder.CreateGround("ocean", { width: 400, height: 400 }, scene);
  const oceanMat = new BABYLON.StandardMaterial("oceanMat", scene);
  oceanMat.diffuseColor  = new BABYLON.Color3(0.1, 0.55, 0.9);
  oceanMat.specularColor = new BABYLON.Color3(0.2, 0.5, 0.8);
  ocean.material = oceanMat;
  // Gentle wave animation via material colour scroll (cosmetic)
  let waveT = 0;
  scene.registerBeforeRender(() => {
    waveT += 0.012;
    oceanMat.diffuseColor = new BABYLON.Color3(
      0.05 + 0.05 * Math.sin(waveT),
      0.5  + 0.05 * Math.sin(waveT + 1),
      0.85 + 0.05 * Math.sin(waveT + 2)
    );
  });

  // ── Islands ───────────────────────────────────────────────────────────────
  _buildMathIsland(scene);
  _buildLangIsland(scene);

  // ── Player ────────────────────────────────────────────────────────────────
  const player = createPlayer(scene);
  player.mesh.position = new BABYLON.Vector3(0, 0.5, 0);

  // ── HUD helpers ───────────────────────────────────────────────────────────
  const hudLocation = document.getElementById("hud-location");
  const hudCrowns   = document.getElementById("hud-crowns");

  function updateHUD() {
    const save = SaveManager.load();
    const crowns = [
      save.mathIsland.crownEarned     ? "👑🔢" : "",
      save.languageIsland.crownEarned ? "👑🔤" : ""
    ].filter(Boolean).join("  ");
    hudCrowns.textContent = crowns;
  }
  updateHUD();

  // ── Proximity hint element ────────────────────────────────────────────────
  let _hintEl = null;
  function _showHint(text) {
    if (_hintEl) return;
    _hintEl = document.createElement("div");
    _hintEl.style.cssText = [
      "position:fixed", "bottom:200px", "left:50%",
      "transform:translateX(-50%)",
      "background:rgba(0,0,0,0.65)", "color:#ffe066",
      "font-family:'Fredoka One',cursive", "font-size:1.3rem",
      "padding:10px 28px", "border-radius:14px",
      "z-index:120", "pointer-events:none",
      "animation:bannerFade 2.5s forwards"
    ].join(";");
    _hintEl.textContent = text;
    document.body.appendChild(_hintEl);
    setTimeout(() => { if (_hintEl) { _hintEl.remove(); _hintEl = null; } }, 2500);
  }
  function _hideHint() {
    if (_hintEl) { _hintEl.remove(); _hintEl = null; }
  }

  let _lastHintIsland = null;

  // ── Proximity / trigger checks ────────────────────────────────────────────
  const ISLAND_ENTER_DIST = 9; // distance from castle door to trigger

  // Door positions (world coordinates) — front face of castle body
  const mathDoor = new BABYLON.Vector3(-60, 0.5, 9);
  const langDoor = new BABYLON.Vector3( 60, 0.5, 9);

  scene.registerBeforeRender(() => {
    player.update();

    const px = player.mesh.position;

    // Proximity labels
    const distMath = BABYLON.Vector3.Distance(px, new BABYLON.Vector3(-60, px.y, 0));
    const distLang = BABYLON.Vector3.Distance(px, new BABYLON.Vector3( 60, px.y, 0));

    if (distMath < 30) {
      if (lastNearIsland !== "math") {
        lastNearIsland = "math";
        hudLocation.textContent = "🔢 Math Island";
      }
      // Proximity castle hint
      const distToDoor = BABYLON.Vector3.Distance(px, mathDoor);
      if (distToDoor < 20 && _lastHintIsland !== "math") {
        _lastHintIsland = "math";
        _showHint("🏰 Walk to the castle door!");
      } else if (distToDoor >= 20 && _lastHintIsland === "math") {
        _lastHintIsland = null;
        _hideHint();
      }
    } else if (distLang < 30) {
      if (lastNearIsland !== "lang") {
        lastNearIsland = "lang";
        hudLocation.textContent = "🔤 Language Island";
      }
      const distToDoor = BABYLON.Vector3.Distance(px, langDoor);
      if (distToDoor < 20 && _lastHintIsland !== "lang") {
        _lastHintIsland = "lang";
        _showHint("🏰 Walk to the castle door!");
      } else if (distToDoor >= 20 && _lastHintIsland === "lang") {
        _lastHintIsland = null;
        _hideHint();
      }
    } else {
      if (lastNearIsland !== null) {
        lastNearIsland = null;
        hudLocation.textContent = "🌊 Open Ocean";
      }
    }

    // Door triggers
    if (!switching && BABYLON.Vector3.Distance(px, mathDoor) < ISLAND_ENTER_DIST) {
      switching = true;
      setTimeout(() => onEnterMath(), 0);
    } else if (!switching && BABYLON.Vector3.Distance(px, langDoor) < ISLAND_ENTER_DIST) {
      switching = true;
      setTimeout(() => onEnterLang(), 0);
    }

    updateHUD();
  });

  return scene;
}

// ─── Private: build Math Island ──────────────────────────────────────────────

function _buildMathIsland(scene) {
  const OX = -60, OZ = 0;

  // Ground
  const ground = BABYLON.MeshBuilder.CreateDisc("mathGround", { radius: 24, tessellation: 32 }, scene);
  ground.rotation.x = Math.PI / 2;
  ground.position   = new BABYLON.Vector3(OX, 0.02, OZ);
  const gm = new BABYLON.StandardMaterial("mathGroundMat", scene);
  gm.diffuseColor = new BABYLON.Color3(0.35, 0.72, 0.2);
  ground.material = gm;

  // Castle body
  _buildCastle(scene, OX, OZ, new BABYLON.Color3(0.85, 0.78, 0.55), new BABYLON.Color3(0.6, 0.5, 0.3));

  // Sign (animated bob)
  _buildSign(scene, OX, OZ + 14, "Math Island 🔢", new BABYLON.Color3(0.95, 0.85, 0.2));

  // 8 trees spread wider
  const treePositions = [
    [-8, -10], [8, -10], [-14, -4], [14, -4],
    [-10, 6],  [10, 6],  [-5, -18], [5, -18]
  ];
  treePositions.forEach(([tx, tz]) => {
    _buildTree(scene, OX + tx, OZ + tz, new BABYLON.Color3(0.1, 0.7, 0.1));
  });
}

// ─── Private: build Language Island ──────────────────────────────────────────

function _buildLangIsland(scene) {
  const OX = 60, OZ = 0;

  // Ground
  const ground = BABYLON.MeshBuilder.CreateDisc("langGround", { radius: 24, tessellation: 32 }, scene);
  ground.rotation.x = Math.PI / 2;
  ground.position   = new BABYLON.Vector3(OX, 0.02, OZ);
  const gm = new BABYLON.StandardMaterial("langGroundMat", scene);
  gm.diffuseColor = new BABYLON.Color3(0.38, 0.25, 0.72);
  ground.material = gm;

  // Castle
  _buildCastle(scene, OX, OZ, new BABYLON.Color3(0.55, 0.65, 0.85), new BABYLON.Color3(0.3, 0.4, 0.6));

  // Sign (animated bob)
  _buildSign(scene, OX, OZ + 14, "Language Island 🔤", new BABYLON.Color3(0.5, 0.85, 1.0));

  // 8 trees spread wider (purple tinted)
  const treePositions = [
    [-8, -10], [8, -10], [-14, -4], [14, -4],
    [-10, 6],  [10, 6],  [-5, -18], [5, -18]
  ];
  treePositions.forEach(([tx, tz]) => {
    _buildTree(scene, OX + tx, OZ + tz, new BABYLON.Color3(0.5, 0.1, 0.8));
  });
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function _buildCastle(scene, cx, cz, wallColor, towerColor) {
  const mat = new BABYLON.StandardMaterial("castleMat_" + cx, scene);
  mat.diffuseColor = wallColor;

  const towerMat = new BABYLON.StandardMaterial("towerMat_" + cx, scene);
  towerMat.diffuseColor = towerColor;

  // Main body
  const body = BABYLON.MeshBuilder.CreateBox("castleBody_" + cx,
    { width: 14, height: 8, depth: 10 }, scene);
  body.position = new BABYLON.Vector3(cx, 4, cz);
  body.material = mat;

  // Four corner towers
  [[-7, -5], [7, -5], [-7, 5], [7, 5]].forEach(([tx, tz], i) => {
    const tower = BABYLON.MeshBuilder.CreateCylinder("tower_" + cx + i,
      { diameter: 3.0, height: 11, tessellation: 8 }, scene);
    tower.position = new BABYLON.Vector3(cx + tx, 5.5, cz + tz);
    tower.material = towerMat;

    // Conical roof
    const roof = BABYLON.MeshBuilder.CreateCylinder("roof_" + cx + i,
      { diameterTop: 0, diameterBottom: 3.4, height: 2.5, tessellation: 8 }, scene);
    roof.position = new BABYLON.Vector3(cx + tx, 12.25, cz + tz);
    const roofMat = new BABYLON.StandardMaterial("roofMat_" + cx + i, scene);
    roofMat.diffuseColor = new BABYLON.Color3(0.7, 0.15, 0.15);
    roof.material = roofMat;
  });

  // Door gap (dark box inset in front)
  const door = BABYLON.MeshBuilder.CreateBox("door_" + cx,
    { width: 3.5, height: 5.5, depth: 0.5 }, scene);
  door.position = new BABYLON.Vector3(cx, 2.75, cz + 5.1);
  const doorMat = new BABYLON.StandardMaterial("doorMat_" + cx, scene);
  doorMat.diffuseColor = new BABYLON.Color3(0.15, 0.08, 0.02);
  door.material = doorMat;
}

function _buildTree(scene, x, z, leafColor) {
  const trunkMat = new BABYLON.StandardMaterial("trunkMat_" + x + z, scene);
  trunkMat.diffuseColor = new BABYLON.Color3(0.45, 0.3, 0.1);

  const leafMat = new BABYLON.StandardMaterial("leafMat_" + x + z, scene);
  leafMat.diffuseColor = leafColor;

  const trunk = BABYLON.MeshBuilder.CreateCylinder("trunk_" + x + z,
    { diameter: 0.7, height: 3.0, tessellation: 8 }, scene);
  trunk.position = new BABYLON.Vector3(x, 1.5, z);
  trunk.material = trunkMat;

  const leaves = BABYLON.MeshBuilder.CreateCylinder("leaves_" + x + z,
    { diameterTop: 0, diameterBottom: 4.5, height: 6, tessellation: 8 }, scene);
  leaves.position = new BABYLON.Vector3(x, 6, z);
  leaves.material = leafMat;
}

function _buildSign(scene, x, z, text, color) {
  // Post
  const post = BABYLON.MeshBuilder.CreateBox("signPost_" + x,
    { width: 0.3, height: 4, depth: 0.3 }, scene);
  post.position = new BABYLON.Vector3(x, 2, z);
  const postMat = new BABYLON.StandardMaterial("postMat_" + x, scene);
  postMat.diffuseColor = new BABYLON.Color3(0.45, 0.28, 0.1);
  post.material = postMat;

  // Board
  const board = BABYLON.MeshBuilder.CreateBox("signBoard_" + x,
    { width: 5.5, height: 1.5, depth: 0.2 }, scene);
  board.position = new BABYLON.Vector3(x, 4.5, z);
  const boardMat = new BABYLON.StandardMaterial("boardMat_" + x, scene);
  boardMat.diffuseColor = color;
  board.material = boardMat;

  // Dynamic texture for text
  const dt = new BABYLON.DynamicTexture("signTex_" + x, { width: 512, height: 128 }, scene);
  dt.drawText(text, null, 90, "bold 52px Fredoka One", "#2c3e50", "transparent", true);
  boardMat.diffuseTexture = dt;

  // Animated floating bob
  let t = 0;
  scene.registerBeforeRender(() => {
    t += 0.02;
    board.position.y = 4.5 + Math.sin(t) * 0.2;
  });
}
