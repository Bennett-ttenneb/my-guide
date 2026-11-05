// node devotions.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TOPICS } from './topics.js';
import { parseRange, rangeText } from './nav.js';

const kjv = JSON.parse(readFileSync(new URL('./data/kjv.json', import.meta.url)));

const ids = TOPICS.map((t) => t.id);
assert.equal(new Set(ids).size, ids.length, 'duplicate topic ids');

const bad = [];
let refs = 0;
for (const t of TOPICS) {
  for (const k of ['id', 'title', 'icon', 'summary', 'prayer']) assert.ok(typeof t[k] === 'string' && t[k].trim(), `${t.id}: missing ${k}`);
  assert.ok(['prayer', 'devotional'].includes(t.kind), `${t.id}: bad kind ${t.kind}`);
  assert.ok(t.prayer.endsWith("In Jesus' name, Amen."), `${t.id}: prayer ending`);
  assert.ok(Array.isArray(t.sections) && t.sections.length, `${t.id}: no sections`);
  if (t.declarations) assert.ok(t.declarations.every((d) => typeof d === 'string' && d.trim()), `${t.id}: bad declaration`);
  for (const s of t.sections) {
    assert.ok(s.heading && s.text && s.refs?.length, `${t.id}: incomplete section`);
    for (const ref of s.refs) {
      refs++;
      const r = parseRange(ref);
      if (!r) { bad.push(`${ref} (unparsed)`); continue; }
      const verses = rangeText(kjv, r);
      if (verses.length !== r.to - r.verse + 1 || verses.some((v) => !v.trim())) bad.push(`${ref} (got ${verses.length} verses)`);
    }
  }
}
assert.deepEqual(bad, [], `bad refs:\n${bad.join('\n')}`);

const kinds = TOPICS.reduce((n, t) => ({ ...n, [t.kind]: (n[t.kind] ?? 0) + 1 }), {});
console.log(`ok: ${TOPICS.length} topics (${kinds.prayer} prayer, ${kinds.devotional} devotional), ${TOPICS.reduce((n, t) => n + t.sections.length, 0)} sections, ${refs} refs`);
