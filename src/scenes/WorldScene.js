/**
 * WorldScene.js
 * Overworld: rich animated ocean, gradient sky dome, two detailed islands,
 * floating clouds, and improved castle exteriors.
 */

import { createPlayer } from "../entities/Player.js";
import { SaveManager }   from "../utils/SaveManager.js";
import { loadCharacterModel, playAnimation } from "../utils/loadCharacterModel.js";
import { NPC_CHARACTERS, NPC_PRESETS } from "../data/characters.js";
import { medMaterial, placeMedieval, placeMany } from "../utils/MedievalLoader.js";


const BABYLON = window.BABYLON;

export function createWorldScene(engine, onEnterMath, onEnterLang, onEnterLetters, onEnterNumbers) {
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.38, 0.68, 0.95, 1);

  // Slight fog for depth
  scene.fogMode    = BABYLON.Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.008;
  scene.fogColor   = new BABYLON.Color3(0.55, 0.78, 0.98);

  let switching = false;
  let lastNearIsland = null;

  // ── Lighting ──────────────────────────────────────────────────────────────
  const sun = new BABYLON.HemisphericLight("sun", new BABYLON.Vector3(0.4, 1, 0.2), scene);
  sun.intensity    = 1.2;
  sun.diffuse      = new BABYLON.Color3(1.0, 0.97, 0.88);
  sun.groundColor  = new BABYLON.Color3(0.25, 0.45, 0.6);

  const sunDir = new BABYLON.DirectionalLight("sunDir", new BABYLON.Vector3(-0.5, -1, -0.3), scene);
  sunDir.intensity = 0.6;
  sunDir.diffuse   = new BABYLON.Color3(1.0, 0.95, 0.80);

  // ── Ocean ─────────────────────────────────────────────────────────────────
  const ocean = BABYLON.MeshBuilder.CreateGround("ocean",
    { width: 280, height: 280, subdivisions: 4 }, scene);
  const oceanMat = new BABYLON.StandardMaterial("oceanMat", scene);
  oceanMat.diffuseColor  = new BABYLON.Color3(0.08, 0.42, 0.72);
  oceanMat.specularColor = new BABYLON.Color3(0.8, 0.9, 1.0);
  oceanMat.specularPower = 64;
  ocean.material = oceanMat;

  // Animated ocean color (no vertex displacement — safe on all platforms)
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
  _buildFoamRing(scene, -30,   0, 13.5);  // Math Island
  _buildFoamRing(scene,  30,   0, 13.5);  // Language Island
  _buildFoamRing(scene,   0, -55, 13.5);  // Letters Island
  _buildFoamRing(scene,   0,  55, 13.5);  // Numbers Island (was missing)

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
  _buildNumbersIsland(scene);

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
  // Horses near Math Island
  animals.push(_buildHorse(scene, -26,  4, 7, 8));
  animals.push(_buildHorse(scene, -34, -4, 7, 9));
  // Cows near Lang Island
  animals.push(_buildCow(scene,  26,  4, 7, 10));
  animals.push(_buildCow(scene,  34, -4, 7, 11));
  // Horse + cow near Numbers Island (z≈55)
  animals.push(_buildHorse(scene,  -4, 57, 5, 12));
  animals.push(_buildCow(scene,    4, 53, 5, 13));
  animals.push(_buildCow(scene,   -4, 53, 5, 14));

  // ── Treasure chests near each island ─────────────────────────────────────
  _buildTreasureChest(scene, -22,   4);   // Math Island
  _buildTreasureChest(scene,  22,   4);   // Language Island
  _buildTreasureChest(scene,   4, -48);   // Letters Island
  _buildTreasureChest(scene,  -4,  48);   // Numbers Island

  // ── Animated seagulls ────────────────────────────────────────────────────
  const seagulls = [
    _buildSeagull(scene,  -8, 16,  10,  0.012, 0),
    _buildSeagull(scene,  10, 20, -12,  0.009, 1),
    _buildSeagull(scene, -18, 14,  -5,  0.011, 2),
    _buildSeagull(scene,   5, 18,  20,  0.010, 3),
  ];

  // ── Player ────────────────────────────────────────────────────────────────
  const player = createPlayer(scene);
  player.mesh.position    = new BABYLON.Vector3(0, 0.5, 0);
  player.camera.alpha     = Math.PI / 2;   // face toward Letters Island (-Z)
  player.camera.beta      = Math.PI / 2.3; // more horizontal view

  // ── Decorative NPCs near islands (GLB if available, otherwise skipped) ────
  _spawnNPCs(scene);

  // ── HUD ───────────────────────────────────────────────────────────────────
  const hudLocation = document.getElementById("hud-location");
  const hudCrowns   = document.getElementById("hud-crowns");
  let _lastCrownsText = "";

  function updateHUD() {
    const save = SaveManager.load();
    const crowns = [
      save.mathIsland.crownEarned     ? "👑🔢" : "",
      save.languageIsland.crownEarned ? "👑🔤" : "",
      (save.lettersIsland  && save.lettersIsland.crownEarned)  ? "👑🔡" : "",
      (save.numbersIsland  && save.numbersIsland.crownEarned)  ? "👑🔟" : ""
    ].filter(Boolean).join("  ");
    if (crowns !== _lastCrownsText) {
      _lastCrownsText = crowns;
      hudCrowns.textContent = crowns;
    }
  }
  updateHUD();

  // ── Cloud drift animation ─────────────────────────────────────────────────
  const clouds = scene.meshes.filter(m => m.name.startsWith("cloud_"));
  let cloudT = 0;

  // ── Proximity / triggers ──────────────────────────────────────────────────

  scene.registerBeforeRender(() => {
    try {
      player.update();
      cloudT += 0.003;

      // Drift clouds slowly
      clouds.forEach((c, i) => {
        c.position.x += Math.sin(cloudT + i) * 0.005;
      });

      // Update animals (isolated so errors never block door triggers)
      animals.forEach(a => { try { a.update(); } catch(e) { console.warn("Animal update error:", e); } });

      // Animate seagulls
      seagulls.forEach(s => { try { s.update(); } catch(e) { console.warn("Seagull update error:", e); } });

      const px = player.mesh.position;

      // Use 2D horizontal distance (no per-frame Vector3 allocations)
      const distMath    = Math.sqrt((px.x + 30) * (px.x + 30) + px.z * px.z);
      const distLang    = Math.sqrt((px.x - 30) * (px.x - 30) + px.z * px.z);
      const distLetters = Math.sqrt(px.x * px.x + (px.z + 55) * (px.z + 55));
      const distNums    = Math.sqrt(px.x * px.x + (px.z - 55) * (px.z - 55));

      if (distMath < 15) {
        if (lastNearIsland !== "math")    { lastNearIsland = "math";    hudLocation.textContent = "🔢 Math Island"; }
      } else if (distLang < 15) {
        if (lastNearIsland !== "lang")    { lastNearIsland = "lang";    hudLocation.textContent = "🔤 Language Island"; }
      } else if (distLetters < 15) {
        if (lastNearIsland !== "letters") { lastNearIsland = "letters"; hudLocation.textContent = "🔡 Letters Island"; }
      } else if (distNums < 15) {
        if (lastNearIsland !== "numbers") { lastNearIsland = "numbers"; hudLocation.textContent = "🔟 Numbers Island"; }
      } else {
        if (lastNearIsland !== null) { lastNearIsland = null; hudLocation.textContent = "🌊 Open Ocean"; }
      }

      if (!switching && distMath < 10) {
        switching = true; setTimeout(() => onEnterMath(), 0);
      } else if (!switching && distLang < 10) {
        switching = true; setTimeout(() => onEnterLang(), 0);
      } else if (!switching && onEnterLetters && distLetters < 10) {
        switching = true; setTimeout(() => onEnterLetters(), 0);
      } else if (!switching && onEnterNumbers && distNums < 10) {
        switching = true; setTimeout(() => onEnterNumbers(), 0);
      }

      updateHUD();
    } catch (e) {
      console.error("WorldScene render error:", e);
    }
  });

  // ── Deferred GLTF decoration loading ─────────────────────────────────────
  // Load procedural world first (instant), then lazy-load GLTF models after
  // the first frames have rendered so the player sees the world immediately.
  setTimeout(() => {
    _decorateMedievalIsland(scene, -30,   0);  // Math Island
    _decorateMedievalIsland(scene,  30,   0);  // Language Island
    _decorateMedievalIsland(scene,   0, -55);  // Letters Island
    _decorateMedievalIsland(scene,   0,  55);  // Numbers Island
  }, 100);

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
  const OX = -30, OZ = 0;

  // Layered ground: sandy base + grassy top
  _buildIslandGround(scene, OX, OZ, "math",
    new BABYLON.Color3(0.92, 0.82, 0.58), // sand
    new BABYLON.Color3(0.28, 0.70, 0.18)  // grass
  );

  // Rocky cliffs around edge
  _buildRocks(scene, OX, OZ, new BABYLON.Color3(0.55, 0.50, 0.42), 8);

  // Castle
  _buildCastle(scene, OX, OZ,
    new BABYLON.Color3(0.82, 0.76, 0.58),  // warm sandstone
    new BABYLON.Color3(0.58, 0.48, 0.30),  // darker stone
    new BABYLON.Color3(0.65, 0.12, 0.12)   // red roofs
  );

  // Flag on castle
  _buildFlag(scene, OX, OZ + 0, new BABYLON.Color3(1.0, 0.85, 0.1), "🔢");

  // Sign
  _buildSign(scene, OX, OZ + 7.5, "Math Island 🔢", new BABYLON.Color3(0.95, 0.85, 0.2));

  // Palm trees
  const treePositions = [[-4,-5],[4,-5],[-6,2],[6,2],[0,-8],[-5,0],[5,0]];
  treePositions.forEach(([tx, tz]) => {
    _buildPalmTree(scene, OX + tx, OZ + tz, new BABYLON.Color3(0.12, 0.72, 0.12));
  });

  // Lamp posts along path
  _buildLampPost(scene, OX - 1.2, OZ + 3.5, new BABYLON.Color3(1.0, 0.95, 0.6));
  _buildLampPost(scene, OX + 1.2, OZ + 3.5, new BABYLON.Color3(1.0, 0.95, 0.6));
}

// ── Language Island ───────────────────────────────────────────────────────────
function _buildLangIsland(scene) {
  const OX = 30, OZ = 0;

  _buildIslandGround(scene, OX, OZ, "lang",
    new BABYLON.Color3(0.88, 0.78, 0.60),
    new BABYLON.Color3(0.35, 0.22, 0.68)  // purple grass
  );

  _buildRocks(scene, OX, OZ, new BABYLON.Color3(0.42, 0.38, 0.55), 8);

  _buildCastle(scene, OX, OZ,
    new BABYLON.Color3(0.52, 0.60, 0.85),  // blue-grey stone
    new BABYLON.Color3(0.30, 0.38, 0.62),
    new BABYLON.Color3(0.45, 0.10, 0.68)   // purple roofs
  );

  _buildFlag(scene, OX, OZ + 0, new BABYLON.Color3(0.5, 0.85, 1.0), "🔤");

  _buildSign(scene, OX, OZ + 7.5, "Language Island 🔤", new BABYLON.Color3(0.5, 0.85, 1.0));

  const treePositions = [[-4,-5],[4,-5],[-6,2],[6,2],[0,-8],[-5,0],[5,0]];
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
  // Castle walls — UnevenBrick texture (keeps the color theme as tint)
  const mat = medMaterial(scene, "UnevenBrick", "castleMat_" + cx, 3, 2);
  mat.diffuseColor = wallColor;   // tints the texture with the island theme colour

  // Tower body — RockTrim texture
  const towerMat = medMaterial(scene, "RockTrim", "towerMat_" + cx, 2, 3);
  towerMat.diffuseColor = towerColor;

  // Roofs — RoundTiles texture
  const roofMat = medMaterial(scene, "RoundTiles", "roofMat_" + cx, 2, 2);
  roofMat.diffuseColor = roofColor;

  // Battlements — slightly darker UnevenBrick
  const battleMat = medMaterial(scene, "UnevenBrick", "battleMat_" + cx, 2, 1);
  battleMat.diffuseColor = new BABYLON.Color3(
    towerColor.r * 0.85, towerColor.g * 0.85, towerColor.b * 0.85);

  // Main body
  const body = BABYLON.MeshBuilder.CreateBox("castleBody_" + cx,
    { width: 6.5, height: 4.5, depth: 5.5 }, scene);
  body.position = new BABYLON.Vector3(cx, 2.25, cz);
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
  [[-3.25, -2.75], [3.25, -2.75], [-3.25, 2.75], [3.25, 2.75]].forEach(([tx, tz], i) => {
    const tower = BABYLON.MeshBuilder.CreateCylinder("tower_" + cx + i,
      { diameter: 1.6, height: 6.5, tessellation: 10 }, scene);
    tower.position = new BABYLON.Vector3(cx + tx, 3.25, cz + tz);
    tower.material = towerMat;

    // Conical roof
    const roof = BABYLON.MeshBuilder.CreateCylinder("roof_" + cx + i,
      { diameterTop: 0, diameterBottom: 1.9, height: 1.8, tessellation: 10 }, scene);
    roof.position = new BABYLON.Vector3(cx + tx, 7.4, cz + tz);
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

  // Main door arch (dark inset)
  const doorMat = new BABYLON.StandardMaterial("doorMat_" + cx, scene);
  doorMat.diffuseColor = new BABYLON.Color3(0.10, 0.06, 0.02);
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

  // Curved trunk using tapered cylinder
  const trunk = BABYLON.MeshBuilder.CreateCylinder("palmTrunk_" + x + z,
    { diameterTop: 0.18, diameterBottom: 0.30, height: 2.8, tessellation: 8 }, scene);
  trunk.position = new BABYLON.Vector3(x, 1.4, z);
  trunk.rotation.z = 0.12; // slight lean
  trunk.material = trunkMat;

  // Coconut bunch
  const coconutMat = new BABYLON.StandardMaterial("coconut_" + x + z, scene);
  coconutMat.diffuseColor = new BABYLON.Color3(0.30, 0.18, 0.05);

  // Fronds (multiple thin flat boxes radiating out)
  const frondAngles = [0, 72, 144, 216, 288];
  frondAngles.forEach((deg, i) => {
    const rad = (deg * Math.PI) / 180;
    const frond = BABYLON.MeshBuilder.CreateBox("frond_" + x + z + i,
      { width: 0.12, height: 0.06, depth: 1.8 }, scene);
    frond.position = new BABYLON.Vector3(
      x + Math.sin(rad) * 0.85,
      2.9,
      z + Math.cos(rad) * 0.85
    );
    frond.rotation.y = rad;
    frond.rotation.z = -0.45; // droop
    frond.material = leafMat;
  });

  // Round leaf canopy on top
  const canopy = BABYLON.MeshBuilder.CreateSphere("canopy_" + x + z,
    { diameterX: 2.4, diameterY: 0.8, diameterZ: 2.4, segments: 6 }, scene);
  canopy.position = new BABYLON.Vector3(x, 3.05, z);
  canopy.material = leafMat;
}

function _buildFlag(scene, cx, cz, color, label) {
  const poleMat = new BABYLON.StandardMaterial("poleMat_" + cx, scene);
  poleMat.diffuseColor = new BABYLON.Color3(0.75, 0.65, 0.45);

  const pole = BABYLON.MeshBuilder.CreateCylinder("flagPole_" + cx,
    { diameter: 0.1, height: 3.5, tessellation: 8 }, scene);
  pole.position = new BABYLON.Vector3(cx, 6.75, cz - 3.25);
  pole.material = poleMat;

  const flagMat = new BABYLON.StandardMaterial("flagMat_" + cx, scene);
  flagMat.diffuseColor = color;
  flagMat.emissiveColor = new BABYLON.Color3(color.r * 0.3, color.g * 0.3, color.b * 0.3);

  const flag = BABYLON.MeshBuilder.CreateBox("flag_" + cx,
    { width: 1.4, height: 0.7, depth: 0.05 }, scene);
  flag.position = new BABYLON.Vector3(cx + 0.72, 7.9, cz - 3.25);
  flag.material = flagMat;

  // Wave flag animation
  let flagT = Math.random() * Math.PI * 2;
  scene.registerBeforeRender(() => {
    flagT += 0.05;
    flag.rotation.y = Math.sin(flagT) * 0.12;
    flag.position.x = cx + 0.72 + Math.sin(flagT) * 0.05;
  });
}

function _buildLampPost(scene, x, z, glowColor) {
  const metalMat = new BABYLON.StandardMaterial("lamp_" + x, scene);
  metalMat.diffuseColor = new BABYLON.Color3(0.3, 0.28, 0.22);

  const post = BABYLON.MeshBuilder.CreateCylinder("lampPost_" + x,
    { diameter: 0.12, height: 2.8, tessellation: 8 }, scene);
  post.position = new BABYLON.Vector3(x, 1.4, z);
  post.material = metalMat;

  const globe = BABYLON.MeshBuilder.CreateSphere("lampGlobe_" + x,
    { diameter: 0.4, segments: 6 }, scene);
  globe.position = new BABYLON.Vector3(x, 2.9, z);
  const globeMat = new BABYLON.StandardMaterial("globeMat_" + x, scene);
  globeMat.diffuseColor  = glowColor;
  globeMat.emissiveColor = glowColor;
  globe.material = globeMat;

  const glow = new BABYLON.PointLight("lampLight_" + x, new BABYLON.Vector3(x, 2.9, z), scene);
  glow.diffuse    = glowColor;
  glow.intensity  = 0.5;
  glow.range      = 6;
}

function _buildSign(scene, x, z, text, color) {
  const postMat = new BABYLON.StandardMaterial("signPost_" + x, scene);
  postMat.diffuseColor = new BABYLON.Color3(0.45, 0.28, 0.1);

  const post = BABYLON.MeshBuilder.CreateCylinder("signPost_" + x,
    { diameter: 0.15, height: 2.2, tessellation: 8 }, scene);
  post.position = new BABYLON.Vector3(x, 1.1, z);
  post.material = postMat;

  const board = BABYLON.MeshBuilder.CreateBox("signBoard_" + x,
    { width: 4.2, height: 1.4, depth: 0.14 }, scene);
  board.position = new BABYLON.Vector3(x, 2.6, z);

  let title    = text;
  let subtitle = "Enter the castle!";
  if (text.includes("Math"))     subtitle = "Solve math puzzles inside!";
  if (text.includes("Language")) subtitle = "Answer language questions!";
  if (text.includes("Letters"))  subtitle = "Collect letters in order!";
  if (text.includes("Numbers"))  subtitle = "Count and sort numbers!";

  const dt  = new BABYLON.DynamicTexture("signTex_" + x, { width: 512, height: 180 }, scene);
  const ctx = dt.getContext();

  // Pre-flip canvas: signs face player from +Z, box +Z face is h+v flipped → cancel both
  ctx.save();
  ctx.translate(512, 180);
  ctx.scale(-1, -1);

  // Background
  ctx.fillStyle = "#1a0e04";
  ctx.fillRect(0, 0, 512, 180);

  // Border
  const hex = (v) => Math.max(0, Math.min(255, Math.floor(v * 255))).toString(16).padStart(2, "0");
  const borderCol = "#" + hex(color.r) + hex(color.g) + hex(color.b);
  ctx.strokeStyle = borderCol;
  ctx.lineWidth = 5;
  ctx.strokeRect(5, 5, 502, 170);

  // Title  (strip emoji for canvas compatibility)
  const titleText = text.replace(/[^\x00-\x7F]/g, "").trim();
  ctx.fillStyle = borderCol;
  ctx.font = "bold 52px Arial";
  ctx.textAlign = "center";
  ctx.fillText(titleText, 256, 76);

  // Subtitle
  ctx.fillStyle = "#eeeeee";
  ctx.font = "28px Arial";
  ctx.fillText(subtitle, 256, 142);

  ctx.restore();
  dt.update();

  const boardMat = new BABYLON.StandardMaterial("boardMat_" + x, scene);
  boardMat.diffuseColor   = color;
  boardMat.diffuseTexture = dt;
  boardMat.emissiveTexture = dt;
  boardMat.emissiveColor  = new BABYLON.Color3(color.r * 0.18, color.g * 0.18, color.b * 0.18);
  boardMat.backFaceCulling = false;
  board.material = boardMat;
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

// ── Numbers Island ─────────────────────────────────────────────────────────────
function _buildNumbersIsland(scene) {
  const OX = 0, OZ = 55;

  _buildIslandGround(scene, OX, OZ, "numbers",
    new BABYLON.Color3(0.90, 0.88, 0.65),  // warm golden sand
    new BABYLON.Color3(0.18, 0.32, 0.72)   // deep blue grass
  );

  _buildRocks(scene, OX, OZ, new BABYLON.Color3(0.28, 0.38, 0.60), 8);

  _buildCastle(scene, OX, OZ,
    new BABYLON.Color3(0.32, 0.42, 0.78),  // navy stone
    new BABYLON.Color3(0.20, 0.30, 0.60),  // darker blue
    new BABYLON.Color3(0.72, 0.58, 0.10)   // gold roofs
  );

  _buildFlag(scene, OX, OZ + 0, new BABYLON.Color3(0.90, 0.80, 0.20), "🔢");
  _buildSign(scene, OX, OZ + 7.5, "Numbers Island", new BABYLON.Color3(0.90, 0.80, 0.20));

  const treePositions = [[-4,-5],[4,-5],[-6,2],[6,2],[0,-8],[-5,0],[5,0]];
  treePositions.forEach(([tx, tz]) => {
    _buildPalmTree(scene, OX + tx, OZ + tz, new BABYLON.Color3(0.18, 0.45, 0.82));
  });

  _buildLampPost(scene, OX - 1.2, OZ + 3.5, new BABYLON.Color3(0.90, 0.80, 0.20));
  _buildLampPost(scene, OX + 1.2, OZ + 3.5, new BABYLON.Color3(0.90, 0.80, 0.20));
}

// ── Medieval island decoration (async / fire-and-forget) ────────────────────
// Enhanced prop set — realistic medieval decorations loaded after world is visible.
function _decorateMedievalIsland(scene, cx, cz) {
  const jobs = [];

  // Tower roofs (sit on top of existing procedural towers)
  const towerOffsets = [[-3.25, -2.75], [3.25, -2.75], [-3.25, 2.75], [3.25, 2.75]];
  for (const [tx, tz] of towerOffsets) {
    jobs.push(placeMedieval(scene, "Roof_Tower_RoundTiles",
      cx + tx, 6.55, cz + tz, 0, 1.05));
  }

  // Castle entrance door frame
  jobs.push(placeMedieval(scene, "DoorFrame_Round_Brick",
    cx, 0.05, cz + 2.95, 0, 0.95));

  // Wall arch above entrance
  jobs.push(placeMedieval(scene, "Wall_Arch",
    cx, 2.55, cz + 2.95, 0, 0.80));

  // Open window shutters on front wall
  jobs.push(placeMedieval(scene, "WindowShutters_Wide_Round_Open",
    cx - 2.0, 2.8, cz + 2.88, 0, 0.55));
  jobs.push(placeMedieval(scene, "WindowShutters_Wide_Round_Open",
    cx + 2.0, 2.8, cz + 2.88, 0, 0.55));

  // Balcony on front face
  jobs.push(placeMedieval(scene, "Balcony_Simple_Straight",
    cx, 3.6, cz + 3.0, 0, 0.60));

  // Wooden crate near entrance
  jobs.push(placeMedieval(scene, "Prop_Crate",
    cx + 1.8, 0.0, cz + 4.2, 0.3, 0.50));

  // Chimney on roof
  jobs.push(placeMedieval(scene, "Prop_Chimney",
    cx - 1.5, 4.5, cz - 1.0, 0, 0.55));

  // Vines on side walls for organic feel
  jobs.push(placeMedieval(scene, "Prop_Vine1",
    cx - 3.3, 2.0, cz + 1.5, 0, 0.65));
  jobs.push(placeMedieval(scene, "Prop_Vine2",
    cx + 3.3, 2.0, cz - 1.5, Math.PI, 0.65));

  // Metal fence on one side of the castle entrance path
  jobs.push(placeMedieval(scene, "Prop_MetalFence_Ornament",
    cx - 1.8, 0.0, cz + 5.5, 0, 0.50));
  jobs.push(placeMedieval(scene, "Prop_MetalFence_Ornament",
    cx + 1.8, 0.0, cz + 5.5, 0, 0.50));

  Promise.all(jobs).catch(e => console.warn("[MedievalDecor] Batch load error:", e));
}

// ── Horse ──────────────────────────────────────────────────────────────────────
function _buildHorse(scene, homeX, homeZ, wanderR, id) {
  const N = "h" + id;
  const bodyMat = new BABYLON.StandardMaterial("horseMat" + N, scene);
  bodyMat.diffuseColor = new BABYLON.Color3(0.62, 0.38, 0.14);

  const maneMat = new BABYLON.StandardMaterial("horseMane" + N, scene);
  maneMat.diffuseColor = new BABYLON.Color3(0.28, 0.16, 0.05);

  const root = new BABYLON.TransformNode("horseRoot" + N, scene);
  root.position = new BABYLON.Vector3(homeX, 0, homeZ);

  function part(tag, w, h, d, px, py, pz, mat) {
    const m = BABYLON.MeshBuilder.CreateBox(tag + N,
      { width: w, height: h, depth: d }, scene);
    m.material = mat || bodyMat;
    m.parent   = root;
    m.position = new BABYLON.Vector3(px, py, pz);
    return m;
  }

  // Body (larger than dog)
  part("hB",  0.80, 0.55, 1.50,  0,    0.80, 0);
  // Neck
  part("hNk", 0.28, 0.55, 0.28,  0,    1.10, 0.65);
  // Head
  part("hH",  0.32, 0.38, 0.55,  0,    1.42, 0.72);
  // Snout
  part("hSn", 0.20, 0.22, 0.32,  0,    1.32, 1.02);
  // Mane (series of small blocks)
  for (let mi = 0; mi < 4; mi++) {
    part("hMn" + mi, 0.12, 0.28, 0.12,
      -0.04, 1.18 + mi * 0.10, 0.55 - mi * 0.08, maneMat);
  }
  // Ears
  part("hEL", 0.10, 0.22, 0.10, -0.14, 1.68, 0.76);
  part("hER", 0.10, 0.22, 0.10,  0.14, 1.68, 0.76);
  // Tail
  const tailPivot = new BABYLON.TransformNode("hTP" + N, scene);
  tailPivot.parent   = root;
  tailPivot.position = new BABYLON.Vector3(0, 0.90, -0.75);
  const tailMesh = BABYLON.MeshBuilder.CreateBox("hTl" + N,
    { width: 0.16, height: 0.52, depth: 0.16 }, scene);
  tailMesh.material = maneMat;
  tailMesh.parent   = tailPivot;
  tailMesh.position = new BABYLON.Vector3(0, 0.26, 0);

  // Legs (4 — tall)
  const legOffsets = [[-0.28,0.55],[0.28,0.55],[-0.28,-0.55],[0.28,-0.55]];
  const legPivots = legOffsets.map(([ox, oz], i) => {
    const piv = new BABYLON.TransformNode("hLP" + i + N, scene);
    piv.parent   = root;
    piv.position = new BABYLON.Vector3(ox, 0.50, oz);
    const leg = BABYLON.MeshBuilder.CreateBox("hLg" + i + N,
      { width: 0.17, height: 0.55, depth: 0.17 }, scene);
    leg.material = bodyMat;
    leg.parent   = piv;
    leg.position = new BABYLON.Vector3(0, -0.27, 0);
    return piv;
  });

  let walkT = Math.random() * Math.PI * 2;
  let curX  = homeX, curZ = homeZ;
  let angle = Math.random() * Math.PI * 2;
  let timer = Math.floor(Math.random() * 80);
  const SPD = 0.036;

  return {
    update() {
      try {
        walkT += 0.09;
        timer++;
        if (timer > 80 + Math.random() * 80) {
          angle += (Math.random() - 0.5) * Math.PI;
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

        const swing = Math.sin(walkT) * 0.55;
        legPivots[0].rotation.x =  swing;
        legPivots[1].rotation.x = -swing;
        legPivots[2].rotation.x = -swing;
        legPivots[3].rotation.x =  swing;
        tailPivot.rotation.z = Math.sin(walkT * 1.8) * 0.45;
      } catch(e) {}
    }
  };
}

// ── Cow ────────────────────────────────────────────────────────────────────────
function _buildCow(scene, homeX, homeZ, wanderR, id) {
  const N = "cw" + id;

  const whiteMat = new BABYLON.StandardMaterial("cowWhite" + N, scene);
  whiteMat.diffuseColor = new BABYLON.Color3(0.97, 0.97, 0.95);

  const spotMat = new BABYLON.StandardMaterial("cowSpot" + N, scene);
  spotMat.diffuseColor = new BABYLON.Color3(0.12, 0.12, 0.12);

  const pinkMat = new BABYLON.StandardMaterial("cowPink" + N, scene);
  pinkMat.diffuseColor = new BABYLON.Color3(0.95, 0.70, 0.72);

  const root = new BABYLON.TransformNode("cowRoot" + N, scene);
  root.position = new BABYLON.Vector3(homeX, 0, homeZ);

  function part(tag, w, h, d, px, py, pz, mat) {
    const m = BABYLON.MeshBuilder.CreateBox(tag + N,
      { width: w, height: h, depth: d }, scene);
    m.material = mat || whiteMat;
    m.parent   = root;
    m.position = new BABYLON.Vector3(px, py, pz);
    return m;
  }

  // Wide body
  part("cwB",  1.00, 0.65, 1.60,  0,    0.82, 0);
  // Neck
  part("cwNk", 0.32, 0.45, 0.32,  0,    1.08, 0.65);
  // Head (wide)
  part("cwH",  0.42, 0.40, 0.55,  0,    1.38, 0.70);
  // Snout/muzzle (pink)
  part("cwSn", 0.26, 0.22, 0.26,  0,    1.25, 1.00, pinkMat);
  // Horns
  for (const hx of [-0.22, 0.22]) {
    const horn = BABYLON.MeshBuilder.CreateCylinder("cwHorn" + hx + N,
      { diameterTop: 0.04, diameterBottom: 0.10, height: 0.30, tessellation: 6 }, scene);
    horn.material = whiteMat;
    horn.parent   = root;
    horn.position = new BABYLON.Vector3(hx, 1.66, 0.70);
    horn.rotation.z = hx > 0 ? 0.5 : -0.5;
  }
  // Ears
  part("cwEL", 0.12, 0.22, 0.10, -0.25, 1.52, 0.68);
  part("cwER", 0.12, 0.22, 0.10,  0.25, 1.52, 0.68);
  // Udder
  part("cwUd", 0.40, 0.22, 0.30,  0,    0.55, -0.30, pinkMat);
  // Dark spots on body
  part("cwSp1", 0.38, 0.32, 0.30, -0.20, 0.98, 0.25, spotMat);
  part("cwSp2", 0.28, 0.28, 0.25,  0.25, 0.90, -0.35, spotMat);

  // Tail
  const tailPivot = new BABYLON.TransformNode("cwTP" + N, scene);
  tailPivot.parent   = root;
  tailPivot.position = new BABYLON.Vector3(0, 0.95, -0.80);
  const tailMesh = BABYLON.MeshBuilder.CreateBox("cwTl" + N,
    { width: 0.12, height: 0.50, depth: 0.12 }, scene);
  tailMesh.material = whiteMat;
  tailMesh.parent   = tailPivot;
  tailMesh.position = new BABYLON.Vector3(0, 0.25, 0);

  // Legs (4 — stocky)
  const legOffsets = [[-0.34,0.60],[0.34,0.60],[-0.34,-0.60],[0.34,-0.60]];
  const legPivots = legOffsets.map(([ox, oz], i) => {
    const piv = new BABYLON.TransformNode("cwLP" + i + N, scene);
    piv.parent   = root;
    piv.position = new BABYLON.Vector3(ox, 0.50, oz);
    const leg = BABYLON.MeshBuilder.CreateBox("cwLg" + i + N,
      { width: 0.18, height: 0.55, depth: 0.18 }, scene);
    // Alternate white/spot coloring on legs
    leg.material = (i % 2 === 0) ? whiteMat : whiteMat;
    leg.parent   = piv;
    leg.position = new BABYLON.Vector3(0, -0.27, 0);
    return piv;
  });

  let walkT = Math.random() * Math.PI * 2;
  let curX  = homeX, curZ = homeZ;
  let angle = Math.random() * Math.PI * 2;
  let timer = Math.floor(Math.random() * 100);
  const SPD = 0.020;  // cows walk slowly

  return {
    update() {
      try {
        walkT += 0.06;
        timer++;
        if (timer > 90 + Math.random() * 100) {
          angle += (Math.random() - 0.5) * Math.PI * 0.9;
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

        const swing = Math.sin(walkT) * 0.40;
        legPivots[0].rotation.x =  swing;
        legPivots[1].rotation.x = -swing;
        legPivots[2].rotation.x = -swing;
        legPivots[3].rotation.x =  swing;
        tailPivot.rotation.z = Math.sin(walkT * 1.2) * 0.35;
      } catch(e) {}
    }
  };
}

// ───────────────────────────────────────────────────────────────────────────────
// DECORATIVE NPCs — fully procedural (no GLB needed)
// ───────────────────────────────────────────────────────────────────────────────

/** Spawn points: one greeter NPC per island */
const NPC_SPAWN_POINTS = [
  { x: -25, z:   5,  ry: -Math.PI * 0.15,  preset: 0 },  // Math Island
  { x:  25, z:   5,  ry:  Math.PI * 1.15,  preset: 1 },  // Language Island
  { x:   5, z: -50,  ry:  Math.PI * 0.05,  preset: 2 },  // Letters Island
  { x:  -5, z:  50,  ry: -Math.PI * 0.95,  preset: 3 },  // Numbers Island
];

function _spawnNPCs(scene) {
  NPC_SPAWN_POINTS.forEach((pt, i) => {
    const palette = NPC_PRESETS[pt.preset % NPC_PRESETS.length];
    _buildProceduralNPC(scene, pt.x, pt.z, pt.ry, palette, i);
  });
}

function _buildProceduralNPC(scene, x, z, rotY, palette, id) {
  const c3 = (arr) => new BABYLON.Color3(arr[0], arr[1], arr[2]);

  const skinMat  = new BABYLON.StandardMaterial("npcSkin_"  + id, scene);
  skinMat.diffuseColor  = c3(palette.skin);

  const shirtMat = new BABYLON.StandardMaterial("npcShirt_" + id, scene);
  shirtMat.diffuseColor = c3(palette.shirt);

  const pantsMat = new BABYLON.StandardMaterial("npcPants_" + id, scene);
  pantsMat.diffuseColor = c3(palette.pants);

  const hairMat  = new BABYLON.StandardMaterial("npcHair_"  + id, scene);
  hairMat.diffuseColor  = c3(palette.hair);

  const shoesMat = new BABYLON.StandardMaterial("npcShoes_" + id, scene);
  shoesMat.diffuseColor = new BABYLON.Color3(0.12, 0.08, 0.04);

  const box = (name, w, h, d, mat, px, py, pz, parent) => {
    const m = BABYLON.MeshBuilder.CreateBox(name + id, { width: w, height: h, depth: d }, scene);
    m.material = mat;
    if (parent) m.parent = parent;
    m.position.set(px, py, pz);
    return m;
  };

  const root = new BABYLON.TransformNode("npcRoot_" + id, scene);
  root.position.set(x, 0.5, z);
  root.rotation.y = rotY;

  const torso    = box("npcTorso_",   0.50, 0.60, 0.28, shirtMat, 0, 0.70, 0, root);
  // head
  const head     = box("npcHead_",    0.40, 0.40, 0.36, skinMat,  0, 1.17, 0, root);
  box("npcHair_",                      0.42, 0.09, 0.38, hairMat,  0, 1.40, 0, root);
  // eyes
  const eyeMat   = new BABYLON.StandardMaterial("npcEye_" + id, scene);
  eyeMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.1);
  box("npcEyeL_", 0.07, 0.07, 0.05, eyeMat, -0.10, 1.23, 0.17, root);
  box("npcEyeR_", 0.07, 0.07, 0.05, eyeMat,  0.10, 1.23, 0.17, root);
  // arms
  box("npcLArm_", 0.15, 0.55, 0.15, shirtMat, -0.34, 0.44, 0, root);
  box("npcRArm_", 0.15, 0.55, 0.15, shirtMat,  0.34, 0.44, 0, root);
  // legs
  box("npcLLeg_", 0.18, 0.52, 0.18, pantsMat,  -0.14, 0.09, 0, root);
  box("npcRLeg_", 0.18, 0.52, 0.18, pantsMat,   0.14, 0.09, 0, root);
  // feet
  box("npcLFoot_", 0.19, 0.09, 0.26, shoesMat, -0.14, -0.18, 0.03, root);
  box("npcRFoot_", 0.19, 0.09, 0.26, shoesMat,  0.14, -0.18, 0.03, root);

  // Idle breathing + gentle head bob
  let t = Math.random() * Math.PI * 2;  // stagger phase per NPC
  scene.registerBeforeRender(() => {
    t += 0.018;
    torso.position.y = 0.70 + Math.sin(t) * 0.012;
    head.position.y  = 1.17 + Math.sin(t) * 0.012;
  });
}

// ── Treasure Chest ────────────────────────────────────────────────────────────
function _buildTreasureChest(scene, x, z) {
  const woodMat = new BABYLON.StandardMaterial("chestWood_" + x + z, scene);
  woodMat.diffuseColor = new BABYLON.Color3(0.55, 0.32, 0.08);

  const metalMat = new BABYLON.StandardMaterial("chestMetal_" + x + z, scene);
  metalMat.diffuseColor  = new BABYLON.Color3(0.72, 0.60, 0.18);
  metalMat.specularColor = new BABYLON.Color3(1.0, 0.9, 0.4);
  metalMat.specularPower = 32;

  const goldMat = new BABYLON.StandardMaterial("chestGold_" + x + z, scene);
  goldMat.diffuseColor  = new BABYLON.Color3(1.0, 0.85, 0.15);
  goldMat.emissiveColor = new BABYLON.Color3(0.3, 0.22, 0.0);

  const base = BABYLON.MeshBuilder.CreateBox("chestBase_" + x + z,
    { width: 0.90, height: 0.55, depth: 0.62 }, scene);
  base.position = new BABYLON.Vector3(x, 0.28, z);
  base.material = woodMat;

  // Lid (slightly wider, raised)
  const lid = BABYLON.MeshBuilder.CreateBox("chestLid_" + x + z,
    { width: 0.92, height: 0.26, depth: 0.64 }, scene);
  lid.position = new BABYLON.Vector3(x, 0.68, z);
  lid.material = woodMat;

  // Metal bands (horizontal straps)
  [-0.18, 0.18].forEach((bx, i) => {
    const band = BABYLON.MeshBuilder.CreateBox("chestBand_" + x + z + i,
      { width: 0.93, height: 0.06, depth: 0.65 }, scene);
    band.position = new BABYLON.Vector3(x + bx, 0.28, z);
    band.material = metalMat;
  });

  // Gold clasp on front
  const clasp = BABYLON.MeshBuilder.CreateBox("chestClasp_" + x + z,
    { width: 0.16, height: 0.16, depth: 0.08 }, scene);
  clasp.position = new BABYLON.Vector3(x, 0.55, z + 0.32);
  clasp.material = goldMat;

  // Gentle bob animation
  let chestT = Math.random() * Math.PI * 2;
  scene.registerBeforeRender(() => {
    chestT += 0.012;
    const bob = Math.sin(chestT) * 0.015;
    base.position.y = 0.28 + bob;
    lid.position.y  = 0.68 + bob;
    clasp.position.y = 0.55 + bob;
  });
}

// ── Seagull ───────────────────────────────────────────────────────────────────
/**
 * Creates a procedural animated seagull that circles in the sky.
 * @param {BABYLON.Scene} scene
 * @param {number} cx  circle center X
 * @param {number} cy  flight altitude Y
 * @param {number} cz  circle center Z
 * @param {number} speed  orbit speed (radians/frame)
 * @param {number} id  unique id for mesh naming
 * @returns {{ update: function }}
 */
function _buildSeagull(scene, cx, cy, cz, speed, id) {
  const bodyMat = new BABYLON.StandardMaterial("sgBody_" + id, scene);
  bodyMat.diffuseColor  = new BABYLON.Color3(0.95, 0.95, 0.95);
  bodyMat.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.1);

  const wingMat = new BABYLON.StandardMaterial("sgWing_" + id, scene);
  wingMat.diffuseColor  = new BABYLON.Color3(0.88, 0.88, 0.90);
  wingMat.emissiveColor = new BABYLON.Color3(0.08, 0.08, 0.08);

  const beakMat = new BABYLON.StandardMaterial("sgBeak_" + id, scene);
  beakMat.diffuseColor = new BABYLON.Color3(0.95, 0.65, 0.10);

  const root = new BABYLON.TransformNode("sgRoot_" + id, scene);
  root.position = new BABYLON.Vector3(cx, cy, cz);

  // Body
  const body = BABYLON.MeshBuilder.CreateSphere("sgBody_" + id,
    { diameterX: 0.50, diameterY: 0.28, diameterZ: 0.65, segments: 5 }, scene);
  body.parent   = root;
  body.material = bodyMat;

  // Head
  const head = BABYLON.MeshBuilder.CreateSphere("sgHead_" + id,
    { diameter: 0.22, segments: 4 }, scene);
  head.parent   = root;
  head.position = new BABYLON.Vector3(0, 0.08, 0.33);
  head.material = bodyMat;

  // Beak
  const beak = BABYLON.MeshBuilder.CreateCylinder("sgBeak_" + id,
    { diameterTop: 0.02, diameterBottom: 0.07, height: 0.18, tessellation: 5 }, scene);
  beak.parent   = root;
  beak.position = new BABYLON.Vector3(0, 0.04, 0.48);
  beak.rotation.x = Math.PI / 2;
  beak.material = beakMat;

  // Wing pivots — so wings flap from the body shoulder
  const lWingPivot = new BABYLON.TransformNode("sgLWP_" + id, scene);
  lWingPivot.parent   = root;
  lWingPivot.position = new BABYLON.Vector3(-0.10, 0, 0);

  const rWingPivot = new BABYLON.TransformNode("sgRWP_" + id, scene);
  rWingPivot.parent   = root;
  rWingPivot.position = new BABYLON.Vector3(0.10, 0, 0);

  // Wing meshes (flat elongated boxes)
  const lWing = BABYLON.MeshBuilder.CreateBox("sgLWing_" + id,
    { width: 0.80, height: 0.05, depth: 0.28 }, scene);
  lWing.parent   = lWingPivot;
  lWing.position = new BABYLON.Vector3(-0.40, 0, 0);
  lWing.material = wingMat;

  const rWing = BABYLON.MeshBuilder.CreateBox("sgRWing_" + id,
    { width: 0.80, height: 0.05, depth: 0.28 }, scene);
  rWing.parent   = rWingPivot;
  rWing.position = new BABYLON.Vector3(0.40, 0, 0);
  rWing.material = wingMat;

  // Wingtip details
  const lTip = BABYLON.MeshBuilder.CreateBox("sgLTip_" + id,
    { width: 0.20, height: 0.04, depth: 0.15 }, scene);
  lTip.parent   = lWingPivot;
  lTip.position = new BABYLON.Vector3(-0.88, 0, 0.04);
  lTip.material = beakMat;

  const rTip = BABYLON.MeshBuilder.CreateBox("sgRTip_" + id,
    { width: 0.20, height: 0.04, depth: 0.15 }, scene);
  rTip.parent   = rWingPivot;
  rTip.position = new BABYLON.Vector3(0.88, 0, 0.04);
  rTip.material = beakMat;

  const orbitRadius = 12 + id * 5;
  let   orbitAngle  = (id / 4) * Math.PI * 2;  // stagger starting positions
  let   flapT       = Math.random() * Math.PI * 2;

  return {
    update() {
      orbitAngle += speed;
      flapT      += 0.12;

      // Orbit
      root.position.x = cx + Math.cos(orbitAngle) * orbitRadius;
      root.position.y = cy + Math.sin(flapT * 0.3) * 0.8;
      root.position.z = cz + Math.sin(orbitAngle) * orbitRadius;

      // Face direction of travel (tangent to circle)
      root.rotation.y = -orbitAngle + Math.PI / 2;

      // Flap wings
      const flapAngle = Math.sin(flapT) * 0.55;
      lWingPivot.rotation.z =  flapAngle;
      rWingPivot.rotation.z = -flapAngle;
    }
  };
}