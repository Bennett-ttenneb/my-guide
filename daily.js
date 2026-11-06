// Daily devotional: each day takes the next section of the topical devotionals (76 sections, so 76 days
// before a repeat). The same date always gives the same devotional, so earlier days can be looked back on.
import { TOPICS } from './topics.js';
import { dayKey } from './plan.js';

const SECTIONS = TOPICS.flatMap((topic) => topic.sections.map((section) => ({ topic, section })));

export function dailyFor(date = new Date()) {
  const key = dayKey(date);
  const n = Math.floor(Date.parse(key) / 86400000);
  const { topic, section } = SECTIONS[((n % SECTIONS.length) + SECTIONS.length) % SECTIONS.length];
  return { key, topic, section, reading: section.refs, verse: section.refs[0] };
}

// Today's and the previous days' devotionals, newest first.
export function dailyHistory(days = 30, today = new Date()) {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    return dailyFor(d);
  });
}
