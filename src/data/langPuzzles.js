/**
 * langPuzzles.js
 * All language puzzle data for each castle room.
 */

export const langPuzzles = {
  // Room 1 — Spelling (text input, hint shown)
  room1: [
    { word: "CAT",   scrambled: "TAC",   hint: "A furry pet that meows 🐱" },
    { word: "DOG",   scrambled: "GOD",   hint: "A loyal pet that barks 🐶" },
    { word: "SUN",   scrambled: "UNS",   hint: "It shines in the sky ☀️" },
    { word: "BUS",   scrambled: "SUB",   hint: "A big vehicle for school 🚌" },
    { word: "HAT",   scrambled: "TAH",   hint: "You wear it on your head 🎩" }
  ],

  // Room 2 — Word Unscramble (text input)
  room2: [
    { word: "APPLE", scrambled: "PPALE", hint: "A red or green fruit 🍎" },
    { word: "TIGER", scrambled: "TIGRE", hint: "A striped big cat 🐯" },
    { word: "CHAIR", scrambled: "RACHI", hint: "You sit on it 🪑" },
    { word: "BRAVE", scrambled: "VERAB", hint: "Not afraid of anything 💪" },
    { word: "CLOUD", scrambled: "DOLUC", hint: "Fluffy thing in the sky ☁️" }
  ],

  // Room 3 — Fill in the Blank (multiple choice)
  room3: [
    { sentence: "The cat sat on the ___", answer: "mat",    choices: ["mat", "hat", "bat", "rat"] },
    { sentence: "I like to ___ books",    answer: "read",   choices: ["read", "eat", "draw", "sing"] },
    { sentence: "The sun is very ___",    answer: "bright", choices: ["dark", "cold", "bright", "soft"] },
    { sentence: "She ___ to school every day", answer: "walks", choices: ["swims", "flies", "walks", "jumps"] },
    { sentence: "The dog ___ in the garden",   answer: "plays", choices: ["sleeps", "plays", "cooks", "reads"] }
  ],

  // Throne Room — sentence arrangement
  throne: [
    { words: ["the", "shines", "brightly", "sun"],              sentence: "the sun shines brightly" },
    { words: ["loves", "she", "reading", "books"],              sentence: "she loves reading books" },
    { words: ["runs", "fast", "the", "dog"],                    sentence: "the dog runs fast" },
    { words: ["is", "today", "sunny", "it"],                    sentence: "it is sunny today" },
    { words: ["cat", "on", "the", "sits", "mat", "the"],        sentence: "the cat sits on the mat" }
  ]
};
