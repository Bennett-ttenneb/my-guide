// On-device natural voice: Kokoro-82M (Apache-2.0) run by sherpa-onnx, which is built for the
// React Native new architecture. (onnxruntime-react-native is not: its module is null on RN 0.88,
// which crashed v2.0.0.) The model is downloaded once (~98 MB); after that it works offline.
import { Platform } from 'react-native';

const MODEL = 'kokoro-int8-en-v0_19';

// Speaker ids of kokoro-en-v0_19 (sherpa-onnx docs: 0 af … 10 bm_lewis).
export const AI_VOICES = [
  [1, 'Bella · warm US woman'], [2, 'Nicole · soft US woman'], [3, 'Sarah · US woman'],
  [6, 'Michael · US man'], [5, 'Adam · deep US man'],
  [7, 'Emma · British woman'], [8, 'Isabella · British woman'], [9, 'George · British man'], [10, 'Lewis · British man'],
];

export const supported = Platform.OS === 'android' || Platform.OS === 'ios';

// Native modules are only required when used, so the web preview keeps working.
const dl = () => require('react-native-sherpa-onnx/download');
const ttsLib = () => require('react-native-sherpa-onnx/tts');
const fs = () => require('@dr.pogodin/react-native-fs');
const audio = () => require('expo-audio');

export async function isInstalled() {
  if (!supported) return false;
  const { ModelCategory, isModelDownloaded } = dl();
  return isModelDownloaded(ModelCategory.Tts, MODEL);
}

// Downloads and unpacks the model. onProgress(0..1); download is the first 90%, unpacking the rest.
export async function install(onProgress) {
  const { ModelCategory, refreshModels, ensureModel } = dl();
  await refreshModels(ModelCategory.Tts);
  await ensureModel(ModelCategory.Tts, MODEL, {
    onProgress: (p) => onProgress?.(p.phase?.startsWith('extract') ? 0.9 + p.percent / 1000 : (p.percent / 100) * 0.9),
  });
}

let engine = null;
function start() {
  engine ??= (async () => {
    const { ModelCategory, getModelPath } = dl();
    const path = await getModelPath(ModelCategory.Tts, MODEL);
    if (!path) throw new Error('Natural voice is not downloaded');
    const { setAudioModeAsync } = audio();
    await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true });
    return ttsLib().createTTS({ modelPath: { type: 'file', path }, modelType: 'kokoro', numThreads: 2 });
  })().catch((e) => { engine = null; throw e; });
  return engine;
}

let clip = 0;
// Generates speech for text into a temporary WAV file and returns its path.
export async function prepare(text, voice) {
  const tts = await start();
  const generated = await tts.generateSpeech(text, { sid: Number(voice) || 0, speed: 1.0 });
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
