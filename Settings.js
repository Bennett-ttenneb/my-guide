import { useEffect, useState, useMemo } from 'react';
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from './theme';
import * as Speech from 'expo-speech';
import * as AI from './aivoice';
import { speakQueue, stopSpeaking } from './speaker';

const SAMPLE = 'The Lord is my shepherd; I shall not want. He makes me lie down in green pastures.';
import { chapterName, dayKey, perDay, PLAN_ORDERS, planProgress, todaysReading, TOTAL_CHAPTERS } from './plan';

const PRESETS = [['1 chapter a day', TOTAL_CHAPTERS], ['2 years', 730], ['1 year', 365], ['6 months', 182], ['90 days', 90], ['30 days', 30]];
const THEMES = [['auto', 'Match phone'], ['light', 'Light'], ['dark', 'Dark']];

export default function Settings({ visible, state, streak, voices, onChange, onStopReading, onClose, onOpenPlan }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [voicesOpen, setVoicesOpen] = useState(false);
  const voiceName = voices.find((v) => v.identifier === state.voice)?.name ?? 'Phone default';

  const [installed, setInstalled] = useState(null); // ids of downloaded AI voices; null while checking
  const [downloading, setDownloading] = useState(null); // { id, progress }
  const [aiError, setAiError] = useState(null);

  useEffect(() => {
    if (visible && AI.supported) AI.installedVoices().then(setInstalled).catch(() => setInstalled([]));
  }, [visible]);

  function pickVoice(identifier) {
    onStopReading();
    onChange({ voice: identifier, aiVoice: null });
    Speech.speak(SAMPLE, { voice: identifier ?? undefined });
  }

  function pickAiVoice(id) {
    onStopReading();
    onChange({ aiVoice: id });
    speakQueue([{ text: SAMPLE }], { aiVoice: id });
  }

  // A downloaded voice is chosen and previewed; any other is downloaded first (one at a time).
  async function tapAiVoice(id) {
    if (installed?.includes(id)) return pickAiVoice(id);
    if (downloading) return;
    setAiError(null);
    setDownloading({ id, progress: 0 });
    try {
      await AI.install(id, (progress) => setDownloading({ id, progress }));
      setInstalled((list) => [...(list ?? []), id]);
      pickAiVoice(id);
    } catch (e) {
      setAiError(`Download did not finish (${e?.message ?? e}). Check your internet connection and try again.`);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScrollView style={styles.sheet} contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <Text style={styles.big}>🔥 {streak}</Text>
          <Text style={styles.muted}>day streak · best {state.best}</Text>
          <Text style={[styles.muted, { marginTop: 8 }]}>
            Today’s reading: {todaysReading(state).map(chapterName).join(', ')}
            {state.lastDay === dayKey() ? ' ✓ done' : ''}
          </Text>
        </View>

        <Row label="Your name">
          <TextInput value={state.name ?? ''} onChangeText={(name) => onChange({ name })} placeholder="For your greeting" placeholderTextColor={c.muted}
            style={styles.nameInput} autoCapitalize="words" maxLength={30} accessibilityLabel="Your name, used in the greeting" />
        </Row>

        <Text style={styles.section}>Reading plan</Text>
        <Pressable onPress={onOpenPlan} style={styles.planBtn} accessibilityRole="button">
          <Text style={styles.planBtnText}>📅  Open plan: days, catch-up and progress</Text>
        </Pressable>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round(planProgress(state) * 100)}%` }]} /></View>
        <Text style={styles.muted}>{Math.round(planProgress(state) * 100)}% done · {perDay(state.plan) === 1 ? '1 chapter' : `about ${perDay(state.plan)} chapters`} a day · finish in {state.plan.days} days</Text>
        <Chips items={PRESETS} value={state.plan.days} onPick={(days) => onChange({ plan: { ...state.plan, days } })} />
        <Row label="Custom length">
          <Stepper value={`${state.plan.days} days`} onMinus={() => onChange({ plan: { ...state.plan, days: Math.max(7, state.plan.days - (state.plan.days > 100 ? 10 : 1)) } })}
            onPlus={() => onChange({ plan: { ...state.plan, days: Math.min(TOTAL_CHAPTERS, state.plan.days + (state.plan.days >= 100 ? 10 : 1)) } })} />
        </Row>
        <Chips items={Object.entries(PLAN_ORDERS).map(([id, label]) => [label, id])} value={state.plan.order}
          onPick={(order) => onChange({ plan: { ...state.plan, order } })} />
        <Pressable style={styles.linkBtn} accessibilityRole="button" onPress={() => Alert.alert('Start the plan over?', 'Your progress goes back to the first day. Your streak, notes and highlights are kept.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Start over', style: 'destructive', onPress: () => onChange({ chapter: 0, lastDay: null }) },
        ])}>
          <Text style={styles.linkText}>Start plan over</Text>
        </Pressable>

        <Text style={styles.section}>Appearance & sound</Text>
        <Chips items={THEMES.map(([id, label]) => [label, id])} value={state.theme} onPick={(theme) => onChange({ theme })} />
        <Row label="Morning reminder">
          <Stepper value={`${String(state.hour).padStart(2, '0')}:00`} onMinus={() => onChange({ hour: (state.hour + 23) % 24 })} onPlus={() => onChange({ hour: (state.hour + 1) % 24 })} />
        </Row>
        <Row label="Text size">
          <Stepper value={String(state.fontSize)} onMinus={() => onChange({ fontSize: Math.max(14, state.fontSize - 1) })} onPlus={() => onChange({ fontSize: Math.min(32, state.fontSize + 1) })} />
        </Row>

        <Text style={styles.section}>Natural AI voice</Text>
        {!AI.supported ? <Text style={styles.muted}>Available in the phone app.</Text> : (
          <>
            <Text style={styles.muted}>Human-sounding voices that run on your phone. Each is a one-time download of about 20 MB (use Wi-Fi), then works offline. Tap one to download it; tap a downloaded one to hear and use it. Overnight play and non-English Bibles use the phone voice below.</Text>
            {aiError && <Text style={[styles.muted, { color: c.danger, marginTop: 6 }]}>{aiError}</Text>}
            {AI.AI_VOICES.map(([id, label]) => {
              const have = installed?.includes(id);
              const busy = downloading?.id === id;
              return (
                <Pressable key={id} onPress={() => tapAiVoice(id)} disabled={installed === null || (!!downloading && !busy)} style={styles.voiceRow} accessibilityRole="button"
                  accessibilityLabel={`${label}. ${have ? (state.aiVoice === id ? 'Selected' : 'Downloaded') : 'Download about 20 megabytes'}`}>
                  <Text style={styles.value}>{state.aiVoice === id ? '✓ ' : ''}{label}</Text>
                  <Text style={styles.muted}>{busy ? `Downloading… ${Math.round(downloading.progress * 100)}%` : have ? 'Downloaded' : installed === null ? '…' : '⬇ Download · 20 MB'}</Text>
                </Pressable>
              );
            })}
            {AI.isAiVoice(state.aiVoice) && (
              <Pressable onPress={() => { stopSpeaking(); onChange({ aiVoice: null }); }} style={styles.linkBtn} accessibilityRole="button">
                <Text style={[styles.linkText, { color: c.accent }]}>Use the phone voice instead</Text>
              </Pressable>
            )}
          </>
        )}

        <Pressable onPress={() => setVoicesOpen(!voicesOpen)} accessibilityRole="button">
          <Row label="Phone voice"><Text style={styles.value}>{voiceName} {voicesOpen ? '▴' : '▾'}</Text></Row>
        </Pressable>
        {voicesOpen && (
          <View>
            <Text style={[styles.muted, { marginVertical: 8 }]}>Tap one to hear it. More voices can be downloaded in your phone’s text-to-speech settings.</Text>
            {[{ identifier: null, name: 'Phone default', language: '' }, ...voices].map((v) => (
              <Pressable key={v.identifier ?? 'default'} onPress={() => pickVoice(v.identifier)} style={styles.voiceRow} accessibilityRole="button">
                <Text style={styles.value}>{v.identifier === state.voice ? '✓ ' : ''}{v.name}</Text>
                <Text style={styles.muted}>{v.language}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Pressable style={styles.button} onPress={() => { stopSpeaking(); setVoicesOpen(false); onClose(); }} accessibilityRole="button">
          <Text style={styles.buttonText}>Done</Text>
        </Pressable>

        <Text style={styles.credit}>My Guide · made by BBotnics Industries</Text>
        <Text style={styles.footnote}>Bible texts from eBible.org: public domain, except where a licence is shown in the translation list. Natural voices: Piper models. Speech to text: Kroko ASR by Banafo (CC BY-SA 4.0). Both run on sherpa-onnx.</Text>
        <View style={styles.legal}>
          {[['Privacy policy', 'PRIVACY.md'], ['Terms of use', 'TERMS.md']].map(([label, file]) => (
            <Pressable key={file} onPress={() => Linking.openURL(`https://github.com/Bennett-ttenneb/my-guide/blob/main/${file}`)} style={styles.linkBtn} accessibilityRole="link">
              <Text style={[styles.linkText, { color: c.accent }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Modal>
  );
}

function Chips({ items, value, onPick }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.chips}>
      {items.map(([label, id]) => (
        <Pressable key={id} onPress={() => onPick(id)} style={[styles.chip, id === value && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: id === value }}>
          <Text style={[styles.chipText, id === value && styles.chipTextOn]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Row({ label, children }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function Stepper({ value, onMinus, onPlus }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.stepper}>
      <Pressable onPress={onMinus} style={styles.small} accessibilityLabel="Decrease"><Text style={styles.smallText}>−</Text></Pressable>
      <Text style={styles.value}>{value}</Text>
      <Pressable onPress={onPlus} style={styles.small} accessibilityLabel="Increase"><Text style={styles.smallText}>+</Text></Pressable>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  nameInput: { minWidth: 160, minHeight: 44, textAlign: 'right', fontSize: 17, color: c.text },
  planBtn: { minHeight: 48, borderRadius: 12, backgroundColor: c.accentSoft, justifyContent: 'center', paddingHorizontal: 14, marginBottom: 6 },
  planBtnText: { color: c.accent, fontSize: 16, fontWeight: '700' },
  section: { fontSize: 14, fontWeight: '700', color: c.muted, textTransform: 'uppercase', marginTop: 20, marginBottom: 8 },
  progressTrack: { height: 10, borderRadius: 5, backgroundColor: c.soft, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: 10, backgroundColor: c.accent },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 10 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: c.border, justifyContent: 'center' },
  chipOn: { backgroundColor: c.accent, borderColor: c.accent },
  chipText: { fontSize: 14, color: c.text, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  linkBtn: { minHeight: 44, justifyContent: 'center' },
  legal: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 8 },
  linkText: { color: c.danger, fontSize: 15, fontWeight: '600' },
  sheet: { flex: 1, backgroundColor: c.bg },
  body: { paddingTop: 64, paddingHorizontal: 20, paddingBottom: 48 },
  card: { alignItems: 'center', backgroundColor: c.soft, borderRadius: 16, padding: 20, marginBottom: 16 },
  big: { fontSize: 44, fontWeight: '700', color: c.accent },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56, borderBottomWidth: 1, borderBottomColor: c.soft },
  label: { fontSize: 17, color: c.text, fontWeight: '600' },
  value: { fontSize: 17, color: c.text },
  muted: { color: c.muted, fontSize: 15 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  small: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' },
  smallText: { fontSize: 24, color: c.text },
  voiceRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.soft },
  button: { backgroundColor: c.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 },
  buttonText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  credit: { textAlign: 'center', marginTop: 28, fontSize: 15, fontWeight: '600', color: c.text },
  footnote: { textAlign: 'center', marginTop: 4, fontSize: 13, color: c.muted },
});
