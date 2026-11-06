// Reads the whole Bible in order, one chapter per finished day.
export const BOOKS = [
  ['Genesis', 50], ['Exodus', 40], ['Leviticus', 27], ['Numbers', 36], ['Deuteronomy', 34],
  ['Joshua', 24], ['Judges', 21], ['Ruth', 4], ['1 Samuel', 31], ['2 Samuel', 24],
  ['1 Kings', 22], ['2 Kings', 25], ['1 Chronicles', 29], ['2 Chronicles', 36], ['Ezra', 10],
  ['Nehemiah', 13], ['Esther', 10], ['Job', 42], ['Psalms', 150], ['Proverbs', 31],
  ['Ecclesiastes', 12], ['Song of Solomon', 8], ['Isaiah', 66], ['Jeremiah', 52], ['Lamentations', 5],
  ['Ezekiel', 48], ['Daniel', 12], ['Hosea', 14], ['Joel', 3], ['Amos', 9],
  ['Obadiah', 1], ['Jonah', 4], ['Micah', 7], ['Nahum', 3], ['Habakkuk', 3],
  ['Zephaniah', 3], ['Haggai', 2], ['Zechariah', 14], ['Malachi', 4],
  ['Matthew', 28], ['Mark', 16], ['Luke', 24], ['John', 21], ['Acts', 28],
  ['Romans', 16], ['1 Corinthians', 16], ['2 Corinthians', 13], ['Galatians', 6], ['Ephesians', 6],
  ['Philippians', 4], ['Colossians', 4], ['1 Thessalonians', 5], ['2 Thessalonians', 3], ['1 Timothy', 6],
  ['2 Timothy', 4], ['Titus', 3], ['Philemon', 1], ['Hebrews', 13], ['James', 5],
  ['1 Peter', 5], ['2 Peter', 3], ['1 John', 5], ['2 John', 1], ['3 John', 1],
  ['Jude', 1], ['Revelation', 22],
];

export const TOTAL_CHAPTERS = BOOKS.reduce((n, [, c]) => n + c, 0);

// index 0 = Genesis 1 = { book: 0, chapter: 1 }; wraps back to Genesis after Revelation 22
export function chapterAt(index) {
  let i = ((index % TOTAL_CHAPTERS) + TOTAL_CHAPTERS) % TOTAL_CHAPTERS;
  for (let book = 0; book < BOOKS.length; book++) {
    if (i < BOOKS[book][1]) return { book, chapter: i + 1 };
    i -= BOOKS[book][1];
  }
}

export const chapterName = ({ book, chapter }) => `${BOOKS[book][0]} ${chapter}`;

// Next/previous chapter, crossing book boundaries and wrapping at the ends.
export function step({ book, chapter }, delta) {
  let index = chapter - 1 + delta;
  for (let b = 0; b < book; b++) index += BOOKS[b][1];
  return chapterAt((index + TOTAL_CHAPTERS) % TOTAL_CHAPTERS);
}

// Local calendar day as YYYY-MM-DD.
export function dayKey(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

// Called when today's reading is finished: advances the plan by one day. Returns the new saved state.
export function finishToday(state, today = new Date()) {
  const key = dayKey(today);
  if (state.lastDay === key) return state;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const streak = state.lastDay === dayKey(yesterday) ? state.streak + 1 : 1;
  return { ...state, lastDay: key, streak, best: Math.max(state.best, streak), chapter: dayEnd(state.plan, daysDone(state.plan, state.chapter) + 1) };
}

// Streak to show: a missed day means it is already broken.
export function currentStreak(state, today = new Date()) {
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  return [dayKey(today), dayKey(yesterday)].includes(state.lastDay) ? state.streak : 0;
}

// Reading plans: finish the Bible in `days` days, in canonical order or New Testament first.
export const DEFAULT_PLAN = { days: TOTAL_CHAPTERS, order: 'canon' };
export const PLAN_ORDERS = { canon: 'Genesis to Revelation', nt: 'New Testament first' };
const NT_START = BOOKS.slice(0, 39).reduce((n, [, c]) => n + c, 0);

// Chapters are spread evenly: a 365-day plan reads 3 or 4 a day and really ends on day 365.
const planDays = (plan = DEFAULT_PLAN) => Math.min(plan.days, TOTAL_CHAPTERS);
export const dayEnd = (plan, n) => Math.min(TOTAL_CHAPTERS, Math.floor((Math.max(n, 0) * TOTAL_CHAPTERS) / planDays(plan))); // chapters read by the end of day n
// Whole plan days covered by the first `chapter` chapters.
export function daysDone(plan, chapter) {
  let n = Math.floor((chapter * planDays(plan)) / TOTAL_CHAPTERS);
  while (n < planDays(plan) && dayEnd(plan, n + 1) <= chapter) n++;
  while (n > 0 && dayEnd(plan, n) > chapter) n--;
  return n;
}
// Average chapters a day, for display ("3.3").
export const perDay = (plan = DEFAULT_PLAN) => Math.round((TOTAL_CHAPTERS / planDays(plan)) * 10) / 10;

// The n-th chapter of the plan, as { book, chapter }.
export const planChapter = (plan = DEFAULT_PLAN, n) => chapterAt(plan.order === 'nt' ? n + NT_START : n);

// Today's chapters (state.chapter counts chapters of the plan already finished).
export const todaysReading = (state) => {
  const done = daysDone(state.plan, state.chapter);
  const day = state.lastDay === dayKey() ? Math.max(done, 1) : done + 1;
  return dayChapters(state.plan, Math.min(day, planDays(state.plan)));
};

export const planProgress = (state) => Math.min(state.chapter / TOTAL_CHAPTERS, 1);

// Whole days between two YYYY-MM-DD keys.
export const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

// Where the plan stands today: day number (1 = start day), days completed, and days behind schedule.
export function planStatus(state, today = new Date()) {
  const completed = daysDone(state.plan, state.chapter);
  const day = daysBetween(state.plan?.start ?? dayKey(today), dayKey(today)) + 1;
  const doneToday = state.lastDay === dayKey(today);
  const total = planDays(state.plan);
  return { day, completed, total, behind: Math.max(0, Math.min(doneToday ? day : day - 1, total) - completed) };
}

// The chapters of plan day n (1-based).
export function dayChapters(plan, n) {
  const first = dayEnd(plan, n - 1);
  return Array.from({ length: Math.max(0, dayEnd(plan, n) - first) }, (_, i) => planChapter(plan, first + i));
}

// Marks plan days 1..n as read (or unmarks down to n). Reaching today's day counts for the streak.
export function markThrough(state, n, today = new Date()) {
  const { day } = planStatus(state, today);
  const next = { ...state, chapter: dayEnd(state.plan, n) };
  const key = dayKey(today);
  if (n >= day && state.lastDay !== key) {
    const streak = currentStreak(state, today) + 1;
    return { ...next, lastDay: key, streak, best: Math.max(state.best, streak) };
  }
  if (n < day && state.lastDay === key) {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return { ...next, lastDay: state.streak > 1 ? dayKey(yesterday) : null, streak: Math.max(state.streak - 1, 0) };
  }
  return next;
}
