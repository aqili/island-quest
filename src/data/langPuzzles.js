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
    { word: "HAT",   scrambled: "TAH",   hint: "You wear it on your head 🎩" },
    { word: "CUP",   scrambled: "PUC",   hint: "You drink from it ☕" },
    { word: "BED",   scrambled: "DEB",   hint: "You sleep on it 🛏️" },
    { word: "PIG",   scrambled: "GIP",   hint: "A pink farm animal 🐷" },
    { word: "MAP",   scrambled: "PAM",   hint: "Shows you where to go 🗺️" },
    { word: "JAM",   scrambled: "MAJ",   hint: "Spread it on toast 🍞" },
    { word: "FOX",   scrambled: "XOF",   hint: "A clever wild animal 🦊" },
    { word: "PEN",   scrambled: "NEP",   hint: "You write with it ✏️" },
    { word: "BAT",   scrambled: "TAB",   hint: "It flies at night 🦇" },
    { word: "NET",   scrambled: "TEN",   hint: "Used to catch fish 🥅" },
    { word: "RUG",   scrambled: "GUR",   hint: "Soft mat on the floor 🟫" }
  ],

  // Room 2 — Word Unscramble (text input)
  room2: [
    { word: "APPLE", scrambled: "PPALE", hint: "A red or green fruit 🍎" },
    { word: "TIGER", scrambled: "TIGRE", hint: "A striped big cat 🐯" },
    { word: "CHAIR", scrambled: "RACHI", hint: "You sit on it 🪑" },
    { word: "BRAVE", scrambled: "VERAB", hint: "Not afraid of anything 💪" },
    { word: "CLOUD", scrambled: "DOLUC", hint: "Fluffy thing in the sky ☁️" },
    { word: "HAPPY", scrambled: "PHAPY", hint: "Feeling great and joyful 😊" },
    { word: "OCEAN", scrambled: "CANOE", hint: "A vast body of salt water 🌊" },
    { word: "GRAPE", scrambled: "PAGER", hint: "A small purple fruit 🍇" },
    { word: "HORSE", scrambled: "SHORE", hint: "A large animal you can ride 🐴" },
    { word: "BREAD", scrambled: "DEBAR", hint: "Baked food for sandwiches 🍞" },
    { word: "FLAME", scrambled: "FLEAM", hint: "A bright tongue of fire 🔥" },
    { word: "PLANT", scrambled: "PLNAT", hint: "It grows from a seed 🌱" },
    { word: "LIGHT", scrambled: "THILG", hint: "The opposite of dark 💡" },
    { word: "WATER", scrambled: "TAWER", hint: "You drink it every day 💧" },
    { word: "DREAM", scrambled: "ARMED", hint: "Something you see when asleep 💤" }
  ],

  // Room 3 — Fill in the Blank (multiple choice)
  room3: [
    { sentence: "The cat sat on the ___", answer: "mat",    choices: ["mat", "hat", "bat", "rat"] },
    { sentence: "I like to ___ books",    answer: "read",   choices: ["read", "eat", "draw", "sing"] },
    { sentence: "The sun is very ___",    answer: "bright", choices: ["dark", "cold", "bright", "soft"] },
    { sentence: "She ___ to school every day", answer: "walks", choices: ["swims", "flies", "walks", "jumps"] },
    { sentence: "The dog ___ in the garden",   answer: "plays", choices: ["sleeps", "plays", "cooks", "reads"] },
    { sentence: "The bird can ___ high",       answer: "fly",   choices: ["swim", "fly", "dig", "run"] },
    { sentence: "I ___ my teeth every morning", answer: "brush", choices: ["wash", "cut", "brush", "paint"] },
    { sentence: "The baby is ___ in the crib",  answer: "sleeping", choices: ["cooking", "sleeping", "driving", "reading"] },
    { sentence: "We eat ___ for breakfast",     answer: "cereal",   choices: ["dinner", "cereal", "lunch", "shoes"] },
    { sentence: "Fish live in the ___",         answer: "water",    choices: ["sky", "water", "sand", "tree"] },
    { sentence: "You use a ___ to cut paper",   answer: "scissors", choices: ["fork", "spoon", "scissors", "pillow"] },
    { sentence: "The ___ shines at night",      answer: "moon",     choices: ["sun", "rain", "moon", "wind"] },
    { sentence: "A ___ has four legs and barks", answer: "dog",     choices: ["fish", "bird", "cat", "dog"] },
    { sentence: "Ice cream is very ___",         answer: "cold",    choices: ["hot", "cold", "loud", "fast"] },
    { sentence: "We use an ___ to keep dry",     answer: "umbrella", choices: ["umbrella", "oven", "chair", "apple"] }
  ],

  // Throne Room — sentence arrangement
  throne: [
    { words: ["the", "shines", "brightly", "sun"],              sentence: "the sun shines brightly" },
    { words: ["loves", "she", "reading", "books"],              sentence: "she loves reading books" },
    { words: ["runs", "fast", "the", "dog"],                    sentence: "the dog runs fast" },
    { words: ["is", "today", "sunny", "it"],                    sentence: "it is sunny today" },
    { words: ["cat", "on", "the", "sits", "mat", "the"],        sentence: "the cat sits on the mat" },
    { words: ["birds", "the", "sing", "morning", "in", "the"],   sentence: "the birds sing in the morning" },
    { words: ["is", "my", "teacher", "kind", "very"],            sentence: "my teacher is very kind" },
    { words: ["we", "park", "the", "play", "in"],                sentence: "we play in the park" },
    { words: ["flowers", "the", "beautiful", "are"],             sentence: "the flowers are beautiful" },
    { words: ["likes", "he", "ice", "cream", "eating"],          sentence: "he likes eating ice cream" },
    { words: ["the", "blue", "sky", "is"],                       sentence: "the sky is blue" },
    { words: ["a", "rabbit", "hops", "in", "the", "garden"],     sentence: "a rabbit hops in the garden" },
    { words: ["stars", "at", "the", "twinkle", "night"],         sentence: "the stars twinkle at night" }
  ]
};
