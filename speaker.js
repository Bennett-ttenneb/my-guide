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
    for (const { text, onStart, onDone } of items) {
      if (run !== id) return;
      onStart?.();
      try {
        await AI.speak(text, aiVoice);
      } catch (e) {
        // AI voice failed (e.g. files removed): finish the rest with the phone voice.
        console.warn('AI voice failed, using phone voice', e);
        if (run === id) speakQueue(items.slice(items.findIndex((it) => it.text === text)), { phoneVoice, onEnd });
        return;
      }
      if (run !== id) return;
      onDone?.();
    }
    if (run === id) onEnd?.();
  })();
}

export function stopSpeaking() {
  run++;
  Speech.stop();
  AI.stop();
}
