/**
 * MathCastleScene.js
 * Interior of the Math Castle — 4 rooms connected in a line.
 * Wide, tall halls with dynamic camera occlusion prevention so walls
 * never block the player's view.
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

const ROOM_LENGTH  = 40;
const ROOM_WIDTH   = 80;
const ROOM_HEIGHT  = 7.0;
const DESIRED_RADIUS = 12;   // default camera pull-back distance

export function createMathCastleScene(engine, onExit) {
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.10, 0.08, 0.05, 1);

  const ambient = new BABYLON.HemisphericLight("ambLight", new BABYLON.Vector3(0, 1, 0), scene);
  ambient.intensity   = 0.72;
  ambient.diffuse     = new BABYLON.Color3(1.0, 0.95, 0.82);
  ambient.groundColor = new BABYLON.Color3(0.20, 0.14, 0.06);

  const doors = [];
  const torchLights = [];

  ROOMS.forEach((room, i) => {
    _buildRoom(scene, i, room.wallColor, room.accentColor, doors, torchLights);
  });

  const player = createPlayer(scene);
  player.mesh.position = new BABYLON.Vector3(0, 0.5, 10);

  // Starting camera position — slightly zoomed in; render loop manages it dynamically
  player.camera.radius           = DESIRED_RADIUS;
  player.camera.lowerRadiusLimit  = 3;
  player.camera.upperRadiusLimit  = 28;

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

    flickerT += 0.08;
    torchLights.forEach((tl, i) => {
      tl.intensity = 2.5 + 0.55 * Math.sin(flickerT * 3.1 + i * 1.7)
                         + 0.22 * Math.sin(flickerT * 7.3 + i * 2.3);
    });

    const pz = player.mesh.position.z;
    const px = player.mesh.position.x;

    // ── Dynamic camera radius — keep camera inside room walls ─────────
    const roomBaseZ  = currentRoom * ROOM_LENGTH;
    const halfW      = ROOM_WIDTH / 2;
    const distBack   = Math.max(0.5, pz - roomBaseZ);          // to back wall
    const distFront  = Math.max(0.5, roomBaseZ + ROOM_LENGTH - pz); // to front wall
    const distLeft   = Math.max(0.5, px + halfW);              // to left wall
    const distRight  = Math.max(0.5, halfW - px);              // to right wall
    // Allow camera up to 80% of the nearest wall distance — always a clear view
    const safeRadius = Math.min(
      DESIRED_RADIUS,
      distBack  * 0.80,
      distFront * 0.80,
      distLeft  * 0.80,
      distRight * 0.80
    );
    const clampedR = Math.max(3.0, safeRadius);
    // Smoothly snap radius so it doesn't jerk
    player.camera.radius = BABYLON.Scalar.Lerp(player.camera.radius, clampedR, 0.18);
    player.camera.upperRadiusLimit = clampedR + 0.5;

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
      if (Math.abs(pz - doorInfo.z) < 1.8 && Math.abs(px) < 2.5) {
        if (SaveManager.isRoomUnlocked("mathIsland", i + 1)) {
          doorInfo.mesh.material.diffuseColor  = new BABYLON.Color3(0.1, 0.8, 0.2);
          doorInfo.mesh.material.emissiveColor = new BABYLON.Color3(0.0, 0.2, 0.0);
          return;
        }
        puzzleActive = true;
        player.mesh.position.z = doorInfo.z - 2.5;
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
  const halfW    = ROOM_WIDTH / 2;        // 40
  const wallX    = halfW + 0.20;          // 40.20 — wall centre x
  const ceilY    = ROOM_HEIGHT;           // 7.0
  const wallMidY = ROOM_HEIGHT / 2;       // 3.5

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
  _applyTileTexture(scene, floorMat, wallColor, 20, 10);

  // Carpet runner
  const carpetMat = new BABYLON.StandardMaterial("carpet_" + idx, scene);
  carpetMat.diffuseColor = isThrone
    ? new BABYLON.Color3(0.72, 0.55, 0.08)
    : new BABYLON.Color3(accentColor.r * 0.7, accentColor.g * 0.45, accentColor.b * 0.35);

  const carpet = BABYLON.MeshBuilder.CreateBox("carpet_" + idx,
    { width: 4.0, height: 0.02, depth: ROOM_LENGTH - 1 }, scene);
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

  // ── Stone pillars — 3 pairs across the length ─────────────────────────
  const pillarMat = new BABYLON.StandardMaterial("pillar_" + idx, scene);
  pillarMat.diffuseColor  = new BABYLON.Color3(
    wallColor.r * 0.85, wallColor.g * 0.82, wallColor.b * 0.78);
  pillarMat.specularColor = new BABYLON.Color3(0.12, 0.12, 0.12);

  [8, 20, 32].forEach((pz, pi) => {
    [-20.0, 20.0].forEach((px, pxi) => {
      const shaft = BABYLON.MeshBuilder.CreateCylinder(
        "pillarShaft_" + idx + pi + pxi,
        { diameter: 0.85, height: 6.6, tessellation: 12 }, scene);
      shaft.position = new BABYLON.Vector3(px, 3.3, baseZ + pz);
      shaft.material = pillarMat;

      const cap = BABYLON.MeshBuilder.CreateBox(
        "pillarCap_" + idx + pi + pxi,
        { width: 1.10, height: 0.30, depth: 1.10 }, scene);
      cap.position = new BABYLON.Vector3(px, 6.65, baseZ + pz);
      cap.material = pillarMat;

      const base = BABYLON.MeshBuilder.CreateBox(
        "pillarBase_" + idx + pi + pxi,
        { width: 1.10, height: 0.26, depth: 1.10 }, scene);
      base.position = new BABYLON.Vector3(px, 0.13, baseZ + pz);
      base.material = pillarMat;
    });
  });

  // ── Hanging banners ────────────────────────────────────────────────────
  const bannerMat = new BABYLON.StandardMaterial("banner_" + idx, scene);
  bannerMat.diffuseColor  = accentColor;
  bannerMat.emissiveColor = new BABYLON.Color3(
    accentColor.r * 0.15, accentColor.g * 0.15, accentColor.b * 0.15);

  const bannerTrimMat = new BABYLON.StandardMaterial("bannerTrim_" + idx, scene);
  bannerTrimMat.diffuseColor = new BABYLON.Color3(0.9, 0.8, 0.2);

  [8, 20, 32].forEach((pz, pi) => {
    [-20.2, 20.2].forEach((px, pxi) => {
      const banner = BABYLON.MeshBuilder.CreateBox(
        "banner_" + idx + pi + pxi,
        { width: 0.80, height: 2.5, depth: 0.07 }, scene);
      banner.position = new BABYLON.Vector3(
        px + (px < 0 ? 0.50 : -0.50), 4.5, baseZ + pz);
      banner.material = bannerMat;

      const trim = BABYLON.MeshBuilder.CreateBox(
        "bannerTrim_" + idx + pi + pxi,
        { width: 0.80, height: 0.18, depth: 0.08 }, scene);
      trim.position = new BABYLON.Vector3(
        px + (px < 0 ? 0.50 : -0.50), 3.14, baseZ + pz);
      trim.material = bannerTrimMat;
    });
  });

  // ── Wall torches — 5 pairs along the length ───────────────────────────
  [5, 13, 21, 29, 37].forEach((tz, ti) => {
    [-1, 1].forEach((side) => {
      _buildWallTorch(scene, side * 39.0, baseZ + tz, idx, ti, side, torchLights);
    });
  });

  // ── Decorative pedestals mid-room ─────────────────────────────────────
  _buildPedestal(scene, -12.0, baseZ + ROOM_LENGTH / 2, accentColor);
  _buildPedestal(scene,  12.0, baseZ + ROOM_LENGTH / 2, accentColor);
  // Extra pedestals for depth
  _buildPedestal(scene, -12.0, baseZ + ROOM_LENGTH * 0.25, accentColor);
  _buildPedestal(scene,  12.0, baseZ + ROOM_LENGTH * 0.25, accentColor);
  _buildPedestal(scene, -12.0, baseZ + ROOM_LENGTH * 0.75, accentColor);
  _buildPedestal(scene,  12.0, baseZ + ROOM_LENGTH * 0.75, accentColor);

  if (isThrone) {
    _buildChandelier(scene, 0, 5.8, baseZ + ROOM_LENGTH / 2, accentColor, torchLights);
    _buildThroneChair(scene, 0, baseZ + ROOM_LENGTH - 5);
  }

  // ── Entry/Exit back wall ──────────────────────────────────────────────
  if (idx === 0) {
    const backWall = BABYLON.MeshBuilder.CreateBox("backWall",
      { width: ROOM_WIDTH, height: ROOM_HEIGHT, depth: 0.40 }, scene);
    backWall.position = new BABYLON.Vector3(0, wallMidY, baseZ);
    backWall.material = stoneMat;

    const exitDoor = BABYLON.MeshBuilder.CreateBox("exitDoor",
      { width: 4.0, height: 5.0, depth: 0.45 }, scene);
    exitDoor.position = new BABYLON.Vector3(0, 2.5, baseZ);
    const edMat = new BABYLON.StandardMaterial("exitDoorMat", scene);
    edMat.diffuseColor = new BABYLON.Color3(0.12, 0.07, 0.02);
    exitDoor.material = edMat;

    const exitArch = BABYLON.MeshBuilder.CreateSphere("exitArch",
      { diameterX: 4.0, diameterY: 1.4, diameterZ: 0.45, segments: 8 }, scene);
    exitArch.position = new BABYLON.Vector3(0, 5.2, baseZ);
    exitArch.material = edMat;
  }

  // ── Front wall with puzzle door ───────────────────────────────────────
  const doorZ = baseZ + ROOM_LENGTH;

  const frontWall = BABYLON.MeshBuilder.CreateBox("frontWall_" + idx,
    { width: ROOM_WIDTH, height: ROOM_HEIGHT, depth: 0.40 }, scene);
  frontWall.position = new BABYLON.Vector3(0, wallMidY, doorZ);
  frontWall.material = stoneMat;

  // Door opening is 4.0 wide; side panels cover the rest
  [[-22.0, 36.0], [22.0, 36.0]].forEach(([dx, dw], j) => {
    const seg = BABYLON.MeshBuilder.CreateBox("doorSeg_" + idx + j,
      { width: dw, height: ROOM_HEIGHT, depth: 0.40 }, scene);
    seg.position = new BABYLON.Vector3(dx, wallMidY, doorZ);
    seg.material = stoneMat;
  });

  const topFill = BABYLON.MeshBuilder.CreateBox("doorTop_" + idx,
    { width: 4.2, height: 2.6, depth: 0.40 }, scene);
  topFill.position = new BABYLON.Vector3(0, 5.7, doorZ);
  topFill.material = stoneMat;

  const archMat = new BABYLON.StandardMaterial("arch_" + idx, scene);
  archMat.diffuseColor = new BABYLON.Color3(
    wallColor.r * 0.92, wallColor.g * 0.90, wallColor.b * 0.86);
  const doorArch = BABYLON.MeshBuilder.CreateSphere("doorArch_" + idx,
    { diameterX: 4.2, diameterY: 1.6, diameterZ: 0.44, segments: 8 }, scene);
  doorArch.position = new BABYLON.Vector3(0, 4.6, doorZ);
  doorArch.material = archMat;

  const doorSlab = BABYLON.MeshBuilder.CreateBox("doorSlab_" + idx,
    { width: 4.0, height: 4.4, depth: 0.28 }, scene);
  doorSlab.position = new BABYLON.Vector3(0, 2.2, doorZ);
  const doorSlabMat = new BABYLON.StandardMaterial("doorSlabMat_" + idx, scene);
  const save   = SaveManager.load();
  const solved = save.mathIsland.roomsCompleted[idx];
  doorSlabMat.diffuseColor  = solved ? new BABYLON.Color3(0.1, 0.8, 0.2) : new BABYLON.Color3(0.78, 0.10, 0.10);
  doorSlabMat.emissiveColor = solved ? new BABYLON.Color3(0.0, 0.2, 0.0) : new BABYLON.Color3(0.15, 0.0, 0.0);
  doorSlab.material = doorSlabMat;

  const handleMat = new BABYLON.StandardMaterial("handle_" + idx, scene);
  handleMat.diffuseColor = new BABYLON.Color3(0.3, 0.3, 0.3);
  const handle = BABYLON.MeshBuilder.CreateSphere("handle_" + idx,
    { diameter: 0.28, segments: 6 }, scene);
  handle.position = new BABYLON.Vector3(1.4, 2.4, doorZ - 0.20);
  handle.material = handleMat;

  // ── Puzzle sign & floor marker ────────────────────────────────────────
  _buildPuzzleSign(scene, doorZ - 4.0, idx, accentColor);
  _buildFloorMarker(scene, doorZ - 2.2, accentColor);
  _addRoomFurniture(scene, idx, baseZ, wallColor, accentColor);

  doors.push({ mesh: doorSlab, z: doorZ });
}

// ── Room furniture ────────────────────────────────────────────────────────────────────────────────
function _addRoomFurniture(scene, idx, baseZ, wallColor, accentColor) {
  const hw = ROOM_WIDTH / 2;
  const woodMat = new BABYLON.StandardMaterial("mFurWood_" + idx, scene);
  woodMat.diffuseColor = new BABYLON.Color3(0.48, 0.30, 0.12);
  const darkMat = new BABYLON.StandardMaterial("mFurDark_" + idx, scene);
  darkMat.diffuseColor = new BABYLON.Color3(0.28, 0.18, 0.08);
  const rugMat = new BABYLON.StandardMaterial("mFurRug_" + idx, scene);
  rugMat.diffuseColor = new BABYLON.Color3(
    accentColor.r * 0.5, accentColor.g * 0.35, accentColor.b * 0.25);

  // Rug in centre of room
  const rug = BABYLON.MeshBuilder.CreateBox("mRug_" + idx,
    { width: 16, height: 0.04, depth: 20 }, scene);
  rug.position = new BABYLON.Vector3(0, 0.12, baseZ + ROOM_LENGTH / 2);
  rug.material = rugMat;

  // Two bookshelves along side walls (inside pillar gaps)
  for (const [sx, sz] of [[-(hw-2), baseZ+6], [(hw-2), baseZ+6],
                           [-(hw-2), baseZ+16], [(hw-2), baseZ+16],
                           [-(hw-2), baseZ+26], [(hw-2), baseZ+26]]) {
    const shelf = BABYLON.MeshBuilder.CreateBox("mShelf_" + idx + sx + sz,
      { width: 0.40, height: 4.0, depth: 3.0 }, scene);
    shelf.position = new BABYLON.Vector3(sx, 2.0, sz);
    shelf.material = woodMat;
    // Books on shelf
    for (let bi = 0; bi < 4; bi++) {
      const bMat = new BABYLON.StandardMaterial("mBook_" + idx + sx + sz + bi, scene);
      bMat.diffuseColor = new BABYLON.Color3(Math.random()*0.5+0.3, Math.random()*0.3, Math.random()*0.4+0.2);
      const book = BABYLON.MeshBuilder.CreateBox("mBook_" + idx + sx + sz + bi,
        { width: 0.35, height: 0.50, depth: 0.45 + Math.random()*0.4 }, scene);
      book.material = bMat;
      book.position = new BABYLON.Vector3(sx + (Math.random()-0.5)*0.3,
        0.8 + bi * 0.95, sz);
    }
  }

  // Central reading table in each room (skip throne)
  if (idx !== 3) {
    const table = BABYLON.MeshBuilder.CreateBox("mTable_" + idx,
      { width: 6, height: 0.18, depth: 3 }, scene);
    table.position = new BABYLON.Vector3(0, 1.0, baseZ + ROOM_LENGTH * 0.65);
    table.material = woodMat;
    for (const [tx, tz] of [[-2.6,-1.1],[2.6,-1.1],[-2.6,1.1],[2.6,1.1]]) {
      const leg = BABYLON.MeshBuilder.CreateBox("mTLeg_" + idx + tx + tz,
        { width: 0.18, height: 1.0, depth: 0.18 }, scene);
      leg.position = new BABYLON.Vector3(tx, 0.50, baseZ + ROOM_LENGTH * 0.65 + tz);
      leg.material = woodMat;
    }
    // Two chairs beside table
    for (const cx of [-4.2, 4.2]) {
      const seat = BABYLON.MeshBuilder.CreateBox("mChairS_" + idx + cx,
        { width: 1.0, height: 0.12, depth: 1.0 }, scene);
      seat.position = new BABYLON.Vector3(cx, 0.75, baseZ + ROOM_LENGTH * 0.65);
      seat.material = woodMat;
      const back = BABYLON.MeshBuilder.CreateBox("mChairB_" + idx + cx,
        { width: 1.0, height: 1.0, depth: 0.12 }, scene);
      back.position = new BABYLON.Vector3(cx, 1.25, baseZ + ROOM_LENGTH * 0.65 - 0.5);
      back.material = woodMat;
    }
  }

  // Bench near entrance
  const bench = BABYLON.MeshBuilder.CreateBox("mBench_" + idx,
    { width: 6, height: 0.14, depth: 0.9 }, scene);
  bench.position = new BABYLON.Vector3(0, 0.60, baseZ + 5);
  bench.material = woodMat;
  for (const bx of [-2.2, 2.2]) {
    const bLeg = BABYLON.MeshBuilder.CreateBox("mBenchLeg_" + idx + bx,
      { width: 0.16, height: 0.60, depth: 0.80 }, scene);
    bLeg.position = new BABYLON.Vector3(bx, 0.30, baseZ + 5);
    bLeg.material = darkMat;
  }

  // Corner barrels
  for (const [bx, bz] of [[-(hw-3), baseZ+4], [(hw-3), baseZ+4]]) {
    for (let bi = 0; bi < 3; bi++) {
      const barrel = BABYLON.MeshBuilder.CreateCylinder("mBarrel_" + idx + bx + bi,
        { diameter: 1.0, height: 1.3, tessellation: 10 }, scene);
      barrel.position = new BABYLON.Vector3(bx + bi * 1.15, 0.65, bz);
      barrel.material = darkMat;
    }
  }
} ──────────────────────────────────────────────────────────

function _buildPuzzleSign(scene, z, idx, accentColor) {
  const postMat = new BABYLON.StandardMaterial("signPost_" + idx, scene);
  postMat.diffuseColor = new BABYLON.Color3(0.38, 0.24, 0.10);

  const postL = BABYLON.MeshBuilder.CreateCylinder("signPostL_" + idx,
    { diameter: 0.22, height: 3.6, tessellation: 8 }, scene);
  postL.position = new BABYLON.Vector3(-2.2, 1.8, z);
  postL.material = postMat;

  const postR = BABYLON.MeshBuilder.CreateCylinder("signPostR_" + idx,
    { diameter: 0.22, height: 3.6, tessellation: 8 }, scene);
  postR.position = new BABYLON.Vector3(2.2, 1.8, z);
  postR.material = postMat;

  const boardSize = 512;
  const bh = 256;
  const dt = new BABYLON.DynamicTexture("signTex_" + idx,
    { width: boardSize, height: bh }, scene);
  dt.drawText("ROOM " + (idx + 1),         null,  90, "bold 72px Arial", "#FFD700", "transparent", true, false);
  dt.drawText("Math Challenge",            null, 162, "bold 44px Arial", "#FF8800", null,          true, false);
  dt.drawText("Walk to the door to play!", null, 228, "34px Arial",      "#553300", null,          true, true);
  dt.uScale = -1;

  const boardMat = new BABYLON.StandardMaterial("signBoard_" + idx, scene);
  boardMat.diffuseColor   = new BABYLON.Color3(0.16, 0.09, 0.02);
  boardMat.diffuseTexture = dt;

  const board = BABYLON.MeshBuilder.CreateBox("signBoard_" + idx,
    { width: 4.6, height: 2.0, depth: 0.12 }, scene);
  board.position = new BABYLON.Vector3(0, 3.4, z);
  board.material = boardMat;

  const stripMat = new BABYLON.StandardMaterial("signStrip_" + idx, scene);
  stripMat.diffuseColor  = accentColor;
  stripMat.emissiveColor = new BABYLON.Color3(
    accentColor.r * 0.4, accentColor.g * 0.4, accentColor.b * 0.4);
  const strip = BABYLON.MeshBuilder.CreateBox("signStrip_" + idx,
    { width: 4.8, height: 0.14, depth: 0.14 }, scene);
  strip.position = new BABYLON.Vector3(0, 4.44, z);
  strip.material = stripMat;
}

// ── Glowing floor marker ──────────────────────────────────────────────────────

function _buildFloorMarker(scene, z, accentColor) {
  const markerMat = new BABYLON.StandardMaterial("floorMarker_" + z, scene);
  markerMat.diffuseColor  = accentColor;
  markerMat.emissiveColor = new BABYLON.Color3(
    accentColor.r * 0.6, accentColor.g * 0.6, accentColor.b * 0.6);

  const outer = BABYLON.MeshBuilder.CreateBox("floorOuter_" + z,
    { width: 6.0, height: 0.03, depth: 1.2 }, scene);
  outer.position = new BABYLON.Vector3(0, 0.13, z);
  outer.material = markerMat;

  const innerMat = new BABYLON.StandardMaterial("floorInner_" + z, scene);
  innerMat.diffuseColor  = new BABYLON.Color3(1.0, 1.0, 0.9);
  innerMat.emissiveColor = new BABYLON.Color3(0.8, 0.7, 0.1);

  const inner = BABYLON.MeshBuilder.CreateBox("floorInner_" + z,
    { width: 4.0, height: 0.04, depth: 0.45 }, scene);
  inner.position = new BABYLON.Vector3(0, 0.14, z);
  inner.material = innerMat;

  [-1.2, 0, 1.2].forEach((ox, ai) => {
    const arrowMat = new BABYLON.StandardMaterial("arrow_" + z + ai, scene);
    arrowMat.diffuseColor  = new BABYLON.Color3(1.0, 0.85, 0.1);
    arrowMat.emissiveColor = new BABYLON.Color3(0.5, 0.4, 0.0);
    const arrow = BABYLON.MeshBuilder.CreateBox("arrow_" + z + ai,
      { width: 0.38, height: 0.04, depth: 0.65 }, scene);
    arrow.position = new BABYLON.Vector3(ox, 0.15, z + 0.6);
    arrow.material = arrowMat;
  });
}

// ── Decorative pedestal with glowing orb ─────────────────────────────────────

function _buildPedestal(scene, x, z, accentColor) {
  const stoneMat = new BABYLON.StandardMaterial("pedStoneMat_" + x + "_" + z, scene);
  stoneMat.diffuseColor = new BABYLON.Color3(0.50, 0.46, 0.40);

  const base = BABYLON.MeshBuilder.CreateBox("pedBase_" + x + "_" + z,
    { width: 0.90, height: 0.22, depth: 0.90 }, scene);
  base.position = new BABYLON.Vector3(x, 0.11, z);
  base.material = stoneMat;

  const col = BABYLON.MeshBuilder.CreateCylinder("pedCol_" + x + "_" + z,
    { diameter: 0.38, height: 1.30, tessellation: 10 }, scene);
  col.position = new BABYLON.Vector3(x, 0.87, z);
  col.material = stoneMat;

  const top = BABYLON.MeshBuilder.CreateBox("pedTop_" + x + "_" + z,
    { width: 0.78, height: 0.18, depth: 0.78 }, scene);
  top.position = new BABYLON.Vector3(x, 1.61, z);
  top.material = stoneMat;

  const orbMat = new BABYLON.StandardMaterial("orb_" + x + "_" + z, scene);
  orbMat.diffuseColor  = accentColor;
  orbMat.emissiveColor = new BABYLON.Color3(
    accentColor.r * 0.7, accentColor.g * 0.7, accentColor.b * 0.7);
  orbMat.alpha = 0.92;

  const orb = BABYLON.MeshBuilder.CreateSphere("orb_" + x + "_" + z,
    { diameter: 0.50, segments: 10 }, scene);
  orb.position = new BABYLON.Vector3(x, 1.95, z);
  orb.material = orbMat;

  const orbLight = new BABYLON.PointLight("orbLight_" + x + "_" + z,
    new BABYLON.Vector3(x, 2.0, z), scene);
  orbLight.diffuse   = accentColor;
  orbLight.intensity = 0.9;
  orbLight.range     = 10;
}

// ── Wall torch ────────────────────────────────────────────────────────────────

function _buildWallTorch(scene, x, z, roomIdx, torchIdx, side, torchLights) {
  const metalMat = new BABYLON.StandardMaterial("torchMetal_" + roomIdx + torchIdx + side, scene);
  metalMat.diffuseColor = new BABYLON.Color3(0.25, 0.22, 0.18);

  const arm = BABYLON.MeshBuilder.CreateBox("torchArm_" + roomIdx + torchIdx + side,
    { width: 0.45, height: 0.11, depth: 0.11 }, scene);
  arm.position = new BABYLON.Vector3(x, 4.2, z);
  arm.material = metalMat;

  const handle = BABYLON.MeshBuilder.CreateCylinder("torchHandle_" + roomIdx + torchIdx + side,
    { diameter: 0.13, height: 0.68, tessellation: 8 }, scene);
  handle.position = new BABYLON.Vector3(x + side * (-0.21), 4.37, z);
  handle.material = metalMat;

  const flameMat = new BABYLON.StandardMaterial("flame_" + roomIdx + torchIdx + side, scene);
  flameMat.diffuseColor  = new BABYLON.Color3(1.0, 0.6, 0.1);
  flameMat.emissiveColor = new BABYLON.Color3(0.8, 0.4, 0.05);

  const flame = BABYLON.MeshBuilder.CreateCylinder("flame_" + roomIdx + torchIdx + side,
    { diameterTop: 0, diameterBottom: 0.24, height: 0.40, tessellation: 8 }, scene);
  flame.position = new BABYLON.Vector3(x + side * (-0.21), 4.76, z);
  flame.material = flameMat;

  const light = new BABYLON.PointLight(
    "torchLight_" + roomIdx + torchIdx + side,
    new BABYLON.Vector3(x + side * (-0.21), 4.80, z),
    scene
  );
  light.diffuse    = new BABYLON.Color3(1.0, 0.72, 0.28);
  light.intensity  = 2.5;
  light.range      = 22;
  torchLights.push(light);
}

// ── Chandelier ────────────────────────────────────────────────────────────────

function _buildChandelier(scene, x, y, z, color, torchLights) {
  const metalMat = new BABYLON.StandardMaterial("chandMetal", scene);
  metalMat.diffuseColor = new BABYLON.Color3(0.55, 0.48, 0.20);

  const ring = BABYLON.MeshBuilder.CreateTorus("chandRing",
    { diameter: 3.5, thickness: 0.14, tessellation: 32 }, scene);
  ring.position = new BABYLON.Vector3(x, y, z);
  ring.material = metalMat;

  const chain = BABYLON.MeshBuilder.CreateCylinder("chandChain",
    { diameter: 0.09, height: 1.6, tessellation: 6 }, scene);
  chain.position = new BABYLON.Vector3(x, y + 0.80, z);
  chain.material = metalMat;

  const candleMat = new BABYLON.StandardMaterial("chandCandle", scene);
  candleMat.diffuseColor = new BABYLON.Color3(0.95, 0.90, 0.80);
  const flameMat = new BABYLON.StandardMaterial("chandFlame", scene);
  flameMat.diffuseColor  = new BABYLON.Color3(1.0, 0.7, 0.1);
  flameMat.emissiveColor = new BABYLON.Color3(0.6, 0.3, 0.02);

  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const cx2 = x + Math.cos(a) * 1.65;
    const cz2 = z + Math.sin(a) * 1.65;

    const candle = BABYLON.MeshBuilder.CreateCylinder("chandCandle_" + i,
      { diameter: 0.15, height: 0.30, tessellation: 8 }, scene);
    candle.position = new BABYLON.Vector3(cx2, y - 0.15, cz2);
    candle.material = candleMat;

    const fl = BABYLON.MeshBuilder.CreateCylinder("chandFlame_" + i,
      { diameterTop: 0, diameterBottom: 0.13, height: 0.22, tessellation: 8 }, scene);
    fl.position = new BABYLON.Vector3(cx2, y + 0.09, cz2);
    fl.material = flameMat;
  }

  const cl = new BABYLON.PointLight("chandLight", new BABYLON.Vector3(x, y - 0.1, z), scene);
  cl.diffuse   = new BABYLON.Color3(1.0, 0.88, 0.58);
  cl.intensity = 3.5;
  cl.range     = 32;
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
    { width: 1.8, height: 0.26, depth: 1.4 }, scene);
  seat.position = new BABYLON.Vector3(x, 0.8, z);
  seat.material = goldMat;

  const cushion = BABYLON.MeshBuilder.CreateBox("throneCushion",
    { width: 1.6, height: 0.18, depth: 1.2 }, scene);
  cushion.position = new BABYLON.Vector3(x, 0.98, z);
  cushion.material = cushionMat;

  const back = BABYLON.MeshBuilder.CreateBox("throneBack",
    { width: 1.8, height: 2.4, depth: 0.22 }, scene);
  back.position = new BABYLON.Vector3(x, 2.1, z - 0.70);
  back.material = goldMat;

  [[-0.78, 0], [0.78, 0]].forEach(([ax], ai) => {
    const arm = BABYLON.MeshBuilder.CreateBox("throneArm_" + ai,
      { width: 0.20, height: 0.65, depth: 1.2 }, scene);
    arm.position = new BABYLON.Vector3(x + ax, 1.15, z);
    arm.material = goldMat;
  });

  const crownMat = new BABYLON.StandardMaterial("crownMat", scene);
  crownMat.diffuseColor  = new BABYLON.Color3(1.0, 0.85, 0.10);
  crownMat.emissiveColor = new BABYLON.Color3(0.4, 0.30, 0.02);
  const crown = BABYLON.MeshBuilder.CreateCylinder("throneCrown",
    { diameterTop: 0.70, diameterBottom: 1.0, height: 0.50, tessellation: 6 }, scene);
  crown.position = new BABYLON.Vector3(x, 3.4, z - 0.70);
  crown.material = crownMat;
}

// ── Tile texture ──────────────────────────────────────────────────────────────

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
