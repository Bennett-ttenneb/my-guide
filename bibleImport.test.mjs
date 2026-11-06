// Run: node bibleImport.test.mjs
import assert from 'node:assert';
import { describe, detectFormat, fromRows, parseOsis, parseUsfx, parseZefania } from './bibleImport.js';

// Enough verses to pass the "is this really a Bible" check, plus John 3:16 to look up.
const filler = (fmt) => Array.from({ length: 120 }, (_, i) => fmt(1, 1 + Math.floor(i / 30), 1 + (i % 30), `In the beginning ${i}`)).join('\n');

const osis = `<osis><osisText><title>Test Version (TV)</title>
${filler((b, c, v, t) => `<verse osisID="Gen.${c}.${v}">${t}</verse>`)}
<verse osisID="John.3.16">For God so loved<note>a footnote</note> the world.</verse></osisText></osis>`;
assert.equal(detectFormat('tv.xml', osis.slice(0, 500)), 'osis');
let b = parseOsis(osis);
assert.equal(b[42][2][15], 'For God so loved the world.');
assert.equal(b[0][0][0], 'In the beginning 0');
assert.equal(b[42][2][0], ''); // missing verses are blank
assert.equal(b.length, 66);

const osisMilestone = `<osis>${filler((bb, c, v, t) => `<verse sID="Gen.${c}.${v}" osisID="Gen.${c}.${v}"/>${t}<verse eID="Gen.${c}.${v}"/>`)}
<verse sID="x" osisID="John.3.16"/>For God so loved the world.<verse eID="x"/></osis>`;
assert.equal(parseOsis(osisMilestone)[42][2][15], 'For God so loved the world.');

const usfx = `<usfx><book id="GEN">${filler((bb, c, v, t) => `<c id="${c}"/><v id="${v}"/>${t}<ve/>`)}</book>
<book id="JHN"><c id="3"/><v id="16"/>For God so loved <f>note</f>the world.<ve/></book></usfx>`;
assert.equal(detectFormat('tv.usfx.xml', usfx), 'usfx');
assert.equal(parseUsfx(usfx)[42][2][15], 'For God so loved the world.');

const zef = `<XMLBIBLE biblename="Zef"><BIBLEBOOK bnumber="1">${[1, 2, 3, 4].map((c) => `<CHAPTER cnumber="${c}">${Array.from({ length: 30 }, (_, v) => `<VERS vnumber="${v + 1}">Text ${c}:${v + 1}</VERS>`).join('')}</CHAPTER>`).join('')}</BIBLEBOOK>
<BIBLEBOOK bnumber="43"><CHAPTER cnumber="3"><VERS vnumber="16">For God so loved &amp; the world.</VERS></CHAPTER></BIBLEBOOK></XMLBIBLE>`;
assert.equal(detectFormat('z.xml', zef), 'zefania');
assert.equal(parseZefania(zef)[42][2][15], 'For God so loved & the world.');

const rows = [...Array.from({ length: 120 }, (_, i) => ({ Book: 1, Chapter: 1 + Math.floor(i / 30), Verse: 1 + (i % 30), Scripture: `Text ${i}` })),
  { Book: 43, Chapter: 3, Verse: 16, Scripture: 'For God so <FI>loved<Fi> the world.<RF>note<Rf>' }];
assert.equal(fromRows(rows)[42][2][15], 'For God so loved the world.');
assert.equal(detectFormat('KJV.bbl.mybible', ''), 'mysword');
assert.equal(detectFormat('kjv.bblx', ''), 'esword');
assert.equal(detectFormat('readme.txt', 'hello'), null);

assert.throws(() => parseZefania('<XMLBIBLE></XMLBIBLE>'), /No Bible text/);
assert.deepEqual(describe('tv.xml', osis), { name: 'Test Version (TV)', short: 'TV' });
assert.equal(describe('Reina_Valera.bbl.mybible').name, 'Reina Valera');

console.log('import ok');
