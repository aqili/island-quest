/**
 * LangCastleScene.js
 * Interior of the Language Castle — 4 rooms connected in a line.
 * Wide, tall halls with dynamic camera occlusion prevention so walls
 * never block the player's view.
 */

import { createPlayer }       from "../entities/Player.js";
import { showPuzzle }             from "../puzzles/LangPuzzleUI.js";
import { langPuzzles }        from "../data/langPuzzles.js";
import { SaveManager }        from "../utils/SaveManager.js";
import { createVirtualJoystick, destroyVirtualJoystick } from "../ui/VirtualJoystick.js";

const BABYLON = window.BABYLON;

const ROOMS = [
  { name: "Room 1 — Spelling 🔤",           pool: "room1",  type: "spelling",   wallColor: new BABYLON.Color3(0.42, 0.40, 0.60), accentColor: new BABYLON.Color3(0.55, 0.30, 0.95) },
  { name: "Room 2 — Word Unscramble 🔀",    pool: "room2",  type: "unscramble", wallColor: new BABYLON.Color3(0.48, 0.38, 0.65), accentColor: new BABYLON.Color3(0.38, 0.18, 0.82) },
  { name: "Room 3 — Fill in the Blank 📖",  pool: "room3",  type: "fillblank",  wallColor: new BABYLON.Color3(0.38, 0.48, 0.65), accentColor: new BABYLON.Color3(0.18, 0.55, 0.90) },
  { name: "👑 Throne Room",                  pool: "throne", type: "throne",     wallColor: new BABYLON.Color3(0.50, 0.38, 0.68), accentColor: new BABYLON.Color3(0.78, 0.55, 0.95) }
];

const ROOM_LENGTH    = 36;
const ROOM_WIDTH     = 48; // triple the original 16 — wide open rooms
const DESIRED_RADIUS = 28;

export function createLangCastleScene(engine, onExit) {
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.06, 0.04, 0.12, 1);

  createVirtualJoystick();
  scene.onDisposeObservable.addOnce(() => destroyVirtualJoystick());

  const ambient = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
  ambient.intensity = 0.9;

  // Fog — focus view on current room
  scene.fogMode    = BABYLON.Scene.FOGMODE_EXP2;
  scene.fogColor   = new BABYLON.Color3(0.07, 0.04, 0.12);
  scene.fogDensity = 0.018;

  const doors = [];
  const torchLights = [];

  ROOMS.forEach((room, i) => {
    _buildRoom(scene, i, room.wallColor, room.accentColor, doors, torchLights);
  });

  const player = createPlayer(scene);
  player.mesh.position = new BABYLON.Vector3(0, 0.5, 10);

  player.camera.radius           = DESIRED_RADIUS;
  player.camera.lowerRadiusLimit  = 3;
  player.camera.upperRadiusLimit  = 28;

  // Top-down castle camera — player can see full room without walls blocking
  const cam = player.camera;
  cam.alpha            = -Math.PI / 2;
  cam.beta             = Math.PI / 3;
  cam.radius           = 40;             // wider room needs more zoom-out
  cam.lowerBetaLimit   = 0.4;
  cam.upperBetaLimit   = Math.PI / 2.3;
  cam.lowerRadiusLimit = 16;
  cam.upperRadiusLimit = 55;

  const hudLocation = document.getElementById("hud-location");
  const hudStars    = document.getElementById("hud-stars");
  _updateHUD(hudLocation, hudStars, 0);

  // Show exit button
  const hudExit    = document.getElementById("hud-exit");
  const hudExitBtn = document.getElementById("hud-exit-btn");
  hudExit.style.display = "";

  // Navigation hint
  const navHint = document.createElement("div");
  navHint.id        = "castle-nav-hint";
  navHint.textContent = "🔵 Walk to the glowing orb at the door to solve a puzzle and unlock the next room!";
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

  let puzzleActive = false;
  let switching    = false;
  let currentRoom  = 0;
  let flickerT     = 0;

  scene.registerBeforeRender(() => {
    try {
    if (puzzleActive || switching) return;
    player.update();

    flickerT += 0.07;
    torchLights.forEach((tl, i) => {
      tl.intensity = 2.3 + 0.50 * Math.sin(flickerT * 2.8 + i * 1.9)
                         + 0.25 * Math.sin(flickerT * 6.5 + i * 2.7);
    });

    const pz = player.mesh.position.z;
    const px = player.mesh.position.x;

    // ── Dynamic camera radius — keep camera inside room walls ─────────
    const roomBaseZ  = currentRoom * ROOM_LENGTH;
    const halfW      = ROOM_WIDTH / 2;
    const distBack   = Math.max(0.5, pz - roomBaseZ);
    const distFront  = Math.max(0.5, roomBaseZ + ROOM_LENGTH - pz);
    const distLeft   = Math.max(0.5, px + halfW);
    const distRight  = Math.max(0.5, halfW - px);
    const safeRadius = Math.min(
      DESIRED_RADIUS,
      distBack  * 0.80,
      distFront * 0.80,
      distLeft  * 0.80,
      distRight * 0.80
    );
    const clampedR = Math.max(3.0, safeRadius);
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
      const solved = SaveManager.isRoomUnlocked("languageIsland", i + 1);
      doorInfo.beacon.isVisible = !solved;
      if (!solved) {
        doorInfo.beacon.position.y = 5.5 + Math.sin(now * 0.002 + i) * 0.25;
        const pulse = 0.5 + Math.sin(now * 0.003 + i) * 0.5;
        const ec = doorInfo.beacon.material.emissiveColor;
        ec.r = pulse * 0.5; ec.g = pulse * 0.2; ec.b = pulse;
      }
    });

    // Exit trigger
    if (pz < -4 && roomIdx === 0) {
      doExit();
      return;
    }

    doors.forEach((doorInfo, i) => {
      if (puzzleActive) return;
      const doorZ = doorInfo.z;
      if (Math.abs(pz - doorZ) < 2.5 && Math.abs(px) < 3) {
        if (SaveManager.isRoomUnlocked("languageIsland", i + 1)) {
          doorInfo.mesh.material.diffuseColor  = new BABYLON.Color3(0.1, 0.8, 0.2);
          doorInfo.mesh.material.emissiveColor = new BABYLON.Color3(0.0, 0.2, 0.0);
          return;
        }
        puzzleActive = true;
        player.mesh.position.z = doorZ - 3;
        _triggerPuzzle(i, () => {
          SaveManager.markRoomComplete("languageIsland", i);
          doorInfo.mesh.material.diffuseColor  = new BABYLON.Color3(0.1, 0.8, 0.2);
          doorInfo.mesh.material.emissiveColor = new BABYLON.Color3(0.0, 0.2, 0.0);
          puzzleActive = false;
          _updateHUD(hudLocation, hudStars, currentRoom);
          if (i === 3) {
            SaveManager.earnCrown("languageIsland");
            _spawnCrownParticles(scene);
            _showVictory("Language Crown", onExit);
          }
        });
      }
    });
    } catch (e) { console.error("LangCastle render error:", e); }
  });

  return scene;
}

// ─── Room builder ─────────────────────────────────────────────────────────────

function _buildRoom(scene, idx, wallColor, accentColor, doors, torchLights) {
  const BABYLON = window.BABYLON;
  const baseZ = idx * ROOM_LENGTH;
  const isThrone = idx === ROOMS.length - 1;

  const wallMat = new BABYLON.StandardMaterial("lWallMat_" + idx, scene);
  wallMat.diffuseColor = wallColor;

  // Floor
  const floorMat = new BABYLON.StandardMaterial("lRoomFloor_" + idx, scene);
  floorMat.diffuseColor = wallColor;
  const floor = BABYLON.MeshBuilder.CreateBox("lFloor_" + idx,
    { width: ROOM_WIDTH, height: 0.2, depth: ROOM_LENGTH }, scene);
  floor.position = new BABYLON.Vector3(0, 0, baseZ + ROOM_LENGTH / 2);
  floor.material = floorMat;
  _applyTileTexture(scene, floorMat, wallColor, 20, 10, true);

  // Carpet runner
  const carpetMat = new BABYLON.StandardMaterial("lCarpet_" + idx, scene);
  carpetMat.diffuseColor = isThrone
    ? new BABYLON.Color3(0.55, 0.12, 0.72)
    : new BABYLON.Color3(accentColor.r * 0.60, accentColor.g * 0.30, accentColor.b * 0.70);
  const carpet = BABYLON.MeshBuilder.CreateBox("lCarpet_" + idx,
    { width: 4.0, height: 0.02, depth: ROOM_LENGTH - 1 }, scene);
  carpet.position = new BABYLON.Vector3(0, 0.12, baseZ + ROOM_LENGTH / 2);
  carpet.material = carpetMat;

  // Left wall
  const lWall = BABYLON.MeshBuilder.CreateBox("lLWall_" + idx,
    { width: 0.3, height: 8, depth: ROOM_LENGTH }, scene);
  lWall.position = new BABYLON.Vector3(-(ROOM_WIDTH / 2 + 0.15), 4, baseZ + ROOM_LENGTH / 2);
  lWall.material = wallMat;

  // Right wall
  const rWall = BABYLON.MeshBuilder.CreateBox("lRWall_" + idx,
    { width: 0.3, height: 8, depth: ROOM_LENGTH }, scene);
  rWall.position = new BABYLON.Vector3(ROOM_WIDTH / 2 + 0.15, 4, baseZ + ROOM_LENGTH / 2);
  rWall.material = wallMat;

  // NOTE: No ceiling — open top allows the top-down camera to see inside

  // ── Entry back wall ───────────────────────────────────────────────────
  if (idx === 0) {
    const backWall = BABYLON.MeshBuilder.CreateBox("lBackWall",
      { width: ROOM_WIDTH, height: 8, depth: 0.3 }, scene);
    backWall.position = new BABYLON.Vector3(0, 4, baseZ);
    backWall.material = wallMat;
    const exitDoor = BABYLON.MeshBuilder.CreateBox("lExitDoor",
      { width: 4, height: 5, depth: 0.5 }, scene);
    exitDoor.position = new BABYLON.Vector3(0, 2.5, baseZ);
    const edMat = new BABYLON.StandardMaterial("lExitDoorMat", scene);
    edMat.diffuseColor = new BABYLON.Color3(0.06, 0.03, 0.10);
    exitDoor.material = edMat;

    const exitArch = BABYLON.MeshBuilder.CreateSphere("lExitArch",
      { diameterX: 4.0, diameterY: 1.4, diameterZ: 0.45, segments: 8 }, scene);
    exitArch.position = new BABYLON.Vector3(0, 5.2, baseZ);
    exitArch.material = edMat;
  }

  // ── Front wall with puzzle door ───────────────────────────────────────
  const doorZ = baseZ + ROOM_LENGTH;
  const frontWall = BABYLON.MeshBuilder.CreateBox("lFrontWall_" + idx,
    { width: ROOM_WIDTH, height: 8, depth: 0.3 }, scene);
  frontWall.position = new BABYLON.Vector3(0, 4, doorZ);
  frontWall.material = wallMat;

  // Door frame — left and right sections flanking a 4-unit gap at center
  const sideW = (ROOM_WIDTH - 4) / 2;   // half the wall space on each side of the door gap
  const sideX = 2 + sideW / 2;           // center X of each door segment
  [[-sideX, sideW], [sideX, sideW]].forEach(([dx, dw], j) => {
    const seg = BABYLON.MeshBuilder.CreateBox("lDoorSeg_" + idx + j,
      { width: dw, height: 8, depth: 0.3 }, scene);
    seg.position = new BABYLON.Vector3(dx, 4, doorZ);
    seg.material = wallMat;
  });

  const topFill = BABYLON.MeshBuilder.CreateBox("lDoorTop_" + idx,
    { width: 4, height: 2.5, depth: 0.3 }, scene);
  topFill.position = new BABYLON.Vector3(0, 6.75, doorZ);
  topFill.material = wallMat;

  const doorSlab = BABYLON.MeshBuilder.CreateBox("lDoorSlab_" + idx,
    { width: 4, height: 5.5, depth: 0.3 }, scene);
  doorSlab.position = new BABYLON.Vector3(0, 2.75, doorZ);
  const doorSlabMat = new BABYLON.StandardMaterial("lDoorSlabMat_" + idx, scene);
  const save   = SaveManager.load();
  const solved = save.languageIsland.roomsCompleted[idx];
  doorSlabMat.diffuseColor  = solved ? new BABYLON.Color3(0.1, 0.8, 0.2) : new BABYLON.Color3(0.55, 0.05, 0.68);
  doorSlabMat.emissiveColor = solved ? new BABYLON.Color3(0.0, 0.2, 0.0) : new BABYLON.Color3(0.12, 0.0, 0.15);
  doorSlab.material = doorSlabMat;

  // Two torches — pushed out to the side walls of the wider room
  [-(ROOM_WIDTH / 2 - 2), ROOM_WIDTH / 2 - 2].forEach((tx, ti) => {
    const torch = new BABYLON.PointLight("lTorch_" + idx + "_" + ti,
      new BABYLON.Vector3(tx, 6, baseZ + ROOM_LENGTH / 2), scene);
    torch.diffuse   = new BABYLON.Color3(0.7, 0.4, 1.0);
    torch.intensity = 1.5;
    torch.range     = 55;
  });

  // Navigation beacon — glowing pulsing sphere above the door
  const beacon = BABYLON.MeshBuilder.CreateSphere("lBeacon_" + idx,
    { diameter: 1.4, segments: 8 }, scene);
  beacon.position = new BABYLON.Vector3(0, 5.5, doorZ - 0.5);
  const beaconMat = new BABYLON.StandardMaterial("lBeaconMat_" + idx, scene);
  beaconMat.diffuseColor  = new BABYLON.Color3(0.6, 0.3, 1.0);
  beaconMat.emissiveColor = new BABYLON.Color3(0.5, 0.2, 1.0);
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
  const rugMat = new BABYLON.StandardMaterial("lRug_" + idx, scene);
  rugMat.diffuseColor = new BABYLON.Color3(
    floorColor.r * 0.25,
    floorColor.g * 0.3,
    Math.min(floorColor.b * 0.6 + 0.25, 1)
  );
  const rug = BABYLON.MeshBuilder.CreateBox("lRug_" + idx,
    { width: 36, height: 0.05, depth: 24 }, scene);
  rug.position = new BABYLON.Vector3(0, 0.12, midZ);
  rug.material = rugMat;

  // Wood material
  const woodMat = new BABYLON.StandardMaterial("lWood_" + idx, scene);
  woodMat.diffuseColor = new BABYLON.Color3(0.45, 0.28, 0.1);

  // Table near entrance
  const tableZ = baseZ + ROOM_LENGTH * 0.3;
  const tableTop = BABYLON.MeshBuilder.CreateBox("lTableTop_" + idx,
    { width: 4.5, height: 0.2, depth: 2.2 }, scene);
  tableTop.position = new BABYLON.Vector3(0, 1.6, tableZ);
  tableTop.material = woodMat;
  [[-1.9, -0.9], [-1.9, 0.9], [1.9, -0.9], [1.9, 0.9]].forEach(([tx, tz], i) => {
    const leg = BABYLON.MeshBuilder.CreateCylinder("lLeg_" + idx + i,
      { diameter: 0.18, height: 1.5, tessellation: 6 }, scene);
    leg.position = new BABYLON.Vector3(tx, 0.85, tableZ + tz);
    leg.material = woodMat;
  });

  // Chairs
  [[-3.2, 0], [3.2, 0]].forEach(([cx], i) => {
    const seat = BABYLON.MeshBuilder.CreateBox("lSeat_" + idx + i,
      { width: 1.0, height: 0.12, depth: 1.0 }, scene);
    seat.position = new BABYLON.Vector3(cx, 1.0, tableZ);
    seat.material = woodMat;
    const back = BABYLON.MeshBuilder.CreateBox("lBack_" + idx + i,
      { width: 1.0, height: 0.9, depth: 0.1 }, scene);
    back.position = new BABYLON.Vector3(cx, 1.5, tableZ + (i === 0 ? -0.45 : 0.45));
    back.material = woodMat;
    [[-0.4, -0.4], [-0.4, 0.4], [0.4, -0.4], [0.4, 0.4]].forEach(([clx, clz], j) => {
      const cl = BABYLON.MeshBuilder.CreateCylinder("lCL_" + idx + i + j,
        { diameter: 0.1, height: 0.95, tessellation: 4 }, scene);
      cl.position = new BABYLON.Vector3(cx + clx, 0.55, tableZ + clz);
      cl.material = woodMat;
    });
  });

  // Bookshelves with books
  const shelfMat = new BABYLON.StandardMaterial("lShelfMat_" + idx, scene);
  shelfMat.diffuseColor = new BABYLON.Color3(0.35, 0.2, 0.08);
  const bookColors = [
    new BABYLON.Color3(0.85, 0.15, 0.5),
    new BABYLON.Color3(0.2, 0.5, 0.9),
    new BABYLON.Color3(0.2, 0.75, 0.35),
    new BABYLON.Color3(0.9, 0.65, 0.1),
    new BABYLON.Color3(0.5, 0.15, 0.8),
  ];
  [-1, 1].forEach((side) => {
    const shelfX = side * (ROOM_WIDTH / 2 - 0.5);
    const shelf = BABYLON.MeshBuilder.CreateBox("lShelf_" + idx + side,
      { width: 0.35, height: 4, depth: 8 }, scene);
    shelf.position = new BABYLON.Vector3(shelfX, 2, baseZ + ROOM_LENGTH * 0.68);
    shelf.material = shelfMat;
    for (let b = 0; b < 5; b++) {
      const book = BABYLON.MeshBuilder.CreateBox("lBook_" + idx + side + b,
        { width: 0.45, height: 0.65, depth: 1.0 }, scene);
      book.position = new BABYLON.Vector3(
        side * (ROOM_WIDTH / 2 - 0.7),
        0.45 + b * 0.78,
        baseZ + ROOM_LENGTH * 0.68 + (b - 2) * 1.3
      );
      const bm = new BABYLON.StandardMaterial("lBM_" + idx + side + b, scene);
      bm.diffuseColor = bookColors[b];
      book.material = bm;
    }
  });

  // Puzzle pedestal near door
  const pedZ = baseZ + ROOM_LENGTH - 8;
  const pedBase = BABYLON.MeshBuilder.CreateCylinder("lPed_" + idx,
    { diameter: 1.2, height: 1.0, tessellation: 8 }, scene);
  pedBase.position = new BABYLON.Vector3(0, 0.5, pedZ);
  const pedMat = new BABYLON.StandardMaterial("lPedMat_" + idx, scene);
  pedMat.diffuseColor  = new BABYLON.Color3(0.5, 0.3, 0.8);
  pedMat.emissiveColor = new BABYLON.Color3(0.2, 0.1, 0.4);
  pedBase.material = pedMat;
  const pedTop = BABYLON.MeshBuilder.CreateBox("lPedTop_" + idx,
    { width: 1.0, height: 0.15, depth: 1.0 }, scene);
  pedTop.position = new BABYLON.Vector3(0, 1.1, pedZ);
  pedTop.material = pedMat;
}

// ── Puzzle door sign ──────────────────────────────────────────────────────────

function _buildPuzzleSign(scene, z, idx, accentColor) {
  const postMat = new BABYLON.StandardMaterial("lSignPost_" + idx, scene);
  postMat.diffuseColor = new BABYLON.Color3(0.28, 0.18, 0.40);

  const postL = BABYLON.MeshBuilder.CreateCylinder("lSignPostL_" + idx,
    { diameter: 0.22, height: 3.6, tessellation: 8 }, scene);
  postL.position = new BABYLON.Vector3(-2.2, 1.8, z);
  postL.material = postMat;

  const postR = BABYLON.MeshBuilder.CreateCylinder("lSignPostR_" + idx,
    { diameter: 0.22, height: 3.6, tessellation: 8 }, scene);
  postR.position = new BABYLON.Vector3(2.2, 1.8, z);
  postR.material = postMat;

  const boardSize = 512;
  const dt = new BABYLON.DynamicTexture("lSignTex_" + idx,
    { width: boardSize, height: Math.floor(boardSize / 2) }, scene);
  const ctx = dt.getContext();

  ctx.fillStyle = "#1a0030";
  ctx.fillRect(0, 0, boardSize, boardSize / 2);
  ctx.strokeStyle = "#BB88FF";
  ctx.lineWidth = 14;
  ctx.strokeRect(8, 8, boardSize - 16, boardSize / 2 - 16);
  ctx.fillStyle = "#DDB8FF";
  ctx.font = "bold 66px Arial";
  ctx.textAlign = "center";
  ctx.fillText("⬆  PUZZLE DOOR", boardSize / 2, 92);
  ctx.font = "bold 46px Arial";
  ctx.fillStyle = "#CC88FF";
  ctx.fillText("Walk to the door!", boardSize / 2, 158);
  ctx.font = "38px Arial";
  ctx.fillStyle = "#AA66EE";
  ctx.fillText("Solve the puzzle to pass", boardSize / 2, 222);
  dt.update();

  dt.uScale = -1;  // fix horizontal mirror on box face

  const boardMat = new BABYLON.StandardMaterial("lSignBoard_" + idx, scene);
  boardMat.diffuseTexture  = dt;
  boardMat.emissiveTexture = dt;
  boardMat.emissiveColor   = new BABYLON.Color3(0.35, 0.20, 0.50);

  const board = BABYLON.MeshBuilder.CreateBox("lSignBoard_" + idx,
    { width: 4.6, height: 2.0, depth: 0.12 }, scene);
  board.position = new BABYLON.Vector3(0, 3.4, z);
  board.material = boardMat;

  const stripMat = new BABYLON.StandardMaterial("lSignStrip_" + idx, scene);
  stripMat.diffuseColor  = accentColor;
  stripMat.emissiveColor = new BABYLON.Color3(
    accentColor.r * 0.4, accentColor.g * 0.3, accentColor.b * 0.5);
  const strip = BABYLON.MeshBuilder.CreateBox("lSignStrip_" + idx,
    { width: 4.8, height: 0.14, depth: 0.14 }, scene);
  strip.position = new BABYLON.Vector3(0, 4.44, z);
  strip.material = stripMat;
}

// ── Glowing floor marker ──────────────────────────────────────────────────────

function _buildFloorMarker(scene, z, accentColor) {
  const markerMat = new BABYLON.StandardMaterial("lFloorMarker_" + z, scene);
  markerMat.diffuseColor  = accentColor;
  markerMat.emissiveColor = new BABYLON.Color3(
    accentColor.r * 0.6, accentColor.g * 0.4, accentColor.b * 0.7);

  const outer = BABYLON.MeshBuilder.CreateBox("lFloorOuter_" + z,
    { width: 6.0, height: 0.03, depth: 1.2 }, scene);
  outer.position = new BABYLON.Vector3(0, 0.13, z);
  outer.material = markerMat;

  const innerMat = new BABYLON.StandardMaterial("lFloorInner_" + z, scene);
  innerMat.diffuseColor  = new BABYLON.Color3(0.95, 0.90, 1.0);
  innerMat.emissiveColor = new BABYLON.Color3(0.5, 0.2, 0.8);

  const inner = BABYLON.MeshBuilder.CreateBox("lFloorInner_" + z,
    { width: 4.0, height: 0.04, depth: 0.45 }, scene);
  inner.position = new BABYLON.Vector3(0, 0.14, z);
  inner.material = innerMat;

  [-1.2, 0, 1.2].forEach((ox, ai) => {
    const arrowMat = new BABYLON.StandardMaterial("lArrow_" + z + ai, scene);
    arrowMat.diffuseColor  = new BABYLON.Color3(0.85, 0.65, 1.0);
    arrowMat.emissiveColor = new BABYLON.Color3(0.4, 0.15, 0.6);
    const arrow = BABYLON.MeshBuilder.CreateBox("lArrow_" + z + ai,
      { width: 0.38, height: 0.04, depth: 0.65 }, scene);
    arrow.position = new BABYLON.Vector3(ox, 0.15, z + 0.6);
    arrow.material = arrowMat;
  });
}

// ── Decorative pedestal with crystal ─────────────────────────────────────────

function _buildPedestal(scene, x, z, accentColor) {
  const stoneMat = new BABYLON.StandardMaterial("lPedStoneMat_" + x + "_" + z, scene);
  stoneMat.diffuseColor = new BABYLON.Color3(0.42, 0.38, 0.52);

  const base = BABYLON.MeshBuilder.CreateBox("lPedBase_" + x + "_" + z,
    { width: 0.90, height: 0.22, depth: 0.90 }, scene);
  base.position = new BABYLON.Vector3(x, 0.11, z);
  base.material = stoneMat;

  const col = BABYLON.MeshBuilder.CreateCylinder("lPedCol_" + x + "_" + z,
    { diameter: 0.38, height: 1.30, tessellation: 10 }, scene);
  col.position = new BABYLON.Vector3(x, 0.87, z);
  col.material = stoneMat;

  const top = BABYLON.MeshBuilder.CreateBox("lPedTop_" + x + "_" + z,
    { width: 0.78, height: 0.18, depth: 0.78 }, scene);
  top.position = new BABYLON.Vector3(x, 1.61, z);
  top.material = stoneMat;

  const crystalMat = new BABYLON.StandardMaterial("lPedCrystal_" + x + "_" + z, scene);
  crystalMat.diffuseColor  = accentColor;
  crystalMat.emissiveColor = new BABYLON.Color3(
    accentColor.r * 0.7, accentColor.g * 0.5, accentColor.b * 0.8);
  crystalMat.alpha = 0.88;

  const orb = BABYLON.MeshBuilder.CreateCylinder("lPedOrb_" + x + "_" + z,
    { diameterTop: 0.08, diameterBottom: 0.44, height: 0.58, tessellation: 6 }, scene);
  orb.position = new BABYLON.Vector3(x, 1.90, z);
  orb.material = crystalMat;

  const tip = BABYLON.MeshBuilder.CreateSphere("lPedTip_" + x + "_" + z,
    { diameter: 0.24, segments: 8 }, scene);
  tip.position = new BABYLON.Vector3(x, 2.24, z);
  tip.material = crystalMat;

  const orbLight = new BABYLON.PointLight("lOrbLight_" + x + "_" + z,
    new BABYLON.Vector3(x, 2.0, z), scene);
  orbLight.diffuse   = accentColor;
  orbLight.intensity = 0.9;
  orbLight.range     = 10;
}

// ── Wall torch with purple flame ──────────────────────────────────────────────

function _buildWallTorch(scene, x, z, roomIdx, torchIdx, side, torchLights) {
  const metalMat = new BABYLON.StandardMaterial("lTorchMetal_" + roomIdx + torchIdx + side, scene);
  metalMat.diffuseColor = new BABYLON.Color3(0.30, 0.22, 0.38);

  const arm = BABYLON.MeshBuilder.CreateBox("lTorchArm_" + roomIdx + torchIdx + side,
    { width: 0.45, height: 0.11, depth: 0.11 }, scene);
  arm.position = new BABYLON.Vector3(x, 4.2, z);
  arm.material = metalMat;

  const handle = BABYLON.MeshBuilder.CreateCylinder("lTorchHandle_" + roomIdx + torchIdx + side,
    { diameter: 0.13, height: 0.68, tessellation: 8 }, scene);
  handle.position = new BABYLON.Vector3(x + side * (-0.21), 4.37, z);
  handle.material = metalMat;

  const flameMat = new BABYLON.StandardMaterial("lFlame_" + roomIdx + torchIdx + side, scene);
  flameMat.diffuseColor  = new BABYLON.Color3(0.75, 0.35, 1.0);
  flameMat.emissiveColor = new BABYLON.Color3(0.45, 0.10, 0.65);

  const flame = BABYLON.MeshBuilder.CreateCylinder("lFlame_" + roomIdx + torchIdx + side,
    { diameterTop: 0, diameterBottom: 0.24, height: 0.40, tessellation: 8 }, scene);
  flame.position = new BABYLON.Vector3(x + side * (-0.21), 4.76, z);
  flame.material = flameMat;

  const light = new BABYLON.PointLight(
    "lTorchLight_" + roomIdx + torchIdx + side,
    new BABYLON.Vector3(x + side * (-0.21), 4.80, z),
    scene
  );
  light.diffuse   = new BABYLON.Color3(0.78, 0.48, 1.0);
  light.intensity = 2.3;
  light.range     = 22;
  torchLights.push(light);
}

// ── Chandelier ────────────────────────────────────────────────────────────────

function _buildChandelier(scene, x, y, z, accentColor, torchLights) {
  const metalMat = new BABYLON.StandardMaterial("lChandMetal", scene);
  metalMat.diffuseColor = new BABYLON.Color3(0.48, 0.30, 0.62);

  const ring = BABYLON.MeshBuilder.CreateTorus("lChandRing",
    { diameter: 3.5, thickness: 0.14, tessellation: 32 }, scene);
  ring.position = new BABYLON.Vector3(x, y, z);
  ring.material = metalMat;

  const chain = BABYLON.MeshBuilder.CreateCylinder("lChandChain",
    { diameter: 0.09, height: 1.6, tessellation: 6 }, scene);
  chain.position = new BABYLON.Vector3(x, y + 0.80, z);
  chain.material = metalMat;

  const crystalMat = new BABYLON.StandardMaterial("lCrystal", scene);
  crystalMat.diffuseColor  = accentColor;
  crystalMat.emissiveColor = new BABYLON.Color3(
    accentColor.r * 0.40, accentColor.g * 0.28, accentColor.b * 0.50);
  crystalMat.alpha = 0.85;

  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const cx2 = x + Math.cos(a) * 1.65;
    const cz2 = z + Math.sin(a) * 1.65;

    const crystal = BABYLON.MeshBuilder.CreateBox("lCrystal_" + i,
      { width: 0.14, height: 0.36, depth: 0.14 }, scene);
    crystal.position = new BABYLON.Vector3(cx2, y - 0.25, cz2);
    crystal.material = crystalMat;
  }

  const cl = new BABYLON.PointLight("lChandLight", new BABYLON.Vector3(x, y - 0.1, z), scene);
  cl.diffuse   = new BABYLON.Color3(0.82, 0.62, 1.0);
  cl.intensity = 3.5;
  cl.range     = 32;
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
    { width: 1.8, height: 0.26, depth: 1.4 }, scene);
  seat.position = new BABYLON.Vector3(x, 0.8, z);
  seat.material = crystalMat;

  const cushion = BABYLON.MeshBuilder.CreateBox("lThroneCushion",
    { width: 1.6, height: 0.18, depth: 1.2 }, scene);
  cushion.position = new BABYLON.Vector3(x, 0.98, z);
  cushion.material = cushionMat;

  const back = BABYLON.MeshBuilder.CreateBox("lThroneBack",
    { width: 1.8, height: 2.4, depth: 0.22 }, scene);
  back.position = new BABYLON.Vector3(x, 2.1, z - 0.70);
  back.material = crystalMat;

  [[-0.78, 0], [0.78, 0]].forEach(([ax], ai) => {
    const arm = BABYLON.MeshBuilder.CreateBox("lThroneArm_" + ai,
      { width: 0.20, height: 0.65, depth: 1.2 }, scene);
    arm.position = new BABYLON.Vector3(x + ax, 1.15, z);
    arm.material = crystalMat;
  });

  [-0.60, 0, 0.60].forEach((ox, si) => {
    const spire = BABYLON.MeshBuilder.CreateCylinder("lSpire_" + si,
      { diameterTop: 0, diameterBottom: 0.28, height: 0.80, tessellation: 6 }, scene);
    spire.position = new BABYLON.Vector3(x + ox, 3.20 + si * 0.10, z - 0.70);
    spire.material = crystalMat;
  });
}

// ── Tile texture helper ───────────────────────────────────────────────────────

function _applyTileTexture(scene, mat, baseColor, uTiles, vTiles, dark) {
  const size = 512;
  const dt = new BABYLON.DynamicTexture("lTileTex_" + Math.random(), { width: size, height: size }, scene);
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
