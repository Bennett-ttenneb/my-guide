import { useEffect, useState, useMemo } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from './theme';
import { parseKey, refName } from './nav';

const when = (ms) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

// Quick notes (free text) plus every note written on a verse, newest first.
export default function Notes({ quickNotes, marks, bible, onAdd, onEditQuick, onEditVerse, onGo }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [draft, setDraft] = useState('');
  const items = [
    ...quickNotes.map((n) => ({ ...n, kind: 'quick' })),
    ...Object.entries(marks).filter(([, m]) => m.note).map(([key, m]) => ({ id: key, text: m.note, date: m.date ?? 0, kind: 'verse', ref: parseKey(key) })),
  ].sort((a, b) => b.date - a.date);

  const add = () => {
    if (!draft.trim()) return;
    onAdd(draft.trim());
    setDraft('');
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.compose}>
        <TextInput placeholderTextColor={c.muted} value={draft} onChangeText={setDraft} placeholder="Write a quick note…" multiline style={styles.input} accessibilityLabel="New quick note" />
        <Pressable onPress={add} style={[styles.addBtn, !draft.trim() && { opacity: 0.4 }]} disabled={!draft.trim()} accessibilityRole="button">
          <Text style={styles.addText}>Add</Text>
        </Pressable>
      </View>
      <FlatList
        data={items}
        keyExtractor={(n) => `${n.kind}${n.id}`}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        ListEmptyComponent={<Text style={styles.empty}>No notes yet. Add a quick note above, or tap a verse while reading to write a note on it.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.card} accessibilityRole="button"
            onPress={() => (item.kind === 'quick' ? onEditQuick(item) : onEditVerse(item.id))}>
            {item.kind === 'verse' && (
              <Pressable onPress={() => onGo({ book: item.ref.book, chapter: item.ref.chapter }, item.ref.verse - 1)} accessibilityRole="link">
                <Text style={styles.ref}>{refName(item.ref)} ›</Text>
                <Text style={styles.verse} numberOfLines={2}>{bible[item.ref.book]?.[item.ref.chapter - 1]?.[item.ref.verse - 1]}</Text>
              </Pressable>
            )}
            <Text style={styles.text}>{item.text}</Text>
            {item.date > 0 && <Text style={styles.date}>{when(item.date)}</Text>}
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
