# Kenney Animated Characters 3 Assets

CC0 — free for any use. Source: https://www.kenney.nl/assets/animated-characters-3

## Source pack

`C:\Users\iogaili\Downloads\kenney_animated-characters-3`

- 1 mesh: `characterMedium.fbx`
- 4 skins: `humanMaleA.png`, `humanFemaleA.png`, `zombieMaleA.png`, `zombieFemaleA.png`
- 3 animations: `idle.fbx`, `jump.fbx`, `run.fbx` (2-frame looping poses)

## Generated GLB files (embedded textures + animations)

| Filename | Character ID | Description |
|---|---|---|
| `humanMale.glb` | `kn_humanMale` | Adventurer (human male) |
| `humanFemale.glb` | `kn_humanFemale` | Heroine (human female) |
| `zombieMale.glb` | `kn_zombieMale` | Zombie (male) |
| `zombieFemale.glb` | `kn_zombieFemale` | Zombie Girl (female) |

## How GLBs were generated

```
blender --background --python scripts/convert_kenney.py
```

Requires Blender 4.x portable at:
`C:\Users\iogaili\AppData\Local\blender-portable\blender.exe`

## Animation names (in each GLB)

| Clip name | Frames | Usage |
|---|---|---|
| `idle` | 2 | standing still |
| `jump` | 2 | jump pose |
| `run` | 2 | run pose (also used for walk) |

## Scale note

Characters export at roughly 1.7 units tall (Y-up, meters).
`scale: 1.0` in `characters.js` is correct.
If they appear too big or small, adjust the `scale` field in `src/data/characters.js`.

