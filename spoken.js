// Finds scripture references in transcribed speech, e.g. "John three sixteen", "Romans chapter 8 verse 28",
// "first Corinthians thirteen", "Psalm one hundred and nineteen verse 105", "John 3:16".
import { BOOKS } from './plan.js';
import { findBook } from './nav.js';

const UNITS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
const TEENS = { ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const ORDINAL = { first: '1', second: '2', third: '3', '1st': '1', '2nd': '2', '3rd': '3', i: '1', ii: '2', iii: '3' };

// "three sixteen" → "3 16"; "twenty eight" → "28"; "one hundred and nineteen" → "119".
export function wordsToDigits(text) {
  const words = text.toLowerCase().replace(/[^a-z0-9:\s-]/g, ' ').replace(/-/g, ' ').split(/\s+/).filter(Boolean);
  const out = [];
  let n = null; // number being built
  let lastKind = null; // 'unit' | 'teen' | 'tens' | 'hundred'
  const flush = () => { if (n !== null) out.push(String(n)); n = null; lastKind = null; };
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w in UNITS) {
      if (n !== null && (lastKind === 'tens' || lastKind === 'hundred')) { n += UNITS[w]; lastKind = 'unit'; }
      else { flush(); n = UNITS[w]; lastKind = 'unit'; }
    } else if (w in TEENS) {
      if (n !== null && lastKind === 'hundred') { n += TEENS[w]; lastKind = 'teen'; }
      else { flush(); n = TEENS[w]; lastKind = 'teen'; }
    } else if (w in TENS) {
      if (n !== null && lastKind === 'hundred') { n += TENS[w]; lastKind = 'tens'; }
      else { flush(); n = TENS[w]; lastKind = 'tens'; }
    } else if (w === 'hundred' && n !== null && lastKind === 'unit') {
      n *= 100; lastKind = 'hundred';
    } else if (w === 'and' && lastKind === 'hundred') {
      // "one hundred and nineteen": keep building
    } else {
      flush();
      out.push(w);
    }
  }
  flush();
  return out.join(' ');
}

// Book names and spoken short forms, longest first so "song of solomon" wins over "song".
const NAMES = [...new Set([
  ...BOOKS.map(([n]) => n.toLowerCase()),
  'psalm', 'song of songs', 'revelations', 'acts of the apostles',
])].sort((a, b) => b.length - a.length);
const BOOK_RE = NAMES.map((n) => n.replace(/^([123]) /, '$1 ?').replace(/ /g, '\\s+')).join('|');
const REF_RE = new RegExp(
  `\\b(${BOOK_RE})\\s+(?:chapter\\s+)?(\\d{1,3})(?:\\s*(?::|verses?|v)\\s*(\\d{1,3})|\\s+(\\d{1,3})(?!\\s*(?:chapter|verse)))?(?:\\s*(?:-|to|through)\\s*(\\d{1,3}))?`,
  'gi',
);

// Returns [{ book, chapter, verse, to, ref }] for every reference found, in order. verse 0 = whole chapter.
export function findSpokenRefs(text) {
  const norm = wordsToDigits(
    text.replace(/\b(first|second|third|1st|2nd|3rd|iii|ii|i)\s+(?=[a-z])/gi, (m, o) => `${ORDINAL[o.toLowerCase()]} `),
  ).replace(/(\d)\s*:\s*(\d)/g, '$1:$2');
  const hits = [];
  for (const m of norm.matchAll(REF_RE)) {
    const book = findBook(m[1]);
    if (book < 0) continue;
    const chapter = Number(m[2]);
    let verse = Number(m[3] ?? m[4] ?? 0);
    if (BOOKS[book][1] === 1 && !m[3] && !m[4]) { verse = chapter; } // "Jude 3" = verse 3
    const ch = BOOKS[book][1] === 1 ? 1 : chapter;
    if (ch < 1 || ch > BOOKS[book][1] || verse > 176) continue;
    const to = m[5] ? Number(m[5]) : verse;
    hits.push({ book, chapter: ch, verse, to: to >= verse ? to : verse });
  }
  return hits;
}

// The model writes lowercase (or uppercase) words without punctuation; each pause ends a sentence.
export function tidy(text) {
  const t = text.trim().replace(/\s+/g, ' ').toLowerCase().replace(/\bi\b/g, 'I').replace(/\b(god|jesus|christ|lord|holy spirit)\b/g, (w) => w.replace(/\b\w/g, (c) => c.toUpperCase()));
  return t ? `${t[0].toUpperCase()}${t.slice(1)}${/[.?!]$/.test(t) ? '' : '.'}` : '';
}

// Turns transcribed sentences into short point-form notes: long run-on speech is split at natural joins,
// fillers dropped, near-duplicates removed. Not AI summarising: every point is the speaker's own words.
export function toPoints(sentences) {
  const FILLER = /^(um+|uh+|ah+|okay|ok|so|amen|yes|yeah|right|alright|all right|praise God|hallelujah)[.!]?$/i;
  const points = [];
  for (const s of sentences) {
    for (const part of s.split(/\s+(?:and then|and so|but then|so then)\s+/i)) {
      const p = tidy(part);
      const words = p.split(' ').length;
      if (!p || FILLER.test(p) || words < 3) continue;
      if (points.length && points[points.length - 1].toLowerCase() === p.toLowerCase()) continue;
      points.push(p);
    }
  }
  return points;
}
