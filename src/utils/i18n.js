/**
 * i18n.js
 * Simple bilingual support: English & Arabic.
 * Usage: import { t, setLang, getLang } from './i18n.js';
 *        t('hud.respawn') → "Respawn" or "العودة"
 */

const strings = {
  en: {
    "loading.title":       "Island Quest",
    "loading.subtitle":    "Loading your adventure… please wait!",
    "hud.respawn":         "🏠 Respawn",
    "hud.ocean":           "🌊 Open Ocean",
    "hud.math":            "🔢 Math Island",
    "hud.lang":            "🔠 Language Island",
    "hud.letters":         "🔤 Letters Island",
    "hud.numbers":         "🔢 Numbers Island",
    "btn.lang":            "عربي",
    "controls.move":       "WASD — Move",
    "controls.jump":       "Space — Jump",
    "controls.rotcam":     "← → — Rotate camera",
    "controls.tiltcam":    "↑ ↓ — Tilt camera",
    "puzzle.collect":      "Collect the letters in alphabetical order!",
    "puzzle.num_order":    "Collect the numbers in ascending order!",
    "puzzle.hint_lbl":     "Hint:",
    "puzzle.close":        "Close",
    "puzzle.check":        "✔ Check",
    "puzzle.correct":      "🎉 Correct!",
    "puzzle.wrong":        "❌ Not quite — try again!",
    "victory.title":       "Amazing!",
    "victory.sub":         "You earned a crown!",
    "victory.back":        "🌍 Back to World",
    "assembly.title":      "Spell the Word!",
    "assembly.hint_lbl":   "Hint:",
    "numbers.title":       "Arrange the Numbers!",
    "numbers.instruction": "Click the numbers from smallest to largest.",
    "numbers.correct":     "🎉 Perfect order!",
    "numbers.wrong":       "❌ Wrong order — try again!",
  },
  ar: {
    "loading.title":       "مغامرة الجزيرة",
    "loading.subtitle":    "جارٍ التحميل... يرجى الانتظار!",
    "hud.respawn":         "🏠 العودة",
    "hud.ocean":           "🌊 البحر المفتوح",
    "hud.math":            "🔢 جزيرة الرياضيات",
    "hud.lang":            "🔠 جزيرة اللغة",
    "hud.letters":         "🔤 جزيرة الحروف",
    "hud.numbers":         "🔢 جزيرة الأرقام",
    "btn.lang":            "English",
    "controls.move":       "WASD — تحرك",
    "controls.jump":       "مسافة — قفز",
    "controls.rotcam":     "← → — دوران الكاميرا",
    "controls.tiltcam":    "↑ ↓ — إمالة الكاميرا",
    "puzzle.collect":      "اجمع الحروف بالترتيب الأبجدي!",
    "puzzle.num_order":    "اجمع الأرقام من الأصغر إلى الأكبر!",
    "puzzle.hint_lbl":     "تلميح:",
    "puzzle.close":        "إغلاق",
    "puzzle.check":        "✔ تحقق",
    "puzzle.correct":      "🎉 صحيح!",
    "puzzle.wrong":        "❌ ليس تماماً — حاول مجدداً!",
    "victory.title":       "رائع!",
    "victory.sub":         "لقد حصلت على تاج!",
    "victory.back":        "🌍 العودة للعالم",
    "assembly.title":      "هجّئ الكلمة!",
    "assembly.hint_lbl":   "تلميح:",
    "numbers.title":       "رتّب الأرقام!",
    "numbers.instruction": "اضغط على الأرقام من الأصغر إلى الأكبر.",
    "numbers.correct":     "🎉 ترتيب صحيح!",
    "numbers.wrong":       "❌ ترتيب خاطئ — حاول مجدداً!",
  }
};

let _current = "en";

export function setLang(lang) {
  _current = lang;
  // Apply dir + lang to document
  document.documentElement.lang = lang;
  document.documentElement.dir  = lang === "ar" ? "rtl" : "ltr";
  // Re-render any elements that store their key in data-i18n
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    el.textContent = t(key);
  });
  // Persist choice
  try { localStorage.setItem("iq_lang", lang); } catch(e) {}
}

export function getLang() { return _current; }

export function t(key) {
  return (strings[_current] && strings[_current][key]) ||
         (strings["en"][key]) ||
         key;
}

/** Call once on startup to restore saved language preference. */
export function initI18n() {
  try {
    const saved = localStorage.getItem("iq_lang");
    if (saved) setLang(saved);
  } catch(e) {}
}
