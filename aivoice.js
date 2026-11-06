// On-device natural voices: Piper (VITS) models run by sherpa-onnx, which is built for the React Native
// new architecture. Each voice is its own ~20 MB download; after that it works offline.
// (Kokoro sounded better but generated speech 4x slower than real time on a Dimensity 1080 phone,
// leaving 15–25 s silences between verses, so 2.1.3 moved to Piper.)
import { Platform } from 'react-native';
import { downloadModel, isModelReady, modelDir } from './models';

// sherpa-onnx tts-models release ids (int8 medium: fast and small).
export const AI_VOICES = [
  ['vits-piper-en_US-hfc_female-medium-int8', 'Grace · warm US woman'],
  ['vits-piper-en_US-amy-medium-int8', 'Amy · US woman'],
  ['vits-piper-en_US-hfc_male-medium-int8', 'Henry · calm US man'],
  ['vits-piper-en_US-ryan-medium-int8', 'Ryan · US man'],
  ['vits-piper-en_GB-jenny_dioco-medium-int8', 'Jenny · British woman'],
  ['vits-piper-en_GB-cori-medium-int8', 'Cori · British woman'],
  ['vits-piper-en_GB-alan-medium-int8', 'Alan · British man'],
  ['vits-piper-en_GB-northern_english_male-medium-int8', 'Thomas · northern English man'],
];
export const isAiVoice = (id) => AI_VOICES.some(([v]) => v === id);

export const supported = Platform.OS === 'android' || Platform.OS === 'ios';

// Native modules are only required when used, so the web preview keeps working.
const ttsLib = () => require('react-native-sherpa-onnx/tts');
const fs = () => require('@dr.pogodin/react-native-fs');
const audio = () => require('expo-audio');

// Ids of the voices already downloaded. Also deletes the 98 MB Kokoro model left by 2.1.2/2.1.3.
export async function installedVoices() {
  if (!supported) return [];
  const RNFS = fs();
  const old = `${RNFS.DocumentDirectoryPath}/sherpa-onnx`;
  if (await RNFS.exists(old)) await RNFS.unlink(old).catch(() => {});
  const ok = await Promise.all(AI_VOICES.map(([id]) => isModelReady('voices', id)));
  return AI_VOICES.filter((_, i) => ok[i]).map(([id]) => id);
}

export const install = (id, onProgress) => downloadModel('voices', 'tts-models', id, onProgress);

// One engine at a time: Piper voices are separate models, so switching voice reloads.
let engine = null;
let engineVoice = null;
function start(voice) {
  if (engine && engineVoice === voice) return engine;
  const previous = engine;
  engineVoice = voice;
  engine = (async () => {
    await previous?.then((t) => t.destroy()).catch(() => {});
    if (!(await isModelReady('voices', voice))) throw new Error('This voice is not downloaded');
    const path = modelDir('voices', voice);
    await audio().setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true });
    return ttsLib().createTTS({ modelPath: { type: 'file', path }, modelType: 'vits', numThreads: 4 });
  })().catch((e) => { engine = null; engineVoice = null; throw e; });
  return engine;
}

let clip = 0;
// Generates speech for text into a temporary WAV file and returns its path.
export async function prepare(text, voice) {
  const tts = await start(voice);
  const generated = await tts.generateSpeech(text, { sid: 0, speed: 1.0 });
  const file = `${fs().CachesDirectoryPath}/verse-${clip++ % 4}.wav`; // a few rotating files; next one is prepared while one plays
  await ttsLib().saveAudioToFile(generated, file);
  return file;
}

let player = null;
// Plays a prepared file; resolves when it finishes or is stopped.
export function play(file) {
  return new Promise((resolve) => {
    player?.remove();
    const p = audio().createAudioPlayer({ uri: `file://${file}` });
    player = p;
    const sub = p.addListener('playbackStatusUpdate', (s) => {
      if (s.didJustFinish) { sub.remove(); p.remove(); if (player === p) player = null; resolve(); }
    });
    p.stopped = () => { sub.remove(); resolve(); };
    p.play();
  });
}

export function stop() {
  const p = player;
  player = null;
  if (p) { p.pause(); p.stopped?.(); p.remove(); }
}

export async function speak(text, voice) {
  await play(await prepare(text, voice));
}
