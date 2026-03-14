/**
 * LangCastleScene.js
 * Interior of the Language Castle — 4 rooms connected in a line.
 *
 *   Room 0 → Room 1 — Spelling             (text input + scrambled hint)
 *   Room 1 → Room 2 — Word Unscramble      (text input)
 *   Room 2 → Room 3 — Fill in the Blank    (multiple choice)
 *   Room 3 → Throne Room                   (sentence arrangement)
 *
 * On Throne Room completion the Language Crown is earned.
 */

import { createPlayer }       from "../entities/Player.js";
import { showPuzzle }             from "../puzzles/LangPuzzleUI.js";
import { langPuzzles }        from "../data/langPuzzles.js";
import { SaveManager }        from "../utils/SaveManager.js";
import { createVirtualJoystick, destroyVirtualJoystick } from "../ui/VirtualJoystick.js";

const BABYLON = window.BABYLON;

/** Room metadata */
const ROOMS = [
  { name: "Room 1 — Spelling 🔤",           pool: "room1",  type: "spelling",   color: new BABYLON.Color3(0.5, 0.55, 0.85) },
  { name: "Room 2 — Word Unscramble 🔀",    pool: "room2",  type: "unscramble", color: new BABYLON.Color3(0.65, 0.45, 0.85) },
  { name: "Room 3 — Fill in the Blank 📖",  pool: "room3",  type: "fillblank",  color: new BABYLON.Color3(0.45, 0.75, 0.85) },
  { name: "👑 Throne Room",                  pool: "throne", type: "throne",     color: new BABYLON.Color3(0.7,  0.5,  0.9) }
];

const ROOM_LENGTH = 36;

/**
 * @param {BABYLON.Engine} engine
 * @param {Function} onExit
 * @returns {BABYLON.Scene}
 */
export function createLangCastleScene(engine, onExit) {
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.07, 0.04, 0.12, 1);

  createVirtualJoystick();
  scene.onDisposeObservable.addOnce(() => destroyVirtualJoystick());

  const ambient = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
  ambient.intensity = 0.9;

  // Fog — focus view on current room
  scene.fogMode    = BABYLON.Scene.FOGMODE_EXP2;
  scene.fogColor   = new BABYLON.Color3(0.07, 0.04, 0.12);
  scene.fogDensity = 0.018;

  const doors = [];
  ROOMS.forEach((room, i) => {
    _buildRoom(scene, i, room.color, doors);
  });

  const player = createPlayer(scene);
  player.mesh.position = new BABYLON.Vector3(0, 0.5, 2);

  // Top-down castle camera — player can see full room without walls blocking
  const cam = player.camera;
  cam.alpha            = -Math.PI / 2;
  cam.beta             = Math.PI / 3;
  cam.radius           = 22;
  cam.lowerBetaLimit   = 0.4;
  cam.upperBetaLimit   = Math.PI / 2.3;
  cam.lowerRadiusLimit = 12;
  cam.upperRadiusLimit = 30;

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

  scene.registerBeforeRender(() => {
    if (puzzleActive || switching) return;
    player.update();

    const pz = player.mesh.position.z;
    const px = player.mesh.position.x;

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

    // Door triggers
    doors.forEach((doorInfo, i) => {
      if (puzzleActive) return;
      const doorZ = doorInfo.z;
      if (Math.abs(pz - doorZ) < 2.5 && Math.abs(px) < 3) {
        if (SaveManager.isRoomUnlocked("languageIsland", i + 1)) {
          doorInfo.mesh.material.diffuseColor = new BABYLON.Color3(0.1, 0.8, 0.2);
          return;
        }
        puzzleActive = true;
        player.mesh.position.z = doorZ - 3;
        _triggerPuzzle(i, () => {
          SaveManager.markRoomComplete("languageIsland", i);
          doorInfo.mesh.material.diffuseColor = new BABYLON.Color3(0.1, 0.8, 0.2);
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
  });

  return scene;
}

// ─── Room builder ─────────────────────────────────────────────────────────────

function _buildRoom(scene, idx, floorColor, doors) {
  const BABYLON = window.BABYLON;
  const baseZ = idx * ROOM_LENGTH;

  const mat = new BABYLON.StandardMaterial("lRoomFloor_" + idx, scene);
  mat.diffuseColor = floorColor;

  const floor = BABYLON.MeshBuilder.CreateBox("lFloor_" + idx,
    { width: 16, height: 0.2, depth: ROOM_LENGTH }, scene);
  floor.position = new BABYLON.Vector3(0, 0, baseZ + ROOM_LENGTH / 2);
  floor.material = mat;

  const wallMat = new BABYLON.StandardMaterial("lWall_" + idx, scene);
  wallMat.diffuseColor = new BABYLON.Color3(
    floorColor.r * 0.65, floorColor.g * 0.65, floorColor.b * 0.65
  );

  const lWall = BABYLON.MeshBuilder.CreateBox("lLWall_" + idx,
    { width: 0.3, height: 8, depth: ROOM_LENGTH }, scene);
  lWall.position = new BABYLON.Vector3(-8.15, 4, baseZ + ROOM_LENGTH / 2);
  lWall.material = wallMat;

  const rWall = BABYLON.MeshBuilder.CreateBox("lRWall_" + idx,
    { width: 0.3, height: 8, depth: ROOM_LENGTH }, scene);
  rWall.position = new BABYLON.Vector3(8.15, 4, baseZ + ROOM_LENGTH / 2);
  rWall.material = wallMat;

  // NOTE: No ceiling — open top allows the top-down camera to see inside

  if (idx === 0) {
    const backWall = BABYLON.MeshBuilder.CreateBox("lBackWall",
      { width: 16, height: 8, depth: 0.3 }, scene);
    backWall.position = new BABYLON.Vector3(0, 4, baseZ);
    backWall.material = wallMat;
    const exitDoor = BABYLON.MeshBuilder.CreateBox("lExitDoor",
      { width: 4, height: 5, depth: 0.5 }, scene);
    exitDoor.position = new BABYLON.Vector3(0, 2.5, baseZ);
    const edMat = new BABYLON.StandardMaterial("lExitDoorMat", scene);
    edMat.diffuseColor = new BABYLON.Color3(0.1, 0.05, 0.15);
    exitDoor.material = edMat;
  }

  const doorZ = baseZ + ROOM_LENGTH;
  const frontWall = BABYLON.MeshBuilder.CreateBox("lFrontWall_" + idx,
    { width: 16, height: 8, depth: 0.3 }, scene);
  frontWall.position = new BABYLON.Vector3(0, 4, doorZ);
  frontWall.material = wallMat;

  [[-5, 6], [5, 6]].forEach(([dx, dw], j) => {
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
  const save = SaveManager.load();
  const solved = save.languageIsland.roomsCompleted[idx];
  doorSlabMat.diffuseColor = solved
    ? new BABYLON.Color3(0.1, 0.8, 0.2)
    : new BABYLON.Color3(0.7, 0.05, 0.7);
  doorSlab.material = doorSlabMat;

  // Two torches (one each side wall) per room
  [-6, 6].forEach((tx, ti) => {
    const torch = new BABYLON.PointLight("lTorch_" + idx + "_" + ti,
      new BABYLON.Vector3(tx, 6, baseZ + ROOM_LENGTH / 2), scene);
    torch.diffuse   = new BABYLON.Color3(0.7, 0.4, 1.0);
    torch.intensity = 1.5;
    torch.range     = 40;
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
    { width: 11, height: 0.05, depth: 24 }, scene);
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
    const shelf = BABYLON.MeshBuilder.CreateBox("lShelf_" + idx + side,
      { width: 0.35, height: 4, depth: 8 }, scene);
    shelf.position = new BABYLON.Vector3(side * 7.5, 2, baseZ + ROOM_LENGTH * 0.68);
    shelf.material = shelfMat;
    for (let b = 0; b < 5; b++) {
      const book = BABYLON.MeshBuilder.CreateBox("lBook_" + idx + side + b,
        { width: 0.45, height: 0.65, depth: 1.0 }, scene);
      book.position = new BABYLON.Vector3(
        side * 7.3,
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

// ─── Puzzle trigger ───────────────────────────────────────────────────────────

function _triggerPuzzle(roomIndex, onSuccess) {
  const { pool, type } = ROOMS[roomIndex];

  if (type === "throne") {
    _runThronePuzzle(onSuccess);
    return;
  }

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
  const stars = save.languageIsland.roomsCompleted
    .map(done => done ? "⭐" : "☆")
    .join(" ");
  starsEl.textContent = stars;
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
