// frontend/src/lib/i18n.js — English / Arabic.
// Screens are written in English and every visible string goes through t().
// The Arabic dictionary (ar.js) maps each English string to its Arabic text; anything
// missing falls back to English. Switching language saves the choice and reloads the
// app so every screen, label, number and date picks it up at once (Arabic is right-to-left).
import AR from './ar';

const KEY = 'propos_lang';
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };

export const lang = read() === 'ar' ? 'ar' : 'en';
export const isAr = lang === 'ar';

if (typeof document !== 'undefined') {
  document.documentElement.lang = lang;
  document.documentElement.dir = isAr ? 'rtl' : 'ltr';
}

// t('Hello') or t('{0} of {1}', [a, b]) / t('Hi {name}', { name })
export function t(text, vars) {
  let s = isAr && AR[text] !== undefined ? AR[text] : text;
  if (vars !== undefined) {
    const v = Array.isArray(vars) || typeof vars === 'object' ? vars : [vars];
    s = s.replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined && v[k] !== null ? v[k] : ''));
  }
  return s;
}

export function setLang(next) {
  try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
  window.location.reload();
}

// Locale for numbers and dates: Arabic text with Western digits, as used in UAE business
export const locale = isAr ? 'ar-AE-u-nu-latn' : 'en-GB';
