import { useEffect, useState, useMemo } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from './theme';
import { BOOKS } from './plan';
import { ABBR, parseKey, parseReference, refName, search } from './nav';
import { COLORS } from './colors';

const OT = 39;
const TABS = [['books', 'Books'], ['search', 'Search'], ['saved', 'Saved'], ['history', 'History']];
const range = (n) => Array.from({ length: n }, (_, i) => ({ key: i + 1, label: String(i + 1) }));
const books = (from, to) => ABBR.slice(from, to).map((label, i) => ({ key: from + i, label, full: BOOKS[from + i][0] }));
const snippet = (bible, r) => bible[r.book]?.[r.chapter - 1]?.[r.verse - 1] ?? '';

// MySword-style navigation: book → chapter → verse grids, typed references, search, saved verses and history.
export default function Navigator({ visible, bible, pos, bookmarks, marks, history, onGo, onClose }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [tab, setTab] = useState('books');
  const [book, setBook] = useState(null);
  const [chapter, setChapter] = useState(null);
  const [ref, setRef] = useState('');
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState(null);

  useEffect(() => {
    if (visible) { setBook(null); setChapter(null); setRef(''); }
  }, [visible]);

  const back = () => (chapter !== null ? setChapter(null) : book !== null ? setBook(null) : onClose());
  const goRef = () => {
    const r = parseReference(ref);
    if (r) onGo({ book: r.book, chapter: r.chapter }, Math.max(r.verse - 1, 0));
  };
  const parsed = ref.trim() && parseReference(ref);
  const saved = [
    ...bookmarks.map((k) => ({ key: k, ...parseKey(k), icon: '🔖' })),
    ...Object.entries(marks).filter(([, m]) => m.color).map(([k, m]) => ({ key: `h${k}`, ...parseKey(k), color: m.color })),
  ];
  const title = book === null ? 'Go to' : chapter === null ? `${BOOKS[book][0]}: chapter` : `${BOOKS[book][0]} ${chapter}: verse`;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={back}>
      <View style={styles.sheet}>
        <View style={styles.head}>
          <Pressable onPress={back} style={styles.headBtn} accessibilityRole="button">
            <Text style={styles.headBtnText}>{book === null || tab !== 'books' ? 'Close' : '‹ Back'}</Text>
          </Pressable>
          <Text style={styles.title}>{tab === 'books' ? title : TABS.find(([t]) => t === tab)[1]}</Text>
        </View>

        <View style={styles.tabs}>
          {TABS.map(([id, label]) => (
            <Pressable key={id} onPress={() => setTab(id)} style={[styles.tab, tab === id && styles.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === id }}>
              <Text style={[styles.tabText, tab === id && styles.tabTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'books' && (
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {book === null && (
              <View style={styles.refRow}>
                <TextInput placeholderTextColor={c.muted} value={ref} onChangeText={setRef} onSubmitEditing={goRef} placeholder="Type a reference, e.g. Jn 3:16"
                  style={styles.input} autoCorrect={false} autoCapitalize="none" returnKeyType="go" accessibilityLabel="Bible reference" />
                <Pressable onPress={goRef} style={[styles.goBtn, !parsed && { opacity: 0.4 }]} disabled={!parsed} accessibilityRole="button">
                  <Text style={styles.goText}>{parsed ? `Go to ${refName(parsed)}` : 'Go'}</Text>
                </Pressable>
              </View>
            )}
            {book === null ? (
              <>
                <Text style={styles.section}>Old Testament</Text>
                <Grid items={books(0, OT)} cols={5} current={pos.book} onPick={setBook} />
                <Text style={styles.section}>New Testament</Text>
                <Grid items={books(OT, BOOKS.length)} cols={5} current={pos.book} onPick={setBook} />
              </>
            ) : chapter === null ? (
              <Grid items={range(BOOKS[book][1])} cols={6} current={book === pos.book ? pos.chapter : null} onPick={setChapter} />
            ) : (
              <>
                <Pressable onPress={() => onGo({ book, chapter }, 0)} style={styles.wide} accessibilityRole="button">
                  <Text style={styles.wideText}>Open {BOOKS[book][0]} {chapter}</Text>
                </Pressable>
                <Grid items={range(bible[book][chapter - 1].length)} cols={6} onPick={(verse) => onGo({ book, chapter }, verse - 1)} />
              </>
            )}
          </ScrollView>
        )}

        {tab === 'search' && (
          <View style={{ flex: 1 }}>
            <View style={[styles.refRow, { marginHorizontal: 12 }]}>
              <TextInput placeholderTextColor={c.muted} value={query} onChangeText={setQuery} onSubmitEditing={() => setHits(search(bible, query))} placeholder="Search words, e.g. love neighbour"
                style={styles.input} returnKeyType="search" accessibilityLabel="Search the Bible" />
              <Pressable onPress={() => setHits(search(bible, query))} style={styles.goBtn} accessibilityRole="button">
                <Text style={styles.goText}>Search</Text>
              </Pressable>
            </View>
            {hits && <Text style={styles.count}>{hits.length >= 300 ? 'First 300 matches' : `${hits.length} matches`}</Text>}
            <RefList items={hits ?? []} bible={bible} onGo={onGo} highlight={query} />
          </View>
        )}

        {tab === 'saved' && (
          saved.length ? <RefList items={saved} bible={bible} onGo={onGo} />
            : <Text style={styles.empty}>Tap any verse while reading to bookmark or highlight it.</Text>
        )}

        {tab === 'history' && (
          history.length ? <RefList items={history.map((h, i) => ({ key: String(i), ...h, verse: 0 }))} bible={bible} onGo={onGo} />
            : <Text style={styles.empty}>Chapters you open will show up here.</Text>
        )}
      </View>
    </Modal>
  );
}

function RefList({ items, bible, onGo }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.key ?? `${item.book}.${item.chapter}.${item.verse}`}
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => (
        <Pressable onPress={() => onGo({ book: item.book, chapter: item.chapter }, Math.max(item.verse - 1, 0))} style={styles.refItem} accessibilityRole="button">
          <View style={styles.refHead}>
            {item.color && <View style={[styles.swatch, { backgroundColor: COLORS[item.color] }]} />}
            <Text style={styles.refTitle}>{item.icon ? `${item.icon} ` : ''}{refName(item)}</Text>
          </View>
          {item.verse > 0 && <Text style={styles.refText} numberOfLines={2}>{item.text ?? snippet(bible, item)}</Text>}
        </Pressable>
      )}
    />
  );
}

function Grid({ items, cols, current, onPick }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.grid}>
      {items.map(({ key, label, full }) => (
        <Pressable key={key} onPress={() => onPick(key)} style={{ width: `${100 / cols}%`, padding: 4 }} accessibilityRole="button" accessibilityLabel={full ?? label}>
          <View style={[styles.cell, key === current && styles.current]}>
            <Text style={[styles.cellText, key === current && styles.currentText]}>{label}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  sheet: { flex: 1, backgroundColor: c.bg, paddingTop: 52 },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, gap: 12 },
  headBtn: { minHeight: 44, minWidth: 64, justifyContent: 'center' },
  headBtnText: { color: c.accent, fontSize: 17, fontWeight: '600' },
  title: { flex: 1, fontSize: 20, fontWeight: '700', color: c.text },
  tabs: { flexDirection: 'row', marginHorizontal: 12, marginBottom: 8, backgroundColor: c.soft, borderRadius: 12, padding: 4 },
  tab: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  tabOn: { backgroundColor: c.card },
  tabText: { fontSize: 15, color: c.muted, fontWeight: '600' },
  tabTextOn: { color: c.accent },
  body: { paddingHorizontal: 12, paddingBottom: 40 },
  refRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  input: { flex: 1, minHeight: 48, borderRadius: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14, fontSize: 16, color: c.text },
  goBtn: { minHeight: 48, paddingHorizontal: 14, borderRadius: 12, backgroundColor: c.accent, justifyContent: 'center' },
  goText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  section: { fontSize: 14, fontWeight: '700', color: c.muted, textTransform: 'uppercase', marginTop: 12, marginBottom: 4, marginLeft: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { minHeight: 48, borderRadius: 10, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' },
  cellText: { fontSize: 16, color: c.text, fontWeight: '600' },
  current: { backgroundColor: c.accent },
  currentText: { color: '#fff' },
  wide: { minHeight: 48, borderRadius: 10, backgroundColor: c.text, alignItems: 'center', justifyContent: 'center', margin: 4, marginBottom: 8 },
  wideText: { color: c.bg, fontSize: 16, fontWeight: '700' },
  count: { marginHorizontal: 16, marginBottom: 4, color: c.muted },
  empty: { margin: 24, textAlign: 'center', color: c.muted, fontSize: 16 },
  refItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.soft },
  refHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 14, height: 14, borderRadius: 7 },
  refTitle: { fontSize: 16, fontWeight: '700', color: c.text },
  refText: { fontSize: 15, color: c.muted, marginTop: 2 },
});
