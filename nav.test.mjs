// Run: node nav.test.mjs
import assert from 'node:assert';
import fs from 'node:fs';
import { parseReference, refName, search } from './nav.js';

const ref = (t) => { const r = parseReference(t); return r && refName(r); };
assert.equal(ref('Jn 3:16'), 'John 3:16');
assert.equal(ref('john 3 16'), 'John 3:16');
assert.equal(ref('1 cor 13'), '1 Corinthians 13');
assert.equal(ref('1jn 4:8'), '1 John 4:8');
assert.equal(ref('Psalm 23'), 'Psalms 23');
assert.equal(ref('gen'), 'Genesis 1');
assert.equal(ref('Jude 3'), 'Jude 1:3'); // one-chapter book: the number is the verse
assert.equal(ref('Judges 6'), 'Judges 6');
assert.equal(ref('rev 22.21'), 'Revelation 22:21');
assert.equal(ref('Song of Solomon 2'), 'Song of Solomon 2');
assert.equal(ref('Phil 4:13'), 'Philippians 4:13');
assert.equal(ref('xyz 1'), null);
assert.equal(ref(''), null);

const kjv = JSON.parse(fs.readFileSync(new URL('./data/kjv.json', import.meta.url)));
const hits = search(kjv, 'God so loved');
assert.ok(hits.some((h) => refName(h) === 'John 3:16'));
assert.equal(search(kjv, '   ').length, 0);
assert.equal(search(kjv, 'the', 50).length, 50);

console.log('nav ok');

import { parseRange, rangeText } from './nav.js';
assert.deepEqual(parseRange('Psalms 23:1-6'), { book: 18, chapter: 23, verse: 1, to: 6 });
assert.equal(parseRange('John 3:16').to, 16);
assert.equal(parseRange('John 3'), null); // a range needs a verse
assert.equal(rangeText(kjv, parseRange('Psalms 23:1-6')).length, 6);
console.log('range ok');
