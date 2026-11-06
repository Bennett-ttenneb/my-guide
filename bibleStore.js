// Imported Bible versions: picked from the phone, converted once, saved as JSON in app storage.
import * as DocumentPicker from 'expo-document-picker';
import { describe, detectFormat, fromRows, parseXml } from './bibleImport';
import { registerBible, unregisterBible } from './bible';

const fs = () => require('@dr.pogodin/react-native-fs');
const dir = () => `${fs().DocumentDirectoryPath}/bibles`;

// Asks for a file and imports it. Returns the new translation entry, or null if the user cancelled.
export async function pickAndImport() {
  const res = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.[0]) return null;
  const RNFS = fs();
  const a = res.assets[0];
  const path = decodeURI(a.uri.replace(/^file:\/\//, ''));
  try {
    const head = await RNFS.read(path, 4000, 0, 'utf8').catch(() => '');
    const format = detectFormat(a.name ?? '', head);
    if (!format) throw new Error('This is not a Bible file the app can read. Supported: OSIS, USFX and Zefania XML, MySword (.bbl.mybible) and e-Sword (.bblx).');
    let books;
    let meta;
    if (format === 'mysword' || format === 'esword') {
      const SQLite = require('expo-sqlite');
      const folder = path.slice(0, path.lastIndexOf('/'));
      const db = await SQLite.openDatabaseAsync(path.slice(path.lastIndexOf('/') + 1), {}, folder);
      try {
        books = fromRows(await db.getAllAsync('SELECT Book, Chapter, Verse, Scripture FROM Bible'));
        const details = await db.getFirstAsync('SELECT * FROM Details').catch(() => null);
        meta = describe(a.name, details ? `<title>${details.Description ?? details.Title ?? ''}</title>` : '');
        if (details?.Abbreviation) meta.short = String(details.Abbreviation).slice(0, 6);
      } catch (e) {
        throw new Error(/no such table/i.test(String(e?.message)) ? 'This module is not a Bible, or it is encrypted and cannot be opened.' : String(e?.message ?? e));
      } finally {
        await db.closeAsync().catch(() => {});
      }
    } else {
      const xml = await RNFS.readFile(path, 'utf8');
      books = parseXml(format, xml);
      meta = describe(a.name, xml.slice(0, 20000));
    }
    const id = `imp-${Date.now().toString(36)}`;
    await RNFS.mkdir(dir());
    await RNFS.writeFile(`${dir()}/${id}.json`, JSON.stringify(books), 'utf8');
    registerBible(id, books);
    const english = /\bgod\b/i.test(books[42]?.[2]?.[15] ?? '');
    return { id, short: meta.short, name: meta.name, lang: english ? 'en' : 'xx', copyright: 'Imported by you' };
  } finally {
    await RNFS.unlink(path).catch(() => {}); // the picker's temporary copy
  }
}

// Loads a previously imported version into memory. Returns false if its file is gone.
export async function loadImported(id) {
  try {
    registerBible(id, JSON.parse(await fs().readFile(`${dir()}/${id}.json`, 'utf8')));
    return true;
  } catch {
    return false;
  }
}

export async function removeImported(id) {
  unregisterBible(id);
  await fs().unlink(`${dir()}/${id}.json`).catch(() => {});
}
