# Quaternius Character Assets

Place Quaternius Ultimate Platformer Character `.glb` files here.

## Download

Get free characters from: https://quaternius.com/packs/ultimateplatformer.html

## Expected files

| Filename          | Character ID  | Used for        |
|-------------------|---------------|-----------------|
| `hero.glb`        | `qt_hero`     | Platformer Hero |
| `female.glb`      | `qt_female`   | Heroine         |
| `adventurer.glb`  | `qt_adventurer` | Adventurer    |

## Animation names expected

The character registry expects these animation names inside the GLB:

- `Idle`
- `Walk`
- `Run`
- `Jump`

If the animation names differ in your downloaded GLB, update `src/data/characters.js`
to match the exact names exported from the GLB.

## GLB requirements

- Format: `.glb` (binary GLTF)  
- Scale: roughly 1–2 units tall (the game adjusts via `scale` in `characters.js`)
- Up-axis: Y-up
