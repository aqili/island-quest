/**
 * MathCastleScene.js
 * Interior of the Math Castle — 4 rooms connected in a line.
 * Wide, tall halls with dynamic camera occlusion prevention so walls
 * never block the player's view.
 */

import { createPlayer }       from "../entities/Player.js";
import { showPuzzle }             from "../puzzles/MathPuzzleUI.js";
import { mathPuzzles }        from "../data/mathPuzzles.js";
import { SaveManager }        from "../utils/SaveManager.js";
import { createVirtualJoystick, destroyVirtualJoystick } from "../ui/VirtualJoystick.js";

const BABYLON = window.BABYLON;

const ROOMS = [
  { name: "Room 1 — Addition & Subtraction ➕➖", pool: "room1",  type: "text",   wallColor: new BABYLON.Color3(0.62, 0.58, 0.50), accentColor: new BABYLON.Color3(0.85, 0.68, 0.20) },
  { name: "Room 2 — Multiplication 🌟",           pool: "room2",  type: "choice", wallColor: new BABYLON.Color3(0.58, 0.62, 0.50), accentColor: new BABYLON.Color3(0.20, 0.75, 0.35) },
  { name: "Room 3 — Shapes & Counting 🔷",        pool: "room3",  type: "choice", wallColor: new BABYLON.Color3(0.50, 0.58, 0.65), accentColor: new BABYLON.Color3(0.20, 0.55, 0.90) },
  { name: "👑 Throne Room",                        pool: "throne", type: "throne", wallColor: new BABYLON.Color3(0.65, 0.58, 0.38), accentColor: new BABYLON.Color3(0.90, 0.80, 0.20) }
];

const ROOM_LENGTH = 36; // Z-offset between rooms
const ROOM_WIDTH  = 48; // triple the original 16 — wide open rooms

export function createMathCastleScene(engine, onExit) {
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.10, 0.08, 0.05, 1);

  createVirtualJoystick();
  scene.onDisposeObservable.addOnce(() => destroyVirtualJoystick());

  // Lighting
  const ambient = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
  ambient.intensity = 0.9;

  // Fog — focus view on current room, hides distant rooms
  scene.fogMode    = BABYLON.Scene.FOGMODE_EXP2;
  scene.fogColor   = new BABYLON.Color3(0.12, 0.08, 0.05);
  scene.fogDensity = 0.018;

  // Build all rooms
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

  // Top-down castle camera — player can see full room without walls blocking
  const cam = player.camera;
  cam.alpha            = -Math.PI / 2;   // behind player (looking toward +Z)
  cam.beta             = Math.PI / 3;    // 60° from vertical — room visible from above
  cam.radius           = 40;             // wider room needs more zoom-out
  cam.lowerBetaLimit   = 0.4;
  cam.upperBetaLimit   = Math.PI / 2.3;
  cam.lowerRadiusLimit = 16;
  cam.upperRadiusLimit = 55;

  // HUD
  const hudLocation = document.getElementById("hud-location");
  const hudStars    = document.getElementById("hud-stars");
  _updateHUD(hudLocation, hudStars, 0);

  // Show exit button
  const hudExit    = document.getElementById("hud-exit");
  const hudExitBtn = document.getElementById("hud-exit-btn");
  hudExit.style.display = "";

  // Navigation hint — tells player to walk to glowing beacon / locked door
  const navHint = document.createElement("div");
  navHint.id        = "castle-nav-hint";
  navHint.textContent = "🔴 Walk to the glowing orb at the door to solve a puzzle and unlock the next room!";
  document.body.appendChild(navHint);
  scene.onDisposeObservable.addOnce(() => navHint.remove());

  function doExit() {
    hudExit.style.display = "none";
    switching = true;
    setTimeout(() => onExit(), 0);
  }
  hudExitBtn.addEventListener("click", doExit);

  scene.onDisposeObservable.addOnce(() => {
    hudExit.style.display = "none";
    hudExitBtn.removeEventListener("click", doExit);
  });

  // Puzzle in-progress flag (prevent re-triggering)
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
      _showRoomBanner(ROOMS[roomIdx].name);
    }

    // Animate door beacons (pulse + float)
    const now = Date.now();
    doors.forEach((doorInfo, i) => {
      if (!doorInfo.beacon) return;
      const solved = SaveManager.isRoomUnlocked("mathIsland", i + 1);
      doorInfo.beacon.isVisible = !solved;
      if (!solved) {
        doorInfo.beacon.position.y = 5.5 + Math.sin(now * 0.002 + i) * 0.25;
        const pulse = 0.5 + Math.sin(now * 0.003 + i) * 0.5;
        const ec = doorInfo.beacon.material.emissiveColor;
        ec.r = pulse; ec.g = pulse * 0.4; ec.b = 0;
      }
    });

    // Exit trigger at back wall of Room 0
    if (pz < -4 && roomIdx === 0) {
      doExit();
      return;
    }

    doors.forEach((doorInfo, i) => {
      if (puzzleActive) return;
      const doorZ = doorInfo.z;
      const dist  = Math.abs(pz - doorZ);
      const distX = Math.abs(px);

      if (dist < 2.5 && distX < 3) {
        // Check if room already solved
        if (SaveManager.isRoomUnlocked("mathIsland", i + 1)) {
          doorInfo.mesh.material.diffuseColor  = new BABYLON.Color3(0.1, 0.8, 0.2);
          doorInfo.mesh.material.emissiveColor = new BABYLON.Color3(0.0, 0.2, 0.0);
          return;
        }
        puzzleActive = true;
        player.mesh.position.z = doorZ - 3; // push back
        _triggerPuzzle(i, scene, () => {
          SaveManager.markRoomComplete("mathIsland", i);
          doorInfo.mesh.material.diffuseColor  = new BABYLON.Color3(0.1, 0.8, 0.2);
          doorInfo.mesh.material.emissiveColor = new BABYLON.Color3(0.0, 0.2, 0.0);
          puzzleActive = false;
          _updateHUD(hudLocation, hudStars, currentRoom);
          if (i === 3) {
            SaveManager.earnCrown("mathIsland");
            _spawnCrownParticles(scene);
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

function _buildRoom(scene, idx, floorColor, doors) {
  const BABYLON = window.BABYLON;
  const baseZ = idx * ROOM_LENGTH;

  const mat = new BABYLON.StandardMaterial("roomFloor_" + idx, scene);
  mat.diffuseColor = floorColor;

  // Floor
  const floor = BABYLON.MeshBuilder.CreateBox("floor_" + idx,
    { width: ROOM_WIDTH, height: 0.2, depth: ROOM_LENGTH }, scene);
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

  // ── Ceiling with beams ────────────────────────────────────────────────
  const ceil = BABYLON.MeshBuilder.CreateBox("ceil_" + idx,
    { width: ROOM_WIDTH, height: 0.25, depth: ROOM_LENGTH }, scene);
  ceil.position = new BABYLON.Vector3(0, ceilY, baseZ + ROOM_LENGTH / 2);
  ceil.material = ceilMat;

  const beamMat = new BABYLON.StandardMaterial("beam_" + idx, scene);
  beamMat.diffuseColor = new BABYLON.Color3(0.32, 0.22, 0.10);
  [5, 13, 21, 29, 37].forEach((bz, bi) => {
    const beam = BABYLON.MeshBuilder.CreateBox("beam_" + idx + bi,
      { width: ROOM_WIDTH + 0.5, height: 0.40, depth: 0.50 }, scene);
    beam.position = new BABYLON.Vector3(0, ceilY - 0.25, baseZ + bz);
    beam.material = beamMat;
  });

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

  // Left wall
  const lWall = BABYLON.MeshBuilder.CreateBox("lWall_" + idx,
    { width: 0.3, height: 8, depth: ROOM_LENGTH }, scene);
  lWall.position = new BABYLON.Vector3(-(ROOM_WIDTH / 2 + 0.15), 4, baseZ + ROOM_LENGTH / 2);
  lWall.material = wallMat;

  // Right wall
  const rWall = BABYLON.MeshBuilder.CreateBox("rWall_" + idx,
    { width: 0.3, height: 8, depth: ROOM_LENGTH }, scene);
  rWall.position = new BABYLON.Vector3(ROOM_WIDTH / 2 + 0.15, 4, baseZ + ROOM_LENGTH / 2);
  rWall.material = wallMat;

  // NOTE: No ceiling — open top allows the top-down camera to see inside the room

  // ── Entry/Exit back wall ──────────────────────────────────────────────
  if (idx === 0) {
    const backWall = BABYLON.MeshBuilder.CreateBox("backWall",
      { width: ROOM_WIDTH, height: 8, depth: 0.3 }, scene);
    backWall.position = new BABYLON.Vector3(0, 4, baseZ);
    backWall.material = wallMat;
    // Door gap in back wall
    const exitDoor = BABYLON.MeshBuilder.CreateBox("exitDoor",
      { width: 4, height: 5, depth: 0.5 }, scene);
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
    { width: ROOM_WIDTH, height: 8, depth: 0.3 }, scene);
  frontWall.position = new BABYLON.Vector3(0, 4, doorZ);
  frontWall.material = wallMat;

  // Door frame — left and right sections flanking a 4-unit gap at center
  const sideW = (ROOM_WIDTH - 4) / 2;   // half the wall space on each side of the door gap
  const sideX = 2 + sideW / 2;           // center X of each door segment
  [[-sideX, sideW], [sideX, sideW]].forEach(([dx, dw], j) => {
    const seg = BABYLON.MeshBuilder.CreateBox("doorSeg_" + idx + j,
      { width: dw, height: 8, depth: 0.3 }, scene);
    seg.position = new BABYLON.Vector3(dx, 4, doorZ);
    seg.material = wallMat;
  });
  // Door top filler
  const topFill = BABYLON.MeshBuilder.CreateBox("doorTop_" + idx,
    { width: 4, height: 2.5, depth: 0.3 }, scene);
  topFill.position = new BABYLON.Vector3(0, 6.75, doorZ);
  topFill.material = wallMat;

  // Colored door slab (starts red, turns green on solve)
  const doorSlab = BABYLON.MeshBuilder.CreateBox("doorSlab_" + idx,
    { width: 4, height: 5.5, depth: 0.3 }, scene);
  doorSlab.position = new BABYLON.Vector3(0, 2.75, doorZ);
  const doorSlabMat = new BABYLON.StandardMaterial("doorSlabMat_" + idx, scene);

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

  // Two torches — pushed out to the side walls of the wider room
  [-(ROOM_WIDTH / 2 - 2), ROOM_WIDTH / 2 - 2].forEach((tx, ti) => {
    const torch = new BABYLON.PointLight("torch_" + idx + "_" + ti,
      new BABYLON.Vector3(tx, 6, baseZ + ROOM_LENGTH / 2), scene);
    torch.diffuse   = new BABYLON.Color3(1, 0.75, 0.3);
    torch.intensity = 1.5;
    torch.range     = 55;
  });

  // Navigation beacon — glowing pulsing sphere above the door
  const beacon = BABYLON.MeshBuilder.CreateSphere("beacon_" + idx,
    { diameter: 1.4, segments: 8 }, scene);
  beacon.position = new BABYLON.Vector3(0, 5.5, doorZ - 0.5);
  const beaconMat = new BABYLON.StandardMaterial("beaconMat_" + idx, scene);
  beaconMat.diffuseColor  = new BABYLON.Color3(1, 0.6, 0);
  beaconMat.emissiveColor = new BABYLON.Color3(1, 0.4, 0);
  beacon.material = beaconMat;
  beacon.isVisible = !solved;

  // Furniture
  _addFurniture(scene, idx, baseZ, floorColor);

  doors.push({ mesh: doorSlab, z: doorZ, beacon });
}

// ─── Furniture builder ────────────────────────────────────────────────────────

function _addFurniture(scene, idx, baseZ, floorColor) {
  const BABYLON = window.BABYLON;
  const midZ = baseZ + ROOM_LENGTH / 2;

  // Rug
  const rugMat = new BABYLON.StandardMaterial("mRug_" + idx, scene);
  rugMat.diffuseColor = new BABYLON.Color3(
    Math.min(floorColor.r * 0.6 + 0.25, 1),
    floorColor.g * 0.25,
    floorColor.b * 0.25
  );
  const rug = BABYLON.MeshBuilder.CreateBox("mRug_" + idx,
    { width: 36, height: 0.05, depth: 24 }, scene);
  rug.position = new BABYLON.Vector3(0, 0.12, midZ);
  rug.material = rugMat;

  // Wood material (shared)
  const woodMat = new BABYLON.StandardMaterial("mWood_" + idx, scene);
  woodMat.diffuseColor = new BABYLON.Color3(0.55, 0.35, 0.15);

  // Table — near entrance of room
  const tableZ = baseZ + ROOM_LENGTH * 0.3;
  const tableTop = BABYLON.MeshBuilder.CreateBox("mTableTop_" + idx,
    { width: 4.5, height: 0.2, depth: 2.2 }, scene);
  tableTop.position = new BABYLON.Vector3(0, 1.6, tableZ);
  tableTop.material = woodMat;
  [[-1.9, -0.9], [-1.9, 0.9], [1.9, -0.9], [1.9, 0.9]].forEach(([tx, tz], i) => {
    const leg = BABYLON.MeshBuilder.CreateCylinder("mLeg_" + idx + i,
      { diameter: 0.18, height: 1.5, tessellation: 6 }, scene);
    leg.position = new BABYLON.Vector3(tx, 0.85, tableZ + tz);
    leg.material = woodMat;
  });

  // Chairs (one each side of table)
  [[-3.2, 0], [3.2, 0]].forEach(([cx], i) => {
    const seat = BABYLON.MeshBuilder.CreateBox("mSeat_" + idx + i,
      { width: 1.0, height: 0.12, depth: 1.0 }, scene);
    seat.position = new BABYLON.Vector3(cx, 1.0, tableZ);
    seat.material = woodMat;
    const back = BABYLON.MeshBuilder.CreateBox("mBack_" + idx + i,
      { width: 1.0, height: 0.9, depth: 0.1 }, scene);
    back.position = new BABYLON.Vector3(cx, 1.5, tableZ + (i === 0 ? -0.45 : 0.45));
    back.material = woodMat;
    // Chair legs
    [[-0.4, -0.4], [-0.4, 0.4], [0.4, -0.4], [0.4, 0.4]].forEach(([clx, clz], j) => {
      const cl = BABYLON.MeshBuilder.CreateCylinder("mCL_" + idx + i + j,
        { diameter: 0.1, height: 0.95, tessellation: 4 }, scene);
      cl.position = new BABYLON.Vector3(cx + clx, 0.55, tableZ + clz);
      cl.material = woodMat;
    });
  });

  // Bookshelves — against each side wall, in the back half of the room
  const shelfMat = new BABYLON.StandardMaterial("mShelf_" + idx, scene);
  shelfMat.diffuseColor = new BABYLON.Color3(0.4, 0.25, 0.1);
  const bookColors = [
    new BABYLON.Color3(0.8, 0.15, 0.15),
    new BABYLON.Color3(0.15, 0.45, 0.85),
    new BABYLON.Color3(0.15, 0.65, 0.25),
    new BABYLON.Color3(0.85, 0.7, 0.1),
    new BABYLON.Color3(0.6, 0.1, 0.7),
  ];
  [-1, 1].forEach((side) => {
    const shelfX = side * (ROOM_WIDTH / 2 - 0.5);
    const shelf = BABYLON.MeshBuilder.CreateBox("mShelf_" + idx + side,
      { width: 0.35, height: 4, depth: 8 }, scene);
    shelf.position = new BABYLON.Vector3(shelfX, 2, baseZ + ROOM_LENGTH * 0.68);
    shelf.material = shelfMat;
    // Books on shelf
    for (let b = 0; b < 5; b++) {
      const book = BABYLON.MeshBuilder.CreateBox("mBook_" + idx + side + b,
        { width: 0.45, height: 0.65, depth: 1.0 }, scene);
      book.position = new BABYLON.Vector3(
        side * (ROOM_WIDTH / 2 - 0.7),
        0.45 + b * 0.78,
        baseZ + ROOM_LENGTH * 0.68 + (b - 2) * 1.3
      );
      const bm = new BABYLON.StandardMaterial("mBM_" + idx + side + b, scene);
      bm.diffuseColor = bookColors[b];
      book.material = bm;
    }
  });

  // Puzzle pedestal near the locked door — hints that the door requires a puzzle
  const pedZ = baseZ + ROOM_LENGTH - 8;
  const pedBase = BABYLON.MeshBuilder.CreateCylinder("mPed_" + idx,
    { diameter: 1.2, height: 1.0, tessellation: 8 }, scene);
  pedBase.position = new BABYLON.Vector3(0, 0.5, pedZ);
  const pedMat = new BABYLON.StandardMaterial("mPedMat_" + idx, scene);
  pedMat.diffuseColor  = new BABYLON.Color3(0.7, 0.6, 0.1);
  pedMat.emissiveColor = new BABYLON.Color3(0.3, 0.25, 0);
  pedBase.material = pedMat;
  const pedTop = BABYLON.MeshBuilder.CreateBox("mPedTop_" + idx,
    { width: 1.0, height: 0.15, depth: 1.0 }, scene);
  pedTop.position = new BABYLON.Vector3(0, 1.1, pedZ);
  pedTop.material = pedMat;
}

// ── Puzzle door sign ──────────────────────────────────────────────────────────

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
  const dt = new BABYLON.DynamicTexture("signTex_" + idx,
    { width: boardSize, height: Math.floor(boardSize / 2) }, scene);
  const ctx = dt.getContext();

  ctx.fillStyle = "#3d1f00";
  ctx.fillRect(0, 0, boardSize, boardSize / 2);
  ctx.strokeStyle = "#FFD700";
  ctx.lineWidth = 14;
  ctx.strokeRect(8, 8, boardSize - 16, boardSize / 2 - 16);
  ctx.fillStyle = "#FFE066";
  ctx.font = "bold 66px Arial";
  ctx.textAlign = "center";
  ctx.fillText("⬆  PUZZLE DOOR", boardSize / 2, 92);
  ctx.font = "bold 46px Arial";
  ctx.fillStyle = "#FFA040";
  ctx.fillText("Walk to the door!", boardSize / 2, 158);
  ctx.font = "38px Arial";
  ctx.fillStyle = "#FFDD88";
  ctx.fillText("Solve the puzzle to pass", boardSize / 2, 222);
  dt.update();

  dt.uScale = -1;  // fix horizontal mirror on box face

  const boardMat = new BABYLON.StandardMaterial("signBoard_" + idx, scene);
  boardMat.diffuseTexture  = dt;
  boardMat.emissiveTexture = dt;
  boardMat.emissiveColor   = new BABYLON.Color3(0.5, 0.4, 0.2);

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

// ─── Room entry banner ────────────────────────────────────────────────────────

function _showRoomBanner(text) {
  const el = document.createElement("div");
  el.className = "room-banner";
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

// ─── Crown sparkle particles ──────────────────────────────────────────────────

function _spawnCrownParticles(scene) {
  const ps = new BABYLON.ParticleSystem("crownParticles", 200, scene);
  ps.particleTexture = new BABYLON.Texture(
    "https://assets.babylonjs.com/textures/flare.png", scene);
  ps.emitter = new BABYLON.Vector3(0, 3, 5);
  ps.color1 = new BABYLON.Color4(1, 0.9, 0.1, 1);
  ps.color2 = new BABYLON.Color4(1, 0.5, 0, 1);
  ps.minSize = 0.2;
  ps.maxSize = 0.6;
  ps.minLifeTime = 1.0;
  ps.maxLifeTime = 2.5;
  ps.emitRate = 200;
  ps.minEmitPower = 3;
  ps.maxEmitPower = 8;
  ps.direction1 = new BABYLON.Vector3(-3, 6, -3);
  ps.direction2 = new BABYLON.Vector3(3, 10, 3);
  ps.gravity = new BABYLON.Vector3(0, -4, 0);
  ps.targetStopDuration = 1.5;
  ps.start();
}

// ─── HUD helpers ─────────────────────────────────────────────────────────────

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
