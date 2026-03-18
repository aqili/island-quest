/**
 * SaveManager.js
 * Thin wrapper around localStorage for persisting game progress.
 * No backend required — works 100% client-side.
 */

const SAVE_KEY = "islandQuestSave";

const DEFAULT_SAVE = {
  mathIsland:     { roomsCompleted: [false, false, false, false], crownEarned: false },
  languageIsland: { roomsCompleted: [false, false, false, false], crownEarned: false },
  lettersIsland:  { crownEarned: false },
  numbersIsland:   { crownEarned: false }
};

export const SaveManager = {
  /** Load saved data from localStorage, or return fresh defaults. */
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT_SAVE));
      const parsed = JSON.parse(raw);
      // Merge defaults for backward compatibility (new islands added later)
      const merged = JSON.parse(JSON.stringify(DEFAULT_SAVE));
      for (const key of Object.keys(parsed)) {
        merged[key] = Object.assign(merged[key] || {}, parsed[key]);
      }
      return merged;
    } catch {
      return JSON.parse(JSON.stringify(DEFAULT_SAVE));
    }
  },

  /** Persist the given save object to localStorage. */
  save(data) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("SaveManager: could not write to localStorage", e);
    }
  },

  /**
   * Mark a specific room as completed and persist.
   * @param {"mathIsland"|"languageIsland"} island
   * @param {number} roomIndex  0-based index (0 = Room1, 3 = Throne)
   */
  markRoomComplete(island, roomIndex) {
    const data = this.load();
    data[island].roomsCompleted[roomIndex] = true;
    this.save(data);
  },

  /**
   * Mark an island crown as earned and persist.
   * @param {"mathIsland"|"languageIsland"} island
   */
  earnCrown(island) {
    const data = this.load();
    data[island].crownEarned = true;
    this.save(data);
  },

  /**
   * Returns true when the player is allowed to enter the given room.
   * Room 0 is always unlocked; room N requires room N-1 to be complete.
   * @param {"mathIsland"|"languageIsland"} island
   * @param {number} roomIndex
   */
  isRoomUnlocked(island, roomIndex) {
    if (roomIndex === 0) return true;
    const data = this.load();
    return data[island].roomsCompleted[roomIndex - 1] === true;
  },

  /** Clear all progress and reset to defaults. */
  reset() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {
      console.warn("SaveManager: could not reset localStorage", e);
    }
  }
};
