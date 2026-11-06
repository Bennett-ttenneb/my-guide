// Run: node spoken.test.mjs
import assert from 'node:assert';
import { findSpokenRefs, wordsToDigits } from './spoken.js';
import { refName } from './nav.js';

assert.equal(wordsToDigits('john three sixteen'), 'john 3 16');
assert.equal(wordsToDigits('romans chapter eight verse twenty eight'), 'romans chapter 8 verse 28');
assert.equal(wordsToDigits('psalm one hundred and nineteen'), 'psalm 119');
assert.equal(wordsToDigits('one hundred five'), '105');

const refs = (t) => findSpokenRefs(t).map((r) => `${refName(r)}${r.to > r.verse ? `-${r.to}` : ''}`);
assert.deepEqual(refs('turn with me to John three sixteen please'), ['John 3:16']);
assert.deepEqual(refs('Romans chapter eight verse twenty eight says'), ['Romans 8:28']);
assert.deepEqual(refs('first Corinthians thirteen is the love chapter'), ['1 Corinthians 13']);
assert.deepEqual(refs('read 1 Corinthians 13:4 to 7'), ['1 Corinthians 13:4-7']);
assert.deepEqual(refs('JOHN 3:16 AND PSALM TWENTY THREE'), ['John 3:16', 'Psalms 23']);
assert.deepEqual(refs('psalm one hundred and nineteen verse one hundred five'), ['Psalms 119:105']);
assert.deepEqual(refs('second Timothy three verse sixteen'), ['2 Timothy 3:16']);
assert.deepEqual(refs('Jude three'), ['Jude 1:3']);
assert.deepEqual(refs('Genesis chapter one'), ['Genesis 1']);
assert.deepEqual(refs('Philippians 4 13'), ['Philippians 4:13']);
assert.deepEqual(refs('Song of Solomon two'), ['Song of Solomon 2']);
assert.deepEqual(refs('John said three things'), []); // a name followed by a word, not a number
assert.deepEqual(refs('Genesis sixty'), []); // Genesis has 50 chapters
assert.deepEqual(refs('nothing to see here'), []);

console.log('spoken ok');

import { tidy, toPoints } from './spoken.js';
assert.equal(tidy('THE LORD IS MY SHEPHERD'), 'The Lord is my shepherd.');
assert.equal(tidy('and i said to jesus'), 'And I said to Jesus.');
assert.equal(tidy('   '), '');
assert.deepEqual(toPoints(['um', 'God is faithful and then we pray every morning', 'amen', 'we pray every morning']),
  ['God is faithful.', 'We pray every morning.']);
console.log('points ok');
