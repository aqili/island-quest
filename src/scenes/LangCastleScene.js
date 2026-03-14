/**
 * LangCastleScene.js
 * Interior of the Language Castle — 4 rooms connected in a line.
 * Visual enhancements: stone-tile floors, arched walls, wall torches with
 * flickering purple lights, stone pillars, hanging banners, and a carpet runner.
 */

import { createPlayer }  from "../entities/Player.js";
import { showPuzzle }    from "../puzzles/LangPuzzleUI.js";
import { langPuzzles }   from "../data/langPuzzles.js";
import { SaveManager }   from "../utils/SaveManager.js";

const BABYLON = window.BABYLON;

const ROOMS = [
  { name: "Room 1 — Spelling 🔤",           pool: "room1",  type: "spelling",   wallColor: new BABYLON.Color3(0.42, 0.40, 0.60), accentColor: new BABYLON.Color3(0.55, 0.30, 0.95) },
  { name: "Room 2 — Word Unscramble 🔀",    pool: "room2",  type: "unscramble", wallColor: new BABYLON.Color3(0.48, 0.38, 0.65), accentColor: new BABYLON.Color3(0.38, 0.18, 0.82) },
  { name: "Room 3 — Fill in the Blank 📖",  pool: "room3",  type: "fillblank",  wallColor: new BABYLON.Color3(0.38, 0.48, 0.65), accentColor: new BABYLON.Color3(0.18, 0.55, 0.90) },
  { name: "👑 Throne Room",                  pool: "throne", type: "throne",     wallColor: new BABYLON.Color3(0.50, 0.38, 0.68), accentColor: new BABYLON.Color3(0.78, 0.55, 0.95) }
];

const ROOM_LENGTH = 18;

export function createLangCastleScene(engine, onExit) {
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.04, 0.02, 0.08, 1);

  scene.fogMode    = BABYLON.Scene.FOGMODE_LINEAR;
  scene.fogStart   = 20;
  scene.fogEnd     = 75;
  scene.fogColor   = new BABYLON.Color3(0.06, 0.03, 0.10);

  const ambient = new BABYLON.HemisphericLight("ambLight", new BABYLON.Vector3(0, 1, 0), scene);
  ambient.intensity   = 0.28;
  ambient.diffuse     = new BABYLON.Color3(0.80, 0.75, 0.98);
  ambient.groundColor = new BABYLON.Color3(0.04, 0.02, 0.06);

  const doors = [];
  const torchLights = [];

  ROOMS.forEach((room, i) => {
    _buildRoom(scene, i, room.wallColor, room.accentColor, doors, torchLights);
  });

  const player = createPlayer(scene);
  player.mesh.position = new BABYLON.Vector3(0, 0.5, 2);

  const hudLocation = document.getElementById("hud-location");
  const hudStars    = document.getElementById("hud-stars");
  _updateHUD(hudLocation, hudStars, 0);

  let puzzleActive = false;
  let switching    = false;
  let currentRoom  = 0;
  let flickerT     = 0;

  scene.registerBeforeRender(() => {
    if (puzzleActive || switching) return;
    player.update();

    // Purple torch flicker
    flickerT += 0.07;
    torchLights.forEach((tl, i) => {
      tl.intensity = 1.0 + 0.30 * Math.sin(flickerT * 2.8 + i * 1.9)
                         + 0.18 * Math.sin(flickerT * 6.5 + i * 2.7);
    });

    const pz = player.mesh.position.z;
    const px = player.mesh.position.x;

    const roomIdx = Math.max(0, Math.min(3, Math.floor(pz / ROOM_LENGTH)));
    if (roomIdx !== currentRoom) {
      currentRoom = roomIdx;
      _updateHUD(hudLocation, hudStars, roomIdx);
    }

    if (pz < -2 && roomIdx === 0) {
      switching = true;
      setTimeout(() => onExit(), 0);
      return;
    }

    doors.forEach((doorInfo, i) => {
      if (puzzleActive) return;
      if (Math.abs(pz - doorInfo.z) < 1.2 && Math.abs(px) < 1.5) {
        if (SaveManager.isRoomUnlocked("languageIsland", i + 1)) {
          doorInfo.mesh.material.diffuseColor  = new BABYLON.Color3(0.1, 0.8, 0.2);
          doorInfo.mesh.material.emissiveColor = new BABYLON.Color3(0.0, 0.2, 0.0);
          return;
        }
        puzzleActive = true;
        player.mesh.position.z = doorInfo.z - 1.5;
        _triggerPuzzle(i, () => {
          SaveManager.markRoomComplete("languageIsland", i);
          doorInfo.mesh.material.diffuseColor  = new BABYLON.Color3(0.1, 0.8, 0.2);
          doorInfo.mesh.material.emissiveColor = new BABYLON.Color3(0.0, 0.2, 0.0);
          puzzleActive = false;
          _updateHUD(hudLocation, hudStars, currentRoom);
          if (i === 3) {
            SaveManager.earnCrown("languageIsland");
            _showVictory("Language Crown", onExit);
          }
        });
      }
    });
  });

  return scene;
}

// ─── Room builder ─────────────────────────────────────────────────────────────

function _buildRoom(scene, idx, wallColor, accentColor, doors, torchLights) {
  const baseZ    = idx * ROOM_LENGTH;
  const isThrone = idx === 3;

  // ── Materials ──────────────────────────────────────────────────────────
  const stoneMat = new BABYLON.StandardMaterial("lStone_" + idx, scene);
  stoneMat.diffuseColor  = wallColor;
  stoneMat.specularColor = new BABYLON.Color3(0.06, 0.06, 0.10);

  const floorMat = new BABYLON.StandardMaterial("lFloor_" + idx, scene);
  floorMat.diffuseColor  = new BABYLON.Color3(
    wallColor.r * 0.72, wallColor.g * 0.68, wallColor.b * 0.80);
  floorMat.specularColor = new BABYLON.Color3(0.10, 0.08, 0.18);
  floorMat.specularPower = 40;

  const ceilMat = new BABYLON.StandardMaterial("lCeil_" + idx, scene);
  ceilMat.diffuseColor = new BABYLON.Color3(
    wallColor.r * 0.48, wallColor.g * 0.44, wallColor.b * 0.55);

  // ── Floor ──────────────────────────────────────────────────────────────
  const floor = BABYLON.MeshBuilder.CreateBox("lFloorMesh_" + idx,
    { width: 8, height: 0.22, depth: ROOM_LENGTH }, scene);
  floor.position = new BABYLON.Vector3(0, 0, baseZ + ROOM_LENGTH / 2);
  floor.material = floorMat;
  _applyTileTexture(floorMat, wallColor, 8, 18, true);

  // Carpet runner
  const carpetMat = new BABYLON.StandardMaterial("lCarpet_" + idx, scene);
  carpetMat.diffuseColor = isThrone
    ? new BABYLON.Color3(0.55, 0.12, 0.72)   // deep purple for throne
    : new BABYLON.Color3(accentColor.r * 0.60, accentColor.g * 0.30, accentColor.b * 0.70);
  carpetMat.specularColor = new BABYLON.Color3(0.05, 0.02, 0.08);

  const carpet = BABYLON.MeshBuilder.CreateBox("lCarpet_" + idx,
    { width: 2.2, height: 0.02, depth: ROOM_LENGTH - 1 }, scene);
  carpet.position = new BABYLON.Vector3(0, 0.12, baseZ + ROOM_LENGTH / 2);
  carpet.material = carpetMat;

  // ── Walls ──────────────────────────────────────────────────────────────
  const lWall = BABYLON.MeshBuilder.CreateBox("lLWall_" + idx,
    { width: 0.35, height: 4.2, depth: ROOM_LENGTH }, scene);
  lWall.position = new BABYLON.Vector3(-4.15, 2.1, baseZ + ROOM_LENGTH / 2);
  lWall.material = stoneMat;

  const rWall = BABYLON.MeshBuilder.CreateBox("lRWall_" + idx,
    { width: 0.35, height: 4.2, depth: ROOM_LENGTH }, scene);
  rWall.position = new BABYLON.Vector3(4.15, 2.1, baseZ + ROOM_LENGTH / 2);
  rWall.material = stoneMat;

  // ── Ceiling with beams ────────────────────────────────────────────────
  const ceil = BABYLON.MeshBuilder.CreateBox("lCeilMesh_" + idx,
    { width: 8, height: 0.22, depth: ROOM_LENGTH }, scene);
  ceil.position = new BABYLON.Vector3(0, 4.2, baseZ + ROOM_LENGTH / 2);
  ceil.material = ceilMat;

  // Star pattern on throne room ceiling
  const beamMat = new BABYLON.StandardMaterial("lBeam_" + idx, scene);
  beamMat.diffuseColor = new BABYLON.Color3(0.22, 0.15, 0.35);
  [3, 7, 11, 15].forEach((bz, bi) => {
    const beam = BABYLON.MeshBuilder.CreateBox("lBeam_" + idx + bi,
      { width: 8.4, height: 0.30, depth: 0.35 }, scene);
    beam.position = new BABYLON.Vector3(0, 4.05, baseZ + bz);
    beam.material = beamMat;
  });

  // ── Stone pillars ─────────────────────────────────────────────────────
  const pillarMat = new BABYLON.StandardMaterial("lPillar_" + idx, scene);
  pillarMat.diffuseColor  = new BABYLON.Color3(
    wallColor.r * 0.88, wallColor.g * 0.84, wallColor.b * 0.92);
  pillarMat.specularColor = new BABYLON.Color3(0.08, 0.06, 0.12);

  [5, 12].forEach((pz, pi) => {
    [-3.0, 3.0].forEach((px, pxi) => {
      const shaft = BABYLON.MeshBuilder.CreateCylinder(
        "lPillarShaft_" + idx + pi + pxi,
        { diameter: 0.55, height: 3.8, tessellation: 12 }, scene);
      shaft.position = new BABYLON.Vector3(px, 1.9, baseZ + pz);
      shaft.material = pillarMat;

      const cap = BABYLON.MeshBuilder.CreateBox(
        "lPillarCap_" + idx + pi + pxi,
        { width: 0.72, height: 0.22, depth: 0.72 }, scene);
      cap.position = new BABYLON.Vector3(px, 3.91, baseZ + pz);
      cap.material = pillarMat;

      const base = BABYLON.MeshBuilder.CreateBox(
        "lPillarBase_" + idx + pi + pxi,
        { width: 0.72, height: 0.20, depth: 0.72 }, scene);
      base.position = new BABYLON.Vector3(px, 0.10, baseZ + pz);
      base.material = pillarMat;
    });
  });

  // ── Hanging banners ───────────────────────────────────────────────────
  const bannerMat = new BABYLON.StandardMaterial("lBanner_" + idx, scene);
  bannerMat.diffuseColor  = accentColor;
  bannerMat.emissiveColor = new BABYLON.Color3(
    accentColor.r * 0.12, accentColor.g * 0.12, accentColor.b * 0.18);

  const bannerTrimMat = new BABYLON.StandardMaterial("lBannerTrim_" + idx, scene);
  bannerTrimMat.diffuseColor  = new BABYLON.Color3(0.80, 0.72, 0.95);
  bannerTrimMat.emissiveColor = new BABYLON.Color3(0.10, 0.05, 0.15);

  [5, 12].forEach((pz, pi) => {
    [-3.05, 3.05].forEach((px, pxi) => {
      const banner = BABYLON.MeshBuilder.CreateBox(
        "lBanner_" + idx + pi + pxi,
        { width: 0.5, height: 1.4, depth: 0.04 }, scene);
      banner.position = new BABYLON.Vector3(
        px + (px < 0 ? 0.32 : -0.32), 2.5, baseZ + pz);
      banner.material = bannerMat;

      const trim = BABYLON.MeshBuilder.CreateBox(
        "lBannerTrim_" + idx + pi + pxi,
        { width: 0.5, height: 0.12, depth: 0.05 }, scene);
      trim.position = new BABYLON.Vector3(
        px + (px < 0 ? 0.32 : -0.32), 1.74, baseZ + pz);
      trim.material = bannerTrimMat;
    });
  });

  // ── Wall torches (purple-tinted) ──────────────────────────────────────
  [3, 8, 13].forEach((tz, ti) => {
    [-1, 1].forEach((side) => {
      _buildWallTorch(scene, side * 3.9, baseZ + tz, idx, ti, side, torchLights);
    });
  });

  // Throne extras
  if (isThrone) {
    _buildChandelier(scene, 0, 3.8, baseZ + ROOM_LENGTH / 2, accentColor, torchLights);
    _buildThroneChair(scene, 0, baseZ + ROOM_LENGTH - 3, accentColor);
  }

  // ── Entry back wall ───────────────────────────────────────────────────
  if (idx === 0) {
    const backWall = BABYLON.MeshBuilder.CreateBox("lBackWall",
      { width: 8, height: 4.2, depth: 0.35 }, scene);
    backWall.position = new BABYLON.Vector3(0, 2.1, baseZ);
    backWall.material = stoneMat;

    const exitDoor = BABYLON.MeshBuilder.CreateBox("lExitDoor",
      { width: 2, height: 2.8, depth: 0.4 }, scene);
    exitDoor.position = new BABYLON.Vector3(0, 1.4, baseZ);
    const edMat = new BABYLON.StandardMaterial("lExitDoorMat", scene);
    edMat.diffuseColor = new BABYLON.Color3(0.06, 0.03, 0.10);
    exitDoor.material = edMat;

    const exitArch = BABYLON.MeshBuilder.CreateSphere("lExitArch",
      { diameterX: 2.0, diameterY: 0.9, diameterZ: 0.4, segments: 8 }, scene);
    exitArch.position = new BABYLON.Vector3(0, 2.95, baseZ);
    exitArch.material = edMat;
  }

  // ── Front wall with puzzle door ───────────────────────────────────────
  const doorZ = baseZ + ROOM_LENGTH;

  const frontWall = BABYLON.MeshBuilder.CreateBox("lFrontWall_" + idx,
    { width: 8, height: 4.2, depth: 0.35 }, scene);
  frontWall.position = new BABYLON.Vector3(0, 2.1, doorZ);
  frontWall.material = stoneMat;

  [[-2.5, 3], [2.5, 3]].forEach(([dx, dw], j) => {
    const seg = BABYLON.MeshBuilder.CreateBox("lDoorSeg_" + idx + j,
      { width: dw, height: 4.2, depth: 0.35 }, scene);
    seg.position = new BABYLON.Vector3(dx, 2.1, doorZ);
    seg.material = stoneMat;
  });

  const topFill = BABYLON.MeshBuilder.CreateBox("lDoorTop_" + idx,
    { width: 2, height: 1.4, depth: 0.35 }, scene);
  topFill.position = new BABYLON.Vector3(0, 3.5, doorZ);
  topFill.material = stoneMat;

  const archMat = new BABYLON.StandardMaterial("lArch_" + idx, scene);
  archMat.diffuseColor = new BABYLON.Color3(
    wallColor.r * 0.90, wallColor.g * 0.88, wallColor.b * 1.0);
  const doorArch = BABYLON.MeshBuilder.CreateSphere("lDoorArch_" + idx,
    { diameterX: 2.0, diameterY: 1.0, diameterZ: 0.38, segments: 8 }, scene);
  doorArch.position = new BABYLON.Vector3(0, 2.85, doorZ);
  doorArch.material = archMat;

  const doorSlab = BABYLON.MeshBuilder.CreateBox("lDoorSlab_" + idx,
    { width: 2, height: 2.75, depth: 0.22 }, scene);
  doorSlab.position = new BABYLON.Vector3(0, 1.375, doorZ);
  const doorSlabMat = new BABYLON.StandardMaterial("lDoorSlabMat_" + idx, scene);
  const save   = SaveManager.load();
  const solved = save.languageIsland.roomsCompleted[idx];
  doorSlabMat.diffuseColor  = solved ? new BABYLON.Color3(0.1, 0.8, 0.2) : new BABYLON.Color3(0.55, 0.05, 0.68);
  doorSlabMat.emissiveColor = solved ? new BABYLON.Color3(0.0, 0.2, 0.0) : new BABYLON.Color3(0.12, 0.0, 0.15);
  doorSlab.material = doorSlabMat;

  const handleMat = new BABYLON.StandardMaterial("lHandle_" + idx, scene);
  handleMat.diffuseColor = new BABYLON.Color3(0.55, 0.42, 0.72);
  const handle = BABYLON.MeshBuilder.CreateSphere("lHandle_" + idx,
    { diameter: 0.18, segments: 6 }, scene);
  handle.position = new BABYLON.Vector3(0.7, 1.5, doorZ - 0.15);
  handle.material = handleMat;

  doors.push({ mesh: doorSlab, z: doorZ });
}

// ── Wall torch with purple flame ──────────────────────────────────────────────

function _buildWallTorch(scene, x, z, roomIdx, torchIdx, side, torchLights) {
  const metalMat = new BABYLON.StandardMaterial("lTorchMetal_" + roomIdx + torchIdx + side, scene);
  metalMat.diffuseColor = new BABYLON.Color3(0.30, 0.22, 0.38);

  const arm = BABYLON.MeshBuilder.CreateBox("lTorchArm_" + roomIdx + torchIdx + side,
    { width: 0.36, height: 0.08, depth: 0.08 }, scene);
  arm.position = new BABYLON.Vector3(x, 2.6, z);
  arm.material = metalMat;

  const handle = BABYLON.MeshBuilder.CreateCylinder("lTorchHandle_" + roomIdx + torchIdx + side,
    { diameter: 0.10, height: 0.55, tessellation: 8 }, scene);
  handle.position = new BABYLON.Vector3(x + side * (-0.16), 2.75, z);
  handle.material = metalMat;

  const flameMat = new BABYLON.StandardMaterial("lFlame_" + roomIdx + torchIdx + side, scene);
  flameMat.diffuseColor  = new BABYLON.Color3(0.75, 0.35, 1.0);
  flameMat.emissiveColor = new BABYLON.Color3(0.45, 0.10, 0.65);

  const flame = BABYLON.MeshBuilder.CreateCylinder("lFlame_" + roomIdx + torchIdx + side,
    { diameterTop: 0, diameterBottom: 0.18, height: 0.32, tessellation: 8 }, scene);
  flame.position = new BABYLON.Vector3(x + side * (-0.16), 3.08, z);
  flame.material = flameMat;

  const light = new BABYLON.PointLight(
    "lTorchLight_" + roomIdx + torchIdx + side,
    new BABYLON.Vector3(x + side * (-0.16), 3.1, z),
    scene
  );
  light.diffuse   = new BABYLON.Color3(0.75, 0.45, 1.0);
  light.intensity = 1.0;
  light.range     = 10;
  torchLights.push(light);
}

// ── Chandelier ────────────────────────────────────────────────────────────────

function _buildChandelier(scene, x, y, z, accentColor, torchLights) {
  const metalMat = new BABYLON.StandardMaterial("lChandMetal", scene);
  metalMat.diffuseColor = new BABYLON.Color3(0.48, 0.30, 0.62);

  const ring = BABYLON.MeshBuilder.CreateTorus("lChandRing",
    { diameter: 2.0, thickness: 0.08, tessellation: 32 }, scene);
  ring.position = new BABYLON.Vector3(x, y, z);
  ring.material = metalMat;

  const chain = BABYLON.MeshBuilder.CreateCylinder("lChandChain",
    { diameter: 0.06, height: 0.55, tessellation: 6 }, scene);
  chain.position = new BABYLON.Vector3(x, y + 0.28, z);
  chain.material = metalMat;

  const crystalMat = new BABYLON.StandardMaterial("lCrystal", scene);
  crystalMat.diffuseColor  = accentColor;
  crystalMat.emissiveColor = new BABYLON.Color3(accentColor.r * 0.35, accentColor.g * 0.25, accentColor.b * 0.45);
  crystalMat.alpha = 0.85;

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const cx2 = x + Math.cos(a) * 0.95;
    const cz2 = z + Math.sin(a) * 0.95;

    const crystal = BABYLON.MeshBuilder.CreateBox("lCrystal_" + i,
      { width: 0.10, height: 0.28, depth: 0.10 }, scene);
    crystal.position = new BABYLON.Vector3(cx2, y - 0.22, cz2);
    crystal.material = crystalMat;
  }

  const cl = new BABYLON.PointLight("lChandLight", new BABYLON.Vector3(x, y - 0.1, z), scene);
  cl.diffuse   = new BABYLON.Color3(0.80, 0.60, 1.0);
  cl.intensity = 1.4;
  cl.range     = 18;
  torchLights.push(cl);
}

// ── Throne chair (language theme) ─────────────────────────────────────────────

function _buildThroneChair(scene, x, z, accentColor) {
  const crystalMat = new BABYLON.StandardMaterial("lThroneMat", scene);
  crystalMat.diffuseColor  = new BABYLON.Color3(0.55, 0.30, 0.85);
  crystalMat.specularColor = new BABYLON.Color3(0.6, 0.4, 0.9);
  crystalMat.specularPower = 80;
  crystalMat.emissiveColor = new BABYLON.Color3(0.06, 0.02, 0.10);

  const cushionMat = new BABYLON.StandardMaterial("lCushionMat", scene);
  cushionMat.diffuseColor = new BABYLON.Color3(0.18, 0.08, 0.38);

  const seat = BABYLON.MeshBuilder.CreateBox("lThroneSeat",
    { width: 1.4, height: 0.22, depth: 1.1 }, scene);
  seat.position = new BABYLON.Vector3(x, 0.8, z);
  seat.material = crystalMat;

  const cushion = BABYLON.MeshBuilder.CreateBox("lThroneCushion",
    { width: 1.2, height: 0.14, depth: 0.9 }, scene);
  cushion.position = new BABYLON.Vector3(x, 0.95, z);
  cushion.material = cushionMat;

  const back = BABYLON.MeshBuilder.CreateBox("lThroneBack",
    { width: 1.4, height: 1.8, depth: 0.18 }, scene);
  back.position = new BABYLON.Vector3(x, 1.80, z - 0.55);
  back.material = crystalMat;

  [[-0.61, 0], [0.61, 0]].forEach(([ax], ai) => {
    const arm = BABYLON.MeshBuilder.CreateBox("lThroneArm_" + ai,
      { width: 0.16, height: 0.55, depth: 1.0 }, scene);
    arm.position = new BABYLON.Vector3(x + ax, 1.07, z);
    arm.material = crystalMat;
  });

  // Crystal spires on top of backrest
  [-0.5, 0, 0.5].forEach((ox, si) => {
    const spire = BABYLON.MeshBuilder.CreateCylinder("lSpire_" + si,
      { diameterTop: 0, diameterBottom: 0.22, height: 0.65, tessellation: 6 }, scene);
    spire.position = new BABYLON.Vector3(x + ox, 2.78 + si * 0.08, z - 0.55);
    spire.material = crystalMat;
  });
}

// ── Tile texture helper ───────────────────────────────────────────────────────

function _applyTileTexture(mat, baseColor, uTiles, vTiles, dark) {
  const size = 512;
  const dt = new BABYLON.DynamicTexture("lTileTex_" + Math.random(), { width: size, height: size }, null);
  const ctx = dt.getContext();
  const tw  = size / uTiles;
  const th  = size / vTiles;

  const mul = dark ? 0.6 : 0.85;
  const r = Math.floor(baseColor.r * 220 * mul);
  const g = Math.floor(baseColor.g * 200 * mul);
  const b = Math.floor(baseColor.b * 230 * mul);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = `rgba(0,0,0,0.28)`;
  ctx.lineWidth = 3;
  for (let col = 0; col <= uTiles; col++) {
    ctx.beginPath(); ctx.moveTo(col * tw, 0); ctx.lineTo(col * tw, size); ctx.stroke();
  }
  for (let row = 0; row <= vTiles; row++) {
    ctx.beginPath(); ctx.moveTo(0, row * th); ctx.lineTo(size, row * th); ctx.stroke();
  }
  dt.update();
  mat.diffuseTexture  = dt;
  mat.uScale = uTiles / 4;
  mat.vScale = vTiles / 4;
}

// ─── Puzzle trigger ───────────────────────────────────────────────────────────

function _triggerPuzzle(roomIndex, onSuccess) {
  const { pool, type } = ROOMS[roomIndex];
  if (type === "throne") { _runThronePuzzle(onSuccess); return; }
  const pool_data = langPuzzles[pool];
  const q = pool_data[Math.floor(Math.random() * pool_data.length)];
  showPuzzle(q, type, onSuccess);
}

function _runThronePuzzle(onSuccess) {
  const pool = langPuzzles.throne;
  const q = pool[Math.floor(Math.random() * pool.length)];
  showPuzzle(q, "throne", onSuccess);
}

// ─── HUD helpers ──────────────────────────────────────────────────────────────

function _updateHUD(locationEl, starsEl, roomIdx) {
  locationEl.textContent = `🏰 Language Castle — ${ROOMS[roomIdx].name}`;
  const save = SaveManager.load();
  starsEl.textContent = save.languageIsland.roomsCompleted.map(d => d ? "⭐" : "☆").join(" ");
}

// ─── Victory screen ───────────────────────────────────────────────────────────

function _showVictory(crownName, onExit) {
  const overlay = document.getElementById("ui-overlay");
  overlay.innerHTML = `
    <div class="puzzle-panel victory-panel">
      <span class="victory-emoji">👑</span>
      <p class="victory-title">You earned the ${crownName}!</p>
      <p class="victory-sub">Incredible! You solved ALL Language puzzles! 🎉🎉🎉</p>
      <button class="btn btn-primary" id="victoryBtn" style="margin-top:24px">
        🌊 Return to Ocean World
      </button>
    </div>`;
  overlay.classList.add("active");
  document.getElementById("victoryBtn").addEventListener("click", () => {
    overlay.innerHTML = "";
    overlay.classList.remove("active");
    onExit();
  });
}
