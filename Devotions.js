import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from './theme';
import { TOPICS } from './topics';
import { parseRange, rangeText, refName } from './nav';

const KINDS = [['prayer', 'Prayers'], ['devotional', 'Devotionals']];

// Topical prayers and devotionals built from scripture; verses are shown in the reader's chosen translation.
export default function Devotions({ bible, speaking, onRead, onStop, onGo }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [kind, setKind] = useState('prayer');
  const [open, setOpen] = useState(null);

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

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.kinds}>
        {KINDS.map(([id, label]) => (
          <Pressable key={id} onPress={() => setKind(id)} style={[styles.kind, kind === id && styles.kindOn]} accessibilityRole="tab" accessibilityState={{ selected: kind === id }}>
            <Text style={[styles.kindText, kind === id && styles.kindTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <FlatList
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
