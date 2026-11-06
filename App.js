import { useEffect, useMemo, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Alert, FlatList, Modal, PanResponder, Pressable, Share, StyleSheet, Text, useColorScheme, useWindowDimensions, View } from 'react-native';
import { DARK, LIGHT, ThemeContext, useTheme } from './theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import { speakQueue, stopSpeaking } from './speaker';
import * as AI from './aivoice';
import { chapterName, currentStreak, dayKey, DEFAULT_PLAN, finishToday, markThrough, planProgress, planStatus, step, todaysReading, TOTAL_CHAPTERS, daysDone } from './plan';
import PlanView from './PlanView';
import { loadImported, pickAndImport, removeImported } from './bibleStore';
import Devotions from './Devotions';
import { TRANSLATIONS, getBible } from './bible';
import { refName, verseKey } from './nav';
import { COLORS } from './colors';
import Navigator from './Navigator';
import Settings from './Settings';
import Notes, { NoteEditor } from './Notes';
import RichNote, { isEmptyNote } from './RichNote';
import { discard } from './attachments';

const KEY = 'morning-bible';
const START = {
  chapter: 0, streak: 0, best: 0, lastDay: null, hour: 7, voice: null, translation: 'web', pos: { book: 0, chapter: 1 }, fontSize: 19,
  bookmarks: [], marks: {}, history: [], quickNotes: [], plan: DEFAULT_PLAN, theme: 'auto', aiVoice: null,
  name: '', imported: [], splitRatio: 0.55,
};
const translationOf = (s) => [...TRANSLATIONS, ...(s.imported ?? [])].find((t) => t.id === s.translation);
const greetingFor = (name, hour = new Date().getHours()) =>
  `${hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'}${name?.trim() ? `, ${name.trim()}` : ''}`;
const SLEEP = [['15 minutes', 15], ['30 minutes', 30], ['1 hour', 60], ['2 hours', 120], ['All night (8 hours)', 480]];
const WORDS_PER_MINUTE = 165; // rough speaking rate of phone voices, used to size the overnight queue
const same = (a, b) => a.book === b.book && a.chapter === b.chapter;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

// shortcut: the OS won't let an app start talking on its own, so the alarm is a notification you tap; fine for a personal app.
async function scheduleMorning(hour) {
  const { granted } = await Notifications.requestPermissionsAsync();
  if (!granted) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Good morning', body: 'Tap to hear today’s chapter.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute: 0 },
  });
}

export default function App() {
  const [state, setState] = useState(null);
  const scheme = useColorScheme();
  const theme = state?.theme ?? 'auto';
  const c = theme === 'dark' || (theme === 'auto' && scheme === 'dark') ? DARK : LIGHT;
  const styles = useMemo(() => makeStyles(c), [c]);
  const [voices, setVoices] = useState([]);
  const [speakingVerse, setSpeakingVerse] = useState(null); // verse index being read; -1 = reading the title; null = silent
  const [sheet, setSheet] = useState(null); // 'nav' | 'translation' | 'settings'
  const [tab, setTab] = useState('bible'); // 'bible' | 'notes'
  const [selected, setSelected] = useState(null); // verse index whose action sheet is open
  const [editing, setEditing] = useState(null); // { title, subtitle, initial, save(text), remove() }
  const [rich, setRich] = useState(null); // note open in the notes editor, 'new', or null
  const [importing, setImporting] = useState(false);
  const { width, height } = useWindowDimensions();
  // Tablets, and phones turned sideways, show the Bible and notes side by side.
  const split = width >= 700 || (width > height && width >= 560);
  const [ratio, setRatio] = useState(null); // live divider position while dragging
  const dragStart = useRef(0.55);
  const paneWidth = useRef(1);
  const [target, setTarget] = useState(0); // verse index to scroll to after navigating
  const list = useRef(null);
  const session = useRef(0); // bumps on every stop, so callbacks from an old reading are ignored
  const swipe = useRef(() => {});

  const persist = (s) => { AsyncStorage.setItem(KEY, JSON.stringify(s)); return s; };
  const update = (patch) => setState((s) => persist({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));

  useEffect(() => {
    AsyncStorage.getItem(KEY).then(async (raw) => {
      let loaded = raw ? { ...START, ...JSON.parse(raw) } : START;
      if (!loaded.plan.start) {
        // Plans from before 2.3 had no start date: count the days already read as on schedule.
        const start = new Date();
        start.setDate(start.getDate() - daysDone(loaded.plan, loaded.chapter) + (loaded.lastDay === dayKey() ? 1 : 0));
        loaded = persist({ ...loaded, plan: { ...loaded.plan, start: dayKey(start) } });
      }
      if (loaded.translation.startsWith('imp-') && !(await loadImported(loaded.translation))) loaded = { ...loaded, translation: 'web' };
      if (loaded.lastDay === dayKey()) return setState(loaded);
      // Opening the app before today's reading is done goes straight to it and starts reading.
      const today = todaysReading(loaded);
      const morning = persist({ ...loaded, pos: today[0] });
      setState(morning);
      read(morning, { chapters: today });
    });
    Speech.getAvailableVoicesAsync().then((all) =>
      setVoices(all.filter((v) => v.language.startsWith('en')).sort((a, b) => a.name.localeCompare(b.name))));
    return () => stopSpeaking();
  }, []);

  useEffect(() => {
    if (state) scheduleMorning(state.hour);
  }, [state?.hour]);

  // Verses in the chapter on screen; scrolling past them throws (reading can run a verse ahead of a page turn).
  const shownVerses = () => (state ? getBible(state.translation)[state.pos.book]?.[state.pos.chapter - 1]?.length ?? 0 : 0);

  useEffect(() => {
    if (!state) return;
    if (target > 0 && target < shownVerses()) list.current?.scrollToIndex({ index: target, viewPosition: 0.2 });
    else list.current?.scrollToOffset({ offset: 0, animated: false });
  }, [state?.pos, state?.translation]);

  useEffect(() => {
    if (speakingVerse > 0 && speakingVerse < shownVerses()) list.current?.scrollToIndex({ index: speakingVerse, viewPosition: 0.3 });
  }, [speakingVerse]);

  // Swipe left/right across the text for next/previous chapter; vertical drags stay with the scroll view.
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 40 && Math.abs(g.dx) > Math.abs(g.dy) * 2.5,
    onPanResponderRelease: (_, g) => { if (Math.abs(g.dx) > 80) swipe.current(g.dx < 0 ? 1 : -1); },
  }), []);

  const ratioRef = useRef(0.55);
  const divider = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { dragStart.current = ratioRef.current; },
    onPanResponderMove: (_, g) => setRatio(Math.min(0.75, Math.max(0.3, dragStart.current + g.dx / paneWidth.current))),
    onPanResponderRelease: (_, g) => {
      const r = Math.min(0.75, Math.max(0.3, dragStart.current + g.dx / paneWidth.current));
      setRatio(null);
      update({ splitRatio: r });
    },
  }), []);
  function stop() {
    session.current++;
    stopSpeaking();
    setSpeakingVerse(null);
  }

  // The AI voice speaks English only; other languages, and overnight play (which must survive the
  // screen turning off), use the phone's voice.
  const voiceFor = (s, { overnight = false } = {}) => ({
    phoneVoice: s.voice,
    aiVoice: !overnight && AI.supported && AI.isAiVoice(s.aiVoice) && translationOf(s)?.lang === 'en' ? s.aiVoice : null,
  });

  // One verse per utterance: Android caps utterance length, and it lets the text follow along verse by verse.
  function read(s, { from = 0, chapters = [s.pos], minutes = 0 } = {}) {
    stop();
    const id = session.current;
    const live = (fn) => (...args) => { if (session.current === id) fn(...args); };
    const bible = getBible(s.translation);
    let queue = chapters;
    if (minutes) {
      // Overnight: queue enough chapters to fill the timer, then the speech engine simply runs out.
      queue = [];
      for (let p = s.pos, words = 0; words < minutes * WORDS_PER_MINUTE && queue.length < TOTAL_CHAPTERS; p = step(p, 1)) {
        queue.push(p);
        words += bible[p.book][p.chapter - 1].join(' ').split(/s+/).length;
      }
    }
    const today = todaysReading(s);
    const items = [];
    queue.forEach((pos, ci) => {
      const verses = bible[pos.book][pos.chapter - 1];
      const start = ci === 0 ? from : 0;
      const lastIndex = verses.findLastIndex(Boolean);
      if (lastIndex < 0) return; // chapter not in this translation (e.g. Old Testament of a New Testament)
      const turnPage = live(() => { setTarget(0); setState((cur) => ({ ...cur, pos })); });
      if (start === 0) items.push({ text: chapterName(pos).replace(/ (d+)$/, ', chapter $1.'), onStart: ci > 0 ? turnPage : undefined });
      verses.forEach((text, i) => {
        if (!text || i < start) return;
        items.push({
          text,
          onStart: live(() => setSpeakingVerse(i)),
          // Hearing the last chapter of today's reading to the end finishes the day.
          onDone: i === lastIndex && same(pos, today[today.length - 1])
            ? live(() => setState((cur) => (cur.lastDay === dayKey() ? cur : persist(finishToday(cur))))) : undefined,
        });
      });
    });
    setSpeakingVerse(from > 0 ? from : -1);
    speakQueue(items, { ...voiceFor(s, { overnight: minutes > 0 }), onEnd: live(() => setSpeakingVerse(null)) });
  }

  // Read arbitrary passages (devotionals, prayers) with the same voice.
  function readTexts(texts) {
    stop();
    const id = session.current;
    setSpeakingVerse(-1);
    speakQueue(texts.map((text) => ({ text })), { ...voiceFor(state), onEnd: () => { if (session.current === id) setSpeakingVerse(null); } });
  }

  function go(pos, verse = 0) {
    stop();
    setSheet(null);
    setTab('bible');
    setTarget(verse);
    update((s) => ({ pos, history: [pos, ...s.history.filter((h) => !same(h, pos))].slice(0, 30) }));
  }

  if (!state) return null;
  const { pos, fontSize, marks, bookmarks } = state;
  const bible = getBible(state.translation);
  const verses = bible[pos.book][pos.chapter - 1];
  const doneToday = state.lastDay === dayKey();
  const today = todaysReading(state);
  const todayLabel = today.length > 1 ? `${chapterName(today[0])} – ${chapterName(today[today.length - 1])}` : chapterName(today[0]);
  const streak = currentStreak(state);
  const speaking = speakingVerse !== null;
  swipe.current = (delta) => go(step(pos, delta));

  const keyOf = (i) => verseKey(pos.book, pos.chapter, i + 1);
  const refOf = (i) => refName({ ...pos, verse: i + 1 });
  const setMark = (key, patch) => update((s) => {
    const next = { ...s.marks[key], ...patch };
    const marks = { ...s.marks };
    if (next.color || next.note) marks[key] = next; else delete marks[key];
    return { marks };
  });
  const toggleBookmark = (key) => update((s) => ({
    bookmarks: s.bookmarks.includes(key) ? s.bookmarks.filter((k) => k !== key) : [key, ...s.bookmarks],
  }));
  const editVerseNote = (key, title, subtitle) => {
    setEditing({
      title, subtitle, initial: state.marks[key]?.note,
      save: (text) => setMark(key, { note: text || undefined, date: Date.now() }),
      remove: () => setMark(key, { note: undefined }),
    });
  };
  // Saving keeps the note (or drops it if left empty) and deletes files of attachments it no longer has.
  // shortcut: a recording or photo added and removed again before saving leaves its file behind; fine at notes scale.
  const saveNote = (saved) => {
    const old = state.quickNotes.find((n) => n.id === saved.id);
    const keepIt = !isEmptyNote(saved);
    const uris = new Set(keepIt ? saved.blocks.map((b) => b.uri) : []);
    discard((old?.blocks ?? []).filter((b) => b.uri && !uris.has(b.uri)));
    if (!keepIt) discard(saved.blocks.filter((b) => b.uri));
    const stored = { ...saved, blocks: saved.blocks.map(({ key, ...b }) => b) };
    update((s) => ({
      quickNotes: !keepIt ? s.quickNotes.filter((n) => n.id !== saved.id)
        : old ? s.quickNotes.map((n) => (n.id === saved.id ? stored : n)) : [stored, ...s.quickNotes],
    }));
    setRich(null);
  };
  // Rotating the phone moves the editor between full screen and split view; keep what was typed.
  const autosaveNote = (saved) => {
    if (isEmptyNote(saved)) return;
    const stored = { ...saved, blocks: saved.blocks.map(({ key, ...b }) => b) };
    update((s) => ({ quickNotes: s.quickNotes.some((n) => n.id === saved.id) ? s.quickNotes.map((n) => (n.id === saved.id ? stored : n)) : [stored, ...s.quickNotes] }));
    setRich(stored);
  };
  const openVerse = (r) => go({ book: r.book, chapter: r.chapter }, Math.max((r.verse || 1) - 1, 0));

  async function importBible() {
    setSheet(null);
    setImporting(true);
    try {
      const t = await pickAndImport();
      if (!t) return;
      update((s) => ({ imported: [...s.imported, t], translation: t.id }));
      setTarget(0);
      Alert.alert('Bible imported', `${t.name} (${t.short}) is now in your translation list.`);
    } catch (e) {
      Alert.alert('Could not import this file', String(e?.message ?? e));
    } finally {
      setImporting(false);
    }
  }

  function removeBible(t) {
    Alert.alert(`Remove ${t.short}?`, `${t.name} will be deleted from this phone. You can import the file again later.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        await removeImported(t.id);
        update((s) => ({ imported: s.imported.filter((x) => x.id !== t.id), translation: s.translation === t.id ? 'web' : s.translation }));
      } },
    ]);
  }

  const deleteNote = (n) => {
    discard(n.blocks.filter((b) => b.uri));
    update((s) => ({ quickNotes: s.quickNotes.filter((q) => q.id !== n.id) }));
    setRich(null);
  };
  const sel = selected === null ? null : { i: selected, key: keyOf(selected), ref: refOf(selected), text: verses[selected] };
  const status = planStatus(state);
  ratioRef.current = state.splitRatio ?? 0.55;
  const shown = ratio ?? ratioRef.current;

  const notesList = (
    <Notes quickNotes={state.quickNotes} marks={marks} bible={bible} onGo={go}
          onNew={() => setRich('new')}
          onEditQuick={(n) => setRich(state.quickNotes.find((q) => q.id === n.id) ?? 'new')}
          onEditVerse={(key) => { const [b, ch, v] = key.split('.').map(Number); editVerseNote(key, refName({ book: b, chapter: ch, verse: v }), bible[b]?.[ch - 1]?.[v - 1]); }} />
  );
  const bibleView = (
    <>
          <View style={styles.toolbar}>
            <Pressable style={[styles.pill, { flex: 1 }]} onPress={() => setSheet('nav')} accessibilityRole="button" accessibilityLabel={`${chapterName(pos)}. Navigate`}>
              <Text style={styles.pillText}>{chapterName(pos)} ▾</Text>
            </Pressable>
            <Pressable style={styles.pill} onPress={() => setSheet('translation')} accessibilityRole="button" accessibilityLabel="Choose translation">
              <Text style={styles.pillText}>{translationOf(state)?.short ?? 'WEB'} ▾</Text>
            </Pressable>
          </View>

          {(!doneToday || status.behind > 0) && (
            <View style={styles.banner}>
              <Pressable style={{ flex: 1 }} onPress={() => go(today[0])} accessibilityRole="button" accessibilityLabel={`Open today's reading, ${todayLabel}`}>
                <Text style={styles.bannerText}>Today: {todayLabel}</Text>
                <Text style={styles.bannerSub}>Day {Math.min(status.day, status.total)} of {status.total}{status.behind ? ` · ${status.behind} behind` : ''} · {Math.round(planProgress(state) * 100)}% done</Text>
              </Pressable>
              <Pressable style={styles.bannerBtn} accessibilityRole="button" accessibilityLabel="Listen to today's reading"
                onPress={() => { go(today[0]); read({ ...state, pos: today[0] }, { chapters: today }); }}>
                <Text style={styles.bannerBtnText}>▶</Text>
              </Pressable>
              <Pressable style={styles.bannerBtn} accessibilityRole="button" accessibilityLabel="Mark today's reading as read" onPress={() => update(finishToday)}>
                <Text style={styles.bannerBtnText}>✓</Text>
              </Pressable>
              <Pressable style={styles.bannerBtn} accessibilityRole="button" accessibilityLabel="Open reading plan" onPress={() => setSheet('plan')}>
                <Text style={styles.bannerBtnText}>📅</Text>
              </Pressable>
            </View>
          )}

          <View style={{ flex: 1 }} {...pan.panHandlers}>
            <FlatList
              ref={list}
              data={verses}
              extraData={[speakingVerse, fontSize, marks, bookmarks]}
              keyExtractor={(_, i) => String(i)}
              contentContainerStyle={styles.reader}
              onScrollToIndexFailed={({ index, averageItemLength }) => {
                list.current?.scrollToOffset({ offset: index * averageItemLength, animated: false });
                setTimeout(() => { if (index < shownVerses()) list.current?.scrollToIndex({ index, viewPosition: 0.3 }); }, 100);
              }}
              ListFooterComponent={
                <Pressable onPress={() => go(step(pos, 1))} style={styles.nextChapter} accessibilityRole="button">
                  <Text style={styles.nextChapterText}>Next: {chapterName(step(pos, 1))} ›</Text>
                </Pressable>
              }
              renderItem={({ item, index }) => {
                if (!item) return null;
                const mark = marks[keyOf(index)];
                return (
                  <Pressable onPress={() => setSelected(index)} accessibilityHint="Opens highlight, note and bookmark options">
                    <Text style={[styles.verse, { fontSize, lineHeight: Math.round(fontSize * 1.55) },
                      mark?.color && { backgroundColor: COLORS[mark.color], color: c.onHighlight },
                      index === speakingVerse && styles.reading]}>
                      <Text style={styles.verseNum}>{index + 1}  </Text>{item}
                      {bookmarks.includes(keyOf(index)) ? '  🔖' : ''}{mark?.note ? '  📝' : ''}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>

          <View style={styles.bottomBar}>
            <Pressable style={styles.navBtn} onPress={() => go(step(pos, -1))} accessibilityRole="button" accessibilityLabel="Previous chapter">
              <Text style={styles.navText}>‹</Text>
            </Pressable>
            <Pressable style={styles.play} onPress={() => (speaking ? stop() : read(state))} accessibilityRole="button">
              <Text style={styles.playText}>{speaking ? '■  Stop' : '▶  Read aloud'}</Text>
            </Pressable>
            <Pressable style={styles.navBtn} onPress={() => setSheet('sleep')} accessibilityRole="button" accessibilityLabel="Play through the night">
              <Text style={styles.moon}>🌙</Text>
            </Pressable>
            <Pressable style={styles.navBtn} onPress={() => go(step(pos, 1))} accessibilityRole="button" accessibilityLabel="Next chapter">
              <Text style={styles.navText}>›</Text>
            </Pressable>
          </View>
        </>
  );
  const left = tab === 'devotions'
    ? <Devotions bible={bible} speaking={speaking} onRead={readTexts} onStop={stop} onGo={go} />
    : tab === 'notes' && !split ? notesList : bibleView;
  const notesPane = rich
    ? <RichNote key={rich === 'new' ? 'new' : `${rich.id}-${rich.updated}`} inline note={rich === 'new' ? null : rich} bible={bible} onSave={saveNote} onDelete={deleteNote} onOpenVerse={openVerse} onVerseHeard={openVerse} onAutosave={autosaveNote} />
    : notesList;

  return (
    <ThemeContext.Provider value={c}>
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>{greetingFor(state.name)}</Text>
          <Text style={styles.byline}>My Guide · by BBotnics Industries</Text>
        </View>
        <Pressable onPress={() => setSheet('settings')} style={styles.chip} accessibilityRole="button" accessibilityLabel={`Streak ${streak} days. Open settings`}>
          <Text style={styles.chipText}>🔥 {streak}   ⚙</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {[['bible', 'Bible'], ['devotions', 'Devotions'], ...(split ? [] : [['notes', 'Notes']])].map(([id, label]) => (
          <Pressable key={id} onPress={() => setTab(id)} style={[styles.tab, tab === id && styles.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === id }}>
            <Text style={[styles.tabText, tab === id && styles.tabTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {split ? (
        <View style={styles.split} onLayout={(e) => { paneWidth.current = e.nativeEvent.layout.width; }}>
          <View style={{ flex: shown }}>{left}</View>
          <View {...divider.panHandlers} style={styles.divider} accessibilityLabel="Drag to resize" accessibilityRole="adjustable">
            <View style={styles.grip} />
          </View>
          <View style={{ flex: 1 - shown }}>{notesPane}</View>
        </View>
      ) : left}

      {/* Verse actions: highlight, note, bookmark, read from here, share */}
      <Modal visible={!!sel} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.backdropBottom} onPress={() => setSelected(null)}>
          {sel && (
            <Pressable style={styles.actions} onPress={() => {}}>
              <Text style={styles.menuTitle}>{sel.ref}</Text>
              <Text style={styles.actionVerse} numberOfLines={3}>{sel.text}</Text>
              <View style={styles.swatches}>
                {Object.entries(COLORS).map(([name, hex]) => (
                  <Pressable key={name} onPress={() => setMark(sel.key, { color: name })} accessibilityRole="button" accessibilityLabel={`Highlight ${name}`}
                    style={[styles.swatch, { backgroundColor: hex }, marks[sel.key]?.color === name && styles.swatchOn]} />
                ))}
                <Pressable onPress={() => setMark(sel.key, { color: undefined })} accessibilityRole="button" accessibilityLabel="Remove highlight" style={[styles.swatch, styles.swatchClear]}>
                  <Text style={styles.clearText}>✕</Text>
                </Pressable>
              </View>
              <ActionRow icon="📝" label={marks[sel.key]?.note ? 'Edit note' : 'Add note'} onPress={() => { setSelected(null); editVerseNote(sel.key, sel.ref, sel.text); }} />
              <ActionRow icon="🔖" label={bookmarks.includes(sel.key) ? 'Remove bookmark' : 'Bookmark'} onPress={() => { toggleBookmark(sel.key); setSelected(null); }} />
              <ActionRow icon="▶" label="Read aloud from here" onPress={() => { setSelected(null); read(state, sel.i); }} />
              <ActionRow icon="↗" label="Share verse" onPress={() => { setSelected(null); Share.share({ message: `${sel.text}\n— ${sel.ref} (${translationOf(state)?.short})` }); }} />
            </Pressable>
          )}
        </Pressable>
      </Modal>

      {rich && !split && <RichNote key={rich === 'new' ? 'new' : `${rich.id}-${rich.updated}`} note={rich === 'new' ? null : rich} bible={bible} onSave={saveNote} onDelete={deleteNote} onOpenVerse={openVerse} onAutosave={autosaveNote} />}

      <NoteEditor visible={!!editing} title={editing?.title} subtitle={editing?.subtitle} initial={editing?.initial}
        onSave={(text) => { editing.save(text); setEditing(null); }}
        onDelete={() => { editing.remove(); setEditing(null); }}
        onClose={() => setEditing(null)} />

      <Navigator visible={sheet === 'nav'} bible={bible} pos={pos} bookmarks={bookmarks} marks={marks} history={state.history}
        onGo={go} onClose={() => setSheet(null)} />

      <Modal visible={sheet === 'translation'} transparent animationType="fade" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSheet(null)}>
          <View style={styles.menu}>
            <Text style={styles.menuTitle}>Translation</Text>
            <FlatList data={[...TRANSLATIONS, ...state.imported]} keyExtractor={(t) => t.id} style={{ maxHeight: 440 }} renderItem={({ item: t }) => (
              <Pressable style={styles.menuRow} accessibilityRole="button" onLongPress={t.id.startsWith('imp-') ? () => removeBible(t) : undefined}
                onPress={() => { stop(); setSheet(null); setTarget(0); update({ translation: t.id }); }}>
                <Text style={[styles.menuText, t.id === state.translation && styles.menuCurrent]}>
                  {t.id === state.translation ? '✓ ' : ''}{t.short} · {t.name}
                </Text>
                {t.copyright !== 'Public domain' && <Text style={styles.menuSub}>{t.copyright}{t.id.startsWith('imp-') ? ' · long-press to remove' : ''}</Text>}
              </Pressable>
            )} />
            <Pressable style={[styles.menuRow, { borderBottomWidth: 0 }]} onPress={importBible} accessibilityRole="button">
              <Text style={[styles.menuText, styles.menuCurrent]}>＋ Import a Bible file…</Text>
              <Text style={styles.menuSub}>OSIS, USFX or Zefania XML, MySword or e-Sword</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Settings visible={sheet === 'settings'} state={state} streak={streak} voices={voices}
        onChange={update} onStopReading={stop} onClose={() => setSheet(null)} onOpenPlan={() => setSheet('plan')} />
      <PlanView visible={sheet === 'plan'} state={state} onClose={() => setSheet(null)}
        onMark={(n) => update((s) => markThrough(s, n))}
        onOpen={(p) => p && go(p)}
        onListen={(chapters) => { setSheet(null); go(chapters[0]); read({ ...state, pos: chapters[0] }, { chapters }); }}
        onYear={() => update((s) => ({ plan: { ...s.plan, days: 365 } }))} />
      <Modal visible={importing} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={[styles.menu, { alignItems: 'center', gap: 12 }]}>
            <ActivityIndicator size="large" color={c.accent} />
            <Text style={styles.menuText}>Importing Bible…</Text>
          </View>
        </View>
      </Modal>
      <Modal visible={sheet === 'sleep'} transparent animationType="fade" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSheet(null)}>
          <View style={styles.menu}>
            <Text style={styles.menuTitle}>🌙 Play through the night</Text>
            <Text style={[styles.menuSub, { marginBottom: 8 }]}>Keeps reading from {chapterName(pos)} onwards, chapter after chapter, then stops by itself. You can turn the screen off. Uses the phone voice, which keeps going with the screen off.</Text>
            {SLEEP.map(([label, minutes]) => (
              <Pressable key={minutes} style={styles.menuRow} accessibilityRole="button" onPress={() => { setSheet(null); read(state, { minutes }); }}>
                <Text style={styles.menuText}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <StatusBar style={c.dark ? 'light' : 'dark'} />
    </View>
    </ThemeContext.Provider>
  );
}

function ActionRow({ icon, label, onPress }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable onPress={onPress} style={styles.actionRow} accessibilityRole="button">
      <Text style={styles.actionIcon}>{icon}</Text>
      <Text style={styles.menuText}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (c) => StyleSheet.create({
  split: { flex: 1, flexDirection: 'row' },
  divider: { width: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg },
  grip: { width: 5, height: 56, borderRadius: 3, backgroundColor: c.border },
  container: { flex: 1, backgroundColor: c.bg, paddingTop: 52 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 },
  brand: { fontSize: 20, fontWeight: '800', color: c.text },
  byline: { fontSize: 12, color: c.muted, fontWeight: '600', letterSpacing: 0.3 },
  chip: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: c.soft, justifyContent: 'center' },
  chipText: { fontSize: 17, fontWeight: '700', color: c.accent },
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, backgroundColor: c.soft, borderRadius: 12, padding: 4 },
  tab: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  tabOn: { backgroundColor: c.card },
  tabText: { fontSize: 15, color: c.muted, fontWeight: '600' },
  tabTextOn: { color: c.accent },
  toolbar: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  pill: { minHeight: 44, paddingHorizontal: 16, borderRadius: 12, backgroundColor: c.text, justifyContent: 'center' },
  pillText: { color: c.bg, fontSize: 17, fontWeight: '700' },
  banner: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 12, backgroundColor: c.accentSoft },
  bannerText: { color: c.accent, fontSize: 16, fontWeight: '700' },
  bannerSub: { color: c.muted, fontSize: 13, marginTop: 2 },
  bannerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  bannerBtnText: { color: c.accent, fontSize: 18, fontWeight: '700' },
  moon: { fontSize: 22 },
  menuSub: { fontSize: 13, color: c.muted, marginBottom: 4 },
  reader: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  verse: { color: c.text, marginBottom: 10, borderRadius: 6 },
  verseNum: { color: c.accent, fontWeight: '700', fontSize: 13 },
  reading: { backgroundColor: c.accentSoft },
  nextChapter: { marginTop: 8, padding: 16, borderRadius: 12, backgroundColor: c.soft, alignItems: 'center' },
  nextChapterText: { color: c.text, fontSize: 16, fontWeight: '700' },
  bottomBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 34, borderTopWidth: 1, borderTopColor: c.soft },
  navBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' },
  navText: { fontSize: 30, color: c.text, marginTop: -4 },
  play: { flex: 1, height: 56, borderRadius: 28, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  playText: { color: '#fff', fontSize: 19, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 24 },
  backdropBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  menu: { backgroundColor: c.bg, borderRadius: 16, padding: 16 },
  menuTitle: { fontSize: 20, fontWeight: '700', color: c.text, marginBottom: 8 },
  menuRow: { minHeight: 48, justifyContent: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.soft },
  menuText: { fontSize: 17, color: c.text },
  menuCurrent: { fontWeight: '700', color: c.accent },
  actions: { backgroundColor: c.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  actionVerse: { fontSize: 15, color: c.muted, fontStyle: 'italic', marginBottom: 12 },
  swatches: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: c.border },
  swatchOn: { borderWidth: 3, borderColor: c.text },
  swatchClear: { backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' },
  clearText: { fontSize: 16, color: c.muted },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, borderBottomWidth: 1, borderBottomColor: c.soft },
  actionIcon: { fontSize: 18, width: 28, textAlign: 'center' },
});
