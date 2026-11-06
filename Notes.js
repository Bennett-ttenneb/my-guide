import { useEffect, useState, useMemo } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from './theme';
import { parseKey, refName } from './nav';
import { normalizeNote, noteText } from './RichNote';

const when = (ms) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

const ICONS = { check: '☑', audio: '🎙', image: '🖼', drawing: '✍' };

// Notes (title, text, checklists, recordings, photos, drawings) plus every note written on a verse, newest first.
export default function Notes({ quickNotes, marks, bible, onNew, onEditQuick, onEditVerse, onGo }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const items = [
    ...quickNotes.map((n) => {
      const note = normalizeNote(n);
      const kinds = [...new Set(note.blocks.map((b) => ICONS[b.type]).filter(Boolean))].join(' ');
      return { ...n, kind: 'quick', title: note.title, text: noteText(note), kinds, date: n.updated ?? n.date };
    }),
    ...Object.entries(marks).filter(([, m]) => m.note).map(([key, m]) => ({ id: key, text: m.note, date: m.date ?? 0, kind: 'verse', ref: parseKey(key) })),
  ].sort((a, b) => b.date - a.date);

  return (
    <View style={{ flex: 1 }}>
      <Pressable onPress={onNew} style={styles.newBtn} accessibilityRole="button">
        <Text style={styles.addText}>＋  New note</Text>
      </Pressable>
      <FlatList
        data={items}
        keyExtractor={(n) => `${n.kind}${n.id}`}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        ListEmptyComponent={<Text style={styles.empty}>No notes yet. Tap New note, or tap a verse while reading to write a note on it.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.card} accessibilityRole="button"
            onPress={() => (item.kind === 'quick' ? onEditQuick(item) : onEditVerse(item.id))}>
            {item.kind === 'verse' && (
              <Pressable onPress={() => onGo({ book: item.ref.book, chapter: item.ref.chapter }, item.ref.verse - 1)} accessibilityRole="link">
                <Text style={styles.ref}>{refName(item.ref)} ›</Text>
                <Text style={styles.verse} numberOfLines={2}>{bible[item.ref.book]?.[item.ref.chapter - 1]?.[item.ref.verse - 1]}</Text>
              </Pressable>
            )}
            {item.title ? <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text> : null}
            {item.text ? <Text style={styles.text} numberOfLines={4}>{item.text}</Text> : null}
            <View style={styles.footer}>
              {item.date > 0 && <Text style={styles.date}>{when(item.date)}</Text>}
              {item.kinds ? <Text style={styles.date}>{item.kinds}</Text> : null}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

// Edit one note. Saving empty text deletes it.
export function NoteEditor({ title, subtitle, initial, visible, onSave, onDelete, onClose }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [text, setText] = useState(initial ?? '');
  useEffect(() => { if (visible) setText(initial ?? ''); }, [visible, initial]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.editor}>
        <View style={styles.editorHead}>
          <Pressable onPress={onClose} style={styles.headBtn} accessibilityRole="button"><Text style={styles.headBtnText}>Cancel</Text></Pressable>
          <Text style={styles.editorTitle} numberOfLines={1}>{title}</Text>
          <Pressable onPress={() => onSave(text.trim())} style={styles.headBtn} accessibilityRole="button"><Text style={[styles.headBtnText, { textAlign: 'right' }]}>Save</Text></Pressable>
        </View>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <TextInput placeholderTextColor={c.muted} value={text} onChangeText={setText} multiline autoFocus placeholder="Your note…" style={styles.editorInput} textAlignVertical="top" accessibilityLabel="Note text" />
        {onDelete && initial ? (
          <Pressable onPress={onDelete} style={styles.delete} accessibilityRole="button"><Text style={styles.deleteText}>Delete note</Text></Pressable>
        ) : null}
      </View>
    </Modal>
  );
}

const makeStyles = (c) => StyleSheet.create({
  newBtn: { marginHorizontal: 16, marginTop: 4, marginBottom: 12, minHeight: 48, borderRadius: 12, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 17, fontWeight: '700', color: c.text, marginBottom: 4 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  compose: { flexDirection: 'row', gap: 8, padding: 16, paddingTop: 8 },
  input: { flex: 1, minHeight: 48, maxHeight: 120, borderRadius: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: c.text },
  addBtn: { minHeight: 48, paddingHorizontal: 18, borderRadius: 12, backgroundColor: c.accent, justifyContent: 'center', alignSelf: 'flex-end' },
  addText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  empty: { margin: 24, textAlign: 'center', color: c.muted, fontSize: 16 },
  card: { backgroundColor: c.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: c.soft },
  ref: { fontSize: 15, fontWeight: '700', color: c.accent },
  verse: { fontSize: 14, color: c.muted, fontStyle: 'italic', marginBottom: 6 },
  text: { fontSize: 16, color: c.text, lineHeight: 23 },
  date: { fontSize: 12, color: c.muted, marginTop: 6 },
  editor: { flex: 1, backgroundColor: c.bg, paddingTop: 52, paddingHorizontal: 16 },
  editorHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  headBtn: { minHeight: 44, minWidth: 64, justifyContent: 'center' },
  headBtnText: { color: c.accent, fontSize: 17, fontWeight: '600' },
  editorTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: c.text },
  subtitle: { fontSize: 15, color: c.muted, fontStyle: 'italic', marginBottom: 10 },
  editorInput: { flex: 1, maxHeight: 360, borderRadius: 12, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, padding: 14, fontSize: 17, color: c.text },
  delete: { alignItems: 'center', padding: 16 },
  deleteText: { color: c.danger, fontSize: 16, fontWeight: '600' },
});
