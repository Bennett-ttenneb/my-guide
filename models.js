// Downloads sherpa-onnx models (voices, speech recognition) straight from their GitHub release and unpacks them
// into app storage. A ".ready" mark is written last, so a half-finished download never counts as installed.
const fs = () => require('@dr.pogodin/react-native-fs');
const extraction = () => require('react-native-sherpa-onnx/extraction');

const RELEASES = 'https://github.com/k2-fsa/sherpa-onnx/releases/download';

export const modelDir = (kind, id) => `${fs().DocumentDirectoryPath}/${kind}/${id}`;
const readyMark = (kind, id) => `${modelDir(kind, id)}/.ready`;

export const isModelReady = (kind, id) => fs().exists(readyMark(kind, id)).catch(() => false);

// kind: local folder ('voices', 'speech'); tag: GitHub release tag ('tts-models', 'asr-models').
// onProgress(0..1): download is the first 90%, unpacking the rest. Throws with a readable message.
export async function downloadModel(kind, tag, id, onProgress) {
  const RNFS = fs();
  const parent = `${RNFS.DocumentDirectoryPath}/${kind}`;
  await RNFS.mkdir(parent);
  const archive = `${RNFS.CachesDirectoryPath}/${id}.tar.bz2`;
  const { promise } = RNFS.downloadFile({
    fromUrl: `${RELEASES}/${tag}/${id}.tar.bz2`,
    toFile: archive,
    progressInterval: 300,
    progress: (p) => p.contentLength > 0 && onProgress?.((p.bytesWritten / p.contentLength) * 0.9),
  });
  try {
    const res = await promise;
    if (res.statusCode !== 200) throw new Error(`server answered ${res.statusCode}`);
    const out = await extraction().extractArchive({ modelId: id, archivePath: archive, format: 'tar.bz2' }, parent, {
      onProgress: (e) => onProgress?.(0.9 + (e.percent / 100) * 0.1),
    });
    if (!out?.success) throw new Error('could not unpack the download');
    await RNFS.writeFile(readyMark(kind, id), 'ok');
  } finally {
    await RNFS.unlink(archive).catch(() => {});
  }
}
