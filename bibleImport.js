// Turns Bible files made for other apps into this app's shape: books[66][chapter - 1][verse - 1] = text.
// Supported: OSIS XML, USFX XML, Zefania XML, MySword (.bbl.mybible) and e-Sword (.bblx) modules.
// Only the 66 Protestant-canon books are kept, matching the built-in Bibles.
import { BOOKS } from './plan.js';

// Book ids used by OSIS (Gen, Exod…) and USFX/USFM (GEN, EXO…), in canonical order.
const OSIS = 'Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev'.split(' ');
const USFM = 'GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV'.split(' ');

const empty = () => BOOKS.map(() => []);
const decode = (t) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&');
// Removes notes and cross-references entirely, then any remaining markup.
const clean = (t) => decode(t
  .replace(/<(note|f|x|rdg|fig)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
  .replace(/<(RF|TS)\b[^>]*>[\s\S]*?<R[ft]>/gi, '') // MySword footnotes and titles
  .replace(/<[^>]+>/g, ' ')
  .replace(/\\[a-z]+\d* ?|[{}]/gi, '') // e-Sword RTF codes
  .replace(/\s+/g, ' ')).trim();

function put(books, b, c, v, text) {
  if (b < 0 || b >= BOOKS.length || c < 1 || c > BOOKS[b][1] || v < 1) return;
  const ch = (books[b][c - 1] ??= []);
  ch[v - 1] = ch[v - 1] ? `${ch[v - 1]} ${text}` : text;
}

// Fills gaps so every chapter is an array and every missing verse is ''.
function finish(books) {
  for (let b = 0; b < books.length; b++) {
    for (let c = 0; c < BOOKS[b][1]; c++) {
      const ch = (books[b][c] ??= []);
      for (let v = 0; v < ch.length; v++) ch[v] ??= '';
    }
  }
  const verses = books.flat(2).filter(Boolean).length;
  if (verses < 100) throw new Error('No Bible text was found in this file');
  return books;
}

// OSIS: <verse osisID="John.3.16">…</verse>, or milestones <verse sID="…"/> … <verse eID="…"/>.
export function parseOsis(xml) {
  const books = empty();
  const contained = /<verse\b[^>]*\bosisID="([^"]+)"[^>]*(?<!\/)>([\s\S]*?)<\/verse>/g;
  let found = false;
  for (const m of xml.matchAll(contained)) { found = true; osisPut(books, m[1], m[2]); }
  if (!found) {
    const milestone = /<verse\b[^>]*\bsID="([^"]+)"[^>]*\/>([\s\S]*?)<verse\b[^>]*\beID="\1"[^>]*\/>/g;
    for (const m of xml.matchAll(milestone)) {
      const id = (m[0].match(/osisID="([^"]+)"/) ?? [, m[1]])[1];
      osisPut(books, id, m[2]);
    }
  }
  return finish(books);
}
function osisPut(books, id, text) {
  const [book, c, v] = id.split(/\s/)[0].split('.');
  put(books, OSIS.indexOf(book), Number(c), Number(v), clean(text));
}

// USFX: <book id="GEN"> … <c id="1"/> … <v id="1"/>text<ve/>.
export function parseUsfx(xml) {
  const books = empty();
  let b = -1;
  let c = 0;
  const token = /<book\b[^>]*\bid="([^"]+)"|<c\b[^>]*\bid="(\d+)"|<v\b[^>]*\bid="(\d+)"[^>]*\/>([\s\S]*?)(?=<ve\s*\/>|<v\b|<c\b|<\/book>)/g;
  for (const m of xml.matchAll(token)) {
    if (m[1]) { b = USFM.indexOf(m[1].toUpperCase()); c = 0; } else if (m[2]) c = Number(m[2]);
    else if (m[3]) put(books, b, c, Number(m[3]), clean(m[4]));
  }
  return finish(books);
}

// Zefania: <BIBLEBOOK bnumber="43"><CHAPTER cnumber="3"><VERS vnumber="16">…</VERS>.
export function parseZefania(xml) {
  const books = empty();
  for (const bm of xml.matchAll(/<BIBLEBOOK\b[^>]*\bbnumber="(\d+)"[^>]*>([\s\S]*?)<\/BIBLEBOOK>/gi)) {
    const b = Number(bm[1]) - 1;
    for (const cm of bm[2].matchAll(/<CHAPTER\b[^>]*\bcnumber="(\d+)"[^>]*>([\s\S]*?)<\/CHAPTER>/gi)) {
      for (const vm of cm[2].matchAll(/<VERS\b[^>]*\bvnumber="(\d+)"[^>]*>([\s\S]*?)<\/VERS>/gi)) {
        put(books, b, Number(cm[1]), Number(vm[1]), clean(vm[2]));
      }
    }
  }
  return finish(books);
}

// Rows of { Book, Chapter, Verse, Scripture } from MySword/e-Sword (book numbers 1–66).
export function fromRows(rows) {
  const books = empty();
  for (const r of rows) put(books, Number(r.Book) - 1, Number(r.Chapter), Number(r.Verse), clean(String(r.Scripture ?? '')));
  return finish(books);
}

export function detectFormat(name, head) {
  if (/\.bbl\.mybible$|\.mybible$/i.test(name)) return 'mysword';
  if (/\.bblx$/i.test(name)) return 'esword';
  if (/<XMLBIBLE\b|<BIBLEBOOK\b/i.test(head)) return 'zefania';
  if (/<osis\b|osisID=/i.test(head)) return 'osis';
  if (/<usfx\b|<book\s+id=/i.test(head)) return 'usfx';
  return null;
}

export const parseXml = (format, xml) => ({ osis: parseOsis, usfx: parseUsfx, zefania: parseZefania }[format](xml));

// A short name and title for the version, from the file's own metadata when it has any.
export function describe(name, text = '') {
  const title = decode((text.match(/<title\b[^>]*>([^<]{2,80})<\/title>/i) ?? text.match(/<description\b[^>]*>([^<]{2,80})</i) ?? [])[1] ?? '')
    || name.replace(/\.(xml|bblx|bbl\.mybible|mybible|osis|usfx)$/i, '').replace(/[_-]+/g, ' ');
  const short = (title.match(/\b[A-Z]{2,6}\b/) ?? [])[0] ?? title.split(/\s+/).map((w) => w[0]).join('').slice(0, 5).toUpperCase();
  return { name: title.trim(), short };
}
