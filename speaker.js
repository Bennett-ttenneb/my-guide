import * as Speech from 'expo-speech';
import * as AI from './aivoice';

// Speaks a queue of items [{ text, onStart, onDone }].
// Phone voice: everything is queued natively up front, so it keeps going with the screen off.
// AI voice: one item at a time from JS, because each call resolves only when its audio has finished.
let run = 0;

export function speakQueue(items, { phoneVoice, aiVoice, onEnd }) {
  const id = ++run;
  if (!aiVoice) {
    items.forEach(({ text, onStart, onDone }, i) => Speech.speak(text, {
      voice: phoneVoice ?? undefined,
      onStart,
      onDone: () => { onDone?.(); if (i === items.length - 1 && run === id) onEnd?.(); },
    }));
    if (!items.length) onEnd?.();
    return;
  }
  (async () => {
    // Keep a few verses generated ahead of the one playing, so short verses do not leave gaps behind long ones.
    const AHEAD = 3;
    const live = () => run === id;
    const ready = [];
    const fill = (upTo) => {
      for (let j = ready.length; j < Math.min(items.length, upTo + 1); j++) {
        ready[j] = AI.prepare(items[j].text, aiVoice, live);
        ready[j].catch(() => {}); // a failure is handled when it is awaited
      }
    };
    for (let i = 0; i < items.length; i++) {
      const { onStart, onDone } = items[i];
      fill(i + AHEAD);
      try {
        const file = await ready[i];
        if (!live()) return;
        onStart?.();
        await AI.play(file);
      } catch (e) {
        if (!live()) return;
        // AI voice failed (e.g. model files removed): finish the rest with the phone voice.
        console.warn('AI voice failed, using phone voice', e);
        speakQueue(items.slice(i), { phoneVoice, onEnd });
        return;
      }
      if (!live()) return;
      onDone?.();
    }
    if (live()) onEnd?.();
  })();
}

export function stopSpeaking() {
  run++;
  Speech.stop();
  AI.stop();
}
