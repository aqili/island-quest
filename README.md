# 🏝️ Island Quest

A **3D browser-based educational adventure game** for kids aged **6–12**. Explore a beautiful ocean world, walk to two islands, enter their castles, and solve puzzles in each room to earn a crown!

---

## 🎮 How to Play

| Control | Action |
|---|---|
| **W / ↑** | Move forward |
| **S / ↓** | Move backward |
| **A / ←** | Move left |
| **D / →** | Move right |
| **Mouse drag** | Rotate camera |
| **Mouse wheel** | Zoom in / out |

## 📱 Mobile Controls

| Control | Action |
|---|---|
| **Virtual Joystick** (bottom-left) | Move player |
| **Drag on screen** | Rotate camera |
| **Pinch** | Zoom in / out |

### Goal
1. Walk across the ocean to **Math Island** or **Language Island**
2. Enter the castle and walk toward each door
3. Solve the puzzle to unlock the door and move to the next room
4. Reach the **Throne Room** and complete the final challenge to earn the 👑 Crown!

---

## 🔢 Math Island — Castle Rooms

| Room | Puzzle Type |
|---|---|
| Room 1 | Addition & Subtraction (type the answer) |
| Room 2 | Multiplication (4-choice quiz) |
| Room 3 | Shapes & Counting (4-choice quiz) |
| 👑 Throne | 3 rapid-fire questions — earn the **Math Crown**! |

## 🔤 Language Island — Castle Rooms

| Room | Puzzle Type |
|---|---|
| Room 1 | Spelling (type the word from a scrambled hint) |
| Room 2 | Word Unscramble (type the correct word) |
| Room 3 | Fill in the Blank (4-choice quiz) |
| 👑 Throne | Arrange words into a sentence — earn the **Language Crown**! |

---

## 💾 Progress

All progress is saved automatically using your browser's `localStorage`. No account or internet connection required after the page loads.

---

## 🚀 Running Locally

Just open `index.html` in any modern browser — **no install, no build step needed**!

```bash
# Option 1: Open directly
open index.html

# Option 2: Use a local server (recommended for module imports)
npx serve .
# then visit http://localhost:3000
```

> **Tip**: Some browsers block ES6 modules on `file://` URLs. If the game doesn't load, use a local server with `npx serve .` or VS Code Live Server.

---

## ☁️ Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository
3. **No configuration needed** — Vercel auto-detects the static site
4. Click **Deploy**! 🚀

The included `vercel.json` handles all routing automatically.

---

## 🛠️ Tech Stack

| Purpose | Technology |
|---|---|
| 3D Engine | [Babylon.js](https://www.babylonjs.com/) via CDN |
| Language | Vanilla JavaScript (ES6 modules) |
| Styling | CSS3 (Fredoka One font, kid-friendly UI) |
| Hosting | Vercel (static, no backend) |
| Save System | `localStorage` |

---

## 📁 File Structure

```
island-quest/
├── index.html                  # Entry point
├── vercel.json                 # Vercel static hosting config
├── styles/
│   └── main.css                # Global kid-friendly styles
└── src/
    ├── main.js                 # Engine init + scene manager
    ├── scenes/
    │   ├── WorldScene.js       # Ocean + 2 islands overworld
    │   ├── MathCastleScene.js  # Math castle + 4 puzzle rooms
    │   └── LangCastleScene.js  # Language castle + 4 puzzle rooms
    ├── entities/
    │   └── Player.js           # Player mesh + WASD + joystick movement + camera
    ├── puzzles/
    │   ├── MathPuzzleUI.js     # Math puzzle overlay UI
    │   ├── LangPuzzleUI.js     # Language puzzle overlay UI
    │   └── confetti.js         # CSS confetti celebration effect
    ├── data/
    │   ├── mathPuzzles.js      # Math questions data
    │   └── langPuzzles.js      # Language questions data
    ├── ui/
    │   └── VirtualJoystick.js  # Mobile touch joystick
    └── utils/
        └── SaveManager.js      # localStorage save/load
```

---

## 📸 Screenshot

*Coming soon — deploy to Vercel and add your screenshot here!*

---

## 🎨 Kid-Friendly Design

- **Font**: Fredoka One (Google Fonts) — bubbly and easy to read
- **Colors**: Bright yellows, greens, pinks, purples
- **Feedback**: 🎉 Confetti + green flash for correct answers; red shake for wrong
- **Encouragement**: "You can do it! 🌟", "Try Again! 💪"
- **Victory**: Crown emoji + bounce animation + color flash