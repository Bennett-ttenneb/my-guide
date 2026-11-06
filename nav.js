import { BOOKS } from './plan.js';

export const ABBR = 'Gen Exo Lev Num Deu Jos Jdg Rut 1Sa 2Sa 1Ki 2Ki 1Ch 2Ch Ezr Neh Est Job Psa Pro Ecc Sng Isa Jer Lam Eze Dan Hos Joe Amo Oba Jon Mic Nah Hab Zep Hag Zec Mal Mat Mrk Luk Jhn Act Rom 1Co 2Co Gal Eph Php Col 1Th 2Th 1Ti 2Ti Tit Phm Heb Jas 1Pe 2Pe 1Jn 2Jn 3Jn Jud Rev'.split(' ');

// Common short forms that are not a prefix of the book name.
const ALIASES = { jn: 'John', jhn: 'John', mk: 'Mark', mrk: 'Mark', mt: 'Matthew', lk: 'Luke', ps: 'Psalms', psalm: 'Psalms', pss: 'Psalms', sng: 'Song of Solomon', songofsongs: 'Song of Solomon', jdg: 'Judges', jas: 'James', php: 'Philippians', phil: 'Philippians', phm: 'Philemon', philem: 'Philemon', jud: 'Jude', jude: 'Jude', rv: 'Revelation', revelations: 'Revelation', qoh: 'Ecclesiastes', canticles: 'Song of Solomon' };

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export function findBook(text) {
  const q = norm(text);
  if (!q) return -1;
  const num = q.match(/^[123]/)?.[0] ?? '';
  const rest = q.slice(num.length);
  const alias = ALIASES[q] ?? (num && ALIASES[rest] ? `${num} ${ALIASES[rest]}` : null);
  const aliased = alias ? BOOKS.findIndex(([n]) => norm(n) === norm(alias)) : -1;
  if (aliased >= 0) return aliased;
  const abbr = ABBR.findIndex((a) => norm(a) === q);
  if (abbr >= 0) return abbr;
  return BOOKS.findIndex(([n]) => norm(n).startsWith(q));
}

// "Jn 3:16", "1 cor 13", "gen 1 3", "Psalm 23" → { book, chapter, verse } (verse 1-based, 0 = start of chapter)
export function parseReference(text) {
  const m = text.trim().match(/^(\d?\s*[a-z][a-z .]*?)\s*(\d+)?(?:\s*[:.\s]\s*(\d+))?\s*$/i);
  if (!m) return null;
  const book = findBook(m[1]);
  if (book < 0) return null;
  // One-chapter books (Jude, Philemon…) are cited by verse: "Jude 3" = Jude 1:3.
  if (BOOKS[book][1] === 1 && m[2] && !m[3]) return { book, chapter: 1, verse: Number(m[2]) };
  const chapter = Math.min(Math.max(Number(m[2] ?? 1), 1), BOOKS[book][1]);
  return { book, chapter, verse: Number(m[3] ?? 0) };
}

// "Psalms 23:1-6" or "John 3:16" → { book, chapter, verse, to } (to = last verse, inclusive)
export function parseRange(text) {
  const m = text.trim().match(/^(.*?)-(\d+)$/);
  const r = parseReference(m ? m[1] : text);
  if (!r || !r.verse) return null;
  return { ...r, to: m ? Number(m[2]) : r.verse };
}

// Verse texts of a range in one translation ('' entries dropped).
export const rangeText = (bible, r) => (bible[r.book]?.[r.chapter - 1] ?? []).slice(r.verse - 1, r.to).filter(Boolean);

// Case-insensitive search of one translation; every word must appear in the verse.
export function search(bible, query, limit = 300) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = [];
  if (!words.length) return hits;
  for (let b = 0; b < bible.length; b++) {
    for (let c = 0; c < bible[b].length; c++) {
      const chapter = bible[b][c];
      for (let v = 0; v < chapter.length; v++) {
        const t = chapter[v].toLowerCase();
        if (t && words.every((w) => t.includes(w))) {
          hits.push({ book: b, chapter: c + 1, verse: v + 1, text: chapter[v] });
          if (hits.length >= limit) return hits;
        }
      }
    }
  }
  return hits;
}

export const verseKey = (book, chapter, verse) => `${book}.${chapter}.${verse}`;
export const parseKey = (key) => {
  const [book, chapter, verse] = key.split('.').map(Number);
  return { book, chapter, verse };
};
export const refName = ({ book, chapter, verse }) => `${BOOKS[book][0]} ${chapter}${verse ? `:${verse}` : ''}`;

// Label and text for a linked verse or range in a note ({ book, chapter, verse, to }; verse 0 = whole chapter).
export const verseLabel = (b) => `${refName(b)}${b.to > b.verse ? `-${b.to}` : ''}`;
export const verseText = (bible, b) => (b.verse ? rangeText(bible, b) : (bible[b.book]?.[b.chapter - 1] ?? []).filter(Boolean).slice(0, 3)).join(' ');
