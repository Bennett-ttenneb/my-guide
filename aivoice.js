// On-device natural voice (Kokoro-82M, Apache-2.0) via @pocketpalai/react-native-speech.
// The model is downloaded once (~94 MB) into app storage; after that it runs fully offline.
import { Platform } from 'react-native';

const HF = 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main';
const DICT_URL = 'https://huggingface.co/datasets/palshub/phonemizer-dicts/resolve/main/en-us.bin';

export const AI_VOICES = [
  ['af_heart', 'Heart · warm US woman'], ['af_bella', 'Bella · US woman'], ['af_nicole', 'Nicole · soft US woman'],
  ['am_michael', 'Michael · US man'], ['am_adam', 'Adam · deep US man'], ['am_fenrir', 'Fenrir · strong US man'],
  ['bf_emma', 'Emma · British woman'], ['bm_george', 'George · British man'],
];

export const supported = Platform.OS === 'android' || Platform.OS === 'ios';

// Native modules are only required when used, so the web preview keeps working.
const fs = () => require('@dr.pogodin/react-native-fs');
const lib = () => require('@pocketpalai/react-native-speech');

const dir = () => `${fs().DocumentDirectoryPath}/kokoro`;
const files = () => [
  { url: `${HF}/onnx/model_q8f16.onnx`, path: `${dir()}/model.onnx`, size: 86033585 },
  { url: `${HF}/tokenizer.json`, path: `${dir()}/tokenizer.json`, size: 3497 },
  { url: DICT_URL, path: `${dir()}/en-us.bin`, size: 3556124 },
  // The library only keeps downloaded voices in memory, so save them where its loader looks first.
  ...AI_VOICES.map(([id]) => ({ url: `${HF}/voices/${id}.bin`, path: `${dir()}/voices/${id}.bin`, size: 522240 })),
];

export async function isInstalled() {
  if (!supported) return false;
  const checks = await Promise.all(files().map((f) => fs().exists(f.path)));
  return checks.every(Boolean);
}

// Downloads everything not yet present. onProgress(0..1).
export async function install(onProgress) {
  const RNFS = fs();
  await RNFS.mkdir(`${dir()}/voices`);
  const list = files();
  const total = list.reduce((n, f) => n + f.size, 0);
  let done = 0;
  for (const f of list) {
    if (await RNFS.exists(f.path)) { done += f.size; continue; }
    const tmp = `${f.path}.part`; // never leave a half file under the real name
    const { promise } = RNFS.downloadFile({
      fromUrl: f.url, toFile: tmp, progressInterval: 250,
      progress: (p) => onProgress?.((done + p.bytesWritten) / total),
    });
    const res = await promise;
    if (res.statusCode !== 200) { await RNFS.unlink(tmp).catch(() => {}); throw new Error(`Download failed (${res.statusCode})`); }
    await RNFS.moveFile(tmp, f.path);
    done += f.size;
    onProgress?.(done / total);
  }
  await RNFS.writeFile(`${dir()}/voices-manifest.json`, JSON.stringify({ baseUrl: `${HF}/voices`, voices: AI_VOICES.map(([id]) => id) }));
}

export async function remove() {
  const RNFS = fs();
  stopped();
  if (await RNFS.exists(dir())) await RNFS.unlink(dir());
}

let ready = null;
function start() {
  ready ??= (async () => {
    const { default: Speech, TTSEngine } = lib();
    const d = `file://${dir()}`;
    await Speech.initialize({
      engine: TTSEngine.KOKORO,
      modelPath: `${d}/model.onnx`,
      tokenizerPath: `${d}/tokenizer.json`,
      voicesPath: `${d}/voices-manifest.json`,
      dictPath: `${d}/en-us.bin`,
    });
    return Speech;
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

// Resolves when the text has finished playing.
export async function speak(text, voice) {
  const Speech = await start();
  await Speech.speak(text, voice);
}

function stopped() {
  if (ready) ready.then((Speech) => Speech.stop()).catch(() => {});
}
export const stop = stopped;
