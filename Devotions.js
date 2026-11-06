import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from './theme';
import { TOPICS } from './topics';
import { parseRange, rangeText, refName } from './nav';
import { dailyFor, dailyHistory } from './daily';

const KINDS = [['prayer', 'Prayers'], ['devotional', 'Devotionals']];

// Topical prayers and devotionals built from scripture; verses are shown in the reader's chosen translation.
export default function Devotions({ bible, speaking, onRead, onStop, onGo }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [kind, setKind] = useState('prayer');
  const [open, setOpen] = useState(null);
  const [day, setDay] = useState(null); // daily devotional being read
  const [history, setHistory] = useState(false);
  const today = dailyFor();

  const passages = (refs) => refs.map((ref) => {
    const r = parseRange(ref);
    const verses = r ? rangeText(bible, r) : [];
    return { ref, r, label: r ? `${refName(r)}${r.to > r.verse ? `-${r.to}` : ''}` : ref, text: verses.join(' ') };
  });

  function readTopic(t) {
    const texts = [t.title + '.', t.summary];
    for (const s of t.sections) {
      texts.push(s.heading + '.');
      for (const p of passages(s.refs)) if (p.text) texts.push(`${p.label.replace(':', ', verse ').replace('-', ' to ')}.`, p.text);
      texts.push(s.text);
    }
    if (t.declarations?.length) texts.push('Declarations.', ...t.declarations);
    texts.push('Let us pray.', t.prayer);
    onRead(texts);
  }

  function readDaily(d) {
    const texts = [`${d.topic.title}. ${d.section.heading}.`];
    for (const p of passages(d.reading)) if (p.text) texts.push(`${p.label.replace(':', ', verse ').replace('-', ' to ')}.`, p.text);
    texts.push(d.section.text);
    onRead(texts);
  }

  const longDate = (key) => new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const header = (
    <View style={{ gap: 10, marginBottom: 6 }}>
      <Pressable style={styles.today} onPress={() => setDay(today)} accessibilityRole="button" accessibilityLabel={`Today's devotional: ${today.section.heading}`}>
        <Text style={styles.todayLabel}>TODAY’S DEVOTIONAL · {longDate(today.key).toUpperCase()}</Text>
        <Text style={styles.todayTitle}>{today.topic.icon} {today.section.heading}</Text>
        <Text style={styles.todayVerse} numberOfLines={3}>“{passages([today.verse])[0].text}” — {passages([today.verse])[0].label}</Text>
        <Text style={styles.todayMore}>Read today’s devotional ›</Text>
      </Pressable>
      <Pressable onPress={() => setHistory(true)} style={styles.earlier} accessibilityRole="button">
        <Text style={styles.earlierText}>Earlier devotionals ›</Text>
      </Pressable>
      <View style={[styles.kinds, { paddingHorizontal: 0, marginBottom: 0 }]}>
        {KINDS.map(([id, label]) => (
          <Pressable key={id} onPress={() => setKind(id)} style={[styles.kind, kind === id && styles.kindOn]} accessibilityRole="tab" accessibilityState={{ selected: kind === id }}>
            <Text style={[styles.kindText, kind === id && styles.kindTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        ListHeaderComponent={header}
        data={TOPICS.filter((t) => t.kind === kind)}
        keyExtractor={(t) => t.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 10 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 10 }}
        renderItem={({ item: t }) => (
          <Pressable style={styles.card} onPress={() => setOpen(t)} accessibilityRole="button" accessibilityLabel={`${t.title}. ${t.summary}`}>
            <Text style={styles.icon}>{t.icon}</Text>
            <Text style={styles.cardTitle}>{t.title}</Text>
            <Text style={styles.cardSummary} numberOfLines={3}>{t.summary}</Text>
          </Pressable>
        )}
      />

      <Modal visible={history} animationType="slide" onRequestClose={() => setHistory(false)}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Pressable onPress={() => setHistory(false)} style={styles.headBtn} accessibilityRole="button"><Text style={styles.headBtnText}>‹ Back</Text></Pressable>
            <Text style={styles.headTitle}>Earlier devotionals</Text>
          </View>
          <FlatList
            data={dailyHistory(30)}
            keyExtractor={(d) => d.key}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
            renderItem={({ item: d, index }) => (
              <Pressable style={styles.histRow} onPress={() => { setHistory(false); setDay(d); }} accessibilityRole="button">
                <Text style={styles.histDate}>{index === 0 ? 'Today' : longDate(d.key)}</Text>
                <Text style={styles.histTitle}>{d.topic.icon} {d.section.heading}</Text>
                <Text style={styles.histTopic}>{d.topic.title} · {passages([d.verse])[0].label}</Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>

      <Modal visible={!!day} animationType="slide" onRequestClose={() => { onStop(); setDay(null); }}>
        {day && (
          <View style={styles.sheet}>
            <View style={[styles.head, { justifyContent: 'space-between' }]}>
              <Pressable onPress={() => { onStop(); setDay(null); }} style={styles.headBtn} accessibilityRole="button"><Text style={styles.headBtnText}>‹ Back</Text></Pressable>
              <Pressable onPress={() => (speaking ? onStop() : readDaily(day))} style={styles.listen} accessibilityRole="button">
                <Text style={styles.listenText}>{speaking ? '■  Stop' : '▶  Listen'}</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.body}>
              <Text style={styles.todayLabel}>{longDate(day.key).toUpperCase()}</Text>
              <Text style={styles.title}>{day.section.heading}</Text>
              <Text style={styles.summary}>{day.topic.icon} {day.topic.title}</Text>
              <View style={styles.section}>
                <Text style={styles.heading}>Reading</Text>
                {passages(day.reading).map((p) => (
                  <Pressable key={p.ref} style={styles.scripture} accessibilityRole="link" accessibilityHint="Opens this passage in the Bible"
                    onPress={() => { if (p.r) { onStop(); setDay(null); onGo({ book: p.r.book, chapter: p.r.chapter }, p.r.verse - 1); } }}>
                    <Text style={styles.ref}>{p.label} ›</Text>
                    <Text style={styles.verse}>{p.text || 'Not in this translation.'}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.section}>
                <Text style={styles.heading}>Reflection</Text>
                <Text style={styles.reflection}>{day.section.text}</Text>
              </View>
              <View style={[styles.section, styles.prayerBox]}>
                <Text style={styles.heading}>Verse for today</Text>
                <Text style={styles.prayer}>“{passages([day.verse])[0].text}”</Text>
                <Text style={[styles.ref, { marginTop: 6 }]}>— {passages([day.verse])[0].label}</Text>
              </View>
              <Pressable onPress={() => { onStop(); setDay(null); setOpen(day.topic); }} style={[styles.earlier, { marginTop: 18 }]} accessibilityRole="button">
                <Text style={styles.earlierText}>More on {day.topic.title}, with a prayer ›</Text>
              </Pressable>
            </ScrollView>
          </View>
        )}
      </Modal>

      <Modal visible={!!open} animationType="slide" onRequestClose={() => { onStop(); setOpen(null); }}>
        {open && (
          <View style={styles.sheet}>
            <View style={styles.head}>
              <Pressable onPress={() => { onStop(); setOpen(null); }} style={styles.headBtn} accessibilityRole="button">
                <Text style={styles.headBtnText}>‹ Back</Text>
              </Pressable>
              <Pressable onPress={() => (speaking ? onStop() : readTopic(open))} style={styles.listen} accessibilityRole="button">
                <Text style={styles.listenText}>{speaking ? '■  Stop' : '▶  Listen'}</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.body}>
              <Text style={styles.bigIcon}>{open.icon}</Text>
              <Text style={styles.title}>{open.title}</Text>
              <Text style={styles.summary}>{open.summary}</Text>

              {open.sections.map((s) => (
                <View key={s.heading} style={styles.section}>
                  <Text style={styles.heading}>{s.heading}</Text>
                  {passages(s.refs).map((p) => (
                    <Pressable key={p.ref} style={styles.scripture} accessibilityRole="link" accessibilityHint="Opens this passage in the Bible"
                      onPress={() => { if (p.r) { onStop(); setOpen(null); onGo({ book: p.r.book, chapter: p.r.chapter }, p.r.verse - 1); } }}>
                      <Text style={styles.ref}>{p.label} ›</Text>
                      <Text style={styles.verse}>{p.text || 'Not in this translation.'}</Text>
                    </Pressable>
                  ))}
                  <Text style={styles.reflection}>{s.text}</Text>
                </View>
              ))}

              {open.declarations?.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.heading}>Declarations</Text>
                  {open.declarations.map((d) => <Text key={d} style={styles.declaration}>• {d}</Text>)}
                </View>
              )}

              <View style={[styles.section, styles.prayerBox]}>
                <Text style={styles.heading}>🙏 Prayer</Text>
                <Text style={styles.prayer}>{open.prayer}</Text>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  today: { backgroundColor: c.accentSoft, borderRadius: 18, padding: 16, gap: 6 },
  todayLabel: { fontSize: 12, fontWeight: '700', color: c.accent, letterSpacing: 0.6 },
  todayTitle: { fontSize: 20, fontWeight: '800', color: c.text },
  todayVerse: { fontSize: 15, color: c.text, fontStyle: 'italic', lineHeight: 22 },
  todayMore: { fontSize: 15, fontWeight: '700', color: c.accent },
  earlier: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: c.border, justifyContent: 'center', paddingHorizontal: 14 },
  earlierText: { color: c.text, fontSize: 15, fontWeight: '600' },
  headTitle: { flex: 1, fontSize: 20, fontWeight: '700', color: c.text },
  histRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.soft, gap: 2 },
  histDate: { fontSize: 13, color: c.muted, fontWeight: '600' },
  histTitle: { fontSize: 17, color: c.text, fontWeight: '700' },
  histTopic: { fontSize: 14, color: c.muted },
  kinds: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  kind: { minHeight: 40, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: c.border, justifyContent: 'center' },
  kindOn: { backgroundColor: c.accent, borderColor: c.accent },
  kindText: { fontSize: 15, fontWeight: '600', color: c.muted },
  kindTextOn: { color: '#fff' },
  card: { flex: 1, backgroundColor: c.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: c.soft, minHeight: 140 },
  icon: { fontSize: 28, marginBottom: 6 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 4 },
  cardSummary: { fontSize: 13, color: c.muted, lineHeight: 18 },
  sheet: { flex: 1, backgroundColor: c.bg, paddingTop: 52 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 },
  headBtn: { minHeight: 44, minWidth: 64, justifyContent: 'center' },
  headBtnText: { color: c.accent, fontSize: 17, fontWeight: '600' },
  listen: { minHeight: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: c.accent, justifyContent: 'center' },
  listenText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  body: { paddingHorizontal: 20, paddingBottom: 48 },
  bigIcon: { fontSize: 44, marginTop: 4 },
  title: { fontSize: 28, fontWeight: '800', color: c.text, marginTop: 4 },
  summary: { fontSize: 16, color: c.muted, marginTop: 6, lineHeight: 22 },
  section: { marginTop: 22 },
  heading: { fontSize: 19, fontWeight: '700', color: c.text, marginBottom: 8 },
  scripture: { borderLeftWidth: 3, borderLeftColor: c.accent, paddingLeft: 12, marginBottom: 10 },
  ref: { fontSize: 14, fontWeight: '700', color: c.accent, marginBottom: 2 },
  verse: { fontSize: 16, color: c.text, lineHeight: 24, fontStyle: 'italic' },
  reflection: { fontSize: 16, color: c.text, lineHeight: 24, marginTop: 4 },
  declaration: { fontSize: 16, color: c.text, lineHeight: 24, marginBottom: 6 },
  prayerBox: { backgroundColor: c.accentSoft, borderRadius: 16, padding: 16 },
  prayer: { fontSize: 17, color: c.text, lineHeight: 27 },
});
