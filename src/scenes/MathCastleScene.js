/**
 * MathCastleScene.js
 * Interior of the Math Castle — 4 rooms connected in a line.
 *
 *   Room 0 (index) → Room 1 — Addition & Subtraction  (text input)
 *   Room 1          → Room 2 — Multiplication          (multiple choice)
 *   Room 2          → Room 3 — Shapes & Counting       (multiple choice)
 *   Room 3          → Throne Room                      (multiple choice rapid-fire × 3)
 *
 * On Throne Room completion the Math Crown is earned.
 */

import { createPlayer }       from "../entities/Player.js";
import { showPuzzle }             from "../puzzles/MathPuzzleUI.js";
import { mathPuzzles }        from "../data/mathPuzzles.js";
import { SaveManager }        from "../utils/SaveManager.js";
import { createVirtualJoystick, destroyVirtualJoystick } from "../ui/VirtualJoystick.js";

const BABYLON = window.BABYLON;

/** Room metadata */
const ROOMS = [
  { name: "Room 1 — Addition & Subtraction ➕➖", pool: "room1", type: "text",   color: new BABYLON.Color3(0.85, 0.78, 0.55) },
  { name: "Room 2 — Multiplication 🌟",           pool: "room2", type: "choice", color: new BABYLON.Color3(0.78, 0.85, 0.55) },
  { name: "Room 3 — Shapes & Counting 🔷",        pool: "room3", type: "choice", color: new BABYLON.Color3(0.55, 0.78, 0.85) },
  { name: "👑 Throne Room",                        pool: "throne",type: "throne", color: new BABYLON.Color3(0.9,  0.82, 0.45) }
];

const ROOM_LENGTH = 36; // Z-offset between rooms
const ROOM_WIDTH  = 48; // triple the original 16 — wide open rooms

/**
 * @param {BABYLON.Engine} engine
 * @param {Function} onExit – go back to WorldScene
 * @returns {BABYLON.Scene}
 */
export function createMathCastleScene(engine, onExit) {
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.12, 0.08, 0.05, 1);

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
  ROOMS.forEach((room, i) => {
    _buildRoom(scene, i, room.color, doors);
  });

  // Player — start just inside Room 0
  const player = createPlayer(scene);
  player.mesh.position = new BABYLON.Vector3(0, 0.5, 2);

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
  let switching    = false; // prevent double scene-switch
  let currentRoom  = 0;

  scene.registerBeforeRender(() => {
    if (puzzleActive || switching) return;
    player.update();

    const pz = player.mesh.position.z;
    const px = player.mesh.position.x;

    // Current room index based on Z position
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

    // Door triggers — player tries to move through a door
    doors.forEach((doorInfo, i) => {
      if (puzzleActive) return;
      const doorZ = doorInfo.z;
      const dist  = Math.abs(pz - doorZ);
      const distX = Math.abs(px);

      if (dist < 2.5 && distX < 3) {
        // Check if room already solved
        if (SaveManager.isRoomUnlocked("mathIsland", i + 1)) {
          // Door already open — let player pass, mark door green
          doorInfo.mesh.material.diffuseColor = new BABYLON.Color3(0.1, 0.8, 0.2);
          return;
        }
        // Block and show puzzle
        puzzleActive = true;
        player.mesh.position.z = doorZ - 3; // push back
        _triggerPuzzle(i, scene, () => {
          SaveManager.markRoomComplete("mathIsland", i);
          doorInfo.mesh.material.diffuseColor = new BABYLON.Color3(0.1, 0.8, 0.2);
          puzzleActive = false;
          _updateHUD(hudLocation, hudStars, currentRoom);

          // Throne room victory
          if (i === 3) {
            SaveManager.earnCrown("mathIsland");
            _spawnCrownParticles(scene);
            _showVictory(scene, "Math Crown", onExit);
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

  const mat = new BABYLON.StandardMaterial("roomFloor_" + idx, scene);
  mat.diffuseColor = floorColor;

  // Floor
  const floor = BABYLON.MeshBuilder.CreateBox("floor_" + idx,
    { width: ROOM_WIDTH, height: 0.2, depth: ROOM_LENGTH }, scene);
  floor.position = new BABYLON.Vector3(0, 0, baseZ + ROOM_LENGTH / 2);
  floor.material = mat;

  // Walls
  const wallMat = new BABYLON.StandardMaterial("wall_" + idx, scene);
  wallMat.diffuseColor = new BABYLON.Color3(
    floorColor.r * 0.7, floorColor.g * 0.7, floorColor.b * 0.7
  );

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

  // Back wall (entry side)
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
    edMat.diffuseColor = new BABYLON.Color3(0.15, 0.1, 0.05);
    exitDoor.material = edMat;
  }

  // Door to NEXT room (at far end of this room)
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

  // Check if already solved
  const save = SaveManager.load();
  const solved = save.mathIsland.roomsCompleted[idx];
  doorSlabMat.diffuseColor = solved
    ? new BABYLON.Color3(0.1, 0.8, 0.2)
    : new BABYLON.Color3(0.85, 0.1, 0.1);
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

// ─── Puzzle trigger ───────────────────────────────────────────────────────────

function _triggerPuzzle(roomIndex, scene, onSuccess) {
  const { pool, type } = ROOMS[roomIndex];

  if (type === "throne") {
    _runThronePuzzle(onSuccess);
    return;
  }

  const pool_data = mathPuzzles[pool];
  const q = pool_data[Math.floor(Math.random() * pool_data.length)];
  showPuzzle(q, type === "text" ? "text" : "choice", onSuccess);
}

// Throne: must answer 3 random questions in a row
function _runThronePuzzle(onSuccess) {
  let streak = 0;
  const needed = 3;

  function nextQ() {
    const pool = mathPuzzles.throne;
    const q = pool[Math.floor(Math.random() * pool.length)];
    showPuzzle(
      { ...q, question: `[${streak + 1}/${needed}] ${q.question}` },
      "choice",
      () => {
        streak++;
        if (streak >= needed) {
          onSuccess();
        } else {
          nextQ();
        }
      }
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
  const save = SaveManager.load();
  const stars = save.mathIsland.roomsCompleted
    .map(done => done ? "⭐" : "☆")
    .join(" ");
  starsEl.textContent = stars;
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
