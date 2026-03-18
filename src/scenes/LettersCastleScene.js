/**
 * LettersCastleScene.js
 * Castle with 4 rooms: Room 0 = Assembly Hall, Rooms 1/2/3 = Letter Rooms.
 * Player walks through each room collecting 2 letter tiles per room (6 total),
 * then returns to the Assembly Hall and arranges letters to spell the secret word.
 */

import { createPlayer }   from "../entities/Player.js";
import { LETTER_WORDS }   from "../data/lettersPuzzles.js";
import { SaveManager }    from "../utils/SaveManager.js";
import { t }              from "../utils/i18n.js";
import { medMaterial }    from "../utils/MedievalLoader.js";

export function createLettersCastleScene(engine, onExit) {
  const BABYLON = window.BABYLON;
  const scene   = new BABYLON.Scene(engine);

  // ── Dimensions ─────────────────────────────────────────────────────────────
  const ROOM_WIDTH   = 25;
  const ROOM_LENGTH  = 30;
  const ROOM_HEIGHT  = 7.0;
  const NUM_ROOMS    = 4;    // 0 = entry/assembly, 1–3 = letter rooms
  const DESIRED_RADIUS = 12;

  // ── Pick a random word ──────────────────────────────────────────────────────
  const puzzleData     = LETTER_WORDS[Math.floor(Math.random() * LETTER_WORDS.length)];
  const TARGET_WORD    = puzzleData.word;
  const HINT_TEXT      = puzzleData.hint;
  const TARGET_LETTERS = puzzleData.letters.slice();
  // Letters sorted A-Z — the required collection order
  const ALPHA_ORDER    = TARGET_WORD.toUpperCase().split('').sort().join('');

  // ── State ───────────────────────────────────────────────────────────────────
  let currentRoom      = 0;
  let collectedLetters = [];
  let letterTiles      = [];
  let crownEarned      = false;
  let _lastOrderHintTime = 0;
  const torchLights    = [];
  const doorBeacons    = [];
  let assemblyBoxMesh  = null;
  const ASSEMBLY_Z     = ROOM_LENGTH * 0.60;   // 18 — middle of room 0
  const ASSEMBLY_POS   = new BABYLON.Vector3(0, 0, ASSEMBLY_Z);

  // ── Scene setup ─────────────────────────────────────────────────────────────
  scene.clearColor = new BABYLON.Color4(0.06, 0.03, 0.10, 1);

  const ambient = new BABYLON.HemisphericLight("amb", new BABYLON.Vector3(0, 1, 0), scene);
  ambient.intensity   = 1.1;
  ambient.diffuse     = new BABYLON.Color3(0.90, 0.82, 1.0);
  ambient.groundColor = new BABYLON.Color3(0.30, 0.18, 0.50);

  // ── Shared materials ────────────────────────────────────────────────────────
  function stdMat(name, r, g, b, emR, emG, emB) {
    const m = new BABYLON.StandardMaterial(name, scene);
    m.diffuseColor = new BABYLON.Color3(r, g, b);
    if (emR !== undefined) m.emissiveColor = new BABYLON.Color3(emR, emG, emB);
    return m;
  }

  const wallMat  = medMaterial(scene, "UnevenBrick", "wallMat",  4, 6);
  wallMat.diffuseColor  = new BABYLON.Color3(0.22, 0.48, 0.44);
  const floorMat = medMaterial(scene, "WoodDark",    "floorMat", 6, 8);
  floorMat.diffuseColor = new BABYLON.Color3(0.12, 0.32, 0.30);
  const ceilMat    = stdMat("ceilMat",    0.08, 0.22, 0.20);
  const stoneMat   = medMaterial(scene, "RockTrim",   "stoneMat", 3, 5);
  stoneMat.diffuseColor = new BABYLON.Color3(0.28, 0.52, 0.50);
  const goldMat    = stdMat("goldMat",    0.82, 0.67, 0.10, 0.22, 0.14, 0.00);
  const tealMat    = stdMat("tealMat",    0.10, 0.75, 0.65, 0.02, 0.28, 0.22);
  const crystalMat = stdMat("crystalMat", 0.45, 0.10, 0.80, 0.20, 0.02, 0.48);

  // Tiled floor for assembly room — use Brick texture from medieval pack
  const tiledFloorMat = medMaterial(scene, "Brick", "tiledFloor", 8, 5);
  tiledFloorMat.diffuseColor = new BABYLON.Color3(0.10, 0.30, 0.28);

  // ── Build rooms ─────────────────────────────────────────────────────────────
  for (let r = 0; r < NUM_ROOMS; r++) _buildRoom(r);

  function _buildRoom(r) {
    const baseZ = r * ROOM_LENGTH;
    const midZ  = baseZ + ROOM_LENGTH / 2;
    const hw    = ROOM_WIDTH / 2;
    const cy    = ROOM_HEIGHT / 2;

    // Floor
    const fl = BABYLON.MeshBuilder.CreateBox(`fl_${r}`,
      { width: ROOM_WIDTH, height: 0.4, depth: ROOM_LENGTH }, scene);
    fl.position.set(0, -0.2, midZ);
    fl.material = (r === 0) ? tiledFloorMat : floorMat;

    // Left wall
    const lw = BABYLON.MeshBuilder.CreateBox(`lw_${r}`,
      { width: 0.4, height: ROOM_HEIGHT, depth: ROOM_LENGTH }, scene);
    lw.position.set(-hw - 0.2, cy, midZ);
    lw.material = wallMat;

    // Right wall
    const rw = BABYLON.MeshBuilder.CreateBox(`rw_${r}`,
      { width: 0.4, height: ROOM_HEIGHT, depth: ROOM_LENGTH }, scene);
    rw.position.set(hw + 0.2, cy, midZ);
    rw.material = wallMat;

    // Back wall (room 0 only — entrance side)
    if (r === 0) {
      const bk = BABYLON.MeshBuilder.CreateBox("bkwall",
        { width: ROOM_WIDTH, height: ROOM_HEIGHT, depth: 0.4 }, scene);
      bk.position.set(0, cy, baseZ - 0.2);
      bk.material = wallMat;
    }

    // Front wall: door opening for rooms 0-2, solid wall for last room
    if (r < NUM_ROOMS - 1) {
      _buildDoorWall(r, baseZ + ROOM_LENGTH);
    } else {
      const fw = BABYLON.MeshBuilder.CreateBox(`fw_${r}`,
        { width: ROOM_WIDTH, height: ROOM_HEIGHT, depth: 0.4 }, scene);
      fw.position.set(0, cy, baseZ + ROOM_LENGTH + 0.2);
      fw.material = wallMat;
    }

    // Room-specific content
    if (r === 0) {
      _buildAssemblyHall(baseZ);
    } else {
      _buildLetterRoom(r, baseZ);
    }

    // Torches on both walls
    _buildWallTorch(-hw, baseZ + ROOM_LENGTH * 0.30, r);
    _buildWallTorch( hw, baseZ + ROOM_LENGTH * 0.30, r);
    _buildWallTorch(-hw, baseZ + ROOM_LENGTH * 0.70, r);
    _buildWallTorch( hw, baseZ + ROOM_LENGTH * 0.70, r);
  }

  // ── Door wall (wall with a central opening) ─────────────────────────────────
  function _buildDoorWall(r, wallZ) {
    const hw    = ROOM_WIDTH / 2;
    const doorW = 5.0;
    const doorH = 5.5;
    const sideW = (ROOM_WIDTH - doorW) / 2;  // 10

    // Left and right panels
    const lp = BABYLON.MeshBuilder.CreateBox(`dwL_${r}`,
      { width: sideW, height: ROOM_HEIGHT, depth: 0.4 }, scene);
    lp.position.set(-hw + sideW / 2, ROOM_HEIGHT / 2, wallZ);
    lp.material = wallMat;

    const rp = BABYLON.MeshBuilder.CreateBox(`dwR_${r}`,
      { width: sideW, height: ROOM_HEIGHT, depth: 0.4 }, scene);
    rp.position.set(hw - sideW / 2, ROOM_HEIGHT / 2, wallZ);
    rp.material = wallMat;

    // Top lintel (above door)
    const lintelH = ROOM_HEIGHT - doorH;
    const tp = BABYLON.MeshBuilder.CreateBox(`dwT_${r}`,
      { width: doorW, height: lintelH, depth: 0.4 }, scene);
    tp.position.set(0, doorH + lintelH / 2, wallZ);
    tp.material = wallMat;

    // Glowing archway frame
    for (const sx of [-doorW / 2, doorW / 2]) {
      const fp = BABYLON.MeshBuilder.CreateBox(`dfr_${r}_${sx > 0 ? "R" : "L"}`,
        { width: 0.4, height: doorH, depth: 0.6 }, scene);
      fp.position.set(sx, doorH / 2, wallZ);
      fp.material = stoneMat;
    }

    // Glowing arch top — teal emissive strip as visual invitation
    const arch = BABYLON.MeshBuilder.CreateBox(`darch_${r}`,
      { width: doorW + 0.4, height: 0.25, depth: 0.5 }, scene);
    arch.position.set(0, doorH + 0.12, wallZ);
    const archMat = new BABYLON.StandardMaterial(`darchMat_${r}`, scene);
    archMat.diffuseColor  = new BABYLON.Color3(0.10, 0.80, 0.65);
    archMat.emissiveColor = new BABYLON.Color3(0.03, 0.45, 0.35);
    arch.material = archMat;

    // Arch light
    const al = new BABYLON.PointLight(`darchL_${r}`,
      new BABYLON.Vector3(0, doorH + 0.3, wallZ - 0.5), scene);
    al.diffuse    = new BABYLON.Color3(0.20, 1.0, 0.80);
    al.intensity  = 1.2;
    al.range      = 8;

    // Direction sign above arch
    _buildDoorSign(r, wallZ, doorH);

    // Pulsing ground beacon — visual cue that the doorway is walkable
    const beacon = BABYLON.MeshBuilder.CreateSphere(`dbeacon_${r}`,
      { diameter: 0.9, segments: 7 }, scene);
    beacon.position.set(0, 0.5, wallZ - 0.3);
    const beaconMat = new BABYLON.StandardMaterial(`dbeaconMat_${r}`, scene);
    beaconMat.diffuseColor  = new BABYLON.Color3(0.10, 0.90, 0.70);
    beaconMat.emissiveColor = new BABYLON.Color3(0.05, 0.60, 0.45);
    beacon.material = beaconMat;
    doorBeacons.push({ mesh: beacon, mat: beaconMat, offset: r * 1.3 });
  }

  // ── Sign above each doorway ──────────────────────────────────────────────────
  function _buildDoorSign(r, wallZ, doorH) {
    const board = BABYLON.MeshBuilder.CreateBox(`dsign_${r}`,
      { width: 3.2, height: 0.9, depth: 0.1 }, scene);
    board.position.set(0, doorH + 0.8, wallZ - 0.5);
    try {
      const roomNum = r + 1;
      const dt = new BABYLON.DynamicTexture(`dsigntex_${r}`, { width: 400, height: 112 }, scene, false);
      const ctx = dt.getContext();
      ctx.fillStyle = "#0e0428";
      ctx.fillRect(0, 0, 400, 112);
      ctx.fillStyle = "#60ffcc";
      ctx.font = "bold 30px Arial";
      ctx.textAlign = "center";
      ctx.fillText(`Room ${roomNum} ➜`, 200, 42);
      ctx.fillStyle = "#c090ff";
      ctx.font = "22px Arial";
      ctx.fillText("Find the hidden letters!", 200, 80);
      dt.update();
      dt.uScale = -1;
      const sm = new BABYLON.StandardMaterial(`dsignmat_${r}`, scene);
      sm.diffuseTexture  = dt;
      sm.emissiveTexture = dt;
      board.material = sm;
    } catch(e) {
      board.material = crystalMat;
    }
  }

  // ── Assembly Hall (Room 0) ───────────────────────────────────────────────────

  function _buildAssemblyHall(baseZ) {
    // Welcome sign near entrance
    const wsign = BABYLON.MeshBuilder.CreateBox("wsign",
      { width: 5.5, height: 1.2, depth: 0.12 }, scene);
    wsign.position.set(0, 4.8, baseZ + ROOM_LENGTH * 0.20);
    try {
      const dt = new BABYLON.DynamicTexture("wsignTex", { width: 512, height: 112 }, scene, false);
      const ctx = dt.getContext();
      ctx.fillStyle = "#100420";
      ctx.fillRect(0, 0, 512, 112);
      ctx.fillStyle = "#ffcc00";
      ctx.font = "bold 34px Arial";
      ctx.textAlign = "center";
      ctx.fillText("🔤  LETTERS CASTLE", 256, 44);
      ctx.fillStyle = "#cc99ff";
      ctx.font = "21px Arial";
      ctx.fillText("Hint: " + HINT_TEXT, 256, 84);
      dt.update();
      dt.uScale = -1;
      const sm = new BABYLON.StandardMaterial("wsignMat", scene);
      sm.diffuseTexture  = dt;
      sm.emissiveTexture = dt;
      wsign.material = sm;
    } catch(e) {
      wsign.material = goldMat;
    }

    // Assembly pedestal
    const ped = BABYLON.MeshBuilder.CreateBox("asmPed",
      { width: 4.2, height: 0.4, depth: 1.6 }, scene);
    ped.position.set(0, 0.2, ASSEMBLY_Z);
    ped.material = stoneMat;

    // Assembly box on pedestal
    assemblyBoxMesh = BABYLON.MeshBuilder.CreateBox("asmBox",
      { width: 3.8, height: 0.75, depth: 1.2 }, scene);
    assemblyBoxMesh.position.set(0, 0.77, ASSEMBLY_Z);
    try {
      const dt = new BABYLON.DynamicTexture("asmTex", { width: 512, height: 128 }, scene, false);
      const ctx = dt.getContext();
      ctx.fillStyle = "#081420";
      ctx.fillRect(0, 0, 512, 128);
      ctx.fillStyle = "#30ffcc";
      ctx.font = "bold 30px Arial";
      ctx.textAlign = "center";
      ctx.fillText("✦  ASSEMBLY BOX  ✦", 256, 48);
      ctx.fillStyle = "#80eecc";
      ctx.font = "20px Arial";
      ctx.fillText("Collect all 6 letters, then return here", 256, 88);
      dt.update();
      dt.uScale = -1;
      const bm = new BABYLON.StandardMaterial("asmBoxMat", scene);
      bm.diffuseTexture  = dt;
      bm.emissiveTexture = dt;
      assemblyBoxMesh.material = bm;
    } catch(e) {
      assemblyBoxMesh.material = tealMat;
    }

    // Glowing torus ring around the box
    const ring = BABYLON.MeshBuilder.CreateTorus("asmRing",
      { diameter: 3.0, thickness: 0.09, tessellation: 32 }, scene);
    ring.position.set(0, 0.28, ASSEMBLY_Z);
    ring.rotation.x = Math.PI / 2;
    const rm = new BABYLON.StandardMaterial("asmRingMat", scene);
    rm.diffuseColor  = new BABYLON.Color3(0.10, 0.90, 0.70);
    rm.emissiveColor = new BABYLON.Color3(0.03, 0.50, 0.38);
    ring.material = rm;

    // Assembly light
    const al = new BABYLON.PointLight("asmL",
      new BABYLON.Vector3(0, 2.0, ASSEMBLY_Z), scene);
    al.diffuse    = new BABYLON.Color3(0.20, 1.0, 0.80);
    al.intensity  = 2.0;
    al.range      = 10;
  }

  // ── Letter Room (Rooms 1–3) ─────────────────────────────────────────────────
  function _buildLetterRoom(r, baseZ) {
    const idxA = (r - 1) * 2;
    const idxB = (r - 1) * 2 + 1;
    const midZ = baseZ + ROOM_LENGTH / 2;

    // Room label on back wall
    _buildRoomLabel(r, baseZ);

    // ── Randomised letter positions ──────────────────────────────────────────
    // Pick from a pool of well-spread safe spots (avoid walls & furniture blocks)
    const posPool = [
      new BABYLON.Vector3(-7,  1.6, baseZ +  7),
      new BABYLON.Vector3( 7,  1.6, baseZ +  7),
      new BABYLON.Vector3(-8,  1.6, midZ  -  2),
      new BABYLON.Vector3( 8,  1.6, midZ  +  2),
      new BABYLON.Vector3(-5,  1.6, baseZ + 22),
      new BABYLON.Vector3( 5,  1.6, baseZ + 22),
      new BABYLON.Vector3( 0,  1.6, baseZ +  9),
      new BABYLON.Vector3( 0,  1.6, baseZ + 21),
      new BABYLON.Vector3(-6,  1.6, midZ),
      new BABYLON.Vector3( 6,  1.6, midZ),
    ];
    const iA = (r * 3 + 1) % posPool.length;
    let   iB = (r * 5 + 4) % posPool.length;
    if (iB === iA) iB = (iB + 1) % posPool.length;

    if (idxA < TARGET_LETTERS.length) _buildLetterTile(TARGET_LETTERS[idxA], idxA, posPool[iA]);
    if (idxB < TARGET_LETTERS.length) _buildLetterTile(TARGET_LETTERS[idxB], idxB, posPool[iB]);

    // ── Crystal accent pillars ───────────────────────────────────────────────
    _buildCrystalPillar(-9, midZ - 6);
    _buildCrystalPillar( 9, midZ - 6);
    _buildCrystalPillar(-9, midZ + 6);
    _buildCrystalPillar( 9, midZ + 6);

    // ── Overhead lights (two bright point lights per room) ───────────────────
    const makeRoomLight = (lx, lz, idx) => {
      const l = new BABYLON.PointLight(`rl_${r}_${idx}`,
        new BABYLON.Vector3(lx, 5.8, lz), scene);
      l.diffuse    = new BABYLON.Color3(0.88, 0.78, 1.0);
      l.intensity  = 4.0;
      l.range      = 20;
    };
    makeRoomLight(0, midZ - 7, 0);
    makeRoomLight(0, midZ + 7, 1);

    // ── Furniture ────────────────────────────────────────────────────────────
    _addLetterRoomFurniture(r, baseZ);
  }

  // ── Letter room furniture ────────────────────────────────────────────────────
  function _addLetterRoomFurniture(r, baseZ) {
    const B = BABYLON;
    const midZ = baseZ + ROOM_LENGTH / 2;
    const hw   = ROOM_WIDTH / 2;  // 12.5

    // Shared wood material
    const woodM = stdMat(`lrWood_${r}`, 0.42, 0.26, 0.10);
    const darkM = stdMat(`lrDark_${r}`, 0.22, 0.14, 0.06);
    const fabricM = stdMat(`lrFab_${r}`,
      0.35 + r * 0.12, 0.15, 0.55 - r * 0.08,
      0.06 + r * 0.02, 0.01, 0.12);
    const stoneM = stdMat(`lrStone_${r}`, 0.32, 0.28, 0.42);
    const metalM = stdMat(`lrMetal_${r}`, 0.55, 0.52, 0.60, 0.08, 0.06, 0.12);

    // ── Colourful rug across the room length ──────────────────────────────────
    const rug = B.MeshBuilder.CreateBox(`lrRug_${r}`,
      { width: 14, height: 0.04, depth: ROOM_LENGTH - 4 }, scene);
    rug.position.set(0, 0.02, midZ);
    const rugM = stdMat(`lrRugM_${r}`,
      0.18 + r * 0.08, 0.08, 0.38 + r * 0.06, 0.04, 0.01, 0.10);
    rug.material = rugM;

    // ── Bookshelves along both side walls ─────────────────────────────────────
    const shelfData = [
      { x: -(hw - 0.3), zOff: 5  },
      { x: -(hw - 0.3), zOff: 17 },
      { x:  (hw - 0.3), zOff: 5  },
      { x:  (hw - 0.3), zOff: 17 },
    ];
    shelfData.forEach(({ x, zOff }, si) => {
      const sz = baseZ + zOff;
      // Shelf unit
      const sh = B.MeshBuilder.CreateBox(`lrSh_${r}_${si}`,
        { width: 0.4, height: 4.5, depth: 6 }, scene);
      sh.position.set(x, 2.25, sz);
      sh.material = darkM;
      // Shelf planks
      [1.2, 2.4, 3.6].forEach((sy, pi) => {
        const sp = B.MeshBuilder.CreateBox(`lrShP_${r}_${si}_${pi}`,
          { width: 0.42, height: 0.08, depth: 5.8 }, scene);
        sp.position.set(x, sy, sz);
        sp.material = woodM;
      });
      // Books on each shelf
      const bkColors = [
        [0.75,0.10,0.10],[0.10,0.45,0.85],[0.15,0.70,0.30],
        [0.85,0.65,0.10],[0.60,0.10,0.75],[0.10,0.65,0.65],
      ];
      [1.2, 2.4, 3.6].forEach((sy, pi) => {
        for (let b = 0; b < 5; b++) {
          const bk = B.MeshBuilder.CreateBox(`lrBk_${r}_${si}_${pi}_${b}`,
            { width: 0.4, height: 0.6 + b * 0.06, depth: 0.7 }, scene);
          const side = x < 0 ? 1 : -1;
          bk.position.set(x + side * 0.01, sy + 0.34 + b * 0.01, sz - 2.2 + b * 1.0);
          const bkM = stdMat(`lrBkM_${r}_${si}_${pi}_${b}`,
            ...bkColors[b % bkColors.length]);
          bk.material = bkM;
        }
      });
    });

    // ── Central reading table ─────────────────────────────────────────────────
    const tblZ = baseZ + ROOM_LENGTH * 0.55;
    const tblTop = B.MeshBuilder.CreateBox(`lrTbl_${r}`,
      { width: 5.5, height: 0.18, depth: 2.8 }, scene);
    tblTop.position.set(0, 1.55, tblZ);
    tblTop.material = woodM;
    // Table legs
    [[-2.4,-1.1],[-2.4,1.1],[2.4,-1.1],[2.4,1.1]].forEach(([lx,lz],li) => {
      const leg = B.MeshBuilder.CreateCylinder(`lrTL_${r}_${li}`,
        { diameter: 0.22, height: 1.5, tessellation: 6 }, scene);
      leg.position.set(lx, 0.75, tblZ + lz);
      leg.material = darkM;
    });
    // Items on table: open book + candle
    const book = B.MeshBuilder.CreateBox(`lrBook_${r}`,
      { width: 1.1, height: 0.08, depth: 0.85 }, scene);
    book.position.set(-1.2, 1.65, tblZ - 0.1);
    book.material = stdMat(`lrBkOpen_${r}`, 0.85, 0.80, 0.65);
    const candle = B.MeshBuilder.CreateCylinder(`lrCnd_${r}`,
      { diameter: 0.14, height: 0.55, tessellation: 8 }, scene);
    candle.position.set(1.5, 1.84, tblZ);
    candle.material = stdMat(`lrCndM_${r}`, 0.92, 0.88, 0.75, 0.25, 0.22, 0.10);
    const flame = B.MeshBuilder.CreateSphere(`lrFlm_${r}`,
      { diameter: 0.18, segments: 5 }, scene);
    flame.position.set(1.5, 2.15, tblZ);
    flame.material = stdMat(`lrFlmM_${r}`, 1.0, 0.65, 0.05, 0.80, 0.38, 0.0);
    const fl = new B.PointLight(`lrFl_${r}`,
      new B.Vector3(1.5, 2.3, tblZ), scene);
    fl.diffuse = new B.Color3(1.0, 0.72, 0.28);
    fl.intensity = 1.4; fl.range = 7;

    // ── Chairs at table ───────────────────────────────────────────────────────
    [[-3.4, 0, 0], [3.4, 0, Math.PI]].forEach(([cx, cz, ry], ci) => {
      const seat = B.MeshBuilder.CreateBox(`lrSeat_${r}_${ci}`,
        { width: 1.1, height: 0.10, depth: 1.1 }, scene);
      seat.position.set(cx, 1.02, tblZ);
      seat.material = fabricM;
      const back = B.MeshBuilder.CreateBox(`lrBack_${r}_${ci}`,
        { width: 1.1, height: 1.0, depth: 0.10 }, scene);
      const side = cx < 0 ? -0.52 : 0.52;
      back.position.set(cx, 1.58, tblZ + side);
      back.material = fabricM;
      [[-0.4,-0.4],[-0.4,0.4],[0.4,-0.4],[0.4,0.4]].forEach(([llx,llz],li) => {
        const lleg = B.MeshBuilder.CreateCylinder(`lrCL_${r}_${ci}_${li}`,
          { diameter: 0.10, height: 1.0, tessellation: 4 }, scene);
        lleg.position.set(cx + llx, 0.50, tblZ + llz);
        lleg.material = darkM;
      });
    });

    // ── Decorative urns / vases at corners ───────────────────────────────────
    [
      [-hw + 1.5, baseZ + 2.5],
      [ hw - 1.5, baseZ + 2.5],
      [-hw + 1.5, baseZ + ROOM_LENGTH - 2.5],
      [ hw - 1.5, baseZ + ROOM_LENGTH - 2.5],
    ].forEach(([vx, vz], vi) => {
      const urn = B.MeshBuilder.CreateCylinder(`lrUrn_${r}_${vi}`,
        { diameterTop: 0.55, diameterBottom: 0.35, height: 1.2, tessellation: 10 }, scene);
      urn.position.set(vx, 0.6, vz);
      const urnM = stdMat(`lrUrnM_${r}_${vi}`,
        0.55 + vi * 0.08, 0.30 + vi * 0.05, 0.70,
        0.12 + vi * 0.02, 0.06, 0.18);
      urn.material = urnM;
      // Plant top (fluffy sphere)
      const plant = B.MeshBuilder.CreateSphere(`lrPlant_${r}_${vi}`,
        { diameter: 0.8, segments: 5 }, scene);
      plant.position.set(vx, 1.55, vz);
      plant.material = stdMat(`lrPlantM_${r}_${vi}`,
        0.12, 0.55 + vi * 0.06, 0.22, 0.02, 0.14, 0.04);
    });

    // ── Wall-hung picture frames ──────────────────────────────────────────────
    [
      { x: -(hw - 0.08), z: midZ,        ry:  Math.PI / 2 },
      { x:  (hw - 0.08), z: midZ,        ry: -Math.PI / 2 },
      { x: -(hw - 0.08), z: midZ - 10,   ry:  Math.PI / 2 },
      { x:  (hw - 0.08), z: midZ - 10,   ry: -Math.PI / 2 },
    ].forEach(({ x, z, ry }, fi) => {
      const frame = B.MeshBuilder.CreateBox(`lrFrm_${r}_${fi}`,
        { width: 0.10, height: 1.8, depth: 1.4 }, scene);
      frame.position.set(x, 3.4, z);
      frame.rotation.y = ry;
      frame.material = darkM;
      const canvas = B.MeshBuilder.CreateBox(`lrCvs_${r}_${fi}`,
        { width: 0.06, height: 1.5, depth: 1.1 }, scene);
      canvas.position.set(x + (x < 0 ? 0.04 : -0.04), 3.4, z);
      canvas.rotation.y = ry;
      const cvColors = [
        [0.45,0.15,0.65],[0.15,0.55,0.65],[0.65,0.45,0.10],[0.65,0.18,0.28],
      ];
      canvas.material = stdMat(`lrCvsM_${r}_${fi}`, ...cvColors[fi % 4],
        cvColors[fi % 4][0]*0.3, cvColors[fi % 4][1]*0.3, cvColors[fi % 4][2]*0.3);
    });

    // ── Ceiling chandelier ────────────────────────────────────────────────────
    const chain = B.MeshBuilder.CreateCylinder(`lrChain_${r}`,
      { diameter: 0.08, height: 1.2, tessellation: 6 }, scene);
    chain.position.set(0, ROOM_HEIGHT - 0.6, midZ);
    chain.material = metalM;
    const chandelier = B.MeshBuilder.CreateTorus(`lrChand_${r}`,
      { diameter: 2.2, thickness: 0.12, tessellation: 20 }, scene);
    chandelier.position.set(0, ROOM_HEIGHT - 1.3, midZ);
    chandelier.material = metalM;
    // 6 gem stones hanging from torus
    for (let g = 0; g < 6; g++) {
      const angle = (g / 6) * Math.PI * 2;
      const gem = B.MeshBuilder.CreateSphere(`lrGem_${r}_${g}`,
        { diameter: 0.22, segments: 5 }, scene);
      gem.position.set(
        Math.cos(angle) * 1.1, ROOM_HEIGHT - 1.55, midZ + Math.sin(angle) * 1.1);
      const hue = g / 6;
      gem.material = stdMat(`lrGemM_${r}_${g}`,
        0.5 + hue * 0.4, 0.2, 0.8 - hue * 0.4,
        0.35 + hue * 0.3, 0.05, 0.45 - hue * 0.2);
    }
    // Chandelier light
    const cl = new B.PointLight(`lrCL_${r}`,
      new B.Vector3(0, ROOM_HEIGHT - 1.5, midZ), scene);
    cl.diffuse    = new B.Color3(0.90, 0.80, 1.0);
    cl.intensity  = 3.0;
    cl.range      = 22;

    // ── Benches along back wall ───────────────────────────────────────────────
    [[-4, 0], [4, 0]].forEach(([bx], bi) => {
      const bench = B.MeshBuilder.CreateBox(`lrBench_${r}_${bi}`,
        { width: 3.0, height: 0.14, depth: 0.9 }, scene);
      bench.position.set(bx, 0.65, baseZ + ROOM_LENGTH - 2);
      bench.material = woodM;
      // Bench legs
      [[-1.2, -0.3],[1.2, -0.3],[-1.2, 0.3],[1.2, 0.3]].forEach(([lx,lz],li) => {
        const bl = B.MeshBuilder.CreateBox(`lrBL_${r}_${bi}_${li}`,
          { width: 0.14, height: 0.62, depth: 0.14 }, scene);
        bl.position.set(bx + lx, 0.31, baseZ + ROOM_LENGTH - 2 + lz);
        bl.material = darkM;
      });
    });

    // ── Barrel cluster near one corner ────────────────────────────────────────
    [[1.2,0,0],[0,-0.5,1.1],[2.4,0,0.5]].forEach(([ox,oy,oz], bi) => {
      const barrel = B.MeshBuilder.CreateCylinder(`lrBrl_${r}_${bi}`,
        { diameter: 0.85, height: 1.1, tessellation: 10 }, scene);
      barrel.position.set(-hw + 2 + ox, 0.55 + oy, baseZ + 4 + oz);
      if (oy < 0) barrel.rotation.z = Math.PI / 2;
      barrel.material = stoneM;
      // Barrel ring
      const ring = B.MeshBuilder.CreateTorus(`lrBrlR_${r}_${bi}`,
        { diameter: 0.88, thickness: 0.05, tessellation: 12 }, scene);
      ring.position.set(-hw + 2 + ox, (oy < 0 ? 0.55 + oy : 0.78 + oy), baseZ + 4 + oz);
      if (oy < 0) ring.rotation.z = Math.PI / 2;
      ring.material = metalM;
    });
  }

  // ── Room number label on back wall ──────────────────────────────────────────
  function _buildRoomLabel(r, baseZ) {
    const board = BABYLON.MeshBuilder.CreateBox(`rlabel_${r}`,
      { width: 3.5, height: 1.0, depth: 0.10 }, scene);
    // Faces the player coming in from room 0 direction (at higher z, facing back = -z)
    board.position.set(0, 4.5, baseZ + 0.25);
    try {
      const dt = new BABYLON.DynamicTexture(`rlabeltex_${r}`, { width: 400, height: 112 }, scene, false);
      const ctx = dt.getContext();
      ctx.fillStyle = "#0c0820";
      ctx.fillRect(0, 0, 400, 112);
      ctx.fillStyle = "#ff9020";
      ctx.font = "bold 36px Arial";
      ctx.textAlign = "center";
      ctx.fillText(`Room ${r}  🔤`, 200, 46);
      ctx.fillStyle = "#ffcc88";
      ctx.font = "20px Arial";
      const letters = TARGET_LETTERS.slice((r - 1) * 2, (r - 1) * 2 + 2);
      ctx.fillText(`Find letters: ?  ?`, 200, 82);
      dt.update();
      dt.uScale = -1;
      const sm = new BABYLON.StandardMaterial(`rlabelmat_${r}`, scene);
      sm.diffuseTexture  = dt;
      sm.emissiveTexture = dt;
      board.material = sm;
    } catch(e) {
      board.material = goldMat;
    }
  }

  // ── HSV helper ──────────────────────────────────────────────────────────────
  function _hsvToColor3(h, s, v) {
    const i = Math.floor(h / 60) % 6;
    const f = h / 60 - Math.floor(h / 60);
    const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    const rows = [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]];
    const [r, g, b] = rows[i];
    return new BABYLON.Color3(r, g, b);
  }

  // ── Letter tile ─────────────────────────────────────────────────────────────
  function _buildLetterTile(letter, index, pos) {
    const root = new BABYLON.TransformNode(`ltRoot_${index}`, scene);
    root.position.copyFrom(pos);

    // Large flat tile
    const tile = BABYLON.MeshBuilder.CreateBox(`lt_${index}`,
      { width: 1.2, height: 1.2, depth: 0.15 }, scene);
    tile.parent = root;

    try {
      const dt = new BABYLON.DynamicTexture(`ltTex_${index}`, { width: 128, height: 128 }, scene, false);
      const ctx = dt.getContext();
      const hue = (index / 6) * 360;
      ctx.fillStyle = `hsl(${hue}, 65%, 18%)`;
      ctx.fillRect(0, 0, 128, 128);
      ctx.strokeStyle = `hsl(${hue}, 90%, 65%)`;
      ctx.lineWidth = 5;
      ctx.strokeRect(5, 5, 118, 118);
      ctx.fillStyle = `hsl(${hue}, 85%, 88%)`;
      ctx.font = "bold 88px Arial";
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(letter, 64, 68);
      dt.update();
      const tm = new BABYLON.StandardMaterial(`ltMat_${index}`, scene);
      tm.diffuseTexture  = dt;
      tm.emissiveTexture = dt;
      tile.material = tm;
    } catch(e) {
      const tm = new BABYLON.StandardMaterial(`ltMatFb_${index}`, scene);
      tm.diffuseColor  = new BABYLON.Color3(0.30, 0.55, 1.0);
      tm.emissiveColor = new BABYLON.Color3(0.10, 0.18, 0.50);
      tile.material = tm;
    }

    // Glow ring
    const ring = BABYLON.MeshBuilder.CreateTorus(`ltRing_${index}`,
      { diameter: 1.4, thickness: 0.07, tessellation: 24 }, scene);
    ring.parent   = root;
    ring.rotation.x = Math.PI / 2;

    const c = _hsvToColor3((index / 6) * 360, 0.8, 0.9);
    const rm = new BABYLON.StandardMaterial(`ltRingMat_${index}`, scene);
    rm.diffuseColor  = c;
    rm.emissiveColor = new BABYLON.Color3(c.r * 0.5, c.g * 0.5, c.b * 0.5);
    ring.material = rm;

    // Point light (small range so it doesn't eat the light budget)
    const pl = new BABYLON.PointLight(`ltL_${index}`, BABYLON.Vector3.Zero(), scene);
    pl.parent    = root;
    pl.diffuse   = c;
    pl.intensity = 1.2;
    pl.range     = 6;

    letterTiles.push({
      root, letter, index, collected: false,
      _t: Math.random() * Math.PI * 2,
      update() {
        if (this.collected) return;
        this._t += 0.025;
        this.root.position.y = pos.y + Math.sin(this._t) * 0.22;
        this.root.rotation.y += 0.020;
      }
    });
  }

  // ── Crystal accent pillar ────────────────────────────────────────────────────
  function _buildCrystalPillar(x, z) {
    const base = BABYLON.MeshBuilder.CreateBox(`cpb_${x}_${z}`,
      { width: 0.5, height: 0.3, depth: 0.5 }, scene);
    base.position.set(x, 0.15, z);
    base.material = stoneMat;

    const spire = BABYLON.MeshBuilder.CreateCylinder(`cps_${x}_${z}`,
      { diameterTop: 0, diameterBottom: 0.28, height: 0.7, tessellation: 6 }, scene);
    spire.position.set(x, 0.65, z);
    spire.material = crystalMat;

    const cl = new BABYLON.PointLight(`cpl_${x}_${z}`,
      new BABYLON.Vector3(x, 1.0, z), scene);
    cl.diffuse    = new BABYLON.Color3(0.50, 0.10, 1.0);
    cl.intensity  = 0.6;
    cl.range      = 5;
  }

  // ── Wall torch ───────────────────────────────────────────────────────────────

  function _buildWallTorch(wallX, z, r) {
    // Bracket stub (inset 0.5 from wall)
    const sx = wallX > 0 ? wallX - 0.5 : wallX + 0.5;
    const holder = BABYLON.MeshBuilder.CreateBox(`thold_${r}_${wallX}_${z}`,
      { width: 0.12, height: 0.5, depth: 0.12 }, scene);
    holder.position.set(sx, 3.2, z);
    holder.material = stoneMat;

    const flame = BABYLON.MeshBuilder.CreateCylinder(`tflm_${r}_${wallX}_${z}`,
      { diameterTop: 0, diameterBottom: 0.20, height: 0.40, tessellation: 6 }, scene);
    flame.position.set(sx, 3.65, z);
    const fm = new BABYLON.StandardMaterial(`tfm_${r}_${wallX}_${z}`, scene);
    fm.diffuseColor  = new BABYLON.Color3(0.50, 0.08, 0.90);
    fm.emissiveColor = new BABYLON.Color3(0.30, 0.04, 0.60);
    flame.material = fm;

    const tl = new BABYLON.PointLight(`tl_${r}_${wallX}_${z}`,
      new BABYLON.Vector3(sx, 3.8, z), scene);
    tl.diffuse    = new BABYLON.Color3(0.65, 0.35, 1.0);
    tl.intensity  = 1.8;
    tl.range      = 12;
    torchLights.push({ light: tl, baseI: 1.8, offset: Math.random() * Math.PI * 2 });
  }

  // ── Player ───────────────────────────────────────────────────────────────────
  const player = createPlayer(scene);
  player.mesh.position.set(0, 0.5, 2);
  player.camera.radius           = DESIRED_RADIUS;
  player.camera.lowerRadiusLimit = 3;
  player.camera.upperRadiusLimit = 22;

  // ── HUD ──────────────────────────────────────────────────────────────────────
  const hudLocation = document.getElementById("hud-location");
  const hudStars    = document.getElementById("hud-stars");
  function _updateHUD() {
    if (hudLocation) hudLocation.textContent = `🔤 Letters Castle – Room ${currentRoom + 1}`;
    if (hudStars)    hudStars.textContent     = `📜 ${collectedLetters.length} / 6`;
  }
  _updateHUD();

  // ── Overlay helpers ──────────────────────────────────────────────────────────
  const overlay = document.getElementById("ui-overlay");
  function _clearOverlay() {
    overlay.innerHTML = "";
    overlay.classList.remove("active");
  }

  // ── Assembly UI ──────────────────────────────────────────────────────────────
  let assemblyOpen = false;

  function _showAssemblyUI() {
    assemblyOpen = true;
    overlay.innerHTML = "";
    overlay.classList.add("active");

    const panel = document.createElement("div");
    panel.className = "puzzle-panel";
    panel.innerHTML = `
      <h2>🔤 Arrange the Letters!</h2>
      <p class="tagline">${HINT_TEXT}</p>
      <p class="question">Tap letters in the correct order to spell the word:</p>
    `;

    const display  = document.createElement("div");
    display.className = "sentence-builder";
    panel.appendChild(display);

    const tileArea = document.createElement("div");
    tileArea.className = "word-tiles";

    // selected = [{ltr, btn}] to track which button each selection came from
    const selected = [];

    function _refresh() {
      display.innerHTML = "";
      selected.forEach((item, i) => {
        const w = document.createElement("span");
        w.className  = "sentence-word";
        w.textContent = item.ltr;
        w.onclick = () => {
          item.btn.disabled = false;
          item.btn.classList.remove("used");
          selected.splice(i, 1);
          _refresh();
        };
        display.appendChild(w);
      });

      if (selected.length === TARGET_LETTERS.length) {
        const attempt = selected.map(x => x.ltr).join("");
        if (attempt === TARGET_WORD) {
          _onWordCorrect();
        } else {
          feedback.className  = "feedback wrong";
          feedback.textContent = t("letters.wrong");
          selected.forEach(item => {
            item.btn.disabled = false;
            item.btn.classList.remove("used");
          });
          selected.length = 0;
          _refresh();
        }
      }
    }

    const shuffled = collectedLetters.slice().sort(() => Math.random() - 0.5);
    shuffled.forEach(ltr => {
      const btn = document.createElement("button");
      btn.className  = "btn btn-word";
      btn.textContent = ltr;
      btn.onclick = () => {
        btn.disabled = true;
        btn.classList.add("used");
        selected.push({ ltr, btn });
        _refresh();
      };
      tileArea.appendChild(btn);
    });
    panel.appendChild(tileArea);

    const feedback = document.createElement("div");
    feedback.className = "feedback";
    panel.appendChild(feedback);

    const closeBtn = document.createElement("button");
    closeBtn.className  = "btn btn-primary";
    closeBtn.style.background = "#555";
    closeBtn.textContent = t("letters.close");
    closeBtn.onclick = () => { _clearOverlay(); assemblyOpen = false; };
    panel.appendChild(closeBtn);

    overlay.appendChild(panel);
  }

  // ── Word correct ─────────────────────────────────────────────────────────────
  function _onWordCorrect() {
    crownEarned = true;
    const save = SaveManager.load();
    save.lettersIsland = save.lettersIsland || {};
    save.lettersIsland.crownEarned = true;
    SaveManager.save(save);
    _showVictory();
  }

  function _showVictory() {
    overlay.innerHTML = "";
    overlay.classList.add("active");
    _spawnConfetti();

    const panel = document.createElement("div");
    panel.className = "puzzle-panel victory-panel";
    panel.innerHTML = `
      <span class="victory-emoji">👑</span>
      <div class="victory-title">Amazing! You spelled ${TARGET_WORD}!</div>
      <div class="victory-sub">${HINT_TEXT}</div><br>
    `;

    const exitBtn = document.createElement("button");
    exitBtn.className  = "btn btn-primary";
    exitBtn.textContent = t("letters.return");
    exitBtn.onclick = () => { _clearOverlay(); if (typeof onExit === "function") onExit(); };
    panel.appendChild(exitBtn);
    overlay.appendChild(panel);
  }

  // ── Confetti ─────────────────────────────────────────────────────────────────
  function _spawnConfetti() {
    const wrap = document.createElement("div");
    wrap.className = "confetti-wrap";
    document.body.appendChild(wrap);
    const colors = ["#ff0","#f0f","#0ff","#0f0","#f80","#88f"];
    for (let i = 0; i < 60; i++) {
      const p = document.createElement("div");
      p.className = "confetti-piece";
      p.style.left             = Math.random() * 100 + "vw";
      p.style.background       = colors[i % colors.length];
      p.style.animationDuration = (1.5 + Math.random() * 2) + "s";
      p.style.animationDelay   = (Math.random() * 1) + "s";
      wrap.appendChild(p);
    }
    setTimeout(() => { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 4000);
  }

  // ── Order hint ──────────────────────────────────────────────────────────────
  function _showOrderHint(triedLetter, nextExpected) {
    const now = performance.now();
    if (now - _lastOrderHintTime < 2000) return; // debounce 2 s
    _lastOrderHintTime = now;
    const b = document.createElement("div");
    b.className  = "room-banner order-hint";
    b.textContent = t("letters.order_hint");
    document.body.appendChild(b);
    setTimeout(() => { if (b.parentNode) b.parentNode.removeChild(b); }, 2500);
  }

  // ── Collect banner ───────────────────────────────────────────────────────────
  function _showCollectBanner(letter) {
    const b = document.createElement("div");
    b.className  = "room-banner";
    b.textContent = t("letters.collected").replace("{l}", letter).replace("{c}", collectedLetters.length);
    document.body.appendChild(b);
    setTimeout(() => { if (b.parentNode) b.parentNode.removeChild(b); }, 2500);
  }

  // ── Render loop ──────────────────────────────────────────────────────────────
  let time = 0;

  scene.registerBeforeRender(() => {
    try {
      time += 0.016;

      player.update();

      const px = player.mesh.position.x;
      const py = player.mesh.position.y;
      const pz = player.mesh.position.z;

      // Torch flicker
      for (const t of torchLights) {
        t.light.intensity = t.baseI
          + 0.50 * Math.sin(time * 2.9 + t.offset)
          + 0.20 * Math.sin(time * 7.3 + t.offset);
      }

      // Door beacon pulse
      for (const b of doorBeacons) {
        const pulse = 0.55 + 0.45 * Math.sin(time * 2.2 + b.offset);
        b.mat.emissiveColor.set(0.05 * pulse, 0.60 * pulse, 0.45 * pulse);
        b.mesh.position.y = 0.45 + 0.18 * Math.sin(time * 2.2 + b.offset);
      }

      // Letter tile float + collection
      for (const tile of letterTiles) {
        tile.update();
        if (!tile.collected) {
          const dist = BABYLON.Vector3.Distance(
            new BABYLON.Vector3(px, py, pz),
            tile.root.position
          );
          if (dist < 5.0) {
            const nextExpected = ALPHA_ORDER[collectedLetters.length];
            if (tile.letter.toUpperCase() !== nextExpected) {
              // Wrong alphabetical order — hint the player
              _showOrderHint(tile.letter, nextExpected);
            } else {
              tile.collected = true;
              collectedLetters.push(tile.letter);
              tile.root.setEnabled(false);
              _showCollectBanner(tile.letter);
              _updateHUD();
              // Last letter collected — open puzzle immediately
              if (collectedLetters.length === 6 && !assemblyOpen) {
                setTimeout(() => _showAssemblyUI(), 800);
              }
            }
          }
        }
      }

      // Assembly box trigger (all 6 letters + close to box) — kept as fallback
      if (!assemblyOpen && collectedLetters.length === 6) {
        const asmDist = BABYLON.Vector3.Distance(
          new BABYLON.Vector3(px, py, pz),
          ASSEMBLY_POS
        );
        if (asmDist < 5.0) _showAssemblyUI();
      }

      // Room number (floor division by room length)
      currentRoom = Math.max(0, Math.min(NUM_ROOMS - 1, Math.floor(pz / ROOM_LENGTH)));
      _updateHUD();

      // Camera radius — prevent clipping through walls
      const roomBaseZ = currentRoom * ROOM_LENGTH;
      const hw        = ROOM_WIDTH / 2;
      const dBack     = Math.max(0.5, pz - roomBaseZ);
      const dFront    = Math.max(0.5, roomBaseZ + ROOM_LENGTH - pz);
      const dLeft     = Math.max(0.5, px + hw);
      const dRight    = Math.max(0.5, hw - px);
      const safe = Math.min(DESIRED_RADIUS, dBack * 0.85, dFront * 0.85, dLeft * 0.85, dRight * 0.85);
      const clampedR  = Math.max(3.5, safe);
      player.camera.radius = BABYLON.Scalar.Lerp(player.camera.radius, clampedR, 0.15);
      player.camera.upperRadiusLimit = clampedR + 0.5;

      // Exit (walk back through entrance)
      if (pz < -1.5 && typeof onExit === "function") onExit();

    } catch(err) {
      console.error("LettersCastle render error:", err);
    }
  });

  return scene;
}
