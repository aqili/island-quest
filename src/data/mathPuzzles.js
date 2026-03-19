/**
 * mathPuzzles.js
 * All math puzzle questions for each castle room.
 * Each room array contains questions; one is picked randomly per attempt.
 */

export const mathPuzzles = {
  // Room 1 — Addition & Subtraction (text input)
  room1: [
    { question: "What is 14 + 27? ➕", answer: "41" },
    { question: "What is 35 + 18? ➕", answer: "53" },
    { question: "What is 50 - 23? ➖", answer: "27" },
    { question: "What is 42 - 17? ➖", answer: "25" },
    { question: "What is 66 + 14? ➕", answer: "80" },
    { question: "What is 29 + 34? ➕", answer: "63" },
    { question: "What is 81 - 46? ➖", answer: "35" },
    { question: "What is 17 + 55? ➕", answer: "72" },
    { question: "What is 90 - 38? ➖", answer: "52" },
    { question: "What is 23 + 49? ➕", answer: "72" },
    { question: "What is 75 - 28? ➖", answer: "47" },
    { question: "What is 44 + 37? ➕", answer: "81" },
    { question: "What is 60 - 15? ➖", answer: "45" },
    { question: "What is 38 + 26? ➕", answer: "64" },
    { question: "What is 93 - 57? ➖", answer: "36" }
  ],

  // Room 2 — Multiplication (multiple choice)
  room2: [
    { question: "What is 6 × 7? 🌟", answer: "42", choices: ["36", "42", "48", "54"] },
    { question: "What is 8 × 4? 🌟", answer: "32", choices: ["24", "28", "32", "36"] },
    { question: "What is 3 × 9? 🌟", answer: "27", choices: ["21", "24", "27", "30"] },
    { question: "What is 5 × 6? 🌟", answer: "30", choices: ["25", "30", "35", "40"] },
    { question: "What is 7 × 7? 🌟", answer: "49", choices: ["42", "49", "56", "63"] },
    { question: "What is 4 × 9? 🌟", answer: "36", choices: ["32", "36", "40", "44"] },
    { question: "What is 8 × 6? 🌟", answer: "48", choices: ["42", "44", "48", "52"] },
    { question: "What is 9 × 5? 🌟", answer: "45", choices: ["35", "40", "45", "50"] },
    { question: "What is 7 × 8? 🌟", answer: "56", choices: ["48", "54", "56", "64"] },
    { question: "What is 6 × 6? 🌟", answer: "36", choices: ["30", "32", "36", "42"] },
    { question: "What is 12 × 3? 🌟", answer: "36", choices: ["33", "36", "39", "42"] },
    { question: "What is 11 × 4? 🌟", answer: "44", choices: ["40", "42", "44", "48"] },
    { question: "What is 9 × 9? 🌟", answer: "81", choices: ["72", "79", "81", "90"] },
    { question: "What is 3 × 8? 🌟", answer: "24", choices: ["18", "21", "24", "27"] },
    { question: "What is 7 × 5? 🌟", answer: "35", choices: ["30", "33", "35", "40"] }
  ],

  // Room 3 — Shapes & Counting (multiple choice)
  room3: [
    { question: "How many sides does a hexagon have? 🔷", answer: "6", choices: ["4", "5", "6", "8"] },
    { question: "How many sides does a triangle have? 🔺", answer: "3", choices: ["2", "3", "4", "5"] },
    { question: "How many corners does a square have? ⬛", answer: "4", choices: ["3", "4", "5", "6"] },
    { question: "How many sides does a pentagon have? ⭐", answer: "5", choices: ["4", "5", "6", "7"] },
    { question: "How many sides does an octagon have? 🛑", answer: "8", choices: ["6", "7", "8", "9"] },
    { question: "How many faces does a cube have? 🧊", answer: "6", choices: ["4", "6", "8", "12"] },
    { question: "How many edges does a triangle have? 🔺", answer: "3", choices: ["2", "3", "4", "6"] },
    { question: "How many sides does a decagon have? 🔟", answer: "10", choices: ["8", "9", "10", "12"] },
    { question: "How many corners does a hexagon have? 🔷", answer: "6", choices: ["4", "5", "6", "8"] },
    { question: "How many sides does a circle have? ⭕", answer: "0", choices: ["0", "1", "2", "4"] },
    { question: "How many faces does a pyramid have? 🔺", answer: "5", choices: ["3", "4", "5", "6"] },
    { question: "How many right angles in a rectangle? 📐", answer: "4", choices: ["2", "3", "4", "6"] },
    { question: "How many lines of symmetry in a square? ⬛", answer: "4", choices: ["2", "3", "4", "8"] }
  ],

  // Throne Room — rapid-fire mix (multiple choice)
  throne: [
    { question: "What is 9 × 8? 👑", answer: "72", choices: ["63", "72", "81", "90"] },
    { question: "What is 100 - 37? 👑", answer: "63", choices: ["53", "63", "73", "83"] },
    { question: "What is 12 + 29? 👑", answer: "41", choices: ["39", "40", "41", "42"] },
    { question: "How many sides does a rectangle have? 👑", answer: "4", choices: ["3", "4", "5", "6"] },
    { question: "What is 7 × 6? 👑", answer: "42", choices: ["36", "42", "48", "54"] },
    { question: "What is 125 - 68? 👑", answer: "57", choices: ["47", "53", "57", "67"] },
    { question: "What is 8 × 8? 👑", answer: "64", choices: ["56", "62", "64", "72"] },
    { question: "What is 45 + 67? 👑", answer: "112", choices: ["102", "110", "112", "122"] },
    { question: "What is 11 × 7? 👑", answer: "77", choices: ["66", "70", "77", "84"] },
    { question: "What is 200 - 85? 👑", answer: "115", choices: ["105", "110", "115", "125"] },
    { question: "What is 15 × 4? 👑", answer: "60", choices: ["45", "55", "60", "75"] },
    { question: "How many edges does a cube have? 👑", answer: "12", choices: ["6", "8", "10", "12"] },
    { question: "What is 56 + 78? 👑", answer: "134", choices: ["124", "130", "134", "144"] }
  ]
};
