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
    // Generate the next item while the current one plays, so verses follow each other without long gaps.
    let next = items.length ? AI.prepare(items[0].text, aiVoice) : null;
    for (let i = 0; i < items.length; i++) {
      const { onStart, onDone } = items[i];
      try {
        const file = await next;
        if (run !== id) return;
        next = i + 1 < items.length ? AI.prepare(items[i + 1].text, aiVoice) : null;
        next?.catch(() => {}); // a failure is handled when it is awaited
        onStart?.();
        await AI.play(file);
      } catch (e) {
        // AI voice failed (e.g. model files removed): finish the rest with the phone voice.
        console.warn('AI voice failed, using phone voice', e);
        if (run === id) speakQueue(items.slice(i), { phoneVoice, onEnd });
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
