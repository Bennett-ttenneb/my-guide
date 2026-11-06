import { useMemo } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from './theme';
import { chapterName, dayChapters, perDay, planProgress, planStatus } from './plan';

const ROW = 68;

// Bible-reading plan: every day's chapters, ticks for days done, and catching up on missed days.
export default function PlanView({ visible, state, onClose, onMark, onOpen, onListen, onYear }) {
  const c = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  if (!visible) return null;
  const { day, completed, behind, total } = planStatus(state);
  const start = new Date(`${state.plan.start}T12:00:00`);
  const dateOf = (n) => { const d = new Date(start); d.setDate(start.getDate() + n - 1); return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); };
  const label = (n) => { const ch = dayChapters(state.plan, n); return ch.length > 1 ? `${chapterName(ch[0])} – ${chapterName(ch[ch.length - 1])}` : ch[0] ? chapterName(ch[0]) : ''; };
  const days = Array.from({ length: total }, (_, i) => i + 1);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.page}>
        <View style={styles.head}>
          <Pressable onPress={onClose} style={styles.headBtn} accessibilityRole="button"><Text style={styles.headBtnText}>‹ Back</Text></Pressable>
          <Text style={styles.title}>Reading plan</Text>
        </View>

        <View style={styles.summary}>
          <Text style={styles.big}>Day {Math.min(day, total)} of {total}</Text>
          <View style={styles.track}><View style={[styles.fill, { width: `${Math.round(planProgress(state) * 100)}%` }]} /></View>
          <Text style={styles.muted}>{completed} days read · {Math.round(planProgress(state) * 100)}% of the Bible · about {perDay(state.plan)} chapters a day</Text>
          {state.plan.days !== 365 && (
            <Pressable onPress={onYear} style={styles.link} accessibilityRole="button"><Text style={styles.linkText}>Switch to Bible in a year (365 days)</Text></Pressable>
          )}
          <Text style={styles.muted}>Daily reminder at {String(state.hour).padStart(2, '0')}:00 (change it in Settings).</Text>
        </View>

        {behind > 0 ? (
          <View style={styles.catchUp}>
            <Text style={styles.catchTitle}>You’re {behind} day{behind > 1 ? 's' : ''} behind</Text>
            <Text style={styles.catchText}>Next missed: day {completed + 1}, {label(completed + 1)}.</Text>
            <View style={styles.row}>
              <Pressable onPress={() => onListen(dayChapters(state.plan, completed + 1))} style={styles.btn} accessibilityRole="button"><Text style={styles.btnText}>▶ Listen</Text></Pressable>
              <Pressable onPress={() => onMark(completed + 1)} style={styles.btn} accessibilityRole="button"><Text style={styles.btnText}>✓ Mark day {completed + 1}</Text></Pressable>
              {behind > 1 && (
                <Pressable onPress={() => onMark(completed + behind)} style={styles.btnGhost} accessibilityRole="button"><Text style={styles.btnGhostText}>Mark all {behind}</Text></Pressable>
              )}
            </View>
          </View>
        ) : (
          <Text style={styles.onTrack}>✓ You’re on track</Text>
        )}

        <FlatList
          data={days}
          keyExtractor={(n) => String(n)}
          getItemLayout={(_, i) => ({ length: ROW, offset: ROW * i, index: i })}
          initialScrollIndex={Math.max(0, Math.min(day, total) - 3)}
          renderItem={({ item: n }) => {
            const done = n <= completed;
            return (
              <View style={[styles.dayRow, n === day && styles.todayRow]}>
                <Pressable style={{ flex: 1 }} onPress={() => onOpen(dayChapters(state.plan, n)[0])} accessibilityRole="button" accessibilityLabel={`Day ${n}, ${label(n)}. Open`}>
                  <Text style={styles.dayTitle}>Day {n}{n === day ? ' · today' : ''} <Text style={styles.dayDate}>{dateOf(n)}</Text></Text>
                  <Text style={[styles.dayChapters, done && styles.doneText]} numberOfLines={1}>{label(n)}</Text>
                </Pressable>
                <Pressable onPress={() => onMark(done ? n - 1 : n)} style={[styles.tick, done && styles.tickOn]} accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={`Day ${n} read`}>
                  <Text style={[styles.tickText, done && { color: '#fff' }]}>✓</Text>
                </Pressable>
              </View>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const makeStyles = (c) => StyleSheet.create({
  page: { flex: 1, backgroundColor: c.bg, paddingTop: 44 },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 },
  headBtn: { minHeight: 44, minWidth: 64, justifyContent: 'center' },
  headBtnText: { color: c.accent, fontSize: 17, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '700', color: c.text },
  summary: { paddingHorizontal: 20, paddingVertical: 10, gap: 6 },
  big: { fontSize: 26, fontWeight: '800', color: c.text },
  track: { height: 10, borderRadius: 5, backgroundColor: c.soft, overflow: 'hidden' },
  fill: { height: 10, backgroundColor: c.accent },
  muted: { color: c.muted, fontSize: 14 },
  link: { minHeight: 40, justifyContent: 'center' },
  linkText: { color: c.accent, fontWeight: '700', fontSize: 15 },
  catchUp: { marginHorizontal: 16, marginBottom: 8, padding: 14, borderRadius: 16, backgroundColor: c.accentSoft, gap: 6 },
  catchTitle: { fontSize: 17, fontWeight: '800', color: c.accent },
  catchText: { fontSize: 15, color: c.text },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  btn: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, backgroundColor: c.accent, justifyContent: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
  btnGhost: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: c.accent, justifyContent: 'center' },
  btnGhostText: { color: c.accent, fontWeight: '700' },
  onTrack: { marginHorizontal: 20, marginBottom: 8, color: c.accent, fontWeight: '700', fontSize: 16 },
  dayRow: { height: ROW, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: c.soft },
  todayRow: { backgroundColor: c.soft },
  dayTitle: { fontSize: 16, fontWeight: '700', color: c.text },
  dayDate: { fontSize: 13, fontWeight: '400', color: c.muted },
  dayChapters: { fontSize: 14, color: c.muted },
  doneText: { textDecorationLine: 'line-through' },
  tick: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
  tickOn: { backgroundColor: c.accent, borderColor: c.accent },
  tickText: { fontSize: 18, fontWeight: '800', color: c.border },
});
