/**
 * confetti.js
 * Lightweight CSS-only confetti burst. No external dependency.
 * Exported so both MathPuzzleUI and LangPuzzleUI can call it.
 */

const COLORS = ["#f39c12", "#e74c3c", "#2ecc71", "#3498db", "#9b59b6", "#1abc9c", "#e91e63"];

/**
 * Spawn a burst of confetti pieces that fall off-screen, then self-clean.
 * @param {number} count  number of pieces (default 60)
 */
export function spawnConfetti(count = 60) {
  const wrap = document.createElement("div");
  wrap.className = "confetti-wrap";
  document.body.appendChild(wrap);

  for (let i = 0; i < count; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left     = `${Math.random() * 100}vw`;
    piece.style.background = COLORS[Math.floor(Math.random() * COLORS.length)];
    piece.style.width    = `${6 + Math.random() * 10}px`;
    piece.style.height   = `${8 + Math.random() * 12}px`;
    piece.style.animationDuration  = `${1.5 + Math.random() * 1.5}s`;
    piece.style.animationDelay    = `${Math.random() * 0.5}s`;
    wrap.appendChild(piece);
  }

  // Remove the whole wrapper once all pieces have fallen (longest possible = 3 s + 0.5 s delay)
  setTimeout(() => wrap.remove(), 4000);
}
