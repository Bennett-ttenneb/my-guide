import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from './theme';
import { keep } from './attachments';
import Sketch, { DrawingPreview } from './Sketch';

// A note is { id, title, blocks, date, updated }. Blocks:
//   text  { text, style }   check { text, done, style }   audio { uri, duration }
//   image { uri, w, h }     drawing { strokes, w, h }
// Formatting is per block (bold, italic, underline, strike, list, quote, align, indent).
let seq = 0;
const key = () => `b${Date.now().toString(36)}${seq++}`;
const textBlock = (text = '', style = {}) => ({ key: key(), type: 'text', text, style });

export function normalizeNote(n) {
  if (n.blocks) return { ...n, blocks: n.blocks.map((b) => ({ key: key(), style: {}, ...b })) };
  return { id: n.id, title: '', date: n.date, updated: n.date, blocks: [textBlock(n.text ?? '')] }; // notes from before 2.1
}

export const noteText = (n) => n.blocks.filter((b) => b.type === 'text' || b.type === 'check').map((b) => b.text).join('\n');
export const isEmptyNote = (n) => !n.title.trim() && n.blocks.every((b) => (b.type === 'text' || b.type === 'check') && !b.text.trim());

function plain(n) {
  const lines = n.blocks.map((b, i) => {
    if (b.type === 'check') return `${b.done ? '☑' : '☐'} ${b.text}`;
    if (b.type === 'text') return `${b.style?.list === 'bullet' ? '• ' : b.style?.list === 'number' ? `${listNumber(n.blocks, i)}. ` : ''}${b.text}`;
    return { audio: '[voice recording]', image: '[photo]', drawing: '[drawing]' }[b.type];
  });
  return [n.title, ...lines].filter(Boolean).join('\n');
}

function listNumber(blocks, i) {
  let n = 1;
  for (let j = i - 1; j >= 0 && blocks[j].type === 'text' && blocks[j].style?.list === 'number'; j--) n++;
  return n;
}

const when = (ms) => new Date(ms).toLocaleString(undefined, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const clock = (ms) => { const s = Math.floor((ms ?? 0) / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

export default function RichNote({ note, onSave, onDelete, onClose }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { width } = useWindowDimensions();
  const [doc, setDoc] = useState(() => (note ? normalizeNote(note) : { id: Date.now(), title: '', date: Date.now(), blocks: [textBlock()] }));
  const docRef = useRef(doc);
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const lastEdit = useRef({ at: 0, block: null });
  const [focus, setFocus] = useState(0);
  const [formatBar, setFormatBar] = useState(false);
  const [sketch, setSketch] = useState(null); // { index, initial } while drawing
  const [menu, setMenu] = useState(false);
  const inputs = useRef({});
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const rec = useAudioRecorderState(recorder, 250);

  // Every change goes through here so undo/redo works. Typing in the same block within a second is one undo step.
  function change(next, typingIn = null) {
    const prev = docRef.current;
    const now = Date.now();
    const sameBurst = typingIn && lastEdit.current.block === typingIn && now - lastEdit.current.at < 1000;
    if (!sameBurst) { setPast((p) => [...p.slice(-60), prev]); setFuture([]); }
    lastEdit.current = { at: now, block: typingIn };
    docRef.current = next;
    setDoc(next);
  }
  const setBlocks = (blocks, typingIn) => change({ ...docRef.current, blocks }, typingIn);
  const patchBlock = (i, patch, typingIn) => setBlocks(docRef.current.blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)), typingIn);

  const undo = () => {
    if (!past.length) return;
    setFuture((f) => [docRef.current, ...f]);
    docRef.current = past[past.length - 1];
    setDoc(docRef.current);
    setPast(past.slice(0, -1));
  };
  const redo = () => {
    if (!future.length) return;
    setPast((p) => [...p, docRef.current]);
    docRef.current = future[0];
    setDoc(docRef.current);
    setFuture(future.slice(1));
  };

  // Focus is applied after the next render, once a newly added line has its input.
  const pendingFocus = useRef(null);
  const focusBlock = (i) => { setFocus(i); pendingFocus.current = docRef.current.blocks[i]?.key; };
  useEffect(() => {
    const k = pendingFocus.current;
    if (!k) return;
    pendingFocus.current = null;
    const t = setTimeout(() => inputs.current[k]?.focus(), 30);
    return () => clearTimeout(t);
  }, [doc]);

  // Inserts attachment blocks after the focused block, keeping a text line after them to carry on typing.
  function insert(...added) {
    const blocks = [...docRef.current.blocks];
    const at = Math.min(focus, blocks.length - 1);
    const here = blocks[at];
    const replaceEmpty = here && here.type === 'text' && !here.text && !here.style?.list;
    const tail = blocks[at + 1] && (blocks[at + 1].type === 'text' || blocks[at + 1].type === 'check') ? [] : [textBlock()];
    blocks.splice(replaceEmpty ? at : at + 1, replaceEmpty ? 1 : 0, ...added, ...tail);
    setBlocks(blocks);
  }

  function removeBlock(i) {
    const blocks = docRef.current.blocks.filter((_, j) => j !== i);
    setBlocks(blocks.length ? blocks : [textBlock()]);
  }

  // Enter on a checklist or list line starts a new line of the same kind.
  function newLineAfter(i) {
    const b = docRef.current.blocks[i];
    if (!b.text.trim()) return toPlain(i); // Enter on an empty item ends the list
    const blocks = [...docRef.current.blocks];
    blocks.splice(i + 1, 0, b.type === 'check' ? { key: key(), type: 'check', text: '', done: false, style: { ...b.style } } : textBlock('', { ...b.style }));
    setBlocks(blocks);
    focusBlock(i + 1);
  }
  const toPlain = (i) => patchBlock(i, { type: 'text', done: undefined, style: { ...docRef.current.blocks[i].style, list: undefined } });

  function backspaceEmpty(i) {
    const b = docRef.current.blocks[i];
    if (b.text || i === 0) return;
    if (b.type === 'check' || b.style?.list) return toPlain(i);
    removeBlock(i);
    focusBlock(i - 1);
  }

  function toggleCheck() {
    const i = focus;
    const b = docRef.current.blocks[i];
    if (b && b.type === 'check') return toPlain(i);
    if (b && b.type === 'text') return patchBlock(i, { type: 'check', done: false, style: { ...b.style, list: undefined } });
    insert({ key: key(), type: 'check', text: '', done: false, style: {} });
  }

  function format(patch) {
    const b = docRef.current.blocks[focus];
    if (!b || (b.type !== 'text' && b.type !== 'check')) return;
    const style = { ...b.style };
    for (const [k, v] of Object.entries(patch)) style[k] = typeof v === 'function' ? v(style[k]) : v;
    patchBlock(focus, { style });
  }

  async function startRecording() {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) return Alert.alert('Microphone needed', 'Allow microphone access in your phone settings to record voice notes.');
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  }
  async function stopRecording() {
    const duration = rec.durationMillis;
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false });
    if (!recorder.uri) return;
    try {
      insert({ key: key(), type: 'audio', uri: await keep(recorder.uri, 'm4a'), duration });
    } catch (e) {
      Alert.alert('Could not save the recording', String(e?.message ?? e));
    }
  }

  async function addImage(fromCamera) {
    if (fromCamera) {
      const { granted } = await ImagePicker.requestCameraPermissionsAsync();
      if (!granted) return Alert.alert('Camera needed', 'Allow camera access in your phone settings to take photos for notes.');
    }
    const pick = fromCamera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const res = await pick({ mediaTypes: ['images'], quality: 0.8 });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    try {
      insert({ key: key(), type: 'image', uri: await keep(a.uri, (a.uri.split('.').pop() || 'jpg').slice(0, 4)), w: a.width, h: a.height });
    } catch (e) {
      Alert.alert('Could not add the photo', String(e?.message ?? e));
    }
  }

  const finish = () => { if (rec.isRecording) stopRecording(); onSave({ ...docRef.current, updated: Date.now() }); };
  const chars = doc.title.length + noteText(doc).replace(/\n/g, '').length;
  const focused = doc.blocks[focus];
  const fs = focused?.style ?? {};
  const contentWidth = width - 40;

  return (
    <Modal visible animationType="slide" onRequestClose={finish}>
      <KeyboardAvoidingView style={styles.page} behavior="padding">
        <View style={styles.head}>
          <Pressable onPress={finish} style={styles.hBtn} accessibilityRole="button" accessibilityLabel="Save and go back"><Text style={styles.hText}>←</Text></Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={undo} style={styles.hBtn} accessibilityRole="button" accessibilityLabel="Undo"><Text style={[styles.hText, !past.length && styles.off]}>↶</Text></Pressable>
          <Pressable onPress={redo} style={styles.hBtn} accessibilityRole="button" accessibilityLabel="Redo"><Text style={[styles.hText, !future.length && styles.off]}>↷</Text></Pressable>
          <Pressable onPress={() => Share.share({ message: plain(docRef.current) })} style={styles.hBtn} accessibilityRole="button" accessibilityLabel="Share note"><Text style={styles.hText}>⇪</Text></Pressable>
          <Pressable onPress={() => setMenu(!menu)} style={styles.hBtn} accessibilityRole="button" accessibilityLabel="More"><Text style={styles.hText}>⋮</Text></Pressable>
          <Pressable onPress={finish} style={styles.hBtn} accessibilityRole="button" accessibilityLabel="Done"><Text style={[styles.hText, { color: c.accent }]}>✓</Text></Pressable>
        </View>
        {menu && (
          <View style={styles.menu}>
            <Pressable style={styles.menuRow} accessibilityRole="button" onPress={() => Alert.alert('Delete this note?', 'Its recordings, photos and drawings are deleted too.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => onDelete(docRef.current) },
            ])}>
              <Text style={[styles.menuText, { color: c.danger }]}>🗑  Delete note</Text>
            </Pressable>
          </View>
        )}

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <TextInput value={doc.title} onChangeText={(title) => change({ ...docRef.current, title }, 'title')} placeholder="Title"
            placeholderTextColor={c.muted} style={styles.title} accessibilityLabel="Note title" />
          <Text style={styles.meta}>{when(doc.updated ?? doc.date)}  |  {chars} characters</Text>

          {doc.blocks.map((b, i) => {
            if (b.type === 'audio') return <AudioBlock key={b.key} block={b} styles={styles} c={c} onDelete={() => removeBlock(i)} />;
            if (b.type === 'image') return (
              <Attachment key={b.key} styles={styles} onDelete={() => removeBlock(i)} label="photo">
                <Image source={{ uri: b.uri }} style={{ width: contentWidth, height: (contentWidth * b.h) / b.w, borderRadius: 12 }} resizeMode="cover" accessibilityLabel="Photo" />
              </Attachment>
            );
            if (b.type === 'drawing') return (
              <Attachment key={b.key} styles={styles} onDelete={() => removeBlock(i)} label="drawing">
                <Pressable onPress={() => setSketch({ index: i, initial: b })} accessibilityRole="button" accessibilityLabel="Edit drawing" style={styles.drawing}>
                  <DrawingPreview drawing={b} width={contentWidth} />
                </Pressable>
              </Attachment>
            );
            const st = b.style ?? {};
            const textStyle = [styles.text, st.bold && { fontWeight: '700' }, st.italic && { fontStyle: 'italic' },
              (st.underline || st.strike) && { textDecorationLine: [st.underline && 'underline', st.strike && 'line-through'].filter(Boolean).join(' ') },
              st.heading && { fontSize: 22, fontWeight: '800' }, { textAlign: st.align ?? 'left' },
              b.type === 'check' && b.done && { color: c.muted, textDecorationLine: 'line-through' }];
            const single = b.type === 'check' || !!st.list;
            return (
              <View key={b.key} style={[styles.row, { marginLeft: (st.indent ?? 0) * 24 }, st.quote && styles.quote]}>
                {b.type === 'check' && (
                  <Pressable onPress={() => patchBlock(i, { done: !b.done })} style={styles.box} accessibilityRole="checkbox" accessibilityState={{ checked: !!b.done }}>
                    <Text style={styles.boxText}>{b.done ? '☑' : '☐'}</Text>
                  </Pressable>
                )}
                {b.type === 'text' && st.list && <Text style={styles.bullet}>{st.list === 'bullet' ? '•' : `${listNumber(doc.blocks, i)}.`}</Text>}
                <TextInput
                  ref={(r) => { inputs.current[b.key] = r; }}
                  value={b.text}
                  onChangeText={(text) => patchBlock(i, { text }, b.key)}
                  onFocus={() => setFocus(i)}
                  multiline={!single}
                  submitBehavior={single ? 'submit' : undefined}
                  onSubmitEditing={single ? () => newLineAfter(i) : undefined}
                  onKeyPress={({ nativeEvent }) => nativeEvent.key === 'Backspace' && backspaceEmpty(i)}
                  placeholder={i === 0 && doc.blocks.length === 1 ? 'Start typing' : b.type === 'check' ? 'List item' : ''}
                  placeholderTextColor={c.muted}
                  style={textStyle}
                  accessibilityLabel={b.type === 'check' ? 'Checklist item' : 'Note text'}
                />
              </View>
            );
          })}
          <Pressable style={{ minHeight: 160 }} onPress={() => focusBlock(doc.blocks.length - 1)} accessibilityLabel="Continue writing" />
        </ScrollView>

        {rec.isRecording && (
          <View style={styles.recording}>
            <Text style={styles.recDot}>●</Text>
            <Text style={styles.recText}>Recording  {clock(rec.durationMillis)}</Text>
          </View>
        )}

        {formatBar ? (
          <ScrollView horizontal style={styles.bar} contentContainerStyle={styles.barInner} keyboardShouldPersistTaps="always">
            <Tool label="B" bold on={fs.bold} onPress={() => format({ bold: (v) => !v })} name="Bold" styles={styles} />
            <Tool label="I" italic on={fs.italic} onPress={() => format({ italic: (v) => !v })} name="Italic" styles={styles} />
            <Tool label="U" underline on={fs.underline} onPress={() => format({ underline: (v) => !v })} name="Underline" styles={styles} />
            <Tool label="S" strike on={fs.strike} onPress={() => format({ strike: (v) => !v })} name="Strikethrough" styles={styles} />
            <Tool label="H" on={fs.heading} onPress={() => format({ heading: (v) => !v })} name="Heading" styles={styles} />
            <Tool label="•≡" on={fs.list === 'bullet'} onPress={() => format({ list: (v) => (v === 'bullet' ? undefined : 'bullet') })} name="Bulleted list" styles={styles} />
            <Tool label="1≡" on={fs.list === 'number'} onPress={() => format({ list: (v) => (v === 'number' ? undefined : 'number') })} name="Numbered list" styles={styles} />
            <Tool label="❝" on={fs.quote} onPress={() => format({ quote: (v) => !v })} name="Quote" styles={styles} />
            <Tool label={{ center: '≡c', right: '≡r' }[fs.align] ?? '≡l'} onPress={() => format({ align: (v) => ({ left: 'center', center: 'right' }[v ?? 'left'] ?? 'left') })} name="Alignment" styles={styles} />
            <Tool label="⇥" onPress={() => format({ indent: (v) => Math.min((v ?? 0) + 1, 4) })} name="Indent" styles={styles} />
            <Tool label="⇤" onPress={() => format({ indent: (v) => Math.max((v ?? 0) - 1, 0) })} name="Outdent" styles={styles} />
            <Tool label="✕" onPress={() => setFormatBar(false)} name="Close formatting" styles={styles} />
          </ScrollView>
        ) : (
          <View style={[styles.bar, styles.barInner, { justifyContent: 'space-around' }]}>
            <Tool label={rec.isRecording ? '■' : '🎙'} on={rec.isRecording} onPress={rec.isRecording ? stopRecording : startRecording} name={rec.isRecording ? 'Stop recording' : 'Record voice'} styles={styles} />
            <Tool label="🖼" onPress={() => Alert.alert('Add a photo', undefined, [
              { text: 'Take photo', onPress: () => addImage(true) },
              { text: 'Choose from gallery', onPress: () => addImage(false) },
              { text: 'Cancel', style: 'cancel' },
            ])} name="Add photo" styles={styles} />
            <Tool label="✍" onPress={() => setSketch({ index: null, initial: null })} name="Draw" styles={styles} />
            <Tool label="☑" on={focused?.type === 'check'} onPress={toggleCheck} name="Checklist" styles={styles} />
            <Tool label="T" onPress={() => setFormatBar(true)} name="Text formatting" styles={styles} />
          </View>
        )}
      </KeyboardAvoidingView>

      {sketch && (
        <Sketch visible initial={sketch.initial} onClose={() => setSketch(null)} onSave={(drawing) => {
          if (sketch.index === null) { if (drawing) insert({ key: key(), type: 'drawing', ...drawing }); }
          else if (drawing) patchBlock(sketch.index, drawing);
          else removeBlock(sketch.index);
          setSketch(null);
        }} />
      )}
    </Modal>
  );
}

function Tool({ label, on, onPress, name, bold, italic, underline, strike, styles }) {
  return (
    <Pressable onPress={onPress} style={[styles.tool, on && styles.toolOn]} accessibilityRole="button" accessibilityLabel={name} accessibilityState={{ selected: !!on }}>
      <Text style={[styles.toolText, bold && { fontWeight: '800' }, italic && { fontStyle: 'italic' },
        underline && { textDecorationLine: 'underline' }, strike && { textDecorationLine: 'line-through' }]}>{label}</Text>
    </Pressable>
  );
}

function Attachment({ children, onDelete, label, styles }) {
  return (
    <View style={styles.attachment}>
      {children}
      <Pressable onPress={onDelete} style={styles.remove} accessibilityRole="button" accessibilityLabel={`Remove ${label}`}>
        <Text style={styles.removeText}>✕</Text>
      </Pressable>
    </View>
  );
}

// Play/pause bar for a voice recording, like a voice message.
function AudioBlock({ block, onDelete, styles, c }) {
  const player = useAudioPlayer(block.uri);
  const status = useAudioPlayerStatus(player);
  const bars = useMemo(() => Array.from({ length: 28 }, (_, i) => 4 + ((block.uri.charCodeAt(block.uri.length - 1 - (i % 9)) * (i + 3)) % 14)), [block.uri]);
  const progress = status.duration ? status.currentTime / status.duration : 0;
  const toggle = () => {
    if (status.playing) return player.pause();
    if (status.didJustFinish || progress > 0.98) player.seekTo(0);
    player.play();
  };
  return (
    <View style={styles.audio}>
      <Pressable onPress={toggle} style={styles.play} accessibilityRole="button" accessibilityLabel={status.playing ? 'Pause recording' : 'Play recording'}>
        <Text style={styles.playText}>{status.playing ? '❚❚' : '▶'}</Text>
      </Pressable>
      <Text style={styles.audioTime}>{clock(status.playing || progress ? status.currentTime * 1000 : block.duration)}</Text>
      <View style={styles.wave}>
        {bars.map((h, i) => <View key={i} style={{ width: 3, height: h, borderRadius: 2, backgroundColor: i / bars.length <= progress ? c.accent : c.muted }} />)}
      </View>
      <Pressable onPress={onDelete} style={styles.play} accessibilityRole="button" accessibilityLabel="Delete recording">
        <Text style={styles.trash}>🗑</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  page: { flex: 1, backgroundColor: c.bg, paddingTop: 44 },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  hBtn: { width: 46, height: 48, alignItems: 'center', justifyContent: 'center' },
  hText: { fontSize: 22, color: c.text },
  off: { color: c.border },
  menu: { position: 'absolute', top: 92, right: 12, zIndex: 10, backgroundColor: c.card, borderRadius: 12, borderWidth: 1, borderColor: c.border, elevation: 6 },
  menuRow: { paddingHorizontal: 18, minHeight: 48, justifyContent: 'center' },
  menuText: { fontSize: 16 },
  body: { paddingHorizontal: 20, paddingBottom: 24 },
  title: { fontSize: 26, fontWeight: '700', color: c.text, paddingVertical: 6 },
  meta: { fontSize: 13, color: c.muted, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  quote: { borderLeftWidth: 3, borderLeftColor: c.accent, paddingLeft: 10 },
  text: { flex: 1, fontSize: 17, lineHeight: 25, color: c.text, paddingVertical: 4 },
  box: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  boxText: { fontSize: 22, color: c.accent },
  bullet: { width: 28, fontSize: 17, lineHeight: 25, color: c.text, paddingVertical: 4 },
  attachment: { marginVertical: 8 },
  remove: { position: 'absolute', top: 6, right: 6, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  removeText: { color: '#fff', fontSize: 15 },
  drawing: { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: c.border },
  audio: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.soft, borderRadius: 14, paddingHorizontal: 6, marginVertical: 8, minHeight: 52 },
  play: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  playText: { fontSize: 18, color: c.accent },
  audioTime: { fontSize: 15, color: c.text, width: 52 },
  wave: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 24 },
  trash: { fontSize: 18 },
  recording: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 8, backgroundColor: c.soft, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginBottom: 6 },
  recDot: { color: '#dc2626', fontSize: 16 },
  recText: { color: c.text, fontSize: 15, fontWeight: '600' },
  bar: { flexGrow: 0, backgroundColor: c.soft, borderTopWidth: 1, borderTopColor: c.border },
  barInner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 4, paddingBottom: 10 },
  tool: { minWidth: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  toolOn: { backgroundColor: c.accentSoft },
  toolText: { fontSize: 20, color: c.text },
});
