/**
 * MathPuzzleUI.js
 * Manages the full-screen puzzle overlay for Math Castle rooms.
 *
 * Public API:
 *   showPuzzle(puzzleData, roomType, onSuccess)
 *   hidePuzzle()
 */

import { spawnConfetti } from "./confetti.js";
import { t } from "../utils/i18n.js";
import { SoundManager } from "../utils/SoundManager.js";

const overlay = document.getElementById("ui-overlay");

/** Remove all children from the overlay and hide it. */
export function hidePuzzle() {
  overlay.innerHTML = "";
  overlay.classList.remove("active");
}

/**
 * Display the appropriate puzzle panel.
 * @param {object}   puzzleData  – one entry from mathPuzzles.js arrays
 * @param {string}   roomType    – "text" | "choice" | "throne"
 * @param {Function} onSuccess   – called after correct answer delay
 */
export function showPuzzle(puzzleData, roomType, onSuccess) {
  overlay.innerHTML = "";
  overlay.classList.add("active");

  const panel = document.createElement("div");
  panel.className = "puzzle-panel";

  // Tagline
  const tagline = document.createElement("p");
  tagline.className = "tagline";
  tagline.textContent = t("puzzle.math.tagline");
  panel.appendChild(tagline);

  // Question text
  const qEl = document.createElement("p");
  qEl.className = "question";
  qEl.textContent = puzzleData.question;
  panel.appendChild(qEl);

  // Feedback area (reused by all types)
  const feedback = document.createElement("p");
  feedback.className = "feedback";
  panel.appendChild(feedback);

  if (roomType === "text") {
    _buildTextInput(panel, puzzleData, feedback, onSuccess);
  } else {
    _buildChoiceButtons(panel, puzzleData, feedback, onSuccess);
  }

  overlay.appendChild(panel);

  // Auto-focus text input if present
  const inp = panel.querySelector(".puzzle-input");
  if (inp) setTimeout(() => inp.focus(), 80);
}

// ─── internal helpers ────────────────────────────────────────────────────────

function _buildTextInput(panel, puzzleData, feedback, onSuccess) {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "puzzle-input";
  input.placeholder = t("puzzle.placeholder");
  input.autocomplete = "off";
  panel.insertBefore(input, feedback);

  const btn = document.createElement("button");
  btn.className = "btn btn-primary";
  btn.textContent = t("puzzle.check");
  panel.appendChild(btn);

  const check = () => {
    const val = input.value.trim();
    if (val === "") return;
    if (val === puzzleData.answer) {
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

function _buildChoiceButtons(panel, puzzleData, feedback, onSuccess) {
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

  panel.insertBefore(grid, feedback);
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
  // Re-trigger animation
  feedback.style.animation = "none";
  requestAnimationFrame(() => { feedback.style.animation = ""; });
}
