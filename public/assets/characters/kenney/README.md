# Kenney Character Assets

Place Kenney Animated Characters `.glb` files here.

## Download

Get free characters from: https://www.kenney.nl/assets/animated-characters

## Expected files

| Filename      | Character ID | Used for        |
|---------------|--------------|-----------------|
| `robot.glb`   | `kn_robot`   | Robot explorer  |
| `alien.glb`   | `kn_alien`   | Alien adventurer|
| `knight.glb`  | `kn_knight`  | Knight character|

## NPC usage

The first 3 Kenney characters are also placed as **decorative NPCs** on each
island.  They play their `Idle` animation and do not move or interact.

## Animation names expected

- `Idle`
- `Walk`
- `Run`
- `Jump`

If the animation names differ, update `src/data/characters.js`.

## GLB requirements

- Format: `.glb` (binary GLTF)
- Scale: roughly 1–2 units tall
- Up-axis: Y-up
