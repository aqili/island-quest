/**
 * MathCastleScene.js
 * Interior of the Math Castle — 4 rooms connected in a line.
 * Visual enhancements: stone-tile floors, arched walls, wall torches with
 * flickering lights, stone pillars, hanging banners, and a carpet runner.
 */

import { createPlayer }  from "../entities/Player.js";
import { showPuzzle }    from "../puzzles/MathPuzzleUI.js";
import { mathPuzzles }   from "../data/mathPuzzles.js";
import { SaveManager }   from "../utils/SaveManager.js";

const BABYLON = window.BABYLON;

const ROOMS = [
  { name: "Room 1 — Addition & Subtraction ➕➖", pool: "room1",  type: "text",   wallColor: new BABYLON.Color3(0.62, 0.58, 0.50), accentColor: new BABYLON.Color3(0.85, 0.68, 0.20) },
  { name: "Room 2 — Multiplication 🌟",           pool: "room2",  type: "choice", wallColor: new BABYLON.Color3(0.58, 0.62, 0.50), accentColor: new BABYLON.Color3(0.20, 0.75, 0.35) },
  { name: "Room 3 — Shapes & Counting 🔷",        pool: "room3",  type: "choice", wallColor: new BABYLON.Color3(0.50, 0.58, 0.65), accentColor: new BABYLON.Color3(0.20, 0.55, 0.90) },
  { name: "👑 Throne Room",                        pool: "throne", type: "throne", wallColor: new BABYLON.Color3(0.65, 0.58, 0.38), accentColor: new BABYLON.Color3(0.90, 0.80, 0.20) }
];

const ROOM_LENGTH = 22;
const ROOM_WIDTH  = 14;
const ROOM_HEIGHT = 6.5;

export function createMathCastleScene(engine, onExit) {
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.10, 0.08, 0.05, 1);

  // Brighter ambient — well-lit castle interior
  const ambient = new BABYLON.HemisphericLight("ambLight", new BABYLON.Vector3(0, 1, 0), scene);
  ambient.intensity   = 0.65;
  ambient.diffuse     = new BABYLON.Color3(1.0, 0.95, 0.82);
  ambient.groundColor = new BABYLON.Color3(0.18, 0.12, 0.06);

  const doors = [];
  const torchLights = []; // for flicker animation

  ROOMS.forEach((room, i) => {
    _buildRoom(scene, i, room.wallColor, room.accentColor, doors, torchLights);
  });

  // Player — start further in so back wall isn't immediately behind camera
  const player = createPlayer(scene);
  player.mesh.position = new BABYLON.Vector3(0, 0.5, 6);

  // Pull camera closer to avoid wall clipping in wider room
  player.camera.radius          = 8;
  player.camera.lowerRadiusLimit = 4;
  player.camera.upperRadiusLimit = 14;

  // HUD
  const hudLocation = document.getElementById("hud-location");
  const hudStars    = document.getElementById("hud-stars");
  _updateHUD(hudLocation, hudStars, 0);

  let puzzleActive = false;
  let switching    = false;
  let currentRoom  = 0;
  let flickerT     = 0;

  scene.registerBeforeRender(() => {
    try {
    if (puzzleActive || switching) return;
    player.update();

    // Torch flicker — brighter range
    flickerT += 0.08;
    torchLights.forEach((tl, i) => {
      tl.intensity = 2.2 + 0.50 * Math.sin(flickerT * 3.1 + i * 1.7)
                         + 0.20 * Math.sin(flickerT * 7.3 + i * 2.3);
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
      const dist  = Math.abs(pz - doorInfo.z);
      const distX = Math.abs(px);
      if (dist < 1.2 && distX < 1.5) {
        if (SaveManager.isRoomUnlocked("mathIsland", i + 1)) {
          doorInfo.mesh.material.diffuseColor = new BABYLON.Color3(0.1, 0.8, 0.2);
          doorInfo.mesh.material.emissiveColor = new BABYLON.Color3(0.0, 0.2, 0.0);
          return;
        }
        puzzleActive = true;
        player.mesh.position.z = doorInfo.z - 1.5;
        _triggerPuzzle(i, scene, () => {
          SaveManager.markRoomComplete("mathIsland", i);
          doorInfo.mesh.material.diffuseColor  = new BABYLON.Color3(0.1, 0.8, 0.2);
          doorInfo.mesh.material.emissiveColor = new BABYLON.Color3(0.0, 0.2, 0.0);
          puzzleActive = false;
          _updateHUD(hudLocation, hudStars, currentRoom);
          if (i === 3) {
            SaveManager.earnCrown("mathIsland");
            _showVictory(scene, "Math Crown", onExit);
          }
        });
      }
    });
    } catch (e) { console.error("MathCastle render error:", e); }
  });

  return scene;
}

// ─── Room builder ─────────────────────────────────────────────────────────────

function _buildRoom(scene, idx, wallColor, accentColor, doors, torchLights) {
  const baseZ = idx * ROOM_LENGTH;
  const isThrone = idx === 3;
  const halfW = ROOM_WIDTH / 2;        // 7
  const wallX = halfW + 0.175;         // 7.175 — wall centre x
  const ceilY = ROOM_HEIGHT;           // 6.5
  const wallMidY = ROOM_HEIGHT / 2;    // 3.25

  // ── Materials ──────────────────────────────────────────────────────────
  const stoneMat = new BABYLON.StandardMaterial("stone_" + idx, scene);
  stoneMat.diffuseColor  = wallColor;
  stoneMat.specularColor = new BABYLON.Color3(0.08, 0.08, 0.08);

  const floorMat = new BABYLON.StandardMaterial("floor_" + idx, scene);
  floorMat.diffuseColor  = new BABYLON.Color3(
    wallColor.r * 0.75, wallColor.g * 0.70, wallColor.b * 0.65);
  floorMat.specularColor = new BABYLON.Color3(0.15, 0.12, 0.08);
  floorMat.specularPower = 32;

  const ceilMat = new BABYLON.StandardMaterial("ceil_" + idx, scene);
  ceilMat.diffuseColor = new BABYLON.Color3(
    wallColor.r * 0.60, wallColor.g * 0.58, wallColor.b * 0.54);

  // ── Floor ──────────────────────────────────────────────────────────────
  const floor = BABYLON.MeshBuilder.CreateBox("floor_" + idx,
    { width: ROOM_WIDTH, height: 0.22, depth: ROOM_LENGTH }, scene);
  floor.position = new BABYLON.Vector3(0, 0, baseZ + ROOM_LENGTH / 2);
  floor.material = floorMat;

  // Stone tile grid overlay
  _applyTileTexture(scene, floorMat, wallColor, 14, 22);

  // Carpet runner down the center
  const carpetMat = new BABYLON.StandardMaterial("carpet_" + idx, scene);
  carpetMat.diffuseColor  = isThrone
    ? new BABYLON.Color3(0.72, 0.55, 0.08)
    : new BABYLON.Color3(accentColor.r * 0.7, accentColor.g * 0.45, accentColor.b * 0.35);
  carpetMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);

  const carpet = BABYLON.MeshBuilder.CreateBox("carpet_" + idx,
    { width: 2.8, height: 0.02, depth: ROOM_LENGTH - 1 }, scene);
  carpet.position = new BABYLON.Vector3(0, 0.12, baseZ + ROOM_LENGTH / 2);
  carpet.material = carpetMat;

  // ── Walls ──────────────────────────────────────────────────────────────
  const lWall = BABYLON.MeshBuilder.CreateBox("lWall_" + idx,
    { width: 0.35, height: ROOM_HEIGHT, depth: ROOM_LENGTH }, scene);
  lWall.position = new BABYLON.Vector3(-wallX, wallMidY, baseZ + ROOM_LENGTH / 2);
  lWall.material = stoneMat;

  const rWall = BABYLON.MeshBuilder.CreateBox("rWall_" + idx,
    { width: 0.35, height: ROOM_HEIGHT, depth: ROOM_LENGTH }, scene);
  rWall.position = new BABYLON.Vector3(wallX, wallMidY, baseZ + ROOM_LENGTH / 2);
  rWall.material = stoneMat;

  // ── Ceiling with beams ────────────────────────────────────────────────
  const ceil = BABYLON.MeshBuilder.CreateBox("ceil_" + idx,
    { width: ROOM_WIDTH, height: 0.22, depth: ROOM_LENGTH }, scene);
  ceil.position = new BABYLON.Vector3(0, ceilY, baseZ + ROOM_LENGTH / 2);
  ceil.material = ceilMat;

  // Ceiling cross-beams
  const beamMat = new BABYLON.StandardMaterial("beam_" + idx, scene);
  beamMat.diffuseColor = new BABYLON.Color3(0.32, 0.22, 0.10);
  [4, 9, 14, 19].forEach((bz, bi) => {
    const beam = BABYLON.MeshBuilder.CreateBox("beam_" + idx + bi,
      { width: ROOM_WIDTH + 0.4, height: 0.35, depth: 0.40 }, scene);
    beam.position = new BABYLON.Vector3(0, ceilY - 0.22, baseZ + bz);
    beam.material = beamMat;
  });

  // ── Stone pillars ─────────────────────────────────────────────────────
  const pillarMat = new BABYLON.StandardMaterial("pillar_" + idx, scene);
  pillarMat.diffuseColor  = new BABYLON.Color3(
    wallColor.r * 0.85, wallColor.g * 0.82, wallColor.b * 0.78);
  pillarMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);

  [6, 16].forEach((pz, pi) => {
    [-5.5, 5.5].forEach((px, pxi) => {
      // Pillar shaft
      const shaft = BABYLON.MeshBuilder.CreateCylinder(
        "pillarShaft_" + idx + pi + pxi,
        { diameter: 0.60, height: 6.0, tessellation: 12 }, scene);
      shaft.position = new BABYLON.Vector3(px, 3.0, baseZ + pz);
      shaft.material = pillarMat;

      // Capital (top)
      const cap = BABYLON.MeshBuilder.CreateBox(
        "pillarCap_" + idx + pi + pxi,
        { width: 0.82, height: 0.26, depth: 0.82 }, scene);
      cap.position = new BABYLON.Vector3(px, 6.13, baseZ + pz);
      cap.material = pillarMat;

      // Base
      const base = BABYLON.MeshBuilder.CreateBox(
        "pillarBase_" + idx + pi + pxi,
        { width: 0.82, height: 0.22, depth: 0.82 }, scene);
      base.position = new BABYLON.Vector3(px, 0.11, baseZ + pz);
      base.material = pillarMat;
    });
  });

  // ── Hanging banners on pillars ────────────────────────────────────────
  const bannerMat = new BABYLON.StandardMaterial("banner_" + idx, scene);
  bannerMat.diffuseColor  = accentColor;
  bannerMat.emissiveColor = new BABYLON.Color3(
    accentColor.r * 0.15, accentColor.g * 0.15, accentColor.b * 0.15);

  const bannerTrimMat = new BABYLON.StandardMaterial("bannerTrim_" + idx, scene);
  bannerTrimMat.diffuseColor = new BABYLON.Color3(0.9, 0.8, 0.2);

  [6, 16].forEach((pz, pi) => {
    [-5.55, 5.55].forEach((px, pxi) => {
      const banner = BABYLON.MeshBuilder.CreateBox(
        "banner_" + idx + pi + pxi,
        { width: 0.6, height: 2.0, depth: 0.05 }, scene);
      banner.position = new BABYLON.Vector3(
        px + (px < 0 ? 0.36 : -0.36), 4.0, baseZ + pz);
      banner.material = bannerMat;

      const trim = BABYLON.MeshBuilder.CreateBox(
        "bannerTrim_" + idx + pi + pxi,
        { width: 0.6, height: 0.14, depth: 0.06 }, scene);
      trim.position = new BABYLON.Vector3(
        px + (px < 0 ? 0.36 : -0.36), 2.95, baseZ + pz);
      trim.material = bannerTrimMat;
    });
  });

  // ── Wall torches ──────────────────────────────────────────────────────
  [4, 10, 17].forEach((tz, ti) => {
    [-1, 1].forEach((side) => {
      _buildWallTorch(scene, side * 6.9, baseZ + tz, idx, ti, side, torchLights);
    });
  });

  // Throne room: chandelier
  if (isThrone) {
    _buildChandelier(scene, 0, 5.5, baseZ + ROOM_LENGTH / 2, accentColor, torchLights);
    _buildThroneChair(scene, 0, baseZ + ROOM_LENGTH - 3);
  }

  // ── Entry/Exit back wall ──────────────────────────────────────────────
  if (idx === 0) {
    const backWall = BABYLON.MeshBuilder.CreateBox("backWall",
      { width: ROOM_WIDTH, height: ROOM_HEIGHT, depth: 0.35 }, scene);
    backWall.position = new BABYLON.Vector3(0, wallMidY, baseZ);
    backWall.material = stoneMat;

    const exitDoor = BABYLON.MeshBuilder.CreateBox("exitDoor",
      { width: 2.4, height: 3.5, depth: 0.4 }, scene);
    exitDoor.position = new BABYLON.Vector3(0, 1.75, baseZ);
    const edMat = new BABYLON.StandardMaterial("exitDoorMat", scene);
    edMat.diffuseColor = new BABYLON.Color3(0.12, 0.07, 0.02);
    exitDoor.material = edMat;

    // Arch over exit
    const exitArch = BABYLON.MeshBuilder.CreateSphere("exitArch",
      { diameterX: 2.4, diameterY: 1.0, diameterZ: 0.4, segments: 8 }, scene);
    exitArch.position = new BABYLON.Vector3(0, 3.6, baseZ);
    exitArch.material = edMat;
  }

  // ── Front wall with puzzle door ───────────────────────────────────────
  const doorZ = baseZ + ROOM_LENGTH;

  // Solid back plane of the front wall
  const frontWall = BABYLON.MeshBuilder.CreateBox("frontWall_" + idx,
    { width: ROOM_WIDTH, height: ROOM_HEIGHT, depth: 0.35 }, scene);
  frontWall.position = new BABYLON.Vector3(0, wallMidY, doorZ);
  frontWall.material = stoneMat;

  // Door frame sides (cover left and right of 2-unit-wide opening)
  [[-4.0, 6.0], [4.0, 6.0]].forEach(([dx, dw], j) => {
    const seg = BABYLON.MeshBuilder.CreateBox("doorSeg_" + idx + j,
      { width: dw, height: ROOM_HEIGHT, depth: 0.35 }, scene);
    seg.position = new BABYLON.Vector3(dx, wallMidY, doorZ);
    seg.material = stoneMat;
  });

  // Door top filler (above the door opening)
  const topFill = BABYLON.MeshBuilder.CreateBox("doorTop_" + idx,
    { width: 2.2, height: 3.0, depth: 0.35 }, scene);
  topFill.position = new BABYLON.Vector3(0, 5.0, doorZ);
  topFill.material = stoneMat;

  // Arch over door
  const archMat = new BABYLON.StandardMaterial("arch_" + idx, scene);
  archMat.diffuseColor = new BABYLON.Color3(
    wallColor.r * 0.90, wallColor.g * 0.88, wallColor.b * 0.84);
  const doorArch = BABYLON.MeshBuilder.CreateSphere("doorArch_" + idx,
    { diameterX: 2.2, diameterY: 1.2, diameterZ: 0.40, segments: 8 }, scene);
  doorArch.position = new BABYLON.Vector3(0, 3.6, doorZ);
  doorArch.material = archMat;

  // The puzzle door slab
  const doorSlab = BABYLON.MeshBuilder.CreateBox("doorSlab_" + idx,
    { width: 2.0, height: 3.5, depth: 0.22 }, scene);
  doorSlab.position = new BABYLON.Vector3(0, 1.75, doorZ);
  const doorSlabMat = new BABYLON.StandardMaterial("doorSlabMat_" + idx, scene);
  const save   = SaveManager.load();
  const solved = save.mathIsland.roomsCompleted[idx];
  doorSlabMat.diffuseColor  = solved ? new BABYLON.Color3(0.1, 0.8, 0.2) : new BABYLON.Color3(0.78, 0.10, 0.10);
  doorSlabMat.emissiveColor = solved ? new BABYLON.Color3(0.0, 0.2, 0.0) : new BABYLON.Color3(0.15, 0.0, 0.0);
  doorSlab.material = doorSlabMat;

  // Iron door handle
  const handleMat = new BABYLON.StandardMaterial("handle_" + idx, scene);
  handleMat.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.3);
  const handle = BABYLON.MeshBuilder.CreateSphere("handle_" + idx,
    { diameter: 0.20, segments: 6 }, scene);
  handle.position = new BABYLON.Vector3(0.75, 2.0, doorZ - 0.15);
  handle.material = handleMat;

  doors.push({ mesh: doorSlab, z: doorZ });
}

// ── Wall torch with bracket ───────────────────────────────────────────────────

function _buildWallTorch(scene, x, z, roomIdx, torchIdx, side, torchLights) {
  const metalMat = new BABYLON.StandardMaterial("torchMetal_" + roomIdx + torchIdx + side, scene);
  metalMat.diffuseColor = new BABYLON.Color3(0.25, 0.22, 0.18);

  // Bracket arm
  const arm = BABYLON.MeshBuilder.CreateBox("torchArm_" + roomIdx + torchIdx + side,
    { width: 0.40, height: 0.09, depth: 0.09 }, scene);
  arm.position = new BABYLON.Vector3(x, 3.8, z);
  arm.material = metalMat;

  // Torch handle
  const handle = BABYLON.MeshBuilder.CreateCylinder("torchHandle_" + roomIdx + torchIdx + side,
    { diameter: 0.11, height: 0.60, tessellation: 8 }, scene);
  handle.position = new BABYLON.Vector3(x + side * (-0.18), 3.95, z);
  handle.material = metalMat;

  // Flame (glowing cone)
  const flameMat = new BABYLON.StandardMaterial("flame_" + roomIdx + torchIdx + side, scene);
  flameMat.diffuseColor  = new BABYLON.Color3(1.0, 0.6, 0.1);
  flameMat.emissiveColor = new BABYLON.Color3(0.8, 0.4, 0.05);

  const flame = BABYLON.MeshBuilder.CreateCylinder("flame_" + roomIdx + torchIdx + side,
    { diameterTop: 0, diameterBottom: 0.20, height: 0.36, tessellation: 8 }, scene);
  flame.position = new BABYLON.Vector3(x + side * (-0.18), 4.30, z);
  flame.material = flameMat;

  // Point light at torch
  const light = new BABYLON.PointLight(
    "torchLight_" + roomIdx + torchIdx + side,
    new BABYLON.Vector3(x + side * (-0.18), 4.35, z),
    scene
  );
  light.diffuse    = new BABYLON.Color3(1.0, 0.70, 0.25);
  light.intensity  = 2.2;
  light.range      = 16;
  torchLights.push(light);
}

// ── Chandelier ────────────────────────────────────────────────────────────────

function _buildChandelier(scene, x, y, z, color, torchLights) {
  const metalMat = new BABYLON.StandardMaterial("chandMetal", scene);
  metalMat.diffuseColor = new BABYLON.Color3(0.55, 0.48, 0.20);

  // Central ring
  const ring = BABYLON.MeshBuilder.CreateTorus("chandRing",
    { diameter: 2.4, thickness: 0.10, tessellation: 32 }, scene);
  ring.position = new BABYLON.Vector3(x, y, z);
  ring.material = metalMat;

  // Chain up to ceiling
  const chain = BABYLON.MeshBuilder.CreateCylinder("chandChain",
    { diameter: 0.07, height: 1.2, tessellation: 6 }, scene);
  chain.position = new BABYLON.Vector3(x, y + 0.6, z);
  chain.material = metalMat;

  // Candles on ring
  const candleMat = new BABYLON.StandardMaterial("chandCandle", scene);
  candleMat.diffuseColor  = new BABYLON.Color3(0.95, 0.90, 0.80);
  const flameMat = new BABYLON.StandardMaterial("chandFlame", scene);
  flameMat.diffuseColor  = new BABYLON.Color3(1.0, 0.7, 0.1);
  flameMat.emissiveColor = new BABYLON.Color3(0.6, 0.3, 0.02);

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const cx2 = x + Math.cos(a) * 1.1;
    const cz2 = z + Math.sin(a) * 1.1;

    const candle = BABYLON.MeshBuilder.CreateCylinder("chandCandle_" + i,
      { diameter: 0.13, height: 0.26, tessellation: 8 }, scene);
    candle.position = new BABYLON.Vector3(cx2, y - 0.13, cz2);
    candle.material = candleMat;

    const fl = BABYLON.MeshBuilder.CreateCylinder("chandFlame_" + i,
      { diameterTop: 0, diameterBottom: 0.11, height: 0.18, tessellation: 8 }, scene);
    fl.position = new BABYLON.Vector3(cx2, y + 0.07, cz2);
    fl.material = flameMat;
  }

  // Central chandelier light
  const cl = new BABYLON.PointLight("chandLight", new BABYLON.Vector3(x, y - 0.1, z), scene);
  cl.diffuse   = new BABYLON.Color3(1.0, 0.85, 0.55);
  cl.intensity = 2.5;
  cl.range     = 22;
  torchLights.push(cl);
}

// ── Throne chair ──────────────────────────────────────────────────────────────

function _buildThroneChair(scene, x, z) {
  const goldMat = new BABYLON.StandardMaterial("throneMat", scene);
  goldMat.diffuseColor  = new BABYLON.Color3(0.85, 0.68, 0.10);
  goldMat.specularColor = new BABYLON.Color3(0.8, 0.7, 0.3);
  goldMat.specularPower = 64;

  const cushionMat = new BABYLON.StandardMaterial("cushionMat", scene);
  cushionMat.diffuseColor = new BABYLON.Color3(0.65, 0.08, 0.08);

  // Seat
  const seat = BABYLON.MeshBuilder.CreateBox("throneSeat",
    { width: 1.4, height: 0.22, depth: 1.1 }, scene);
  seat.position = new BABYLON.Vector3(x, 0.8, z);
  seat.material = goldMat;

  // Cushion
  const cushion = BABYLON.MeshBuilder.CreateBox("throneCushion",
    { width: 1.2, height: 0.14, depth: 0.9 }, scene);
  cushion.position = new BABYLON.Vector3(x, 0.95, z);
  cushion.material = cushionMat;

  // Backrest
  const back = BABYLON.MeshBuilder.CreateBox("throneBack",
    { width: 1.4, height: 1.8, depth: 0.18 }, scene);
  back.position = new BABYLON.Vector3(x, 1.80, z - 0.55);
  back.material = goldMat;

  // Armrests
  [[-0.61, 0], [0.61, 0]].forEach(([ax], ai) => {
    const arm = BABYLON.MeshBuilder.CreateBox("throneArm_" + ai,
      { width: 0.16, height: 0.55, depth: 1.0 }, scene);
    arm.position = new BABYLON.Vector3(x + ax, 1.07, z);
    arm.material = goldMat;
  });

  // Crown on top of backrest
  const crownMat = new BABYLON.StandardMaterial("crownMat", scene);
  crownMat.diffuseColor  = new BABYLON.Color3(1.0, 0.85, 0.10);
  crownMat.emissiveColor = new BABYLON.Color3(0.4, 0.30, 0.02);
  const crown = BABYLON.MeshBuilder.CreateCylinder("throneCrown",
    { diameterTop: 0.6, diameterBottom: 0.8, height: 0.4, tessellation: 6 }, scene);
  crown.position = new BABYLON.Vector3(x, 2.78, z - 0.55);
  crown.material = crownMat;
}

// ── Tile texture helper ───────────────────────────────────────────────────────

function _applyTileTexture(scene, mat, baseColor, uTiles, vTiles) {
  const size = 512;
  const dt = new BABYLON.DynamicTexture("tileTex_" + Math.random(), { width: size, height: size }, scene);
  const ctx = dt.getContext();
  const tw  = size / uTiles;
  const th  = size / vTiles;

  // Base fill
  const r = Math.floor(baseColor.r * 220);
  const g = Math.floor(baseColor.g * 200);
  const b = Math.floor(baseColor.b * 180);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, size, size);

  // Grout lines
  ctx.strokeStyle = `rgba(0,0,0,0.22)`;
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

function _triggerPuzzle(roomIndex, scene, onSuccess) {
  const { pool, type } = ROOMS[roomIndex];
  if (type === "throne") { _runThronePuzzle(onSuccess); return; }
  const q = mathPuzzles[pool][Math.floor(Math.random() * mathPuzzles[pool].length)];
  showPuzzle(q, type === "text" ? "text" : "choice", onSuccess);
}

function _runThronePuzzle(onSuccess) {
  let streak = 0;
  const needed = 3;
  function nextQ() {
    const pool = mathPuzzles.throne;
    const q = pool[Math.floor(Math.random() * pool.length)];
    showPuzzle(
      { ...q, question: `[${streak + 1}/${needed}] ${q.question}` },
      "choice",
      () => { streak++; if (streak >= needed) { onSuccess(); } else { nextQ(); } }
    );
  }
  nextQ();
}

// ─── HUD helpers ──────────────────────────────────────────────────────────────

function _updateHUD(locationEl, starsEl, roomIdx) {
  locationEl.textContent = `🏰 Math Castle — ${ROOMS[roomIdx].name}`;
  const save  = SaveManager.load();
  starsEl.textContent = save.mathIsland.roomsCompleted.map(d => d ? "⭐" : "☆").join(" ");
}

// ─── Victory screen ───────────────────────────────────────────────────────────

function _showVictory(scene, crownName, onExit) {
  const overlay = document.getElementById("ui-overlay");
  overlay.innerHTML = `
    <div class="puzzle-panel victory-panel">
      <span class="victory-emoji">👑</span>
      <p class="victory-title">You earned the ${crownName}!</p>
      <p class="victory-sub">Amazing! You solved ALL Math puzzles! 🎉🎉🎉</p>
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
