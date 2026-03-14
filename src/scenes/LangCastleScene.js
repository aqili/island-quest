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

  const doors = [];
  ROOMS.forEach((room, i) => {
    _buildRoom(scene, i, room.color, doors);
  });

  const player = createPlayer(scene);
  player.mesh.position = new BABYLON.Vector3(0, 0.5, 2);

  const hudLocation = document.getElementById("hud-location");
  const hudStars    = document.getElementById("hud-stars");
  _updateHUD(hudLocation, hudStars, 0);

  // Show exit button
  const hudExit    = document.getElementById("hud-exit");
  const hudExitBtn = document.getElementById("hud-exit-btn");
  hudExit.style.display = "";

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

  const ceil = BABYLON.MeshBuilder.CreateBox("lCeil_" + idx,
    { width: 16, height: 0.2, depth: ROOM_LENGTH }, scene);
  ceil.position = new BABYLON.Vector3(0, 8, baseZ + ROOM_LENGTH / 2);
  ceil.material = wallMat;

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

  doors.push({ mesh: doorSlab, z: doorZ });
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
