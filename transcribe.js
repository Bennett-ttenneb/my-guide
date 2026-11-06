// Speech to text, fully on the phone, with sherpa-onnx and the Kroko streaming English model (~55 MB, once).
// Chosen over Android's built-in SpeechRecognizer, which stops after pauses and needs restart loops for long
// sermons, and over Whisper, which works in 30-second batches and is too heavy to keep up live on mid-range phones.
// A streaming recognizer runs indefinitely, offline, at a fraction of real time.
import { Platform } from 'react-native';
import { downloadModel, isModelReady, modelDir } from './models';
import { tidy } from './spoken';

export const MODEL = 'sherpa-onnx-streaming-zipformer-en-kroko-2025-08-06';
export const MODEL_MB = 55;
export const supported = Platform.OS === 'android' || Platform.OS === 'ios';

const stt = () => require('react-native-sherpa-onnx/stt');
const audioLib = () => require('react-native-sherpa-onnx/audio');
const fs = () => require('@dr.pogodin/react-native-fs');

export const isInstalled = () => (supported ? isModelReady('speech', MODEL) : Promise.resolve(false));
export const install = (onProgress) => downloadModel('speech', 'asr-models', MODEL, onProgress);

let engine = null;
function start() {
  engine ??= stt().createStreamingSTT({ modelPath: { type: 'file', path: modelDir('speech', MODEL) }, modelType: 'auto', enableEndpoint: true })
    .catch((e) => { engine = null; throw e; });
  return engine;
}

// Live transcription from the microphone until stop() is called. Microphone permission must already be granted.
// onPartial(text) shows the sentence being heard; onSentence(text) delivers each finished sentence.
export async function startLive({ onPartial, onSentence, onError }) {
  const recognizer = await start();
  const stream = await recognizer.createStream();
  const mic = audioLib().createPcmLiveStream({ sampleRate: 16000, channelCount: 1 });
  let chain = Promise.resolve(); // chunks are processed one after another, never overlapping
  let stopped = false;
  const offData = mic.onData((samples, rate) => {
    chain = chain.then(async () => {
      if (stopped) return;
      const { result, isEndpoint } = await stream.processAudioChunk(samples, rate);
      if (isEndpoint) {
        const s = tidy(result.text);
        if (s) onSentence(s);
        onPartial('');
        await stream.reset();
      } else {
        onPartial(result.text ? tidy(result.text).replace(/\.$/, '…') : '');
      }
    }).catch((e) => onError?.(String(e?.message ?? e)));
  });
  const offError = mic.onError((m) => onError?.(m));
  await mic.start();
  return async function stop() {
    await mic.stop().catch(() => {});
    offData(); offError();
    await chain;
    stopped = true;
    const last = tidy((await stream.getResult().catch(() => ({ text: '' }))).text);
    if (last) onSentence(last);
    onPartial('');
    await stream.release().catch(() => {});
  };
}

// Transcribes an audio file (MP3, M4A, WAV…). Converts it to 16 kHz WAV, then streams it through the
// recognizer in chunks so even hour-long files never sit in memory at once. Returns the sentences.
export async function transcribeFile(uri, { onProgress, shouldStop } = {}) {
  const RNFS = fs();
  const recognizer = await start();
  const input = decodeURI(uri.replace(/^file:\/\//, ''));
  const wav = `${RNFS.CachesDirectoryPath}/import-${Date.now()}.wav`;
  await audioLib().convertAudioToWav16k(input, wav);
  const stream = await recognizer.createStream();
  const sentences = [];
  try {
    const { size } = await RNFS.stat(wav);
    const CHUNK = 16000 * 2 * 2; // 2 s of 16-bit mono audio, so pauses split sentences
    for (let pos = 44; pos < size; pos += CHUNK) {
      if (shouldStop?.()) break;
      const samples = pcm16ToFloats(await RNFS.read(wav, CHUNK, pos, 'base64'));
      const { result, isEndpoint } = await stream.processAudioChunk(samples, 16000);
      if (isEndpoint) {
        const s = tidy(result.text);
        if (s) sentences.push(s);
        await stream.reset();
      }
      onProgress?.(Math.min(pos / size, 1));
    }
    await stream.inputFinished();
    while (await stream.isReady()) await stream.decode();
    const last = tidy((await stream.getResult()).text);
    if (last) sentences.push(last);
  } finally {
    await stream.release().catch(() => {});
    await RNFS.unlink(wav).catch(() => {});
  }
  return sentences;
}

function pcm16ToFloats(base64) {
  const bin = globalThis.atob(base64);
  const out = new Float32Array(bin.length >> 1);
  for (let i = 0; i < out.length; i++) {
    let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
    if (v >= 0x8000) v -= 0x10000;
    out[i] = v / 32768;
  }
  return out;
}
