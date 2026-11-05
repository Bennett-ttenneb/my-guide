// Converts eBible.org "_vpl.txt" downloads into data/<id>.json for offline use.
// Usage: node scripts/build-bibles.mjs <folder holding eng-kjv/, eng-web/, ...> [id ...]
// Output shape: books[66][chapter-1][verse-1] = text ('' where a translation skips a verse,
// [] for a chapter it does not have, e.g. the Old Testament of an NT-only translation).
import fs from 'node:fs';
import path from 'node:path';
import { BOOKS } from '../plan.js';

// drop: chapters past the Protestant count (other versification, Greek Esther/Daniel) are
// dropped with a warning instead of failing the build. Defaults to on for non-English.
const SOURCES = {
  kjv: { dir: 'eng-kjv', lang: 'en' },
  web: { dir: 'eng-web', lang: 'en' },
  asv: { dir: 'eng-asv', lang: 'en' },
  bbe: { dir: 'engBBE', lang: 'en' },
  ylt: { dir: 'engylt', lang: 'en' },
  dby: { dir: 'engDBY', lang: 'en' },
  gnv: { dir: 'enggnv', lang: 'en' },
  dra: { dir: 'engDRA', lang: 'en', drop: true }, // Esther 11-16, Daniel 13-14
  wbs: { dir: 'engwebster', lang: 'en' },
  wmb: { dir: 'engwmb', lang: 'en' },
  rv: { dir: 'eng-rv', lang: 'en' },
  bsb: { dir: 'engbsb', lang: 'en' },
  nde: { dir: 'nde', lang: 'nd' },
  tsn: { dir: 'tsn', lang: 'tn' },
};
const CODES = 'GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SOL ISA JER LAM EZE DAN HOS JOE AMO OBA JON MIC NAH HAB ZEP HAG ZEC MAL MAT MAR LUK JOH ACT ROM 1CO 2CO GAL EPH PHI COL 1TH 2TH 1TI 2TI TIT PHM HEB JAM 1PE 2PE 1JO 2JO 3JO JUD REV'.split(' ');
if (CODES.length !== BOOKS.length) throw new Error('book code list out of step with plan.js');

const [src, ...only] = process.argv.slice(2);
if (!src) throw new Error('pass the folder of unzipped eBible downloads');

for (const [id, { dir, lang, drop = lang !== 'en' }] of Object.entries(SOURCES)) {
  if (only.length && !only.includes(id)) continue;
  const books = BOOKS.map(([, count]) => Array.from({ length: count }, () => []));
  const dropped = new Set();
  let verses = 0;
  for (const line of fs.readFileSync(path.join(src, dir, `${dir}_vpl.txt`), 'utf8').split('\n')) {
    const m = line.match(/^(\w{3}) (\d+):(\d+) (.*)$/);
    const b = m && CODES.indexOf(m[1]);
    if (b === null || b < 0) continue; // apocrypha and blank lines
    const chapter = books[b][m[2] - 1];
    if (!chapter) {
      if (!drop) throw new Error(`${id}: ${m[1]} ${m[2]} beyond expected chapter count`);
      dropped.add(`${m[1]} ${m[2]}`);
      continue;
    }
    // Brackets mark words the translators supplied in the old public-domain English texts and
    // read badly aloud; licensed texts keep them (they mark variants, and must stay unmodified).
    const text = lang === 'en' ? m[4].replace(/[[\]]/g, '') : m[4];
    chapter[m[3] - 1] = text.trim();
    verses++;
  }
  if (dropped.size) console.warn(`${id}: dropped chapters beyond the expected count: ${[...dropped].join(', ')}`);
  for (const book of books) for (const ch of book) for (let i = 0; i < ch.length; i++) ch[i] ??= '';
  const empty = books.flat().filter((ch) => !ch.length).length;
  fs.writeFileSync(new URL(`../data/${id}.json`, import.meta.url), JSON.stringify(books));
  console.log(id, verses, 'verses', empty ? `(${empty} chapters empty)` : '');
}
