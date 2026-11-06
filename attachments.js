import { Platform } from 'react-native';

// Note attachments (recordings, photos) are copied into the app's own storage so they survive
// the picker's or recorder's temporary files being cleaned up.
const fs = () => require('@dr.pogodin/react-native-fs');
const native = Platform.OS !== 'web';

export async function keep(uri, ext) {
  if (!native) return uri; // web preview: keep the temporary URL
  const RNFS = fs();
  const dir = `${RNFS.DocumentDirectoryPath}/notes`;
  await RNFS.mkdir(dir);
  const dest = `${dir}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  await RNFS.copyFile(decodeURI(uri.replace(/^file:\/\//, '')), dest);
  return `file://${dest}`;
}

// Deletes files belonging to removed blocks. Never throws: a missing file is already gone.
export async function discard(blocks) {
  if (!native) return;
  const RNFS = fs();
  for (const b of blocks) {
    if (b.uri?.startsWith('file://')) await RNFS.unlink(b.uri.slice(7)).catch(() => {});
  }
}
