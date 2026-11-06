// Run: node plan.test.mjs
import assert from 'node:assert';
import fs from 'node:fs';
import { BOOKS, chapterAt, chapterName, step, TOTAL_CHAPTERS, finishToday, currentStreak } from './plan.js';
import { TRANSLATIONS } from './bible.js';

assert.equal(TOTAL_CHAPTERS, 1189);
assert.equal(chapterName(chapterAt(0)), 'Genesis 1');
assert.equal(chapterName(chapterAt(50)), 'Exodus 1');
assert.equal(chapterName(chapterAt(1188)), 'Revelation 22');
assert.equal(chapterName(chapterAt(1189)), 'Genesis 1');
assert.equal(chapterName(step({ book: 0, chapter: 50 }, 1)), 'Exodus 1');
assert.equal(chapterName(step({ book: 1, chapter: 1 }, -1)), 'Genesis 50');
assert.equal(chapterName(step({ book: 0, chapter: 1 }, -1)), 'Revelation 22');
assert.equal(chapterName(step({ book: 65, chapter: 22 }, 1)), 'Genesis 1');

let s = { chapter: 0, streak: 0, best: 0, lastDay: null };
s = finishToday(s, new Date(2026, 0, 31));
assert.deepEqual([s.streak, s.chapter], [1, 1]);
s = finishToday(s, new Date(2026, 0, 31)); // same day twice counts once
assert.deepEqual([s.streak, s.chapter], [1, 1]);
s = finishToday(s, new Date(2026, 1, 1)); // across a month boundary
assert.equal(s.streak, 2);
assert.equal(currentStreak(s, new Date(2026, 1, 2)), 2);
assert.equal(currentStreak(s, new Date(2026, 1, 3)), 0); // missed a day
s = finishToday(s, new Date(2026, 1, 4));
assert.deepEqual([s.streak, s.best], [1, 2]);

// Embedded Bibles: 66 books, no chapter past the expected count, and (English) John 3:16 in place.
// Non-English and NT-only translations may have empty chapters, so their text is not checked.
const bibleSrc = fs.readFileSync(new URL('./bible.js', import.meta.url), 'utf8');
assert.ok(TRANSLATIONS.length >= 6);
for (const { id, lang } of TRANSLATIONS) {
  assert.ok(bibleSrc.includes(`${id}: () => require('./data/${id}.json')`), `${id} in LOAD`);
  const bible = JSON.parse(fs.readFileSync(new URL(`./data/${id}.json`, import.meta.url)));
  assert.equal(bible.length, 66, id);
  bible.forEach((book, b) => assert.ok(book.length <= BOOKS[b][1] && book.every(Array.isArray), `${id} ${BOOKS[b][0]}`));
  if (lang === 'en') assert.match(bible[42][2][15], /God .*lo[uv].* the world/i, `${id} John 3:16`);
}

console.log('plan ok');

import { perDay, planChapter, todaysReading, planProgress } from './plan.js';
assert.equal(perDay({ days: 365 }), 3.3);
assert.equal(perDay({ days: 1189 }), 1);
assert.equal(perDay({ days: 90 }), 13.2);
assert.equal(chapterName(planChapter({ order: 'nt' }, 0)), 'Matthew 1');
assert.equal(chapterName(planChapter({ order: 'nt' }, 260)), 'Genesis 1'); // NT has 260 chapters, then the OT
assert.equal(chapterName(chapterAt(-1)), 'Revelation 22');
let p = { chapter: 0, streak: 0, best: 0, lastDay: null, plan: { days: 365, order: 'canon' } };
assert.deepEqual(todaysReading(p).map(chapterName), ['Genesis 1', 'Genesis 2', 'Genesis 3']);
p = finishToday(p);
assert.equal(p.chapter, 3);
assert.deepEqual(todaysReading(p).map(chapterName), ['Genesis 1', 'Genesis 2', 'Genesis 3']); // still shows today's, marked done
assert.ok(planProgress(p) > 0);
console.log('plans ok');

import { planStatus, dayChapters, markThrough, daysBetween } from './plan.js';
assert.equal(daysBetween('2026-01-30', '2026-02-02'), 3);
const year = { days: 365, order: 'canon', start: '2026-01-01' };
let y = { chapter: 0, streak: 0, best: 0, lastDay: null, plan: year };
let st = planStatus(y, new Date(2026, 0, 5)); // day 5, nothing read
assert.deepEqual([st.day, st.completed, st.behind, st.total], [5, 0, 4, 365]);
assert.deepEqual(dayChapters(year, 2).map(chapterName), ['Genesis 4', 'Genesis 5', 'Genesis 6']);
assert.equal(chapterName(dayChapters(year, 365).at(-1)), 'Revelation 22'); // ends exactly on day 365
assert.equal(dayChapters(year, 366).length, 0);
assert.equal(Array.from({ length: 365 }, (_, i) => dayChapters(year, i + 1).length).reduce((a, b) => a + b), 1189); // every chapter once
assert.ok(Array.from({ length: 365 }, (_, i) => dayChapters(year, i + 1).length).every((n) => n === 3 || n === 4));
y = markThrough(y, 4, new Date(2026, 0, 5)); // catch up the 4 missed days
assert.deepEqual([planStatus(y, new Date(2026, 0, 5)).behind, y.chapter, y.lastDay], [0, 13, null]);
y = markThrough(y, 5, new Date(2026, 0, 5)); // and today
assert.deepEqual([planStatus(y, new Date(2026, 0, 5)).behind, y.streak, y.lastDay], [0, 1, '2026-01-05']);
y = markThrough(y, 4, new Date(2026, 0, 5)); // undo today
assert.deepEqual([y.chapter, y.streak, y.lastDay], [13, 0, null]);
console.log('year ok');
