/**
 * LangPuzzleUI.js
 * Manages the full-screen puzzle overlay for Language Castle rooms.
 *
 * Public API:
 *   showPuzzle(puzzleData, roomType, onSuccess)
 *   hidePuzzle()
 */

import { spawnConfetti } from "./confetti.js";
import { t } from "../utils/i18n.js";
import { SoundManager } from "../utils/SoundManager.js";

const overlay = document.getElementById("ui-overlay");

export function hidePuzzle() {
  overlay.innerHTML = "";
  overlay.classList.remove("active");
}

/**
 * @param {object}   puzzleData
 * @param {string}   roomType   "spelling" | "unscramble" | "fillblank" | "throne"
 * @param {Function} onSuccess
 */
export function showPuzzle(puzzleData, roomType, onSuccess) {
  overlay.innerHTML = "";
  overlay.classList.add("active");

  const panel = document.createElement("div");
  panel.className = "puzzle-panel";

  const tagline = document.createElement("p");
  tagline.className = "tagline";
  tagline.textContent = t("puzzle.lang.tagline");
  panel.appendChild(tagline);

  const feedback = document.createElement("p");
  feedback.className = "feedback";

  if (roomType === "spelling") {
    _buildSpelling(panel, puzzleData, feedback, onSuccess);
  } else if (roomType === "unscramble") {
    _buildUnscramble(panel, puzzleData, feedback, onSuccess);
  } else if (roomType === "fillblank") {
    _buildFillBlank(panel, puzzleData, feedback, onSuccess);
  } else if (roomType === "throne") {
    _buildThrone(panel, puzzleData, feedback, onSuccess);
  }

  panel.appendChild(feedback);
  overlay.appendChild(panel);

  const inp = panel.querySelector(".puzzle-input");
  if (inp) setTimeout(() => inp.focus(), 80);
}

// ─── Room 1: Spelling ────────────────────────────────────────────────────────

function _buildSpelling(panel, puzzleData, feedback, onSuccess) {
  const hint = document.createElement("p");
  hint.className = "question";
  hint.textContent = puzzleData.hint;
  panel.appendChild(hint);

  const scrambled = document.createElement("p");
  scrambled.className = "scrambled-hint";
  scrambled.textContent = t("puzzle.scrambled_lbl") + " " + puzzleData.scrambled;
  panel.appendChild(scrambled);

  _attachTextInput(panel, puzzleData.word, feedback, onSuccess);
}

// ─── Room 2: Unscramble ──────────────────────────────────────────────────────

function _buildUnscramble(panel, puzzleData, feedback, onSuccess) {
  const qEl = document.createElement("p");
  qEl.className = "question";
  qEl.textContent = t("puzzle.unscramble_title");
  panel.appendChild(qEl);

  const scrambled = document.createElement("p");
  scrambled.className = "scrambled-hint";
  scrambled.textContent = puzzleData.scrambled;
  panel.appendChild(scrambled);

  const sub = document.createElement("p");
  sub.style.cssText = "color:#7f8c8d;font-size:1rem;margin-bottom:12px;";
  sub.textContent = t("puzzle.hint_lbl") + " " + puzzleData.hint;
  panel.appendChild(sub);

  _attachTextInput(panel, puzzleData.word, feedback, onSuccess);
}

// ─── Room 3: Fill in the Blank ───────────────────────────────────────────────

function _buildFillBlank(panel, puzzleData, feedback, onSuccess) {
  const qEl = document.createElement("p");
  qEl.className = "question";
  qEl.textContent = puzzleData.sentence;
  panel.appendChild(qEl);

  const grid = document.createElement("div");
  grid.className = "choices-grid";

  puzzleData.choices.forEach((choice) => {
    const btn = document.createElement("button");
    btn.className = "btn btn-choice";
    btn.textContent = choice;
    btn.addEventListener("click", () => {
      if (choice === puzzleData.answer) {
        _showCorrect(feedback, onSuccess);
        grid.querySelectorAll("button").forEach(b => (b.disabled = true));
      } else {
        _showWrong(feedback);
      }
    });
    grid.appendChild(btn);
  });

  panel.appendChild(grid);
}

// ─── Throne Room: Sentence Arrangement ───────────────────────────────────────

function _buildThrone(panel, puzzleData, feedback, onSuccess) {
  const title = document.createElement("p");
  title.className = "question";
  title.textContent = t("puzzle.arrange_title");
  panel.appendChild(title);

  // Sentence builder display
  const builder = document.createElement("div");
  builder.className = "sentence-builder";
  panel.appendChild(builder);

  // Track which words have been placed
  const placed = [];

  // Shuffled word tiles
  const shuffled = [...puzzleData.words].sort(() => Math.random() - 0.5);
  const tilesWrap = document.createElement("div");
  tilesWrap.className = "word-tiles";

  shuffled.forEach((word) => {
    const btn = document.createElement("button");
    btn.className = "btn btn-word";
    btn.textContent = word;
    btn.addEventListener("click", () => {
      if (btn.classList.contains("used")) return;
      btn.classList.add("used");
      placed.push(word);
      // Add word to builder as a clickable chip (click to remove)
      const chip = document.createElement("span");
      chip.className = "sentence-word";
      chip.textContent = word;
      chip.addEventListener("click", () => {
        placed.splice(placed.indexOf(word), 1);
        chip.remove();
        btn.classList.remove("used");
      });
      builder.appendChild(chip);
    });
    tilesWrap.appendChild(btn);
  });

  panel.appendChild(tilesWrap);

  // Check button
  const checkBtn = document.createElement("button");
  checkBtn.className = "btn btn-primary";
  checkBtn.textContent = t("puzzle.check_sentence");
  panel.appendChild(checkBtn);

  checkBtn.addEventListener("click", () => {
    const attempt = placed.join(" ").toLowerCase().trim();
    if (attempt === puzzleData.sentence.toLowerCase().trim()) {
      _showCorrect(feedback, onSuccess);
    } else {
      _showWrong(feedback);
    }
  });
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function _attachTextInput(panel, correctWord, feedback, onSuccess) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "puzzle-input";
  input.placeholder = t("puzzle.placeholder_word");
  input.autocomplete = "off";
  panel.appendChild(input);

  const btn = document.createElement("button");
  btn.className = "btn btn-primary";
  btn.textContent = t("puzzle.check");
  panel.appendChild(btn);

  const check = () => {
    const val = input.value.trim().toUpperCase();
    if (val === "") return;
    if (val === correctWord.toUpperCase()) {
      _showCorrect(feedback, onSuccess);
    } else {
      _showWrong(feedback);
      input.value = "";
      input.focus();
    }
  };

  btn.addEventListener("click", check);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") check(); });
}

function _showCorrect(feedback, onSuccess) {
  feedback.textContent = t("puzzle.correct");
  feedback.className = "feedback correct";
  spawnConfetti();
  SoundManager.playCorrect();
  setTimeout(() => {
    hidePuzzle();
    onSuccess();
  }, 1500);
}

function _showWrong(feedback) {
  feedback.textContent = t("puzzle.wrong");
  feedback.className = "feedback wrong";
  SoundManager.playWrong();
  feedback.style.animation = "none";
  requestAnimationFrame(() => { feedback.style.animation = ""; });
}
