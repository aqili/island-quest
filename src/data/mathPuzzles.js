/**
 * mathPuzzles.js
 * All math puzzle questions for each castle room.
 * Each room array contains 5 questions; one is picked randomly per attempt.
 */

export const mathPuzzles = {
  // Room 1 — Addition & Subtraction (text input)
  room1: [
    { question: "What is 14 + 27? ➕", answer: "41" },
    { question: "What is 35 + 18? ➕", answer: "53" },
    { question: "What is 50 - 23? ➖", answer: "27" },
    { question: "What is 42 - 17? ➖", answer: "25" },
    { question: "What is 66 + 14? ➕", answer: "80" }
  ],

  // Room 2 — Multiplication (multiple choice)
  room2: [
    { question: "What is 6 × 7? 🌟", answer: "42", choices: ["36", "42", "48", "54"] },
    { question: "What is 8 × 4? 🌟", answer: "32", choices: ["24", "28", "32", "36"] },
    { question: "What is 3 × 9? 🌟", answer: "27", choices: ["21", "24", "27", "30"] },
    { question: "What is 5 × 6? 🌟", answer: "30", choices: ["25", "30", "35", "40"] },
    { question: "What is 7 × 7? 🌟", answer: "49", choices: ["42", "49", "56", "63"] }
  ],

  // Room 3 — Shapes & Counting (multiple choice)
  room3: [
    { question: "How many sides does a hexagon have? 🔷", answer: "6", choices: ["4", "5", "6", "8"] },
    { question: "How many sides does a triangle have? 🔺", answer: "3", choices: ["2", "3", "4", "5"] },
    { question: "How many corners does a square have? ⬛", answer: "4", choices: ["3", "4", "5", "6"] },
    { question: "How many sides does a pentagon have? ⭐", answer: "5", choices: ["4", "5", "6", "7"] },
    { question: "How many sides does an octagon have? 🛑", answer: "8", choices: ["6", "7", "8", "9"] }
  ],

  // Throne Room — rapid-fire mix (multiple choice)
  throne: [
    { question: "What is 9 × 8? 👑", answer: "72", choices: ["63", "72", "81", "90"] },
    { question: "What is 100 - 37? 👑", answer: "63", choices: ["53", "63", "73", "83"] },
    { question: "What is 12 + 29? 👑", answer: "41", choices: ["39", "40", "41", "42"] },
    { question: "How many sides does a rectangle have? 👑", answer: "4", choices: ["3", "4", "5", "6"] },
    { question: "What is 7 × 6? 👑", answer: "42", choices: ["36", "42", "48", "54"] }
  ]
};
