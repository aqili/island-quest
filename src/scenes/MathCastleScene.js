/**
 * MathCastleScene.js  (v2 — S-shaped layout with corner corridors)
 *
 * Layout bird's-eye view (not to scale):
 *
 *   ROOM 0 (cx=0)   → puzzle door at z=38 → CORRIDOR 0→1 → ROOM 1 (cx=34)
 *   ROOM 1 (cx=34)  → puzzle door at z=0  → CORRIDOR 1→2 → ROOM 2 (cx=68)
 *   ROOM 2 (cx=68)  → puzzle door at z=38 → CORRIDOR 2→3 → ROOM 3 (cx=102)
 *
 *   The player walks: +Z in Room 0, then RIGHT into corridor, then –Z in Room 1,
 *   then RIGHT into corridor, then +Z in Room 2, then RIGHT into corridor,
 *   then –Z in Room 3 (Throne).
 *
 *   Player enters world at Room 0, z≈5. World exit is at Room 0, z<0.
 */

import { createPlayer }  from "../entities/Player.js";
import { showPuzzle }    from "../puzzles/MathPuzzleUI.js";
import { mathPuzzles }   from "../data/mathPuzzles.js";
import { SaveManager }   from "../utils/SaveManager.js";
import { SoundManager }  from "../utils/SoundManager.js";

const BABYLON = window.BABYLON;

// ── Layout constants ──────────────────────────────────────────────────────────
const ROOM_W   = 22;       // room width  (x direction)
const ROOM_L   = 38;       // room length (z direction, walking axis)
const ROOM_H   = 7.0;      // ceiling height
const CONN_GAP = 12;       // connector corridor width (x span between room walls)
const CONN_D   = 10;       // connector corridor z-depth
const STEP     = ROOM_W + CONN_GAP;   // = 34 — x-offset between room centres

// Four room centre x-positions
const ROOM_CX  = [0, STEP, 2 * STEP, 3 * STEP];   // [0, 34, 68, 102]
const HW       = ROOM_W / 2;                        // half-width = 11

// Puzzle door z for each room (even → far end, odd → near end)
const DOOR_Z   = (idx) => (idx % 2 === 0 ? ROOM_L : 0);
const ENTER_Z  = (idx) => (idx % 2 === 0 ? 0      : ROOM_L);

// Connector data (corridor between room i and i+1)
const CONN = [0, 1, 2].map(i => {
  const xMin = ROOM_CX[i]   + HW;
  const xMax = ROOM_CX[i+1] - HW;
  const zC   = DOOR_Z(i);
  return {
    xMin, xMax,
    xC:   (xMin + xMax) / 2,
    zC,
    zMin: zC - CONN_D / 2,
    zMax: zC + CONN_D / 2,
  };
});

// ── Room definitions ──────────────────────────────────────────────────────────
const ROOMS = [
  { name: "Room 1 — Addition & Subtraction",
    pool: "room1",  type: "text",
    wallColor: new BABYLON.Color3(0.60, 0.55, 0.46),
    accentColor: new BABYLON.Color3(0.90, 0.70, 0.18) },
  { name: "Room 2 — Multiplication",
    pool: "room2",  type: "choice",
    wallColor: new BABYLON.Color3(0.52, 0.60, 0.46),
    accentColor: new BABYLON.Color3(0.20, 0.82, 0.38) },
  { name: "Room 3 — Shapes & Counting",
    pool: "room3",  type: "choice",
    wallColor: new BABYLON.Color3(0.44, 0.54, 0.65),
    accentColor: new BABYLON.Color3(0.22, 0.58, 0.95) },
  { name: "Throne Room",
    pool: "throne", type: "throne",
    wallColor: new BABYLON.Color3(0.64, 0.56, 0.35),
    accentColor: new BABYLON.Color3(0.95, 0.82, 0.18) },
];

const DESIRED_RADIUS = 11;

// ── Main export ───────────────────────────────────────────────────────────────

export function createMathCastleScene(engine, onExit) {
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.06, 0.05, 0.04, 1);

  const ambient = new BABYLON.HemisphericLight("ambLight", new BABYLON.Vector3(0, 1, 0), scene);
  ambient.intensity   = 0.55;
  ambient.diffuse     = new BABYLON.Color3(1.0, 0.95, 0.80);
  ambient.groundColor = new BABYLON.Color3(0.18, 0.12, 0.05);

  // ── Build all rooms and corridors ────────────────────────────────────────
  const doors       = [];
  const torchLights = [];

  ROOMS.forEach((room, i) => {
    _buildRoom(scene, i, room.wallColor, room.accentColor, doors, torchLights);
  });
  CONN.forEach((_, i) => {
    _buildConnector(scene, i, ROOMS[i].wallColor, ROOMS[i].accentColor, torchLights);
  });

  // ── Player ───────────────────────────────────────────────────────────────
  const player = createPlayer(scene);
  player.mesh.position.set(0, 0.5, 6);
  player.camera.radius           = DESIRED_RADIUS;
  player.camera.lowerRadiusLimit = 3;
  player.camera.upperRadiusLimit = 26;

  // ── HUD ──────────────────────────────────────────────────────────────────
  const hudLocation = document.getElementById("hud-location");
  const hudStars    = document.getElementById("hud-stars");
  _updateHUD(hudLocation, hudStars, 0);

  let puzzleActive = false;
  let switching    = false;
  let currentRoom  = 0;
  let flickerT     = 0;

  // ── Apply initial door colours (already-solved rooms) ───────────────────
  doors.forEach((door, i) => {
    if (SaveManager.isRoomUnlocked("mathIsland", i + 1)) _setDoorSolved(door);
  });

  // ── Render loop ──────────────────────────────────────────────────────────
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

      const px = player.mesh.position.x;
      const pz = player.mesh.position.z;

      // Room detection — closest room centre in x
      let roomIdx = 0, bestD = Infinity;
      for (let i = 0; i < 4; i++) {
        const d = Math.abs(px - ROOM_CX[i]);
        if (d < bestD) { bestD = d; roomIdx = i; }
      }
      if (roomIdx !== currentRoom) {
        currentRoom = roomIdx;
        _updateHUD(hudLocation, hudStars, roomIdx);
      }

      // Dynamic camera — keep inside current room walls
      {
        const cx   = ROOM_CX[currentRoom];
        const dL   = Math.max(0.6, px - (cx - HW));
        const dR   = Math.max(0.6, (cx + HW) - px);
        const dB   = Math.max(0.6, pz);
        const dF   = Math.max(0.6, ROOM_L - pz);
        const safe = Math.min(DESIRED_RADIUS, dL * 0.85, dR * 0.85, dB * 0.85, dF * 0.85);
        const r    = Math.max(3.0, safe);
        player.camera.radius           = BABYLON.Scalar.Lerp(player.camera.radius, r, 0.15);
        player.camera.upperRadiusLimit = r + 0.5;
      }

      // Exit back to world (Room 0, behind start)
      if (pz < -1.5 && Math.abs(px - ROOM_CX[0]) < HW + 3) {
        switching = true;
        setTimeout(() => onExit(), 0);
        return;
      }

      // Door triggers
      doors.forEach((door) => {
        if (puzzleActive) return;
        if (Math.abs(px - door.cx) < 2.5 && Math.abs(pz - door.dz) < 2.2) {
          if (SaveManager.isRoomUnlocked("mathIsland", door.idx + 1)) {
            _setDoorSolved(door);
            return;
          }
          puzzleActive = true;
          // Push player back from door
          player.mesh.position.z = door.dz > ROOM_L / 2
            ? door.dz - 2.8
            : door.dz + 2.8;

          SoundManager.playWrong && SoundManager.playWrong();
          _triggerPuzzle(door.idx, scene, () => {
            SaveManager.markRoomComplete("mathIsland", door.idx);
            _setDoorSolved(door);
            SoundManager.playCorrect && SoundManager.playCorrect();
            puzzleActive = false;
            _updateHUD(hudLocation, hudStars, currentRoom);
            if (door.idx === 3) {
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

// ── Door colour helpers ───────────────────────────────────────────────────────

function _setDoorSolved(door) {
  door.slabMat.diffuseColor  = new BABYLON.Color3(0.05, 0.85, 0.28);
  door.slabMat.emissiveColor = new BABYLON.Color3(0.02, 0.30, 0.08);
  if (door.light) {
    door.light.diffuse   = new BABYLON.Color3(0.15, 1.0, 0.30);
    door.light.intensity = 1.2;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOM BUILDER
// ─────────────────────────────────────────────────────────────────────────────

function _buildRoom(scene, idx, wallColor, accentColor, doors, torchLights) {
  const cx       = ROOM_CX[idx];
  const isThrone = idx === 3;
  const wallMidY = ROOM_H / 2;
  const dz       = DOOR_Z(idx);
  const ez       = ENTER_Z(idx);

  // ── Materials ─────────────────────────────────────────────────────────
  const stoneMat = _mat(scene, "stone_" + idx, wallColor, 0.06);

  const floorMat = _mat(scene, "floor_" + idx,
    new BABYLON.Color3(wallColor.r * 0.75, wallColor.g * 0.72, wallColor.b * 0.66), 0.08);
  floorMat.specularPower = 28;
  _applyTileTexture(scene, floorMat, wallColor, 11, 19);

  const ceilMat = _mat(scene, "ceil_" + idx,
    new BABYLON.Color3(wallColor.r * 0.40, wallColor.g * 0.38, wallColor.b * 0.35), 0.0);

  const pillarMat = _mat(scene, "pillar_" + idx,
    new BABYLON.Color3(wallColor.r * 0.90, wallColor.g * 0.88, wallColor.b * 0.84), 0.06);

  // ── Floor ─────────────────────────────────────────────────────────────
  box("floor_" + idx, scene, ROOM_W, 0.22, ROOM_L, cx, 0.11, ROOM_L / 2, floorMat);

  // Carpet runner
  box("carpet_" + idx, scene, 3.0, 0.02, ROOM_L - 2, cx, 0.12, ROOM_L / 2,
    _mat(scene, "carpetM_" + idx, isThrone
      ? new BABYLON.Color3(0.72, 0.52, 0.06)
      : new BABYLON.Color3(accentColor.r * 0.65, accentColor.g * 0.40, accentColor.b * 0.30), 0.0));

  // ── Ceiling ───────────────────────────────────────────────────────────
  box("ceil_" + idx, scene, ROOM_W + 0.8, 0.20, ROOM_L + 0.8, cx, ROOM_H + 0.10, ROOM_L / 2, ceilMat);

  // ── Side walls (with corridor openings) ───────────────────────────────
  // Left wall: needs a gap where CONN[idx-1] connects (if idx>0)
  // Right wall: needs a gap where CONN[idx] connects (if idx<3)
  _buildSideWall(scene, "lWall_" + idx, cx - HW - 0.20, wallMidY, stoneMat,
    idx > 0 ? CONN[idx - 1] : null);
  _buildSideWall(scene, "rWall_" + idx, cx + HW + 0.20, wallMidY, stoneMat,
    idx < 3 ? CONN[idx]     : null);

  // ── Entry side ────────────────────────────────────────────────────────
  if (idx === 0) {
    // Room 0 — solid back wall with world-exit opening
    box("bWall_0", scene, ROOM_W + 0.8, ROOM_H, 0.40, cx, wallMidY, 0, stoneMat);
    // Opening
    const edMat = _mat(scene, "exitDoor", new BABYLON.Color3(0.06, 0.04, 0.02), 0.0);
    box("exitDoorFg", scene, 4.0, 5.0, 0.45, cx, 2.5, 0, edMat);
    arch("exitArch", scene, 4.0, 1.6, 0.45, cx, 5.2, 0, edMat);
  } else {
    // Rooms 1-3 — decorative arch matching connector opening
    const trimMat = _mat(scene, "entTrimM_" + idx,
      new BABYLON.Color3(wallColor.r * 0.88, wallColor.g * 0.86, wallColor.b * 0.82), 0.0);
    const archMat = _mat(scene, "entArM_" + idx,
      new BABYLON.Color3(accentColor.r * 0.80, accentColor.g * 0.80, accentColor.b * 0.80), 0.10);

    // Corner pilasters
    for (const sg of [-1, 1]) {
      box("entP_" + idx + sg, scene, 0.60, ROOM_H, 0.60, cx + sg * (HW - 0.50), wallMidY, ez, trimMat);
    }
    // Semi-circular arch over opening
    arch("entArch_" + idx, scene, CONN_GAP - 1, 2.0, 0.60, cx, 5.0, ez, archMat);
    // Top fill above arch
    box("entTopFill_" + idx, scene,
      CONN_GAP - 1, ROOM_H - 5.2, 0.40,
      cx, 5.2 + (ROOM_H - 5.2) / 2, ez, stoneMat);
  }

  // ── Puzzle door ───────────────────────────────────────────────────────
  _buildPuzzleDoor(scene, idx, cx, dz, wallColor, accentColor, stoneMat, doors, torchLights);

  // ── Pillars ───────────────────────────────────────────────────────────
  [ROOM_L * 0.22, ROOM_L * 0.55, ROOM_L * 0.78].forEach((pz, pi) => {
    for (const sg of [-1, 1]) {
      const px_ = cx + sg * (HW * 0.50);
      cyl("pShaft_" + idx + pi + sg, scene, 0.75, 6.5, px_, 3.25, pz, pillarMat);
      box("pCap_"   + idx + pi + sg, scene, 0.95, 0.28, 0.95, px_, 6.64, pz, pillarMat);
      box("pBase_"  + idx + pi + sg, scene, 0.95, 0.24, 0.95, px_, 0.12, pz, pillarMat);
    }
  });

  // ── Banners ───────────────────────────────────────────────────────────
  const banMat  = _mat(scene, "ban_" + idx, accentColor, 0.18);
  const trimMat2 = _mat(scene, "bTrim2_" + idx, new BABYLON.Color3(0.90, 0.80, 0.18), 0.0);
  [ROOM_L * 0.22, ROOM_L * 0.55].forEach((pz, pi) => {
    for (const sg of [-1, 1]) {
      const px_ = cx + sg * (HW * 0.50);
      const off = sg < 0 ? 0.50 : -0.50;
      box("ban_"  + idx + pi + sg, scene, 0.75, 2.2, 0.07, px_ + off, 4.4, pz, banMat);
      box("bTR_"  + idx + pi + sg, scene, 0.75, 0.15, 0.08, px_ + off, 3.2, pz, trimMat2);
    }
  });

  // ── Wall torches ──────────────────────────────────────────────────────
  [8, ROOM_L / 2, ROOM_L - 8].forEach((tz, ti) => {
    for (const sg of [-1, 1]) {
      _buildWallTorch(scene, cx + sg * (HW - 0.20), tz, idx, ti, sg, torchLights);
    }
  });

  // ── Pedestals ─────────────────────────────────────────────────────────
  [ROOM_L * 0.30, ROOM_L * 0.70].forEach((pz, i) => {
    [cx - HW * 0.65, cx + HW * 0.65].forEach((px_, j) => {
      _buildPedestal(scene, px_, pz, accentColor, idx + "_" + i + "_" + j);
    });
  });

  // ── Room extras ───────────────────────────────────────────────────────
  if (isThrone) {
    _buildChandelier(scene, cx, 5.8, ROOM_L / 2, accentColor, torchLights);
    _buildThroneChair(scene, cx, ROOM_L - 6);
    const spotA = new BABYLON.PointLight("thrSpot", new BABYLON.Vector3(cx, 5.5, ROOM_L / 2), scene);
    spotA.diffuse = new BABYLON.Color3(1.0, 0.90, 0.40); spotA.intensity = 1.8; spotA.range = 20;
  }
  _addRoomFurniture(scene, idx, cx, wallColor, accentColor, isThrone);

  // ── Overhead fill lights ──────────────────────────────────────────────
  for (const frac of [0.25, 0.75]) {
    const pl = new BABYLON.PointLight("pl_" + idx + frac,
      new BABYLON.Vector3(cx, 5.5, ROOM_L * frac), scene);
    pl.diffuse = new BABYLON.Color3(1.0, 0.92, 0.80);
    pl.intensity = 1.0; pl.range = 22;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUZZLE DOOR — clear arch-framed coloured slab (RED=locked, GREEN=solved)
// ─────────────────────────────────────────────────────────────────────────────

function _buildPuzzleDoor(scene, idx, cx, dz, wallColor, accentColor, stoneMat, doors, torchLights) {
  const wallMidY = ROOM_H / 2;
  const DOOR_W   = 4.0;
  const DOOR_H   = 5.0;
  const segW     = (ROOM_W - DOOR_W) / 2;   // 9.0

  // Wall panels flanking the door opening
  for (const sg of [-1, 1]) {
    box("dSeg_" + idx + sg, scene,
      segW, ROOM_H, 0.42,
      cx + sg * (DOOR_W / 2 + segW / 2), wallMidY, dz, stoneMat);
  }
  // Lintel above arch
  box("dTop_"  + idx, scene,
    DOOR_W + 0.4, ROOM_H - DOOR_H, 0.42,
    cx, DOOR_H + (ROOM_H - DOOR_H) / 2, dz, stoneMat);

  // Stone arch crown
  const archMat = _mat(scene, "dArch_" + idx,
    new BABYLON.Color3(wallColor.r * 0.92, wallColor.g * 0.90, wallColor.b * 0.86), 0.0);
  arch("dArch_" + idx, scene, DOOR_W + 0.4, 1.8, 0.50, cx, DOOR_H + 0.1, dz, archMat);

  // Stone keystone above arch
  box("dKeystone_" + idx, scene, 0.55, 0.55, 0.52, cx, DOOR_H + 1.35, dz,
    _mat(scene, "dKS_" + idx,
      new BABYLON.Color3(accentColor.r * 0.80, accentColor.g * 0.80, accentColor.b * 0.80), 0.15));

  // Pilasters flanking the door
  const pilMat = _mat(scene, "dPil_" + idx,
    new BABYLON.Color3(wallColor.r * 0.88, wallColor.g * 0.86, wallColor.b * 0.82), 0.0);
  for (const sg of [-1, 1]) {
    box("dPilaster_" + idx + sg, scene,
      0.55, DOOR_H, 0.55,
      cx + sg * (DOOR_W / 2 + 0.28), DOOR_H / 2, dz, pilMat);
  }

  // ── Coloured door slab ────────────────────────────────────────────────
  const save   = SaveManager.load();
  const solved = !!(save.mathIsland && save.mathIsland.roomsCompleted &&
                     save.mathIsland.roomsCompleted[idx]);

  const slabMat = new BABYLON.StandardMaterial("dSlab_" + idx, scene);
  slabMat.diffuseColor  = solved
    ? new BABYLON.Color3(0.05, 0.85, 0.28) : new BABYLON.Color3(0.88, 0.08, 0.05);
  slabMat.emissiveColor = solved
    ? new BABYLON.Color3(0.02, 0.30, 0.08) : new BABYLON.Color3(0.26, 0.02, 0.01);

  const slab = BABYLON.MeshBuilder.CreateBox("dSlabM_" + idx,
    { width: DOOR_W, height: DOOR_H, depth: 0.28 }, scene);
  slab.position.set(cx, DOOR_H / 2, dz);
  slab.material = slabMat;

  // Gold border trim
  const trimMat = _mat(scene, "dTrimM_" + idx, new BABYLON.Color3(0.80, 0.68, 0.18), 0.22);
  for (const [w, h, bx, by] of [
    [DOOR_W + 0.32, 0.18, cx,           DOOR_H - 0.09],
    [DOOR_W + 0.32, 0.18, cx,           0.09          ],
    [0.18, DOOR_H,        cx - DOOR_W / 2 - 0.09, DOOR_H / 2],
    [0.18, DOOR_H,        cx + DOOR_W / 2 + 0.09, DOOR_H / 2],
  ]) {
    box("dTrP_" + idx + bx, scene, w, h, 0.34, bx, by, dz, trimMat);
  }

  // Door handle
  const handleMat = _mat(scene, "dHndl_" + idx, new BABYLON.Color3(0.82, 0.68, 0.16), 0.22);
  const handle = BABYLON.MeshBuilder.CreateSphere("dHndl_" + idx,
    { diameter: 0.28, segments: 6 }, scene);
  handle.position.set(cx + 1.3, DOOR_H * 0.48, dz - 0.22);
  handle.material = handleMat;

  // ── Glow light at door ────────────────────────────────────────────────
  const doorLight = new BABYLON.PointLight("dLight_" + idx,
    new BABYLON.Vector3(cx, 3.5, dz), scene);
  doorLight.diffuse   = solved
    ? new BABYLON.Color3(0.15, 1.0, 0.30) : new BABYLON.Color3(1.0, 0.20, 0.10);
  doorLight.intensity = solved ? 1.2 : 1.8;
  doorLight.range     = 12;

  // ── Floor approach glow + sign ────────────────────────────────────────
  _buildFloorMarker(scene, cx, dz, accentColor, idx);
  _buildDoorSign(scene, idx, cx, dz, accentColor);

  doors.push({ slabMat, light: doorLight, cx, dz, idx });
}

// ─────────────────────────────────────────────────────────────────────────────
// CONNECTOR CORRIDOR  (right-turn hallway between two rooms)
// ─────────────────────────────────────────────────────────────────────────────

function _buildConnector(scene, connIdx, wallColor, accentColor, torchLights) {
  const c        = CONN[connIdx];
  const wallMidY = ROOM_H / 2;

  const stoneMat = _mat(scene, "cStone_" + connIdx,
    new BABYLON.Color3(wallColor.r * 0.78, wallColor.g * 0.76, wallColor.b * 0.72), 0.0);
  const floorMat = _mat(scene, "cFloor_" + connIdx,
    new BABYLON.Color3(wallColor.r * 0.58, wallColor.g * 0.56, wallColor.b * 0.52), 0.0);
  const ceilMat  = _mat(scene, "cCeil_" + connIdx,
    new BABYLON.Color3(wallColor.r * 0.36, wallColor.g * 0.34, wallColor.b * 0.30), 0.0);
  const carpMat  = _mat(scene, "cCarp_" + connIdx,
    new BABYLON.Color3(accentColor.r * 0.60, accentColor.g * 0.38, accentColor.b * 0.28), 0.0);

  // Floor + ceiling
  box("cFloor_" + connIdx, scene, CONN_GAP, 0.22, CONN_D, c.xC, 0.11, c.zC, floorMat);
  box("cCeil_"  + connIdx, scene, CONN_GAP + 0.8, 0.20, CONN_D + 0.8, c.xC, ROOM_H + 0.10, c.zC, ceilMat);

  // North z-wall (zMax) and South z-wall (zMin)
  box("cNW_" + connIdx, scene, CONN_GAP, ROOM_H, 0.40, c.xC, wallMidY, c.zMax, stoneMat);
  box("cSW_" + connIdx, scene, CONN_GAP, ROOM_H, 0.40, c.xC, wallMidY, c.zMin, stoneMat);

  // Carpet
  box("cCarp_" + connIdx, scene, CONN_GAP - 2, 0.02, CONN_D - 1, c.xC, 0.12, c.zC, carpMat);

  // Accent crown strips on north/south walls
  const stripMat = _mat(scene, "cStrip_" + connIdx, accentColor, 0.25);
  box("cNStr_" + connIdx, scene, CONN_GAP, 0.15, 0.12, c.xC, ROOM_H - 0.08, c.zMax - 0.22, stripMat);
  box("cSStr_" + connIdx, scene, CONN_GAP, 0.15, 0.12, c.xC, ROOM_H - 0.08, c.zMin + 0.22, stripMat);

  // Arch openings on x-faces (matching room entry arches)
  const archMat = _mat(scene, "cArch_" + connIdx,
    new BABYLON.Color3(wallColor.r * 0.88, wallColor.g * 0.86, wallColor.b * 0.82), 0.0);
  // These are NOT solid walls — the rooms open there — just decorative corner arches
  for (const [fx, lbl] of [[c.xMin, "L"], [c.xMax, "R"]]) {
    arch("cFaceArch_" + connIdx + lbl, scene, CONN_D - 1, 2.0, 0.52, fx, 5.0, c.zC, archMat);
  }

  // Torches on z-walls
  for (const tz of [c.zMax - 0.22, c.zMin + 0.22]) {
    _buildWallTorch(scene, c.xC - 2.5, tz, 10 + connIdx, 0, 1, torchLights);
    _buildWallTorch(scene, c.xC + 2.5, tz, 10 + connIdx, 1, -1, torchLights);
  }

  // Corridor point light
  const cl = new BABYLON.PointLight("cLight_" + connIdx,
    new BABYLON.Vector3(c.xC, 4.5, c.zC), scene);
  cl.diffuse = new BABYLON.Color3(1.0, 0.85, 0.60);
  cl.intensity = 1.6; cl.range = 22;
}

// ─────────────────────────────────────────────────────────────────────────────
// FURNITURE
// ─────────────────────────────────────────────────────────────────────────────

function _addRoomFurniture(scene, idx, cx, wallColor, accentColor, isThrone) {
  const woodMat = _mat(scene, "fW_" + idx, new BABYLON.Color3(0.48, 0.30, 0.12), 0.0);
  const darkMat = _mat(scene, "fD_" + idx, new BABYLON.Color3(0.26, 0.16, 0.06), 0.0);

  if (!isThrone) {
    // Reading table
    box("fTabl_" + idx, scene, 5.2, 0.18, 2.4, cx, 0.98, ROOM_L * 0.62, woodMat);
    for (const [tx, tz] of [[-2.2, -0.9],[2.2, -0.9],[-2.2, 0.9],[2.2, 0.9]]) {
      box("fTL_" + idx + tx + tz, scene, 0.16, 0.98, 0.16, cx + tx, 0.49, ROOM_L * 0.62 + tz, woodMat);
    }
    // Chairs
    for (const cx_ of [cx - 3.8, cx + 3.8]) {
      box("fCS_" + idx + cx_, scene, 0.95, 0.12, 0.95, cx_, 0.72, ROOM_L * 0.62, woodMat);
      box("fCB_" + idx + cx_, scene, 0.95, 0.90, 0.10, cx_, 1.17, ROOM_L * 0.62 - 0.44, woodMat);
    }
  }

  // Bookshelves
  for (const [sx, sz] of [
    [cx - HW + 0.26, ROOM_L * 0.18], [cx + HW - 0.26, ROOM_L * 0.18],
    [cx - HW + 0.26, ROOM_L * 0.82], [cx + HW - 0.26, ROOM_L * 0.82]]) {
    box("fSh_" + idx + sx + sz, scene, 0.40, 3.8, 2.4, sx, 1.90, sz, woodMat);
    for (let bi = 0; bi < 3; bi++) {
      const bMat = _mat(scene, "fBkM_" + idx + sx + sz + bi,
        new BABYLON.Color3(Math.random()*0.5+0.3, Math.random()*0.3, Math.random()*0.4+0.2), 0.0);
      box("fBk_" + idx + sx + sz + bi, scene,
        0.34, 0.48, 0.40 + Math.random()*0.36, sx, 0.72 + bi * 0.90, sz, bMat);
    }
  }

  // Bench near entry
  const ez = ENTER_Z(idx);
  const bz = (ez === 0) ? 5 : ROOM_L - 5;
  box("fBen_" + idx, scene, 5.5, 0.13, 0.85, cx, 0.58, bz, woodMat);

  // Corner barrels
  for (const [dx] of [[-HW + 3.2], [HW - 3.2]]) {
    for (let bi = 0; bi < 2; bi++) {
      cyl("fBarr_" + idx + dx + bi, scene, 0.88, 1.15, cx + dx + bi * 1.05, 0.58, 4, darkMat);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DOOR SIGN
// ─────────────────────────────────────────────────────────────────────────────

function _buildDoorSign(scene, idx, cx, dz, accentColor) {
  const postMat = _mat(scene, "sPost_" + idx, new BABYLON.Color3(0.36, 0.22, 0.09), 0.0);
  for (const dx of [-1.9, 1.9]) {
    cyl("sPostC_" + idx + dx, scene, 0.20, 3.4, cx + dx, 1.7, dz, postMat);
  }

  const W = 512, H = 224;
  const bdt = new BABYLON.DynamicTexture("signTex_" + idx, { width: W, height: H }, scene);
  const ctx = bdt.getContext();

  // Each room's box-face shows the texture with a different orientation depending on which
  // face the player sees.  Apply the exact pre-flip the user observed is needed:
  //   Room 0 (idx=0): vertical flip only
  //   Room 1 (idx=1): horizontal flip only
  //   Room 2 (idx=2): vertical flip only
  //   Room 3 (idx=3): both horizontal + vertical
  ctx.save();
  // Rooms with door at Z=ROOM_L (idx 0,2): player sees -Z face = naturally correct, no flip.
  // Rooms with door at Z=0       (idx 1,3): player sees +Z face = naturally h+v flipped, need h+v.
  if (idx === 1 || idx === 3) {
    ctx.translate(W, H);
    ctx.scale(-1, -1);
  }
  // idx 0 and 2: no transform needed

  ctx.fillStyle = "#1a0e04"; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#d4a017"; ctx.lineWidth = 6; ctx.strokeRect(6, 6, W - 12, H - 12);
  ctx.fillStyle = "#FFD700"; ctx.font = "bold 60px Arial"; ctx.textAlign = "center";
  ctx.fillText("ROOM " + (idx + 1), W / 2, 76);
  ctx.fillStyle = "#FF8800"; ctx.font = "bold 36px Arial";
  ctx.fillText((ROOMS[idx].name.split("\u2014")[1] || ROOMS[idx].name).trim(), W / 2, 136);
  ctx.fillStyle = "#cccccc"; ctx.font = "26px Arial";
  ctx.fillText("Walk to the door to play!", W / 2, 192);

  ctx.restore();
  bdt.update();

  const boardMat = new BABYLON.StandardMaterial("signBD_" + idx, scene);
  boardMat.diffuseTexture  = bdt;
  boardMat.emissiveTexture = bdt;
  boardMat.emissiveColor   = new BABYLON.Color3(0.55, 0.45, 0.0);
  boardMat.backFaceCulling = false;

  const signZ = dz > ROOM_L / 2 ? dz - 3.5 : dz + 3.5;
  box("signBrd_" + idx, scene, 4.2, 1.8, 0.12, cx, 3.2, signZ, boardMat);

  const stripMat = _mat(scene, "signSt_" + idx, accentColor, 0.42);
  box("signSt_"  + idx, scene, 4.4, 0.14, 0.14, cx, 4.12, signZ, stripMat);
}

// ─────────────────────────────────────────────────────────────────────────────
// FLOOR MARKER
// ─────────────────────────────────────────────────────────────────────────────

function _buildFloorMarker(scene, cx, dz, accentColor, idx) {
  box("fmO_" + idx, scene, 5.0, 0.03, 1.2, cx, 0.14, dz,
    _mat(scene, "fmOM_" + idx, accentColor, 0.50));
  box("fmI_" + idx, scene, 3.5, 0.04, 0.45, cx, 0.15, dz,
    _mat(scene, "fmIM_" + idx, new BABYLON.Color3(1.0, 0.98, 0.70), 0.72));
}

// ─────────────────────────────────────────────────────────────────────────────
// PEDESTAL
// ─────────────────────────────────────────────────────────────────────────────

function _buildPedestal(scene, x, z, accentColor, key) {
  const sm = _mat(scene, "pedS_" + key, new BABYLON.Color3(0.48, 0.44, 0.38), 0.0);
  box("pedB_" + key, scene, 0.85, 0.20, 0.85, x, 0.10, z, sm);
  cyl("pedC_" + key, scene, 0.36, 1.20, x, 0.82, z, sm);
  box("pedT_" + key, scene, 0.72, 0.17, 0.72, x, 1.54, z, sm);
  const orbMat = _mat(scene, "pedOrb_" + key, accentColor, 0.65);
  orbMat.alpha = 0.90;
  const orb = BABYLON.MeshBuilder.CreateSphere("pedOrb_" + key, { diameter: 0.44, segments: 10 }, scene);
  orb.position.set(x, 1.84, z); orb.material = orbMat;
  const orbL = new BABYLON.PointLight("pedOL_" + key, new BABYLON.Vector3(x, 2.0, z), scene);
  orbL.diffuse = accentColor; orbL.intensity = 0.65; orbL.range = 8;
}

// ─────────────────────────────────────────────────────────────────────────────
// WALL TORCH
// ─────────────────────────────────────────────────────────────────────────────

function _buildWallTorch(scene, x, z, roomIdx, torchIdx, side, torchLights) {
  const metalMat = _mat(scene, "tM_" + roomIdx + torchIdx + side, new BABYLON.Color3(0.24, 0.20, 0.16), 0.0);
  box("tArm_"  + roomIdx + torchIdx + side, scene, 0.40, 0.10, 0.10, x, 4.1, z, metalMat);
  cyl("tHndl_" + roomIdx + torchIdx + side, scene, 0.12, 0.64, x - side * 0.19, 4.33, z, metalMat);
  const flameMat = _mat(scene, "tFlm_" + roomIdx + torchIdx + side,
    new BABYLON.Color3(1.0, 0.62, 0.10), 0.70);
  const flame = BABYLON.MeshBuilder.CreateCylinder("tFlmM_" + roomIdx + torchIdx + side,
    { diameterTop: 0, diameterBottom: 0.22, height: 0.38, tessellation: 8 }, scene);
  flame.position.set(x - side * 0.19, 4.72, z); flame.material = flameMat;
  const light = new BABYLON.PointLight("tLgt_" + roomIdx + torchIdx + side,
    new BABYLON.Vector3(x - side * 0.19, 4.76, z), scene);
  light.diffuse = new BABYLON.Color3(1.0, 0.72, 0.28);
  light.intensity = 2.4; light.range = 20;
  torchLights.push(light);
}

// ─────────────────────────────────────────────────────────────────────────────
// CHANDELIER
// ─────────────────────────────────────────────────────────────────────────────

function _buildChandelier(scene, x, y, z, color, torchLights) {
  const metalMat = _mat(scene, "chdM_" + x, new BABYLON.Color3(0.55, 0.48, 0.20), 0.0);
  const ring = BABYLON.MeshBuilder.CreateTorus("chdRing_" + x,
    { diameter: 3.5, thickness: 0.14, tessellation: 32 }, scene);
  ring.position.set(x, y, z); ring.material = metalMat;
  cyl("chdChain_" + x, scene, 0.09, 1.6, x, y + 0.80, z, metalMat);

  const candleMat = _mat(scene, "chdCan_" + x, new BABYLON.Color3(0.95, 0.90, 0.80), 0.0);
  const flameMat  = _mat(scene, "chdFlm_" + x, new BABYLON.Color3(1.0, 0.70, 0.10), 0.60);

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const cx_ = x + Math.cos(a) * 1.65;
    const cz_ = z + Math.sin(a) * 1.65;
    cyl("cCan_" + x + i, scene, 0.15, 0.28, cx_, y - 0.14, cz_, candleMat);
    const fl = BABYLON.MeshBuilder.CreateCylinder("cFlm_" + x + i,
      { diameterTop: 0, diameterBottom: 0.13, height: 0.20, tessellation: 8 }, scene);
    fl.position.set(cx_, y + 0.08, cz_); fl.material = flameMat;
  }

  const cl = new BABYLON.PointLight("chdL_" + x, new BABYLON.Vector3(x, y - 0.1, z), scene);
  cl.diffuse = new BABYLON.Color3(1.0, 0.88, 0.58);
  cl.intensity = 3.2; cl.range = 30;
  torchLights.push(cl);
}

// ─────────────────────────────────────────────────────────────────────────────
// THRONE CHAIR
// ─────────────────────────────────────────────────────────────────────────────

function _buildThroneChair(scene, x, z) {
  const goldMat = new BABYLON.StandardMaterial("thG", scene);
  goldMat.diffuseColor  = new BABYLON.Color3(0.85, 0.68, 0.10);
  goldMat.specularColor = new BABYLON.Color3(0.8, 0.7, 0.3);
  goldMat.specularPower = 64;
  const cushMat = _mat(scene, "thC", new BABYLON.Color3(0.65, 0.08, 0.08), 0.0);
  const crownMat = _mat(scene, "thCrn", new BABYLON.Color3(1.0, 0.85, 0.10), 0.40);

  box("thSeat", scene, 1.8, 0.26, 1.4, x, 0.8,  z, goldMat);
  box("thCush", scene, 1.6, 0.18, 1.2, x, 0.98, z, cushMat);
  box("thBack", scene, 1.8, 2.4,  0.22, x, 2.1, z - 0.70, goldMat);
  for (const ag of [-0.78, 0.78]) {
    box("thArm_" + ag, scene, 0.20, 0.65, 1.2, x + ag, 1.15, z, goldMat);
  }
  const crown = BABYLON.MeshBuilder.CreateCylinder("thCrn",
    { diameterTop: 0.70, diameterBottom: 1.0, height: 0.50, tessellation: 6 }, scene);
  crown.position.set(x, 3.4, z - 0.70); crown.material = crownMat;
}

// ─────────────────────────────────────────────────────────────────────────────
// TILE TEXTURE
// ─────────────────────────────────────────────────────────────────────────────

function _applyTileTexture(scene, mat, baseColor, uTiles, vTiles) {
  const size = 512;
  const dt   = new BABYLON.DynamicTexture("tileTex_" + Math.random(), { width: size, height: size }, scene);
  const ctx  = dt.getContext();
  const r = Math.floor(baseColor.r * 220);
  const g = Math.floor(baseColor.g * 200);
  const b = Math.floor(baseColor.b * 180);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(0,0,0,0.20)"; ctx.lineWidth = 3;
  const tw = size / uTiles; const th = size / vTiles;
  for (let c = 0; c <= uTiles; c++) { ctx.beginPath(); ctx.moveTo(c*tw,0); ctx.lineTo(c*tw,size); ctx.stroke(); }
  for (let r2 = 0; r2 <= vTiles; r2++) { ctx.beginPath(); ctx.moveTo(0,r2*th); ctx.lineTo(size,r2*th); ctx.stroke(); }
  dt.update();
  mat.diffuseTexture = dt;
  mat.uScale = uTiles / 4; mat.vScale = vTiles / 4;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUZZLE TRIGGER
// ─────────────────────────────────────────────────────────────────────────────

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
    const q    = pool[Math.floor(Math.random() * pool.length)];
    showPuzzle(
      { ...q, question: `[${streak + 1}/${needed}] ${q.question}` },
      "choice",
      () => { streak++; if (streak >= needed) onSuccess(); else nextQ(); }
    );
  }
  nextQ();
}

// ─────────────────────────────────────────────────────────────────────────────
// HUD
// ─────────────────────────────────────────────────────────────────────────────

function _updateHUD(locationEl, starsEl, roomIdx) {
  if (locationEl) locationEl.textContent = `🏰 Math Castle — ${ROOMS[roomIdx].name}`;
  const save = SaveManager.load();
  if (starsEl && save.mathIsland) {
    starsEl.textContent = (save.mathIsland.roomsCompleted || []).map(d => d ? "⭐" : "☆").join(" ");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VICTORY
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// MINI HELPERS (reduce repetition)
// ─────────────────────────────────────────────────────────────────────────────

function _mat(scene, name, color, emissiveStrength = 0.0) {
  const m = new BABYLON.StandardMaterial(name, scene);
  m.diffuseColor  = color;
  m.specularColor = new BABYLON.Color3(0.06, 0.06, 0.06);
  if (emissiveStrength > 0) {
    m.emissiveColor = new BABYLON.Color3(
      color.r * emissiveStrength, color.g * emissiveStrength, color.b * emissiveStrength);
  }
  return m;
}

function box(name, scene, w, h, d, x, y, z, mat) {
  const m = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
  m.position.set(x, y, z);
  if (mat) m.material = mat;
  return m;
}

function cyl(name, scene, diameter, height, x, y, z, mat) {
  const m = BABYLON.MeshBuilder.CreateCylinder(name, { diameter, height, tessellation: 10 }, scene);
  m.position.set(x, y, z);
  if (mat) m.material = mat;
  return m;
}

function arch(name, scene, diamX, diamY, diamZ, x, y, z, mat) {
  const m = BABYLON.MeshBuilder.CreateSphere(name,
    { diameterX: diamX, diameterY: diamY, diameterZ: diamZ, segments: 8 }, scene);
  m.position.set(x, y, z);
  if (mat) m.material = mat;
  return m;
}

// Build a side wall for a room, leaving a gap where a connector corridor attaches.
// conn: the CONN entry for the corridor that connects through this wall, or null for a solid wall.
function _buildSideWall(scene, name, wallX, wallMidY, mat, conn) {
  if (!conn) {
    // No corridor — solid wall
    box(name, scene, 0.40, ROOM_H, ROOM_L, wallX, wallMidY, ROOM_L / 2, mat);
    return;
  }
  // Gap spans the z-range where the corridor overlaps the room (clamped to 0..ROOM_L)
  const gapZ0 = Math.max(0, conn.zMin);
  const gapZ1 = Math.min(ROOM_L, conn.zMax);
  // Segment A: z=0 .. gapZ0
  if (gapZ0 > 0) {
    box(name + "A", scene, 0.40, ROOM_H, gapZ0,
      wallX, wallMidY, gapZ0 / 2, mat);
  }
  // Segment B: z=gapZ1 .. ROOM_L
  if (gapZ1 < ROOM_L) {
    const segLen = ROOM_L - gapZ1;
    box(name + "B", scene, 0.40, ROOM_H, segLen,
      wallX, wallMidY, gapZ1 + segLen / 2, mat);
  }
}
