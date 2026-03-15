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

export function createWorldScene(engine, onEnterMath, onEnterLang, onEnterLetters) {
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.38, 0.68, 0.95, 1);

  createVirtualJoystick();
  scene.onDisposeObservable.addOnce(() => destroyVirtualJoystick());

  // Per-scene state (no module-level variables, so re-entering is clean)
  let lastNearIsland = null;

  // ── Lighting ──────────────────────────────────────────────────────────────
  const sun = new BABYLON.HemisphericLight("sun", new BABYLON.Vector3(0, 1, 0), scene);
  sun.intensity = 1.1;

  // ── Ocean floor plane ─────────────────────────────────────────────────────
  const ocean = BABYLON.MeshBuilder.CreateGround("ocean", { width: 400, height: 400 }, scene);
  const oceanMat = new BABYLON.StandardMaterial("oceanMat", scene);
  oceanMat.diffuseColor  = new BABYLON.Color3(0.08, 0.42, 0.72);
  oceanMat.specularColor = new BABYLON.Color3(0.8, 0.9, 1.0);
  oceanMat.specularPower = 64;
  ocean.material = oceanMat;
  // Gentle wave animation via material colour scroll (cosmetic)
  let waveT = 0;
  scene.registerBeforeRender(() => {
    waveT += 0.016;
    oceanMat.diffuseColor = new BABYLON.Color3(
      0.06 + 0.03 * Math.sin(waveT * 0.7),
      0.40 + 0.05 * Math.sin(waveT * 0.5 + 1),
      0.70 + 0.06 * Math.sin(waveT * 0.4 + 2)
    );
  });

  // ── Foam ring around each island ─────────────────────────────────────────
  _buildFoamRing(scene, -30, 0, 13.5);
  _buildFoamRing(scene,  30, 0, 13.5);
  _buildFoamRing(scene,   0, -55, 13.5);

  // ── Clouds ───────────────────────────────────────────────────────────────
  const cloudPositions = [
    [0, 28, -20], [-25, 24, -35], [20, 30, -10],
    [-15, 26, 15], [35, 22, 5], [-40, 27, -5], [10, 29, 30],
    [0, 26, -65], [-18, 28, -50], [18, 25, -50]
  ];
  cloudPositions.forEach(([cx, cy, cz], i) => {
    _buildCloud(scene, cx, cy, cz, i);
  });

  // ── Islands ───────────────────────────────────────────────────────────────
  _buildMathIsland(scene);
  _buildLangIsland(scene);
  _buildLettersIsland(scene);

  // ── Animals ───────────────────────────────────────────────────────────────
  // IDs must be unique across all animals; use explicit integer id
  const animals = [];
  // Dogs on Math Island (home x, home z, radius, id)
  animals.push(_buildDog(scene, -28,  -3, 6, 0));
  animals.push(_buildDog(scene, -32,   3, 6, 1));
  // Cats on Lang Island
  animals.push(_buildCat(scene,  28,  -3, 6, 2));
  animals.push(_buildCat(scene,  32,   3, 6, 3));
  // Dogs + cats near Letters Island (z≈-55 center)
  animals.push(_buildDog(scene,  -3, -53, 5, 4));
  animals.push(_buildCat(scene,   3, -53, 5, 5));
  animals.push(_buildDog(scene,  -5, -58, 5, 6));
  animals.push(_buildCat(scene,   5, -57, 5, 7));

  // ── Player ────────────────────────────────────────────────────────────────
  const player = createPlayer(scene);
  player.mesh.position = new BABYLON.Vector3(0, 0.5, 0);

  // ── HUD ───────────────────────────────────────────────────────────────────
  const hudLocation = document.getElementById("hud-location");
  const hudCrowns   = document.getElementById("hud-crowns");

  function updateHUD() {
    const save = SaveManager.load();
    const crowns = [
      save.mathIsland.crownEarned     ? "👑🔢" : "",
      save.languageIsland.crownEarned ? "👑🔤" : "",
      (save.lettersIsland && save.lettersIsland.crownEarned) ? "👑🔤" : ""
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
    try {
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
    updateHUD();
    } catch (e) {
      console.error("WorldScene render error:", e);
    }
  });

  return scene;
}

// ── Foam ring ────────────────────────────────────────────────────────────────
function _buildFoamRing(scene, cx, cz, r) {
  const foam = BABYLON.MeshBuilder.CreateTorus("foam_" + cx,
    { diameter: r * 2, thickness: 0.6, tessellation: 40 }, scene);
  foam.position = new BABYLON.Vector3(cx, 0.05, cz);
  foam.rotation.x = Math.PI / 2;
  const foamMat = new BABYLON.StandardMaterial("foamMat_" + cx, scene);
  foamMat.diffuseColor  = new BABYLON.Color3(0.9, 0.95, 1.0);
  foamMat.specularColor = new BABYLON.Color3(1, 1, 1);
  foamMat.alpha = 0.6;
  foam.material = foamMat;
}

// ── Cloud ────────────────────────────────────────────────────────────────────
function _buildCloud(scene, cx, cy, cz, idx) {
  const cloudMat = new BABYLON.StandardMaterial("cloudMat_" + idx, scene);
  cloudMat.diffuseColor  = new BABYLON.Color3(1, 1, 1);
  cloudMat.emissiveColor = new BABYLON.Color3(0.9, 0.92, 0.95);
  cloudMat.alpha = 0.88;

  const puffs = [
    [0, 0, 0, 2.2], [-1.8, -0.3, 0, 1.6], [1.8, -0.3, 0, 1.5],
    [-0.9, 0.5, 0, 1.4], [0.9, 0.4, 0, 1.3]
  ];
  puffs.forEach(([px, py, pz, r], j) => {
    const puff = BABYLON.MeshBuilder.CreateSphere("cloud_" + idx + "_" + j,
      { diameter: r, segments: 5 }, scene);
    puff.position = new BABYLON.Vector3(cx + px, cy + py, cz + pz);
    puff.material = cloudMat;
    // Tag for drift
    if (j === 0) puff.name = "cloud_" + idx;
  });
}

// ── Math Island ───────────────────────────────────────────────────────────────
function _buildMathIsland(scene) {
  const OX = -60, OZ = 0;

  // Ground
  const ground = BABYLON.MeshBuilder.CreateDisc("mathGround", { radius: 24, tessellation: 32 }, scene);
  ground.rotation.x = Math.PI / 2;
  ground.position   = new BABYLON.Vector3(OX, 0.02, OZ);
  const gm = new BABYLON.StandardMaterial("mathGroundMat", scene);
  gm.diffuseColor = new BABYLON.Color3(0.35, 0.72, 0.2);
  ground.material = gm;

  // Flag on castle
  _buildFlag(scene, OX, OZ + 0, new BABYLON.Color3(1.0, 0.85, 0.1), "🔢");

  // Sign (animated bob)
  _buildSign(scene, OX, OZ + 14, "Math Island 🔢", new BABYLON.Color3(0.95, 0.85, 0.2));

  // 8 trees spread wider
  const treePositions = [
    [-8, -10], [8, -10], [-14, -4], [14, -4],
    [-10, 6],  [10, 6],  [-5, -18], [5, -18]
  ];
  treePositions.forEach(([tx, tz]) => {
    _buildPalmTree(scene, OX + tx, OZ + tz, new BABYLON.Color3(0.12, 0.72, 0.12));
  });

  // Lamp posts along path
  _buildLampPost(scene, OX - 1.2, OZ + 3.5, new BABYLON.Color3(1.0, 0.95, 0.6));
  _buildLampPost(scene, OX + 1.2, OZ + 3.5, new BABYLON.Color3(1.0, 0.95, 0.6));
}

// ── Language Island ───────────────────────────────────────────────────────────
function _buildLangIsland(scene) {
  const OX = 60, OZ = 0;

  // Ground
  const ground = BABYLON.MeshBuilder.CreateDisc("langGround", { radius: 24, tessellation: 32 }, scene);
  ground.rotation.x = Math.PI / 2;
  ground.position   = new BABYLON.Vector3(OX, 0.02, OZ);
  const gm = new BABYLON.StandardMaterial("langGroundMat", scene);
  gm.diffuseColor = new BABYLON.Color3(0.38, 0.25, 0.72);
  ground.material = gm;

  _buildRocks(scene, OX, OZ, new BABYLON.Color3(0.42, 0.38, 0.55), 8);

  // Sign (animated bob)
  _buildSign(scene, OX, OZ + 14, "Language Island 🔤", new BABYLON.Color3(0.5, 0.85, 1.0));

  // 8 trees spread wider (purple tinted)
  const treePositions = [
    [-8, -10], [8, -10], [-14, -4], [14, -4],
    [-10, 6],  [10, 6],  [-5, -18], [5, -18]
  ];
  treePositions.forEach(([tx, tz]) => {
    _buildPalmTree(scene, OX + tx, OZ + tz, new BABYLON.Color3(0.48, 0.10, 0.80));
  });

  _buildLampPost(scene, OX - 1.2, OZ + 3.5, new BABYLON.Color3(0.8, 0.6, 1.0));
  _buildLampPost(scene, OX + 1.2, OZ + 3.5, new BABYLON.Color3(0.8, 0.6, 1.0));
}

// ── Shared builders ───────────────────────────────────────────────────────────

function _buildIslandGround(scene, cx, cz, id, sandColor, grassColor) {
  // Sand base (slightly wider)
  const sand = BABYLON.MeshBuilder.CreateDisc(id + "Sand",
    { radius: 13, tessellation: 36 }, scene);
  sand.rotation.x = Math.PI / 2;
  sand.position = new BABYLON.Vector3(cx, 0.01, cz);
  const sandMat = new BABYLON.StandardMaterial(id + "SandMat", scene);
  sandMat.diffuseColor = sandColor;
  sand.material = sandMat;

  // Grass top (slightly smaller, raised a touch)
  const grass = BABYLON.MeshBuilder.CreateDisc(id + "Grass",
    { radius: 10, tessellation: 36 }, scene);
  grass.rotation.x = Math.PI / 2;
  grass.position = new BABYLON.Vector3(cx, 0.04, cz);
  const grassMat = new BABYLON.StandardMaterial(id + "GrassMat", scene);
  grassMat.diffuseColor = grassColor;
  grass.material = grassMat;
}

function _buildRocks(scene, cx, cz, color, count) {
  const mat = new BABYLON.StandardMaterial("rockMat_" + cx, scene);
  mat.diffuseColor = color;
  const angles = Array.from({ length: count }, (_, i) => (i / count) * Math.PI * 2);
  angles.forEach((a, i) => {
    const rx = cx + Math.cos(a) * 11.5;
    const rz = cz + Math.sin(a) * 11.5;
    const h = 0.4 + Math.random() * 0.7;
    const rock = BABYLON.MeshBuilder.CreateBox("rock_" + cx + i,
      { width: 0.7 + Math.random() * 0.6, height: h, depth: 0.6 + Math.random() * 0.5 }, scene);
    rock.position = new BABYLON.Vector3(rx, h / 2, rz);
    rock.rotation.y = Math.random() * Math.PI;
    rock.material = mat;
  });
}

function _buildCastle(scene, cx, cz, wallColor, towerColor, roofColor) {
  const mat = new BABYLON.StandardMaterial("castleMat_" + cx, scene);
  mat.diffuseColor = wallColor;
  // Stone-like specular
  mat.specularColor = new BABYLON.Color3(0.15, 0.15, 0.15);

  const towerMat = new BABYLON.StandardMaterial("towerMat_" + cx, scene);
  towerMat.diffuseColor = towerColor;
  towerMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);

  const roofMat = new BABYLON.StandardMaterial("roofMat_" + cx, scene);
  roofMat.diffuseColor = roofColor;

  const battleMat = new BABYLON.StandardMaterial("battleMat_" + cx, scene);
  battleMat.diffuseColor = new BABYLON.Color3(
    towerColor.r * 0.85, towerColor.g * 0.85, towerColor.b * 0.85);

  // Main body
  const body = BABYLON.MeshBuilder.CreateBox("castleBody_" + cx,
    { width: 14, height: 8, depth: 10 }, scene);
  body.position = new BABYLON.Vector3(cx, 4, cz);
  body.material = mat;

  // Battlements on top of main body
  for (let bi = -3; bi <= 3; bi += 1.2) {
    const b = BABYLON.MeshBuilder.CreateBox("batt_t_" + cx + bi,
      { width: 0.5, height: 0.5, depth: 0.3 }, scene);
    b.position = new BABYLON.Vector3(cx + bi, 4.75, cz - 2.75);
    b.material = battleMat;
    const b2 = BABYLON.MeshBuilder.CreateBox("batt_b_" + cx + bi,
      { width: 0.5, height: 0.5, depth: 0.3 }, scene);
    b2.position = new BABYLON.Vector3(cx + bi, 4.75, cz + 2.75);
    b2.material = battleMat;
  }
  for (let bi = -2.5; bi <= 2.5; bi += 1.2) {
    const b = BABYLON.MeshBuilder.CreateBox("batt_s_" + cx + bi,
      { width: 0.3, height: 0.5, depth: 0.5 }, scene);
    b.position = new BABYLON.Vector3(cx - 3.25, 4.75, cz + bi);
    b.material = battleMat;
    const b2 = b.clone("batt_s2_" + cx + bi);
    b2.position = new BABYLON.Vector3(cx + 3.25, 4.75, cz + bi);
  }

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

    // Tower battlements
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
      const bt = BABYLON.MeshBuilder.CreateBox("tb_" + cx + i + a,
        { width: 0.3, height: 0.4, depth: 0.3 }, scene);
      bt.position = new BABYLON.Vector3(
        cx + tx + Math.cos(a) * 0.7, 6.7, cz + tz + Math.sin(a) * 0.7);
      bt.material = battleMat;
    }

    // Tower windows (inset dark box)
    const winMat = new BABYLON.StandardMaterial("winMat_" + cx + i, scene);
    winMat.diffuseColor = new BABYLON.Color3(0.05, 0.05, 0.12);
    const win = BABYLON.MeshBuilder.CreateBox("win_" + cx + i,
      { width: 0.3, height: 0.5, depth: 0.1 }, scene);
    win.position = new BABYLON.Vector3(cx + tx, 4.2, cz + tz + (tz > 0 ? 0.85 : -0.85));
    win.material = winMat;
  });

  // Door materials
  const doorMat = new BABYLON.StandardMaterial("doorMat_" + cx, scene);
  doorMat.diffuseColor = new BABYLON.Color3(0.10, 0.06, 0.02);

  // Door gap (dark recess behind the opening)
  const doorGap = BABYLON.MeshBuilder.CreateBox("doorGap_" + cx,
    { width: 3.5, height: 5.5, depth: 0.5 }, scene);
  doorGap.position = new BABYLON.Vector3(cx, 2.75, cz + 5.1);
  doorGap.material = doorMat;

  // Door frame panel
  const door = BABYLON.MeshBuilder.CreateBox("door_" + cx,
    { width: 1.6, height: 2.4, depth: 0.35 }, scene);
  door.position = new BABYLON.Vector3(cx, 1.2, cz + 2.9);
  door.material = doorMat;

  // Arch top (rounded look via flattened sphere)
  const arch = BABYLON.MeshBuilder.CreateSphere("arch_" + cx,
    { diameterX: 1.6, diameterY: 0.9, diameterZ: 0.35, segments: 8 }, scene);
  arch.position = new BABYLON.Vector3(cx, 2.55, cz + 2.9);
  arch.material = doorMat;

  // Wall windows (main body)
  const winMat2 = new BABYLON.StandardMaterial("winMat2_" + cx, scene);
  winMat2.diffuseColor = new BABYLON.Color3(0.6, 0.75, 0.9);
  winMat2.emissiveColor = new BABYLON.Color3(0.1, 0.15, 0.25);
  [[-2, 2.5], [2, 2.5]].forEach(([wx], j) => {
    const win = BABYLON.MeshBuilder.CreateBox("wallWin_" + cx + j,
      { width: 0.5, height: 0.8, depth: 0.15 }, scene);
    win.position = new BABYLON.Vector3(cx + wx, 2.5, cz + 2.85);
    win.material = winMat2;
  });
}

function _buildPalmTree(scene, x, z, leafColor) {
  const trunkMat = new BABYLON.StandardMaterial("palmTrunk_" + x + z, scene);
  trunkMat.diffuseColor = new BABYLON.Color3(0.60, 0.42, 0.18);

  const leafMat = new BABYLON.StandardMaterial("palmLeaf_" + x + z, scene);
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

  const post = BABYLON.MeshBuilder.CreateCylinder("signPost_" + x,
    { diameter: 0.15, height: 2.2, tessellation: 8 }, scene);
  post.position = new BABYLON.Vector3(x, 1.1, z);
  post.material = postMat;

  // Board
  const board = BABYLON.MeshBuilder.CreateBox("signBoard_" + x,
    { width: 5.5, height: 1.5, depth: 0.2 }, scene);
  board.position = new BABYLON.Vector3(x, 4.5, z);
  const boardMat = new BABYLON.StandardMaterial("boardMat_" + x, scene);
  boardMat.diffuseColor = color;
  board.material = boardMat;

  const dt = new BABYLON.DynamicTexture("signTex_" + x, { width: 512, height: 128 }, scene);
  dt.drawText(text, null, 90, "bold 48px Fredoka One", "#2c3e50", "transparent", true);
  dt.uScale = -1;   // fix horizontal mirror on box face
  boardMat.diffuseTexture = dt;

  // Animated floating bob
  let t = 0;
  scene.registerBeforeRender(() => {
    t += 0.02;
    board.position.y = 4.5 + Math.sin(t) * 0.2;
  });
}

// ── Letters Island ────────────────────────────────────────────────────────────
function _buildLettersIsland(scene) {
  const OX = 0, OZ = -55;

  _buildIslandGround(scene, OX, OZ, "letters",
    new BABYLON.Color3(0.82, 0.90, 0.88),  // light seafoam sand
    new BABYLON.Color3(0.10, 0.68, 0.60)   // teal grass
  );

  _buildRocks(scene, OX, OZ, new BABYLON.Color3(0.38, 0.55, 0.52), 8);

  // Teal castle
  _buildCastle(scene, OX, OZ,
    new BABYLON.Color3(0.45, 0.72, 0.68),  // teal stone
    new BABYLON.Color3(0.28, 0.52, 0.50),
    new BABYLON.Color3(0.08, 0.45, 0.40)   // dark teal roofs
  );

  _buildFlag(scene, OX, OZ, new BABYLON.Color3(0.20, 0.95, 0.80), "🔤");
  _buildSign(scene, OX, OZ + 7.5, "Letters Island 🔤", new BABYLON.Color3(0.20, 0.90, 0.78));

  const treePositions = [[-4,-5],[4,-5],[-6,2],[6,2],[0,-8],[-5,0],[5,0]];
  treePositions.forEach(([tx, tz]) => {
    _buildPalmTree(scene, OX + tx, OZ + tz, new BABYLON.Color3(0.08, 0.65, 0.55));
  });

  _buildLampPost(scene, OX - 1.2, OZ + 3.5, new BABYLON.Color3(0.40, 1.0, 0.85));
  _buildLampPost(scene, OX + 1.2, OZ + 3.5, new BABYLON.Color3(0.40, 1.0, 0.85));

  // Two houses on the island
  _buildHouse(scene, OX - 6, OZ - 2, new BABYLON.Color3(0.90, 0.85, 0.70), new BABYLON.Color3(0.65, 0.20, 0.10));
  _buildHouse(scene, OX + 6, OZ - 2, new BABYLON.Color3(0.80, 0.90, 0.78), new BABYLON.Color3(0.20, 0.55, 0.30));

  // Letter tiles scattered as decoration around island
  _buildLetterDecoration(scene, OX - 2, OZ + 5, "A");
  _buildLetterDecoration(scene, OX + 2, OZ + 5, "B");
  _buildLetterDecoration(scene, OX,     OZ + 6, "C");
}

function _buildHouse(scene, x, z, wallColor, roofColor) {
  const wallMat = new BABYLON.StandardMaterial("houseMat_" + x + z, scene);
  wallMat.diffuseColor = wallColor;

  const roofMat = new BABYLON.StandardMaterial("roofMat_h_" + x + z, scene);
  roofMat.diffuseColor = roofColor;

  const doorMat = new BABYLON.StandardMaterial("doorMat_h_" + x + z, scene);
  doorMat.diffuseColor = new BABYLON.Color3(0.25, 0.14, 0.05);

  const winMat = new BABYLON.StandardMaterial("winMat_h_" + x + z, scene);
  winMat.diffuseColor  = new BABYLON.Color3(0.60, 0.82, 0.95);
  winMat.emissiveColor = new BABYLON.Color3(0.10, 0.18, 0.28);

  // Body
  const body = BABYLON.MeshBuilder.CreateBox("houseBody_" + x + z,
    { width: 2.4, height: 2.0, depth: 2.0 }, scene);
  body.position = new BABYLON.Vector3(x, 1.0, z);
  body.material = wallMat;

  // Pyramid roof
  const roof = BABYLON.MeshBuilder.CreateCylinder("houseRoof_" + x + z,
    { diameterTop: 0, diameterBottom: 3.0, height: 1.4, tessellation: 4 }, scene);
  roof.position = new BABYLON.Vector3(x, 2.7, z);
  roof.rotation.y = Math.PI / 4;
  roof.material = roofMat;

  // Door
  const door = BABYLON.MeshBuilder.CreateBox("houseDoor_" + x + z,
    { width: 0.45, height: 0.80, depth: 0.12 }, scene);
  door.position = new BABYLON.Vector3(x, 0.40, z + 1.06);
  door.material = doorMat;

  // Two windows
  for (const wx of [-0.65, 0.65]) {
    const win = BABYLON.MeshBuilder.CreateBox("houseWin_" + x + z + wx,
      { width: 0.38, height: 0.38, depth: 0.10 }, scene);
    win.position = new BABYLON.Vector3(x + wx, 1.2, z + 1.06);
    win.material = winMat;
  }
}

function _buildLetterDecoration(scene, x, z, letter) {
  const board = BABYLON.MeshBuilder.CreateBox("letterDec_" + x + z,
    { width: 0.7, height: 0.7, depth: 0.10 }, scene);
  board.position = new BABYLON.Vector3(x, 1.2, z);
  board.rotation.y = Math.random() * Math.PI;

  try {
    const dt = new BABYLON.DynamicTexture("letterDecTex_" + x + z, { width: 64, height: 64 }, scene, false);
    const ctx = dt.getContext();
    ctx.fillStyle = "#0d2a28";
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = "#40ffdd";
    ctx.font = "bold 44px Arial";
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(letter, 32, 34);
    dt.update();
    const m = new BABYLON.StandardMaterial("ldm_" + x + z, scene);
    m.diffuseTexture  = dt;
    m.emissiveTexture = dt;
    board.material = m;
  } catch(e) {
    const m = new BABYLON.StandardMaterial("ldm_" + x + z, scene);
    m.diffuseColor = new BABYLON.Color3(0.1, 0.7, 0.6);
    board.material = m;
  }
}

// ── Dog ───────────────────────────────────────────────────────────────────────
// homeX, homeZ = center of wander area; wanderR = max radius; id = unique int
function _buildDog(scene, homeX, homeZ, wanderR, id) {
  const N = "d" + id;
  const bodyMat = new BABYLON.StandardMaterial("dogMat" + N, scene);
  bodyMat.diffuseColor = new BABYLON.Color3(0.72, 0.52, 0.28);

  const root = new BABYLON.TransformNode("dogRoot" + N, scene);
  root.position = new BABYLON.Vector3(homeX, 0, homeZ);

  function part(tag, w, h, d, px, py, pz) {
    const m = BABYLON.MeshBuilder.CreateBox(tag + N,
      { width: w, height: h, depth: d }, scene);
    m.material = bodyMat;
    m.parent   = root;
    m.position = new BABYLON.Vector3(px, py, pz);
    return m;
  }

  part("dB",  0.55, 0.35, 0.90,  0,     0.38, 0);
  part("dH",  0.38, 0.32, 0.38,  0,     0.62, 0.40);
  part("dSn", 0.22, 0.18, 0.22,  0,     0.55, 0.62);
  part("dEL", 0.10, 0.20, 0.12, -0.18,  0.78, 0.38);
  part("dER", 0.10, 0.20, 0.12,  0.18,  0.78, 0.38);

  const tailPivot = new BABYLON.TransformNode("dTP" + N, scene);
  tailPivot.parent   = root;
  tailPivot.position = new BABYLON.Vector3(0, 0.55, -0.45);
  const tailMesh = BABYLON.MeshBuilder.CreateBox("dTl" + N,
    { width: 0.10, height: 0.35, depth: 0.10 }, scene);
  tailMesh.material = bodyMat;
  tailMesh.parent   = tailPivot;
  tailMesh.position = new BABYLON.Vector3(0, 0.18, 0);

  const legOffsets = [[-0.18,0.28],[0.18,0.28],[-0.18,-0.28],[0.18,-0.28]];
  const legPivots = legOffsets.map(([ox, oz], i) => {
    const piv = new BABYLON.TransformNode("dLP" + i + N, scene);
    piv.parent   = root;
    piv.position = new BABYLON.Vector3(ox, 0.30, oz);
    const leg = BABYLON.MeshBuilder.CreateBox("dLg" + i + N,
      { width: 0.12, height: 0.30, depth: 0.12 }, scene);
    leg.material = bodyMat;
    leg.parent   = piv;
    leg.position = new BABYLON.Vector3(0, -0.15, 0);
    return piv;
  });

  let walkT  = Math.random() * Math.PI * 2;
  let curX   = homeX, curZ = homeZ;
  let angle  = Math.random() * Math.PI * 2;
  let timer  = Math.floor(Math.random() * 60);
  const SPD  = 0.028;

  return {
    update() {
      try {
        walkT += 0.08;
        timer++;
        // Randomly change direction every 60-120 frames
        if (timer > 60 + Math.random() * 60) {
          angle += (Math.random() - 0.5) * Math.PI * 1.2;
          timer = 0;
        }
        const nx = curX + Math.cos(angle) * SPD;
        const nz = curZ + Math.sin(angle) * SPD;
        const distHome = Math.sqrt((nx - homeX) ** 2 + (nz - homeZ) ** 2);
        if (distHome > wanderR) {
          // Steer back toward home
          angle = Math.atan2(homeZ - curZ, homeX - curX) + (Math.random() - 0.5) * 0.5;
        } else {
          curX = nx; curZ = nz;
        }
        root.position.x = curX;
        root.position.z = curZ;
        root.rotation.y = -(angle - Math.PI / 2);

        const swing = Math.sin(walkT) * 0.5;
        legPivots[0].rotation.x =  swing;
        legPivots[1].rotation.x = -swing;
        legPivots[2].rotation.x = -swing;
        legPivots[3].rotation.x =  swing;
        tailPivot.rotation.z = Math.sin(walkT * 2) * 0.5;
      } catch(e) {}
    }
  };
}

// ── Cat ───────────────────────────────────────────────────────────────────────
function _buildCat(scene, homeX, homeZ, wanderR, id) {
  const N = "c" + id;
  const bodyMat = new BABYLON.StandardMaterial("catMat" + N, scene);
  bodyMat.diffuseColor = new BABYLON.Color3(0.80, 0.75, 0.90); // grey-lavender

  const root = new BABYLON.TransformNode("catRoot" + N, scene);
  root.position = new BABYLON.Vector3(homeX, 0, homeZ);

  function part(tag, w, h, d, px, py, pz) {
    const m = BABYLON.MeshBuilder.CreateBox(tag + N,
      { width: w, height: h, depth: d }, scene);
    m.material = bodyMat;
    m.parent   = root;
    m.position = new BABYLON.Vector3(px, py, pz);
    return m;
  }

  // Body (slimmer than dog)
  part("cB",  0.40, 0.28, 0.70,  0,     0.32, 0);
  // Head (rounder)
  part("cH",  0.34, 0.34, 0.32,  0,     0.55, 0.28);
  // Pointy ears
  const earMat = new BABYLON.StandardMaterial("cEarMat" + N, scene);
  earMat.diffuseColor = new BABYLON.Color3(0.95, 0.72, 0.80);
  for (const ex of [-0.14, 0.14]) {
    const ear = BABYLON.MeshBuilder.CreateCylinder("cEar" + ex + N,
      { diameterTop: 0, diameterBottom: 0.12, height: 0.22, tessellation: 3 }, scene);
    ear.material = earMat;
    ear.parent   = root;
    ear.position = new BABYLON.Vector3(ex, 0.76, 0.28);
  }
  // Tail pivot
  const tailPivot = new BABYLON.TransformNode("cTP" + N, scene);
  tailPivot.parent   = root;
  tailPivot.position = new BABYLON.Vector3(0, 0.40, -0.35);
  const tailMesh = BABYLON.MeshBuilder.CreateBox("cTl" + N,
    { width: 0.08, height: 0.45, depth: 0.08 }, scene);
  tailMesh.material = bodyMat;
  tailMesh.parent   = tailPivot;
  tailMesh.position = new BABYLON.Vector3(0, 0.22, 0);
  tailPivot.rotation.z = 0.5;

  // Legs
  const legOffsets = [[-0.14,0.22],[0.14,0.22],[-0.14,-0.22],[0.14,-0.22]];
  const legPivots = legOffsets.map(([ox, oz], i) => {
    const piv = new BABYLON.TransformNode("cLP" + i + N, scene);
    piv.parent   = root;
    piv.position = new BABYLON.Vector3(ox, 0.22, oz);
    const leg = BABYLON.MeshBuilder.CreateBox("cLg" + i + N,
      { width: 0.09, height: 0.24, depth: 0.09 }, scene);
    leg.material = bodyMat;
    leg.parent   = piv;
    leg.position = new BABYLON.Vector3(0, -0.12, 0);
    return piv;
  });

  let walkT = Math.random() * Math.PI * 2;
  let curX  = homeX, curZ = homeZ;
  let angle = Math.random() * Math.PI * 2;
  let timer = Math.floor(Math.random() * 60);
  const SPD = 0.022;

  return {
    update() {
      try {
        walkT += 0.07;
        timer++;
        // Randomly change direction every 70-130 frames
        if (timer > 70 + Math.random() * 60) {
          angle += (Math.random() - 0.5) * Math.PI * 1.4;
          timer = 0;
        }
        const nx = curX + Math.cos(angle) * SPD;
        const nz = curZ + Math.sin(angle) * SPD;
        const distHome = Math.sqrt((nx - homeX) ** 2 + (nz - homeZ) ** 2);
        if (distHome > wanderR) {
          angle = Math.atan2(homeZ - curZ, homeX - curX) + (Math.random() - 0.5) * 0.5;
        } else {
          curX = nx; curZ = nz;
        }
        root.position.x = curX;
        root.position.z = curZ;
        root.rotation.y = -(angle - Math.PI / 2);

        const swing = Math.sin(walkT) * 0.45;
        legPivots[0].rotation.x =  swing;
        legPivots[1].rotation.x = -swing;
        legPivots[2].rotation.x = -swing;
        legPivots[3].rotation.x =  swing;
        tailPivot.rotation.z = 0.5 + Math.sin(walkT * 1.5) * 0.4;
      } catch(e) {}
    }
  };
}
