/**
 * MathCastleScene.js
 * Interior of the Math Castle — 4 rooms connected in a line.
 * Wide, tall halls with stone floors, pillars, torches, puzzle-door signs,
 * glowing floor markers, and decorative pedestals.
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

const ROOM_LENGTH = 30;
const ROOM_WIDTH  = 32;
const ROOM_HEIGHT = 7.0;

export function createMathCastleScene(engine, onExit) {
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.10, 0.08, 0.05, 1);

  // Bright ambient — well-lit interior
  const ambient = new BABYLON.HemisphericLight("ambLight", new BABYLON.Vector3(0, 1, 0), scene);
  ambient.intensity   = 0.70;
  ambient.diffuse     = new BABYLON.Color3(1.0, 0.95, 0.82);
  ambient.groundColor = new BABYLON.Color3(0.20, 0.14, 0.06);

  const doors = [];
  const torchLights = [];

  ROOMS.forEach((room, i) => {
    _buildRoom(scene, i, room.wallColor, room.accentColor, doors, torchLights);
  });

  // Player — start well inside so back wall is behind camera
  const player = createPlayer(scene);
  player.mesh.position = new BABYLON.Vector3(0, 0.5, 8);

  // Camera comfortable for wide room
  player.camera.radius           = 10;
  player.camera.lowerRadiusLimit  = 5;
  player.camera.upperRadiusLimit  = 18;

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

    // Torch flicker
    flickerT += 0.08;
    torchLights.forEach((tl, i) => {
      tl.intensity = 2.4 + 0.55 * Math.sin(flickerT * 3.1 + i * 1.7)
                         + 0.22 * Math.sin(flickerT * 7.3 + i * 2.3);
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
      if (dist < 1.5 && distX < 2.0) {
        if (SaveManager.isRoomUnlocked("mathIsland", i + 1)) {
          doorInfo.mesh.material.diffuseColor  = new BABYLON.Color3(0.1, 0.8, 0.2);
          doorInfo.mesh.material.emissiveColor = new BABYLON.Color3(0.0, 0.2, 0.0);
          return;
        }
        puzzleActive = true;
        player.mesh.position.z = doorInfo.z - 2.0;
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
  const baseZ    = idx * ROOM_LENGTH;
  const isThrone = idx === 3;
  const halfW    = ROOM_WIDTH / 2;       // 16
  const wallX    = halfW + 0.175;        // 16.175
  const ceilY    = ROOM_HEIGHT;          // 7.0
  const wallMidY = ROOM_HEIGHT / 2;      // 3.5

  // ── Materials ──────────────────────────────────────────────────────────
  const stoneMat = new BABYLON.StandardMaterial("stone_" + idx, scene);
  stoneMat.diffuseColor  = wallColor;
  stoneMat.specularColor = new BABYLON.Color3(0.08, 0.08, 0.08);

  const floorMat = new BABYLON.StandardMaterial("floor_" + idx, scene);
  floorMat.diffuseColor  = new BABYLON.Color3(
    wallColor.r * 0.78, wallColor.g * 0.74, wallColor.b * 0.68);
  floorMat.specularColor = new BABYLON.Color3(0.18, 0.14, 0.10);
  floorMat.specularPower = 32;

  const ceilMat = new BABYLON.StandardMaterial("ceil_" + idx, scene);
  ceilMat.diffuseColor = new BABYLON.Color3(
    wallColor.r * 0.58, wallColor.g * 0.55, wallColor.b * 0.52);

  // ── Floor ──────────────────────────────────────────────────────────────
  const floor = BABYLON.MeshBuilder.CreateBox("floor_" + idx,
    { width: ROOM_WIDTH, height: 0.22, depth: ROOM_LENGTH }, scene);
  floor.position = new BABYLON.Vector3(0, 0, baseZ + ROOM_LENGTH / 2);
  floor.material = floorMat;
  _applyTileTexture(scene, floorMat, wallColor, 16, 15);

  // Carpet runner
  const carpetMat = new BABYLON.StandardMaterial("carpet_" + idx, scene);
  carpetMat.diffuseColor  = isThrone
    ? new BABYLON.Color3(0.72, 0.55, 0.08)
    : new BABYLON.Color3(accentColor.r * 0.7, accentColor.g * 0.45, accentColor.b * 0.35);
  carpetMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);

  const carpet = BABYLON.MeshBuilder.CreateBox("carpet_" + idx,
    { width: 3.2, height: 0.02, depth: ROOM_LENGTH - 1 }, scene);
  carpet.position = new BABYLON.Vector3(0, 0.12, baseZ + ROOM_LENGTH / 2);
  carpet.material = carpetMat;

  // ── Walls ──────────────────────────────────────────────────────────────
  const lWall = BABYLON.MeshBuilder.CreateBox("lWall_" + idx,
    { width: 0.40, height: ROOM_HEIGHT, depth: ROOM_LENGTH }, scene);
  lWall.position = new BABYLON.Vector3(-wallX, wallMidY, baseZ + ROOM_LENGTH / 2);
  lWall.material = stoneMat;

  const rWall = BABYLON.MeshBuilder.CreateBox("rWall_" + idx,
    { width: 0.40, height: ROOM_HEIGHT, depth: ROOM_LENGTH }, scene);
  rWall.position = new BABYLON.Vector3(wallX, wallMidY, baseZ + ROOM_LENGTH / 2);
  rWall.material = stoneMat;

  // ── Ceiling with beams ────────────────────────────────────────────────
  const ceil = BABYLON.MeshBuilder.CreateBox("ceil_" + idx,
    { width: ROOM_WIDTH, height: 0.25, depth: ROOM_LENGTH }, scene);
  ceil.position = new BABYLON.Vector3(0, ceilY, baseZ + ROOM_LENGTH / 2);
  ceil.material = ceilMat;

  const beamMat = new BABYLON.StandardMaterial("beam_" + idx, scene);
  beamMat.diffuseColor = new BABYLON.Color3(0.32, 0.22, 0.10);
  [4, 10, 17, 24].forEach((bz, bi) => {
    const beam = BABYLON.MeshBuilder.CreateBox("beam_" + idx + bi,
      { width: ROOM_WIDTH + 0.5, height: 0.38, depth: 0.45 }, scene);
    beam.position = new BABYLON.Vector3(0, ceilY - 0.25, baseZ + bz);
    beam.material = beamMat;
  });

  // ── Stone pillars (3 pairs per room) ─────────────────────────────────
  const pillarMat = new BABYLON.StandardMaterial("pillar_" + idx, scene);
  pillarMat.diffuseColor  = new BABYLON.Color3(
    wallColor.r * 0.85, wallColor.g * 0.82, wallColor.b * 0.78);
  pillarMat.specularColor = new BABYLON.Color3(0.12, 0.12, 0.12);

  [6, 15, 24].forEach((pz, pi) => {
    [-12.0, 12.0].forEach((px, pxi) => {
      // Shaft
      const shaft = BABYLON.MeshBuilder.CreateCylinder(
        "pillarShaft_" + idx + pi + pxi,
        { diameter: 0.70, height: 6.6, tessellation: 12 }, scene);
      shaft.position = new BABYLON.Vector3(px, 3.3, baseZ + pz);
      shaft.material = pillarMat;

      // Capital
      const cap = BABYLON.MeshBuilder.CreateBox(
        "pillarCap_" + idx + pi + pxi,
        { width: 0.95, height: 0.28, depth: 0.95 }, scene);
      cap.position = new BABYLON.Vector3(px, 6.64, baseZ + pz);
      cap.material = pillarMat;

      // Base
      const base = BABYLON.MeshBuilder.CreateBox(
        "pillarBase_" + idx + pi + pxi,
        { width: 0.95, height: 0.24, depth: 0.95 }, scene);
      base.position = new BABYLON.Vector3(px, 0.12, baseZ + pz);
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

  [6, 15, 24].forEach((pz, pi) => {
    [-12.1, 12.1].forEach((px, pxi) => {
      const banner = BABYLON.MeshBuilder.CreateBox(
        "banner_" + idx + pi + pxi,
        { width: 0.70, height: 2.2, depth: 0.06 }, scene);
      banner.position = new BABYLON.Vector3(
        px + (px < 0 ? 0.42 : -0.42), 4.4, baseZ + pz);
      banner.material = bannerMat;

      const trim = BABYLON.MeshBuilder.CreateBox(
        "bannerTrim_" + idx + pi + pxi,
        { width: 0.70, height: 0.16, depth: 0.07 }, scene);
      trim.position = new BABYLON.Vector3(
        px + (px < 0 ? 0.42 : -0.42), 3.24, baseZ + pz);
      trim.material = bannerTrimMat;
    });
  });

  // ── Wall torches (4 pairs per room for extra brightness) ──────────────
  [4, 10, 17, 24].forEach((tz, ti) => {
    [-1, 1].forEach((side) => {
      _buildWallTorch(scene, side * 15.5, baseZ + tz, idx, ti, side, torchLights);
    });
  });

  // ── Decorative pedestals with glowing orbs (mid-room, both sides) ─────
  _buildPedestal(scene, -8.0, baseZ + ROOM_LENGTH / 2, accentColor);
  _buildPedestal(scene,  8.0, baseZ + ROOM_LENGTH / 2, accentColor);

  // Throne room: chandelier + throne chair
  if (isThrone) {
    _buildChandelier(scene, 0, 5.8, baseZ + ROOM_LENGTH / 2, accentColor, torchLights);
    _buildThroneChair(scene, 0, baseZ + ROOM_LENGTH - 4);
  }

  // ── Entry/Exit back wall ──────────────────────────────────────────────
  if (idx === 0) {
    const backWall = BABYLON.MeshBuilder.CreateBox("backWall",
      { width: ROOM_WIDTH, height: ROOM_HEIGHT, depth: 0.40 }, scene);
    backWall.position = new BABYLON.Vector3(0, wallMidY, baseZ);
    backWall.material = stoneMat;

    const exitDoor = BABYLON.MeshBuilder.CreateBox("exitDoor",
      { width: 3.0, height: 4.0, depth: 0.45 }, scene);
    exitDoor.position = new BABYLON.Vector3(0, 2.0, baseZ);
    const edMat = new BABYLON.StandardMaterial("exitDoorMat", scene);
    edMat.diffuseColor = new BABYLON.Color3(0.12, 0.07, 0.02);
    exitDoor.material = edMat;

    const exitArch = BABYLON.MeshBuilder.CreateSphere("exitArch",
      { diameterX: 3.0, diameterY: 1.2, diameterZ: 0.45, segments: 8 }, scene);
    exitArch.position = new BABYLON.Vector3(0, 4.2, baseZ);
    exitArch.material = edMat;
  }

  // ── Front wall with puzzle door ───────────────────────────────────────
  const doorZ = baseZ + ROOM_LENGTH;

  // Back plane of front wall
  const frontWall = BABYLON.MeshBuilder.CreateBox("frontWall_" + idx,
    { width: ROOM_WIDTH, height: ROOM_HEIGHT, depth: 0.40 }, scene);
  frontWall.position = new BABYLON.Vector3(0, wallMidY, doorZ);
  frontWall.material = stoneMat;

  // Door frame sides — each covers from door edge (±1.5) to room inner edge (±16)
  [[-9.25, 13.5], [9.25, 13.5]].forEach(([dx, dw], j) => {
    const seg = BABYLON.MeshBuilder.CreateBox("doorSeg_" + idx + j,
      { width: dw, height: ROOM_HEIGHT, depth: 0.40 }, scene);
    seg.position = new BABYLON.Vector3(dx, wallMidY, doorZ);
    seg.material = stoneMat;
  });

  // Door top filler
  const topFill = BABYLON.MeshBuilder.CreateBox("doorTop_" + idx,
    { width: 3.0, height: 2.8, depth: 0.40 }, scene);
  topFill.position = new BABYLON.Vector3(0, 5.6, doorZ);
  topFill.material = stoneMat;

  // Arch over door
  const archMat = new BABYLON.StandardMaterial("arch_" + idx, scene);
  archMat.diffuseColor = new BABYLON.Color3(
    wallColor.r * 0.92, wallColor.g * 0.90, wallColor.b * 0.86);
  const doorArch = BABYLON.MeshBuilder.CreateSphere("doorArch_" + idx,
    { diameterX: 3.0, diameterY: 1.4, diameterZ: 0.44, segments: 8 }, scene);
  doorArch.position = new BABYLON.Vector3(0, 4.4, doorZ);
  doorArch.material = archMat;

  // Puzzle door slab
  const doorSlab = BABYLON.MeshBuilder.CreateBox("doorSlab_" + idx,
    { width: 2.8, height: 4.2, depth: 0.25 }, scene);
  doorSlab.position = new BABYLON.Vector3(0, 2.1, doorZ);
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
    { diameter: 0.24, segments: 6 }, scene);
  handle.position = new BABYLON.Vector3(1.0, 2.2, doorZ - 0.18);
  handle.material = handleMat;

  // ── PUZZLE DOOR SIGN & FLOOR MARKER ──────────────────────────────────
  _buildPuzzleSign(scene, doorZ - 3.0, idx, accentColor);
  _buildFloorMarker(scene, doorZ - 1.8, accentColor);

  doors.push({ mesh: doorSlab, z: doorZ });
}

// ── Puzzle door sign ──────────────────────────────────────────────────────────

function _buildPuzzleSign(scene, z, idx, accentColor) {
  const postMat = new BABYLON.StandardMaterial("signPost_" + idx, scene);
  postMat.diffuseColor = new BABYLON.Color3(0.38, 0.24, 0.10);

  // Left post
  const postL = BABYLON.MeshBuilder.CreateCylinder("signPostL_" + idx,
    { diameter: 0.18, height: 3.2, tessellation: 8 }, scene);
  postL.position = new BABYLON.Vector3(-1.6, 1.6, z);
  postL.material = postMat;

  // Right post
  const postR = BABYLON.MeshBuilder.CreateCylinder("signPostR_" + idx,
    { diameter: 0.18, height: 3.2, tessellation: 8 }, scene);
  postR.position = new BABYLON.Vector3(1.6, 1.6, z);
  postR.material = postMat;

  // Sign board with DynamicTexture text
  const boardSize = 512;
  const dt = new BABYLON.DynamicTexture("signTex_" + idx, { width: boardSize, height: boardSize / 2 }, scene);
  const ctx = dt.getContext();

  // Board background
  ctx.fillStyle = "#3d1f00";
  ctx.fillRect(0, 0, boardSize, boardSize / 2);

  // Gold border
  ctx.strokeStyle = "#FFD700";
  ctx.lineWidth = 12;
  ctx.strokeRect(8, 8, boardSize - 16, boardSize / 2 - 16);

  // Arrow pointing forward
  ctx.fillStyle = "#FFE066";
  ctx.font = "bold 64px Arial";
  ctx.textAlign = "center";
  ctx.fillText("⬆ PUZZLE DOOR", boardSize / 2, 90);
  ctx.font = "bold 44px Arial";
  ctx.fillStyle = "#FFA040";
  ctx.fillText("Walk to the door!", boardSize / 2, 155);
  ctx.font = "40px Arial";
  ctx.fillStyle = "#FFDD88";
  ctx.fillText("Solve the puzzle to pass", boardSize / 2, 220);

  dt.update();

  const boardMat = new BABYLON.StandardMaterial("signBoard_" + idx, scene);
  boardMat.diffuseTexture  = dt;
  boardMat.emissiveTexture = dt;
  boardMat.emissiveColor   = new BABYLON.Color3(0.5, 0.4, 0.2);

  const board = BABYLON.MeshBuilder.CreateBox("signBoard_" + idx,
    { width: 3.4, height: 1.6, depth: 0.10 }, scene);
  board.position = new BABYLON.Vector3(0, 3.0, z);
  board.material = boardMat;

  // Accent color strip above board
  const stripMat = new BABYLON.StandardMaterial("signStrip_" + idx, scene);
  stripMat.diffuseColor  = accentColor;
  stripMat.emissiveColor = new BABYLON.Color3(
    accentColor.r * 0.4, accentColor.g * 0.4, accentColor.b * 0.4);
  const strip = BABYLON.MeshBuilder.CreateBox("signStrip_" + idx,
    { width: 3.6, height: 0.12, depth: 0.12 }, scene);
  strip.position = new BABYLON.Vector3(0, 3.86, z);
  strip.material = stripMat;
}

// ── Glowing floor marker in front of puzzle door ──────────────────────────────

function _buildFloorMarker(scene, z, accentColor) {
  // Outer ring glow
  const markerMat = new BABYLON.StandardMaterial("floorMarker_" + z, scene);
  markerMat.diffuseColor  = accentColor;
  markerMat.emissiveColor = new BABYLON.Color3(
    accentColor.r * 0.6, accentColor.g * 0.6, accentColor.b * 0.6);

  const outer = BABYLON.MeshBuilder.CreateBox("floorOuter_" + z,
    { width: 4.0, height: 0.03, depth: 1.0 }, scene);
  outer.position = new BABYLON.Vector3(0, 0.13, z);
  outer.material = markerMat;

  // Inner bright strip
  const innerMat = new BABYLON.StandardMaterial("floorInner_" + z, scene);
  innerMat.diffuseColor  = new BABYLON.Color3(1.0, 1.0, 0.9);
  innerMat.emissiveColor = new BABYLON.Color3(0.8, 0.7, 0.1);

  const inner = BABYLON.MeshBuilder.CreateBox("floorInner_" + z,
    { width: 2.8, height: 0.04, depth: 0.35 }, scene);
  inner.position = new BABYLON.Vector3(0, 0.14, z);
  inner.material = innerMat;

  // Foot-step arrows pointing toward door
  [-0.8, 0, 0.8].forEach((ox, ai) => {
    const arrowMat = new BABYLON.StandardMaterial("arrow_" + z + ai, scene);
    arrowMat.diffuseColor  = new BABYLON.Color3(1.0, 0.85, 0.1);
    arrowMat.emissiveColor = new BABYLON.Color3(0.5, 0.4, 0.0);
    const arrow = BABYLON.MeshBuilder.CreateBox("arrow_" + z + ai,
      { width: 0.30, height: 0.04, depth: 0.55 }, scene);
    arrow.position = new BABYLON.Vector3(ox, 0.15, z + 0.5);
    arrow.material = arrowMat;
  });
}

// ── Decorative pedestal with glowing orb ─────────────────────────────────────

function _buildPedestal(scene, x, z, accentColor) {
  const stoneMat = new BABYLON.StandardMaterial("pedStoneMat_" + x + z, scene);
  stoneMat.diffuseColor = new BABYLON.Color3(0.50, 0.46, 0.40);

  // Base slab
  const base = BABYLON.MeshBuilder.CreateBox("pedBase_" + x + z,
    { width: 0.80, height: 0.20, depth: 0.80 }, scene);
  base.position = new BABYLON.Vector3(x, 0.10, z);
  base.material = stoneMat;

  // Column
  const col = BABYLON.MeshBuilder.CreateCylinder("pedCol_" + x + z,
    { diameter: 0.35, height: 1.20, tessellation: 10 }, scene);
  col.position = new BABYLON.Vector3(x, 0.80, z);
  col.material = stoneMat;

  // Top cap
  const top = BABYLON.MeshBuilder.CreateBox("pedTop_" + x + z,
    { width: 0.70, height: 0.16, depth: 0.70 }, scene);
  top.position = new BABYLON.Vector3(x, 1.48, z);
  top.material = stoneMat;

  // Glowing orb
  const orbMat = new BABYLON.StandardMaterial("orb_" + x + z, scene);
  orbMat.diffuseColor  = accentColor;
  orbMat.emissiveColor = new BABYLON.Color3(
    accentColor.r * 0.7, accentColor.g * 0.7, accentColor.b * 0.7);
  orbMat.alpha = 0.92;

  const orb = BABYLON.MeshBuilder.CreateSphere("orb_" + x + z,
    { diameter: 0.45, segments: 10 }, scene);
  orb.position = new BABYLON.Vector3(x, 1.78, z);
  orb.material = orbMat;

  // Small point light from orb
  const orbLight = new BABYLON.PointLight("orbLight_" + x + z,
    new BABYLON.Vector3(x, 1.8, z), scene);
  orbLight.diffuse    = accentColor;
  orbLight.intensity  = 0.8;
  orbLight.range      = 8;
}

// ── Wall torch with bracket ───────────────────────────────────────────────────

function _buildWallTorch(scene, x, z, roomIdx, torchIdx, side, torchLights) {
  const metalMat = new BABYLON.StandardMaterial("torchMetal_" + roomIdx + torchIdx + side, scene);
  metalMat.diffuseColor = new BABYLON.Color3(0.25, 0.22, 0.18);

  const arm = BABYLON.MeshBuilder.CreateBox("torchArm_" + roomIdx + torchIdx + side,
    { width: 0.42, height: 0.10, depth: 0.10 }, scene);
  arm.position = new BABYLON.Vector3(x, 4.0, z);
  arm.material = metalMat;

  const handle = BABYLON.MeshBuilder.CreateCylinder("torchHandle_" + roomIdx + torchIdx + side,
    { diameter: 0.12, height: 0.65, tessellation: 8 }, scene);
  handle.position = new BABYLON.Vector3(x + side * (-0.20), 4.15, z);
  handle.material = metalMat;

  const flameMat = new BABYLON.StandardMaterial("flame_" + roomIdx + torchIdx + side, scene);
  flameMat.diffuseColor  = new BABYLON.Color3(1.0, 0.6, 0.1);
  flameMat.emissiveColor = new BABYLON.Color3(0.8, 0.4, 0.05);

  const flame = BABYLON.MeshBuilder.CreateCylinder("flame_" + roomIdx + torchIdx + side,
    { diameterTop: 0, diameterBottom: 0.22, height: 0.38, tessellation: 8 }, scene);
  flame.position = new BABYLON.Vector3(x + side * (-0.20), 4.52, z);
  flame.material = flameMat;

  const light = new BABYLON.PointLight(
    "torchLight_" + roomIdx + torchIdx + side,
    new BABYLON.Vector3(x + side * (-0.20), 4.55, z),
    scene
  );
  light.diffuse    = new BABYLON.Color3(1.0, 0.72, 0.28);
  light.intensity  = 2.4;
  light.range      = 20;
  torchLights.push(light);
}

// ── Chandelier ────────────────────────────────────────────────────────────────

function _buildChandelier(scene, x, y, z, color, torchLights) {
  const metalMat = new BABYLON.StandardMaterial("chandMetal", scene);
  metalMat.diffuseColor = new BABYLON.Color3(0.55, 0.48, 0.20);

  const ring = BABYLON.MeshBuilder.CreateTorus("chandRing",
    { diameter: 3.0, thickness: 0.12, tessellation: 32 }, scene);
  ring.position = new BABYLON.Vector3(x, y, z);
  ring.material = metalMat;

  const chain = BABYLON.MeshBuilder.CreateCylinder("chandChain",
    { diameter: 0.08, height: 1.5, tessellation: 6 }, scene);
  chain.position = new BABYLON.Vector3(x, y + 0.75, z);
  chain.material = metalMat;

  const candleMat = new BABYLON.StandardMaterial("chandCandle", scene);
  candleMat.diffuseColor = new BABYLON.Color3(0.95, 0.90, 0.80);
  const flameMat = new BABYLON.StandardMaterial("chandFlame", scene);
  flameMat.diffuseColor  = new BABYLON.Color3(1.0, 0.7, 0.1);
  flameMat.emissiveColor = new BABYLON.Color3(0.6, 0.3, 0.02);

  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const cx2 = x + Math.cos(a) * 1.4;
    const cz2 = z + Math.sin(a) * 1.4;

    const candle = BABYLON.MeshBuilder.CreateCylinder("chandCandle_" + i,
      { diameter: 0.14, height: 0.28, tessellation: 8 }, scene);
    candle.position = new BABYLON.Vector3(cx2, y - 0.14, cz2);
    candle.material = candleMat;

    const fl = BABYLON.MeshBuilder.CreateCylinder("chandFlame_" + i,
      { diameterTop: 0, diameterBottom: 0.12, height: 0.20, tessellation: 8 }, scene);
    fl.position = new BABYLON.Vector3(cx2, y + 0.08, cz2);
    fl.material = flameMat;
  }

  const cl = new BABYLON.PointLight("chandLight", new BABYLON.Vector3(x, y - 0.1, z), scene);
  cl.diffuse   = new BABYLON.Color3(1.0, 0.88, 0.58);
  cl.intensity = 3.0;
  cl.range     = 28;
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

  const seat = BABYLON.MeshBuilder.CreateBox("throneSeat",
    { width: 1.6, height: 0.24, depth: 1.2 }, scene);
  seat.position = new BABYLON.Vector3(x, 0.8, z);
  seat.material = goldMat;

  const cushion = BABYLON.MeshBuilder.CreateBox("throneCushion",
    { width: 1.4, height: 0.16, depth: 1.0 }, scene);
  cushion.position = new BABYLON.Vector3(x, 0.96, z);
  cushion.material = cushionMat;

  const back = BABYLON.MeshBuilder.CreateBox("throneBack",
    { width: 1.6, height: 2.2, depth: 0.20 }, scene);
  back.position = new BABYLON.Vector3(x, 2.0, z - 0.60);
  back.material = goldMat;

  [[-0.70, 0], [0.70, 0]].forEach(([ax], ai) => {
    const arm = BABYLON.MeshBuilder.CreateBox("throneArm_" + ai,
      { width: 0.18, height: 0.60, depth: 1.1 }, scene);
    arm.position = new BABYLON.Vector3(x + ax, 1.10, z);
    arm.material = goldMat;
  });

  const crownMat = new BABYLON.StandardMaterial("crownMat", scene);
  crownMat.diffuseColor  = new BABYLON.Color3(1.0, 0.85, 0.10);
  crownMat.emissiveColor = new BABYLON.Color3(0.4, 0.30, 0.02);
  const crown = BABYLON.MeshBuilder.CreateCylinder("throneCrown",
    { diameterTop: 0.65, diameterBottom: 0.90, height: 0.45, tessellation: 6 }, scene);
  crown.position = new BABYLON.Vector3(x, 3.18, z - 0.60);
  crown.material = crownMat;
}

// ── Tile texture helper ───────────────────────────────────────────────────────

function _applyTileTexture(scene, mat, baseColor, uTiles, vTiles) {
  const size = 512;
  const dt = new BABYLON.DynamicTexture("tileTex_" + Math.random(), { width: size, height: size }, scene);
  const ctx = dt.getContext();
  const tw  = size / uTiles;
  const th  = size / vTiles;

  const r = Math.floor(baseColor.r * 220);
  const g = Math.floor(baseColor.g * 200);
  const b = Math.floor(baseColor.b * 180);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = `rgba(0,0,0,0.22)`;
  ctx.lineWidth = 3;
  for (let col = 0; col <= uTiles; col++) {
    ctx.beginPath(); ctx.moveTo(col * tw, 0); ctx.lineTo(col * tw, size); ctx.stroke();
  }
  for (let row = 0; row <= vTiles; row++) {
    ctx.beginPath(); ctx.moveTo(0, row * th); ctx.lineTo(size, row * th); ctx.stroke();
  }
  dt.update();
  mat.diffuseTexture = dt;
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
