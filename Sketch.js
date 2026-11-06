import { useMemo, useRef, useState } from 'react';
import { Modal, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

const COLORS = ['#1c1917', '#dc2626', '#2563eb', '#16a34a', '#ea580c', '#9333ea'];
const TOOLS = [
  { id: 'pencil', label: '✏️', name: 'Pencil', width: 3, opacity: 1 },
  { id: 'pen', label: '🖊️', name: 'Pen', width: 6, opacity: 1 },
  { id: 'marker', label: '🖍️', name: 'Highlighter', width: 18, opacity: 0.35 },
  { id: 'eraser', label: '🧽', name: 'Eraser' },
];

export const pathOf = (points) => points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

// A finished drawing shown inside a note (scaled to fit the width).
export function DrawingPreview({ drawing, width }) {
  const height = Math.round((width * drawing.h) / drawing.w);
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${drawing.w} ${drawing.h}`}>
      <Rect x="0" y="0" width={drawing.w} height={drawing.h} fill="#ffffff" />
      {drawing.strokes.map((s, i) => (
        <Path key={i} d={pathOf(s.points)} stroke={s.color} strokeWidth={s.width} strokeOpacity={s.opacity}
          fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </Svg>
  );
}

// Full-screen drawing pad with pens, highlighter, eraser, colours and undo/redo.
export default function Sketch({ visible, initial, onSave, onClose }) {
  const [strokes, setStrokes] = useState(initial?.strokes ?? []);
  const [redo, setRedo] = useState([]);
  const [tool, setTool] = useState(TOOLS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState({ w: 1, h: 1 });
  const current = useRef(null);
  const [, force] = useState(0);
  const live = useRef({ tool, color, strokes });
  live.current = { tool, color, strokes };

  const eraseAt = (x, y) => {
    const hit = (s) => s.points.some(([px, py]) => Math.hypot(px - x, py - y) < 18 + s.width / 2);
    const left = live.current.strokes.filter((s) => !hit(s));
    if (left.length !== live.current.strokes.length) { setStrokes(left); setRedo([]); }
  };

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const { locationX: x, locationY: y } = e.nativeEvent;
      const { tool: t, color: c } = live.current;
      if (t.id === 'eraser') return eraseAt(x, y);
      current.current = { color: c, width: t.width, opacity: t.opacity, points: [[x, y]] };
      force((n) => n + 1);
    },
    onPanResponderMove: (e) => {
      const { locationX: x, locationY: y } = e.nativeEvent;
      if (live.current.tool.id === 'eraser') return eraseAt(x, y);
      current.current?.points.push([x, y]);
      force((n) => n + 1);
    },
    onPanResponderRelease: () => {
      const s = current.current;
      current.current = null;
      if (s) { setStrokes((all) => [...all, s]); setRedo([]); }
    },
  }), []);

  const undo = () => { if (!strokes.length) return; setRedo([strokes[strokes.length - 1], ...redo]); setStrokes(strokes.slice(0, -1)); };
  const again = () => { if (!redo.length) return; setStrokes([...strokes, redo[0]]); setRedo(redo.slice(1)); };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.page}>
        <View style={styles.head}>
          <Pressable onPress={onClose} style={styles.btn} accessibilityRole="button" accessibilityLabel="Cancel drawing"><Text style={styles.btnText}>✕</Text></Pressable>
          <Pressable onPress={undo} style={styles.btn} accessibilityRole="button" accessibilityLabel="Undo"><Text style={[styles.btnText, !strokes.length && styles.off]}>↶</Text></Pressable>
          <Pressable onPress={again} style={styles.btn} accessibilityRole="button" accessibilityLabel="Redo"><Text style={[styles.btnText, !redo.length && styles.off]}>↷</Text></Pressable>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => onSave(strokes.length ? { strokes, w: size.w, h: size.h } : null)} style={styles.btn} accessibilityRole="button" accessibilityLabel="Save drawing">
            <Text style={[styles.btnText, { color: '#c2410c' }]}>✓</Text>
          </Pressable>
        </View>

        <View style={styles.canvas} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })} {...pan.panHandlers}>
          <Svg width="100%" height="100%">
            {[...strokes, ...(current.current ? [current.current] : [])].map((s, i) => (
              <Path key={i} d={pathOf(s.points)} stroke={s.color} strokeWidth={s.width} strokeOpacity={s.opacity}
                fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </Svg>
        </View>

        <View style={styles.tools}>
          {TOOLS.map((t) => (
            <Pressable key={t.id} onPress={() => setTool(t)} style={[styles.tool, tool.id === t.id && styles.toolOn]} accessibilityRole="button" accessibilityLabel={t.name}>
              <Text style={styles.toolText}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.colors}>
          {COLORS.map((c) => (
            <Pressable key={c} onPress={() => { setColor(c); if (tool.id === 'eraser') setTool(TOOLS[0]); }} accessibilityRole="button" accessibilityLabel={`Colour ${c}`}
              style={[styles.color, { backgroundColor: c }, color === c && styles.colorOn]} />
          ))}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#ffffff', paddingTop: 44 },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  btn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 24, color: '#1c1917' },
  off: { color: '#d6d3d1' },
  canvas: { flex: 1, backgroundColor: '#ffffff' },
  tools: { flexDirection: 'row', justifyContent: 'center', gap: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#e7e5e4' },
  tool: { width: 56, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  toolOn: { backgroundColor: '#fde68a' },
  toolText: { fontSize: 26 },
  colors: { flexDirection: 'row', justifyContent: 'center', gap: 14, paddingVertical: 12, paddingBottom: 32 },
  color: { width: 34, height: 34, borderRadius: 17 },
  colorOn: { borderWidth: 3, borderColor: '#fbbf24' },
});
