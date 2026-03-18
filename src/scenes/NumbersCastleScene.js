/**
 * NumbersCastleScene.js
 * Castle with 4 rooms: Room 0 = Vault Hall, Rooms 1/2/3 = Number Rooms.
 * Player collects 6 number tiles (ascending order), then arranges them
 * smallest → largest in the Vault to earn the crown.
 */

import { createPlayer }    from "../entities/Player.js";
import { NUMBER_PUZZLES }  from "../data/numberPuzzles.js";
import { SaveManager }     from "../utils/SaveManager.js";
import { spawnConfetti }  from "../puzzles/confetti.js";
import { t }              from "../utils/i18n.js";
import { SoundManager }   from "../utils/SoundManager.js";
import { medMaterial }    from "../utils/MedievalLoader.js";

export function createNumbersCastleScene(engine, onExit) {
  const BABYLON = window.BABYLON;
  const scene   = new BABYLON.Scene(engine);

  // ── Dimensions ─────────────────────────────────────────────────────────────
  const ROOM_WIDTH    = 25;
  const ROOM_LENGTH   = 30;
  const ROOM_HEIGHT   = 7.0;
  const NUM_ROOMS     = 4;
  const DESIRED_RADIUS = 12;

  // ── Pick a random puzzle ────────────────────────────────────────────────────
  const puzzleData   = NUMBER_PUZZLES[Math.floor(Math.random() * NUMBER_PUZZLES.length)];
  const TARGET_NUMS  = puzzleData.numbers.slice().sort((a, b) => a - b); // ascending
  const HINT_TEXT    = puzzleData.hint;

  // ── State ───────────────────────────────────────────────────────────────────
  let currentRoom        = 0;
  let collectedNumbers   = [];
  let numberTiles        = [];
  let crownEarned        = false;
  let _lastOrderHintTime = 0;
  const torchLights      = [];
  const doorBeacons      = [];
  let vaultBoxMesh       = null;
  let vaultOpen          = false;
  const VAULT_Z          = ROOM_LENGTH * 0.60;
  const VAULT_POS        = new BABYLON.Vector3(0, 0, VAULT_Z);

  // ── Scene setup ─────────────────────────────────────────────────────────────
  scene.clearColor = new BABYLON.Color4(0.03, 0.06, 0.15, 1);

  const ambient = new BABYLON.HemisphericLight("nAmb", new BABYLON.Vector3(0, 1, 0), scene);
  ambient.intensity   = 1.1;
  ambient.diffuse     = new BABYLON.Color3(0.85, 0.90, 1.0);
  ambient.groundColor = new BABYLON.Color3(0.18, 0.24, 0.45);

  // ── Shared materials ────────────────────────────────────────────────────────
  function stdMat(name, r, g, b, emR, emG, emB) {
    const m = new BABYLON.StandardMaterial(name, scene);
    m.diffuseColor = new BABYLON.Color3(r, g, b);
    if (emR !== undefined) m.emissiveColor = new BABYLON.Color3(emR, emG, emB);
    return m;
  }

  // Deep blue/gold theme — now textured with medieval pack
  const wallMat  = medMaterial(scene, "UnevenBrick", "nWallMat",  4, 6);
  wallMat.diffuseColor  = new BABYLON.Color3(0.18, 0.28, 0.55);
  const floorMat = medMaterial(scene, "WoodDark",    "nFloorMat", 6, 8);
  floorMat.diffuseColor = new BABYLON.Color3(0.10, 0.16, 0.38);
  const stoneMat = medMaterial(scene, "RockTrim",    "nStoneMat", 3, 5);
  stoneMat.diffuseColor = new BABYLON.Color3(0.22, 0.32, 0.58);
  const goldMat    = stdMat("nGoldMat",    0.82, 0.67, 0.10, 0.22, 0.14, 0.00);
  const cyanMat    = stdMat("nCyanMat",    0.10, 0.75, 0.95, 0.02, 0.28, 0.38);

  // Tiled floor for vault hall — use Brick texture
  const tiledFloorMat = medMaterial(scene, "Brick", "nTiledFloor", 8, 5);
  tiledFloorMat.diffuseColor = new BABYLON.Color3(0.08, 0.12, 0.30);

  // ── Overlay & HUD ───────────────────────────────────────────────────────────
  const overlay = document.getElementById("ui-overlay");
  function _clearOverlay() {
    overlay.innerHTML = "";
    overlay.classList.remove("active");
  }

  // ── UI helpers ──────────────────────────────────────────────────────────────
  function _updateHUD() {
    const hudEl = document.getElementById("hud-stars");
    if (hudEl) {
      hudEl.textContent = `🔢 ${collectedNumbers.length}/${TARGET_NUMS.length}  ${HINT_TEXT}`;
    }
  }

  // ── Build rooms ─────────────────────────────────────────────────────────────
  for (let r = 0; r < NUM_ROOMS; r++) _buildRoom(r);

  function _buildRoom(r) {
    const baseZ = r * ROOM_LENGTH;
    const midZ  = baseZ + ROOM_LENGTH / 2;
    const hw    = ROOM_WIDTH / 2;
    const cy    = ROOM_HEIGHT / 2;

    // Floor
    const fl = BABYLON.MeshBuilder.CreateBox(`nFl_${r}`,
      { width: ROOM_WIDTH, height: 0.3, depth: ROOM_LENGTH }, scene);
    fl.position.set(0, 0.15, midZ);
    fl.material = (r === 0) ? tiledFloorMat : floorMat;

    // Walls
    const lw = BABYLON.MeshBuilder.CreateBox(`nLw_${r}`,
      { width: 0.4, height: ROOM_HEIGHT, depth: ROOM_LENGTH }, scene);
    lw.position.set(-hw - 0.2, cy, midZ);
    lw.material = wallMat;

    const rw = BABYLON.MeshBuilder.CreateBox(`nRw_${r}`,
      { width: 0.4, height: ROOM_HEIGHT, depth: ROOM_LENGTH }, scene);
    rw.position.set(hw + 0.2, cy, midZ);
    rw.material = wallMat;

    // Entry (back) wall for room 0 — exit portal
    if (r === 0) {
      const bk = BABYLON.MeshBuilder.CreateBox(`nBk_${r}`,
        { width: ROOM_WIDTH + 0.8, height: ROOM_HEIGHT, depth: 0.4 }, scene);
      bk.position.set(0, cy, baseZ);
      bk.material = stoneMat;

      const exitDoor = BABYLON.MeshBuilder.CreateBox("nExitDoor",
        { width: 4.0, height: 5.0, depth: 0.45 }, scene);
      exitDoor.position.set(0, 2.5, baseZ);
      const edm = new BABYLON.StandardMaterial("nEdm", scene);
      edm.diffuseColor = new BABYLON.Color3(0.05, 0.08, 0.18);
      exitDoor.material = edm;

      const exitArch = BABYLON.MeshBuilder.CreateSphere("nExitArch",
        { diameterX: 4.0, diameterY: 1.4, diameterZ: 0.45, segments: 8 }, scene);
      exitArch.position.set(0, 5.2, baseZ);
      exitArch.material = edm;
    }

    // Entrance arch for the last room — castle gate where player enters
    if (r === NUM_ROOMS - 1) {
      const entZ = baseZ + ROOM_LENGTH;
      const enm = new BABYLON.StandardMaterial("nEntMat", scene);
      enm.diffuseColor  = new BABYLON.Color3(0.22, 0.32, 0.65);
      enm.emissiveColor = new BABYLON.Color3(0.04, 0.08, 0.20);

      // Left and right pillar segments
      [[-11, 18], [11, 18]].forEach(([dx, dw], j) => {
        const seg = BABYLON.MeshBuilder.CreateBox(`nEntSeg_${j}`,
          { width: dw, height: ROOM_HEIGHT, depth: 0.5 }, scene);
        seg.position.set(dx, cy, entZ);
        seg.material = stoneMat;
      });
      const topFill = BABYLON.MeshBuilder.CreateBox("nEntTop",
        { width: 4.2, height: 2.6, depth: 0.5 }, scene);
      topFill.position.set(0, 5.7, entZ);
      topFill.material = stoneMat;

      // Gold arch above entrance
      const archMat = new BABYLON.StandardMaterial("nEntArch", scene);
      archMat.diffuseColor  = new BABYLON.Color3(0.85, 0.70, 0.10);
      archMat.emissiveColor = new BABYLON.Color3(0.30, 0.22, 0.00);
      const arch = BABYLON.MeshBuilder.CreateSphere("nEntArchM",
        { diameterX: 4.2, diameterY: 1.6, diameterZ: 0.5, segments: 8 }, scene);
      arch.position.set(0, 4.6, entZ);
      arch.material = archMat;

      // Welcome banner
      const bannerMat = new BABYLON.StandardMaterial("nEntBanner", scene);
      bannerMat.diffuseColor  = new BABYLON.Color3(0.82, 0.67, 0.10);
      bannerMat.emissiveColor = new BABYLON.Color3(0.25, 0.18, 0.00);
      const banner = BABYLON.MeshBuilder.CreateBox("nEntBannerM",
        { width: 5.0, height: 0.5, depth: 0.15 }, scene);
      banner.position.set(0, 6.5, entZ);
      banner.material = bannerMat;
    }

    // Door wall with arch between rooms
    if (r < NUM_ROOMS - 1) _buildDoorWall(r, baseZ + ROOM_LENGTH);

    // Add room-specific content
    if (r === 0) {
      _buildVaultBox(scene);
      _buildVaultDecor(scene, baseZ);
    } else {
      _buildNumberRoom(r, baseZ);
      _addNumberRoomFurniture(r, baseZ);
    }

    // Torches
    for (const side of [-1, 1]) {
      for (const tz of [5, 15, 25]) {
        _buildTorch(scene, side * (hw - 0.2), 3.5, baseZ + tz, r, tz, side);
      }
    }

    // Overhead point lights
    for (const lz of [0.3, 0.7]) {
      const pl = new BABYLON.PointLight(`nPL_${r}_${lz}`, new BABYLON.Vector3(0, 5.2, baseZ + ROOM_LENGTH * lz), scene);
      pl.diffuse    = new BABYLON.Color3(0.55, 0.70, 1.0);
      pl.intensity  = 1.4;
      pl.range      = 20;
    }
  }

  // ── Door wall ───────────────────────────────────────────────────────────────
  function _buildDoorWall(r, doorWallZ) {
    const hw = ROOM_WIDTH / 2;
    const cy = ROOM_HEIGHT / 2;

    [[-11, 18], [11, 18]].forEach(([dx, dw], j) => {
      const seg = BABYLON.MeshBuilder.CreateBox(`nDwSeg_${r}_${j}`,
        { width: dw, height: ROOM_HEIGHT, depth: 0.4 }, scene);
      seg.position.set(dx, cy, doorWallZ);
      seg.material = stoneMat;
    });

    const topFill = BABYLON.MeshBuilder.CreateBox(`nDwTop_${r}`,
      { width: 4.2, height: 2.6, depth: 0.4 }, scene);
    topFill.position.set(0, 5.7, doorWallZ);
    topFill.material = stoneMat;

    // Arch above door
    const archMat = new BABYLON.StandardMaterial(`nArch_${r}`, scene);
    archMat.diffuseColor  = new BABYLON.Color3(0.55, 0.80, 1.0);
    archMat.emissiveColor = new BABYLON.Color3(0.05, 0.20, 0.45);
    const arch = BABYLON.MeshBuilder.CreateSphere(`nArch_${r}`,
      { diameterX: 4.2, diameterY: 1.6, diameterZ: 0.44, segments: 8 }, scene);
    arch.position.set(0, 4.6, doorWallZ);
    arch.material = archMat;

    // Pulsing door beacons
    for (const sx of [-1.8, 1.8]) {
      const beaconMat = new BABYLON.StandardMaterial(`nBcn_${r}_${sx}`, scene);
      beaconMat.diffuseColor  = new BABYLON.Color3(0.10, 0.70, 1.0);
      beaconMat.emissiveColor = new BABYLON.Color3(0.02, 0.35, 0.70);
      const beacon = BABYLON.MeshBuilder.CreateSphere(`nBcnM_${r}_${sx}`,
        { diameter: 0.36, segments: 8 }, scene);
      beacon.position.set(sx, 0.45, doorWallZ);
      beacon.material = beaconMat;
      doorBeacons.push({ mat: beaconMat, mesh: beacon, offset: Math.random() * Math.PI * 2 });
    }
  }

  // ── Vault box (assembly point) ──────────────────────────────────────────────
  function _buildVaultBox(scene) {
    const vaultMat = new BABYLON.StandardMaterial("nVaultMat", scene);
    vaultMat.diffuseColor  = new BABYLON.Color3(0.72, 0.58, 0.12);
    vaultMat.emissiveColor = new BABYLON.Color3(0.18, 0.12, 0.02);

    const vault = BABYLON.MeshBuilder.CreateBox("nVault",
      { width: 3.0, height: 1.2, depth: 2.0 }, scene);
    vault.position = new BABYLON.Vector3(0, 0.6, VAULT_Z);
    vault.material = vaultMat;
    vaultBoxMesh = vault;

    // gold lock
    const lockMat = new BABYLON.StandardMaterial("nLock", scene);
    lockMat.diffuseColor  = new BABYLON.Color3(0.95, 0.80, 0.10);
    lockMat.emissiveColor = new BABYLON.Color3(0.30, 0.20, 0.00);
    const lock = BABYLON.MeshBuilder.CreateCylinder("nLockC",
      { diameter: 0.5, height: 0.3, tessellation: 12 }, scene);
    lock.position.set(0, 1.35, VAULT_Z);
    lock.material = lockMat;

    // glow light above vault
    const vaultLight = new BABYLON.PointLight("nVaultL",
      new BABYLON.Vector3(0, 3.5, VAULT_Z), scene);
    vaultLight.diffuse   = new BABYLON.Color3(0.8, 0.7, 0.2);
    vaultLight.intensity = 2.0;
    vaultLight.range     = 12;
  }

  // ── Vault room decoration ────────────────────────────────────────────────────
  function _buildVaultDecor(scene, baseZ) {
    // Four gold pillars
    const pillarMat = new BABYLON.StandardMaterial("nPillar", scene);
    pillarMat.diffuseColor  = new BABYLON.Color3(0.72, 0.58, 0.12);
    pillarMat.emissiveColor = new BABYLON.Color3(0.12, 0.08, 0.00);

    for (const [px, pz] of [[-8, baseZ+8], [8, baseZ+8], [-8, baseZ+22], [8, baseZ+22]]) {
      const pillar = BABYLON.MeshBuilder.CreateCylinder(`nVPil_${px}_${pz}`,
        { diameter: 0.9, height: 7.0, tessellation: 8 }, scene);
      pillar.position.set(px, 3.5, pz);
      pillar.material = pillarMat;

      const cap = BABYLON.MeshBuilder.CreateBox(`nVCap_${px}_${pz}`,
        { width: 1.1, height: 0.3, depth: 1.1 }, scene);
      cap.position.set(px, 6.85, pz);
      cap.material = pillarMat;
    }

    // Number tiles waiting hint box
    const hintMat = new BABYLON.StandardMaterial("nHint", scene);
    hintMat.diffuseColor = new BABYLON.Color3(0.12, 0.18, 0.40);
    const hintBox = BABYLON.MeshBuilder.CreateBox("nHintBox",
      { width: 6, height: 0.15, depth: 3 }, scene);
    hintBox.position.set(0, 0.35, VAULT_Z + 5);
    hintBox.material = hintMat;
  }

  // ── Number room ─────────────────────────────────────────────────────────────
  function _buildNumberRoom(r, baseZ) {
    const midZ  = baseZ + ROOM_LENGTH / 2;
    const hw    = ROOM_WIDTH / 2;

    // 2 tiles per room: indices (r-1)*2 and (r-1)*2+1
    const i0 = (r - 1) * 2;
    const i1 = i0 + 1;

    // Wider scatter pool with more random placement across the room
    const positions = [
      [-8, baseZ + 6],   [-8, baseZ + 16],  [-8, baseZ + 24],
      [ 8, baseZ + 6],   [ 8, baseZ + 16],  [ 8, baseZ + 24],
      [-4, baseZ + 10],  [ 4, baseZ + 10],
      [-4, baseZ + 20],  [ 4, baseZ + 20],
      [ 0, baseZ + 8],   [ 0, baseZ + 22],
      [-6, baseZ + 13],  [ 6, baseZ + 13],
      [-2, baseZ + 16],  [ 2, baseZ + 16],
    ];
    // Shuffle and pick 2 random spots
    const picked = positions.sort(() => Math.random() - 0.5).slice(0, 2);

    [[i0, picked[0]], [i1, picked[1]]].forEach(([idx, pos]) => {
      if (idx >= TARGET_NUMS.length) return;
      // Add extra random offset to each tile position
      const rx = pos[0] + (Math.random() - 0.5) * 3;
      const rz = pos[1] + (Math.random() - 0.5) * 4;
      _buildNumberTile(idx, TARGET_NUMS[idx], rx, rz);
    });

    // Banner sign
    const bannerMat = new BABYLON.StandardMaterial(`nBanner_${r}`, scene);
    bannerMat.diffuseColor  = new BABYLON.Color3(0.22, 0.42, 0.85);
    bannerMat.emissiveColor = new BABYLON.Color3(0.04, 0.10, 0.25);
    for (const px of [-10, 10]) {
      const banner = BABYLON.MeshBuilder.CreateBox(`nBannerM_${r}_${px}`,
        { width: 0.7, height: 3.0, depth: 0.08 }, scene);
      banner.position.set(px * 0.96, 4.5, midZ);
      banner.material = bannerMat;
    }

    // Room overhead light
    const roomLight = new BABYLON.PointLight(`nRL_${r}`,
      new BABYLON.Vector3(0, 5.5, midZ), scene);
    roomLight.diffuse   = new BABYLON.Color3(0.60, 0.75, 1.0);
    roomLight.intensity = 2.5;
    roomLight.range     = 18;
  }

  // ── Number tile ─────────────────────────────────────────────────────────────
  function _buildNumberTile(index, num, x, z) {
    const root = new BABYLON.TransformNode(`nTile_${index}`, scene);
    root.position = new BABYLON.Vector3(x, 1.5, z);

    // Unique hue per tile for visual variety
    const hueShift = (index / Math.max(1, TARGET_NUMS.length));
    const tileR = 0.85 + hueShift * 0.1;
    const tileG = 0.70 - hueShift * 0.3;
    const tileB = 0.10 + hueShift * 0.6;

    // Base disc — larger and more colorful
    const discMat = new BABYLON.StandardMaterial(`nDisc_${index}`, scene);
    discMat.diffuseColor  = new BABYLON.Color3(tileR, tileG, tileB);
    discMat.emissiveColor = new BABYLON.Color3(tileR * 0.3, tileG * 0.25, tileB * 0.1);
    const disc = BABYLON.MeshBuilder.CreateCylinder(`nDiscM_${index}`,
      { diameter: 1.6, height: 0.22, tessellation: 16 }, scene);
    disc.material = discMat;
    disc.parent   = root;
    disc.position.set(0, 0, 0);

    // Number label using DynamicTexture
    const numMat = new BABYLON.StandardMaterial(`nNumMat_${index}`, scene);
    try {
      const dt = new BABYLON.DynamicTexture(`nNumTex_${index}`, { width: 128, height: 128 }, scene, false);
      const ctx = dt.getContext();
      // Gradient-like background
      ctx.fillStyle = "#FFD700";
      ctx.fillRect(0, 0, 128, 128);
      // Border
      ctx.strokeStyle = "#8B6914";
      ctx.lineWidth = 6;
      ctx.strokeRect(4, 4, 120, 120);
      // Number text
      ctx.fillStyle = "#1a1050";
      ctx.font = "bold 78px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(num), 64, 68);
      dt.update();
      numMat.diffuseTexture  = dt;
      numMat.emissiveTexture = dt;
      numMat.emissiveColor   = new BABYLON.Color3(0.9, 0.75, 0.0);
      numMat.backFaceCulling = false;
    } catch(e) {
      numMat.diffuseColor = new BABYLON.Color3(0.95, 0.75, 0.0);
    }

    const face = BABYLON.MeshBuilder.CreateBox(`nFace_${index}`,
      { width: 1.1, height: 1.1, depth: 0.05 }, scene);
    face.material = numMat;
    face.parent   = root;
    face.position.set(0, 0.18, 0);

    // Glow ring around the tile
    const glowMat = new BABYLON.StandardMaterial(`nGlow_${index}`, scene);
    glowMat.diffuseColor  = new BABYLON.Color3(0.3 + hueShift * 0.4, 0.6, 1.0 - hueShift * 0.3);
    glowMat.emissiveColor = new BABYLON.Color3(0.1, 0.3, 0.6);
    glowMat.alpha = 0.6;
    const glow = BABYLON.MeshBuilder.CreateTorus(`nGlowM_${index}`,
      { diameter: 1.8, thickness: 0.12, tessellation: 16 }, scene);
    glow.material = glowMat;
    glow.parent   = root;
    glow.position.set(0, -0.10, 0);

    // Small point light for each tile
    const tileLight = new BABYLON.PointLight(`nTileLight_${index}`,
      new BABYLON.Vector3(x, 2.2, z), scene);
    tileLight.diffuse   = new BABYLON.Color3(tileR, tileG, 1.0);
    tileLight.intensity = 0.8;
    tileLight.range     = 5;

    const tileObj = {
      root, num, index, collected: false,
      _t: Math.random() * Math.PI * 2,
      _light: tileLight,
      update() {
        if (this.collected) return;
        this._t += 0.028;
        this.root.position.y = 1.5 + Math.sin(this._t) * 0.28;
        this.root.rotation.y += 0.025;
        // Pulse the glow ring
        if (glow) glow.scaling.setAll(1.0 + Math.sin(this._t * 1.5) * 0.08);
      }
    };
    numberTiles.push(tileObj);
  }

  // ── Number room furniture ────────────────────────────────────────────────────
  function _addNumberRoomFurniture(r, baseZ) {
    const hw = ROOM_WIDTH / 2;
    const woodMat = new BABYLON.StandardMaterial(`nWood_${r}`, scene);
    woodMat.diffuseColor = new BABYLON.Color3(0.45, 0.28, 0.12);
    const stoneFurMat = new BABYLON.StandardMaterial(`nStoneFur_${r}`, scene);
    stoneFurMat.diffuseColor = new BABYLON.Color3(0.30, 0.35, 0.50);
    const rugMat = new BABYLON.StandardMaterial(`nRug_${r}`, scene);
    rugMat.diffuseColor = new BABYLON.Color3(0.12, 0.22, 0.58);

    // Rug
    const rug = BABYLON.MeshBuilder.CreateBox(`nRug_${r}`,
      { width: 12, height: 0.05, depth: 18 }, scene);
    rug.position.set(0, 0.30, baseZ + 15);
    rug.material = rugMat;

    // Two bookshelves
    for (const [sx, sz] of [[-9, baseZ + 6], [9, baseZ + 6]]) {
      const shelf = BABYLON.MeshBuilder.CreateBox(`nShelf_${r}_${sx}`,
        { width: 0.4, height: 4.5, depth: 2.5 }, scene);
      shelf.position.set(sx, 2.3, sz);
      shelf.material = woodMat;
      for (let bi = 0; bi < 3; bi++) {
        const bookMat = new BABYLON.StandardMaterial(`nBook_${r}_${sx}_${bi}`, scene);
        bookMat.diffuseColor = new BABYLON.Color3(Math.random()*0.5+0.3, Math.random()*0.3, Math.random()*0.5+0.2);
        const book = BABYLON.MeshBuilder.CreateBox(`nBook_${r}_${sx}_${bi}`,
          { width: 0.35, height: 0.55, depth: 0.5 + Math.random()*0.5 }, scene);
        book.material = bookMat;
        book.position.set(sx + (Math.random()-0.5)*0.3, 1.0 + bi * 1.2, sz);
      }
    }

    // Central table
    const table = BABYLON.MeshBuilder.CreateBox(`nTable_${r}`,
      { width: 4, height: 0.18, depth: 2 }, scene);
    table.position.set(0, 1.05, baseZ + 22);
    table.material = woodMat;
    for (const [tx, tz] of [[-1.6, -0.7], [1.6, -0.7], [-1.6, 0.7], [1.6, 0.7]]) {
      const leg = BABYLON.MeshBuilder.CreateBox(`nTableLeg_${r}_${tx}_${tz}`,
        { width: 0.18, height: 1.05, depth: 0.18 }, scene);
      leg.position.set(tx, 0.52, baseZ + 22 + tz);
      leg.material = woodMat;
    }

    // Two benches
    for (const bz of [baseZ + 8, baseZ + 26]) {
      const bench = BABYLON.MeshBuilder.CreateBox(`nBench_${r}_${bz}`,
        { width: 4.5, height: 0.15, depth: 0.9 }, scene);
      bench.position.set(0, 0.65, bz);
      bench.material = woodMat;
    }

    // Corner barrels
    for (const [bx, bz] of [[-(hw-1.5), baseZ + 3], [(hw-1.5), baseZ + 3]]) {
      for (let bi = 0; bi < 2; bi++) {
        const barrel = BABYLON.MeshBuilder.CreateCylinder(`nBarrel_${r}_${bx}_${bi}`,
          { diameter: 0.9, height: 1.2, tessellation: 10 }, scene);
        barrel.position.set(bx + bi * 1.1, 0.6, bz);
        barrel.material = woodMat;
      }
    }
  }

  // ── Torch ───────────────────────────────────────────────────────────────────
  function _buildTorch(scene, x, y, z, r, ti, side) {
    const postMat = new BABYLON.StandardMaterial(`nTp_${r}_${ti}_${side}`, scene);
    postMat.diffuseColor = new BABYLON.Color3(0.28, 0.22, 0.10);
    const post = BABYLON.MeshBuilder.CreateBox(`nTorch_${r}_${ti}_${side}`,
      { width: 0.15, height: 0.6, depth: 0.15 }, scene);
    post.position.set(x, y, z);
    post.material = postMat;

    const fireMat = new BABYLON.StandardMaterial(`nFire_${r}_${ti}_${side}`, scene);
    fireMat.diffuseColor  = new BABYLON.Color3(0.98, 0.55, 0.08);
    fireMat.emissiveColor = new BABYLON.Color3(0.70, 0.30, 0.02);
    const fire = BABYLON.MeshBuilder.CreateSphere(`nFireM_${r}_${ti}_${side}`,
      { diameter: 0.32, segments: 6 }, scene);
    fire.position.set(x, y + 0.38, z);
    fire.material = fireMat;

    const torchLight = new BABYLON.PointLight(`nTL_${r}_${ti}_${side}`,
      new BABYLON.Vector3(x, y + 0.5, z), scene);
    torchLight.diffuse   = new BABYLON.Color3(1.0, 0.65, 0.25);
    torchLight.intensity = 1.2;
    torchLight.range     = 10;
    torchLights.push({ light: torchLight, baseI: 1.2, offset: Math.random() * Math.PI * 2 });
  }

  // ── Player ──────────────────────────────────────────────────────────────────
  const player = createPlayer(scene);
  player.mesh.position = new BABYLON.Vector3(0, 0.5, NUM_ROOMS * ROOM_LENGTH - 2);
  player.camera.alpha  = Math.PI / 2; // face toward vault (-Z)

  player.camera.radius           = DESIRED_RADIUS;
  player.camera.lowerRadiusLimit = 3;
  player.camera.upperRadiusLimit = 26;
  player.camera.lowerBetaLimit   = 0.3;
  player.camera.upperBetaLimit   = Math.PI / 2.15;

  // ── Order hint ───────────────────────────────────────────────────────────────
  function _showOrderHint() {
    const now = performance.now();
    if (now - _lastOrderHintTime < 2000) return;
    _lastOrderHintTime = now;
    const b = document.createElement("div");
    b.className  = "room-banner order-hint";
    b.textContent = t("numbers.order_hint");
    document.body.appendChild(b);
    setTimeout(() => { if (b.parentNode) b.parentNode.removeChild(b); }, 2500);
  }

  // ── Collect banner ───────────────────────────────────────────────────────────
  function _showCollectBanner(num) {
    const b = document.createElement("div");
    b.className  = "room-banner";
    b.textContent = t("numbers.collected").replace("{n}", num).replace("{c}", collectedNumbers.length).replace("{t}", TARGET_NUMS.length);
    document.body.appendChild(b);
    setTimeout(() => { if (b.parentNode) b.parentNode.removeChild(b); }, 2500);
  }

  // ── Vault UI ─────────────────────────────────────────────────────────────────
  function _showVaultUI() {
    vaultOpen = true;
    overlay.innerHTML = "";
    overlay.classList.add("active");

    const panel = document.createElement("div");
    panel.className = "puzzle-panel";
    panel.style.maxWidth = "580px";

    const title = document.createElement("h2");
    title.textContent = t("numbers.vault_title");
    panel.appendChild(title);

    const sub = document.createElement("p");
    sub.className = "tagline";
    sub.textContent = t("numbers.vault_sub");
    panel.appendChild(sub);

    const hint = document.createElement("p");
    hint.className   = "tagline";
    hint.style.color = "#2980b9";
    hint.textContent = `${t("numbers.vault_hint")} ${HINT_TEXT}`;
    panel.appendChild(hint);

    const selected  = [];
    const tileArea  = document.createElement("div");
    tileArea.className = "word-tiles";
    tileArea.style.gap = "14px";

    const feedback = document.createElement("div");
    feedback.className = "feedback";

    function _refresh() {
      const seq = selected.map(s => s.num).join(" → ");
      feedback.textContent = seq ? `Selected: ${seq}` : "";
      if (selected.length === TARGET_NUMS.length) {
        // Check if ascending
        let ok = true;
        for (let i = 1; i < selected.length; i++) {
          if (selected[i].num <= selected[i-1].num) { ok = false; break; }
        }
        if (ok) {
          feedback.className  = "feedback correct";
          feedback.textContent = t("numbers.correct");
          SoundManager.playCorrect();
          setTimeout(() => _onVaultCorrect(), 800);
        } else {
          feedback.className  = "feedback wrong";
          feedback.textContent = t("numbers.not_asc");
          SoundManager.playWrong();
          selected.forEach(s => { s.btn.disabled = false; s.btn.classList.remove("used"); });
          selected.length = 0;
          feedback.textContent = "";
        }
      }
    }

    // Shuffle buttons
    const shuffled = collectedNumbers.slice().sort(() => Math.random() - 0.5);
    shuffled.forEach(n => {
      const btn = document.createElement("button");
      btn.className  = "btn btn-word";
      btn.textContent = String(n);
      btn.style.minWidth  = "56px";
      btn.style.fontSize  = "1.6rem";
      btn.onclick = () => {
        btn.disabled = true;
        btn.classList.add("used");
        selected.push({ num: n, btn });
        _refresh();
      };
      tileArea.appendChild(btn);
    });

    panel.appendChild(tileArea);
    panel.appendChild(feedback);

    const closeBtn = document.createElement("button");
    closeBtn.className  = "btn btn-primary";
    closeBtn.style.background = "#555";
    closeBtn.textContent = t("puzzle.close");
    closeBtn.onclick = () => { _clearOverlay(); vaultOpen = false; };
    panel.appendChild(closeBtn);

    overlay.appendChild(panel);
  }

  // ── Vault correct ─────────────────────────────────────────────────────────────
  function _onVaultCorrect() {
    crownEarned = true;
    const save = SaveManager.load();
    save.numbersIsland = save.numbersIsland || {};
    save.numbersIsland.crownEarned = true;
    SaveManager.save(save);
    _showVictory();
  }

  // ── Victory ──────────────────────────────────────────────────────────────────
  function _showVictory() {
    overlay.innerHTML = "";
    overlay.classList.add("active");
    spawnConfetti();
    SoundManager.playVictory();

    const panel = document.createElement("div");
    panel.className = "puzzle-panel victory-panel";

    const emoji = document.createElement("span");
    emoji.className   = "victory-emoji";
    emoji.textContent = "🔢👑";
    panel.appendChild(emoji);

    const title = document.createElement("div");
    title.className   = "victory-title";
    title.textContent = `${t("victory.title")} ${puzzleData.name}!`;
    panel.appendChild(title);

    const sub = document.createElement("div");
    sub.className   = "victory-sub";
    sub.textContent = t("numbers.victory_sub");
    panel.appendChild(sub);

    const backBtn = document.createElement("button");
    backBtn.className   = "btn btn-primary";
    backBtn.style.marginTop = "20px";
    backBtn.textContent = t("victory.back");
    backBtn.onclick     = () => { _clearOverlay(); if (typeof onExit === "function") onExit(); };
    panel.appendChild(backBtn);

    overlay.appendChild(panel);
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
        b.mat.emissiveColor.set(0.02 * pulse, 0.25 * pulse, 0.55 * pulse);
        b.mesh.position.y = 0.45 + 0.18 * Math.sin(time * 2.2 + b.offset);
      }

      // Number tile float + collection
      for (const tile of numberTiles) {
        tile.update();
        if (!tile.collected) {
          const dist = BABYLON.Vector3.Distance(
            new BABYLON.Vector3(px, py, pz),
            tile.root.position
          );
          if (dist < 5.0) {
            const nextVal = TARGET_NUMS[collectedNumbers.length];
            if (tile.num !== nextVal) {
              _showOrderHint();
            } else {
              tile.collected = true;
              collectedNumbers.push(tile.num);
              tile.root.setEnabled(false);
              if (tile._light) tile._light.setEnabled(false);
              _showCollectBanner(tile.num);
              SoundManager.playCollect();
              _updateHUD();
              if (collectedNumbers.length === TARGET_NUMS.length && !vaultOpen) {
                setTimeout(() => _showVaultUI(), 800);
              }
            }
          }
        }
      }

      // Vault proximity fallback
      if (!vaultOpen && collectedNumbers.length === TARGET_NUMS.length) {
        const vaultDist = BABYLON.Vector3.Distance(
          new BABYLON.Vector3(px, py, pz), VAULT_POS);
        if (vaultDist < 5.0) _showVaultUI();
      }

      currentRoom = Math.max(0, Math.min(NUM_ROOMS - 1, Math.floor(pz / ROOM_LENGTH)));
      _updateHUD();

      // Camera radius clamp
      const roomBaseZ = currentRoom * ROOM_LENGTH;
      const hw        = ROOM_WIDTH / 2;
      const dBack     = Math.max(0.5, pz - roomBaseZ);
      const dFront    = Math.max(0.5, roomBaseZ + ROOM_LENGTH - pz);
      const dLeft     = Math.max(0.5, px + hw);
      const dRight    = Math.max(0.5, hw - px);
      const safe = Math.min(DESIRED_RADIUS, dBack * 0.85, dFront * 0.85, dLeft * 0.85, dRight * 0.85);
      player.camera.radius = BABYLON.Scalar.Lerp(player.camera.radius, Math.max(3.5, safe), 0.15);
      player.camera.upperRadiusLimit = Math.max(Math.max(3.5, safe) + 2, 8);

      // Exit
      if (pz < -1.5 && typeof onExit === "function") onExit();

    } catch(err) {
      console.error("NumbersCastleScene render error:", err);
    }
  });

  return scene;
}
