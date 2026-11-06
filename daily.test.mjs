// Run: node daily.test.mjs
import assert from 'node:assert';
import { dailyFor, dailyHistory } from './daily.js';

const a = dailyFor(new Date(2026, 10, 7));
assert.equal(a.key, '2026-11-07');
assert.deepEqual(dailyFor(new Date(2026, 10, 7)), a); // stable for a date
assert.notEqual(dailyFor(new Date(2026, 10, 8)).section.heading, a.section.heading); // changes daily
assert.ok(a.reading.length > 0 && a.verse === a.reading[0] && a.section.text.length > 20);
const h = dailyHistory(30, new Date(2026, 10, 7));
assert.equal(h.length, 30);
assert.equal(h[0].key, '2026-11-07');
assert.equal(h[29].key, '2026-10-09');
console.log('daily ok');
