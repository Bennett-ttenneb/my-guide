import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { pathOf } from './Sketch';
import { verseLabel, verseText } from './nav';

const esc = (t = '') => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fs = () => require('@dr.pogodin/react-native-fs');

async function imageTag(uri) {
  try {
    const data = await fs().readFile(decodeURI(uri.replace(/^file:\/\//, '')), 'base64');
    const type = /\.png$/i.test(uri) ? 'png' : 'jpeg';
    return `<img src="data:image/${type};base64,${data}" />`;
  } catch {
    return '<p class="muted">[photo]</p>';
  }
}

const drawingTag = (d) => `<svg viewBox="0 0 ${d.w} ${d.h}" class="drawing"><rect width="${d.w}" height="${d.h}" fill="#fff"/>${
  d.strokes.map((s) => `<path d="${pathOf(s.points)}" stroke="${s.color}" stroke-width="${s.width}" stroke-opacity="${s.opacity}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg>`;

// Builds a printable page from a note: formatting, checklists, linked verses with their text, photos and drawings.
export async function noteHtml(note, bible) {
  const parts = [];
  let list = null;
  const closeList = () => { if (list) { parts.push(`</${list}>`); list = null; } };
  for (const b of note.blocks) {
    const st = b.style ?? {};
    const want = b.type === 'text' && st.list ? (st.list === 'number' ? 'ol' : 'ul') : null;
    if (want !== list) { closeList(); if (want) { parts.push(`<${want}>`); list = want; } }
    if (b.type === 'text') {
      if (!b.text.trim()) continue;
      let t = esc(b.text).replace(/\n/g, '<br/>');
      if (st.bold) t = `<b>${t}</b>`;
      if (st.italic) t = `<i>${t}</i>`;
      if (st.underline) t = `<u>${t}</u>`;
      if (st.strike) t = `<s>${t}</s>`;
      const css = `text-align:${st.align ?? 'left'};margin-left:${(st.indent ?? 0) * 24}px`;
      parts.push(want ? `<li style="${css}">${t}</li>` : st.heading ? `<h2 style="${css}">${t}</h2>` : st.quote ? `<blockquote style="${css}">${t}</blockquote>` : `<p style="${css}">${t}</p>`);
    } else if (b.type === 'check') {
      parts.push(`<p class="check">${b.done ? '☑' : '☐'} ${esc(b.text)}</p>`);
    } else if (b.type === 'verse') {
      parts.push(`<div class="verse"><b>${esc(verseLabel(b))}</b><br/><i>${esc(bible ? verseText(bible, b) : '')}</i></div>`);
    } else if (b.type === 'image') {
      parts.push(await imageTag(b.uri));
    } else if (b.type === 'drawing') {
      parts.push(drawingTag(b));
    } else if (b.type === 'audio') {
      parts.push('<p class="muted">[voice recording]</p>');
    }
  }
  closeList();
  const date = new Date(note.updated ?? note.date).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  return `<!doctype html><html><head><meta charset="utf-8"/><style>
    body { font-family: Georgia, serif; color: #2b241c; padding: 32px; line-height: 1.5; }
    h1 { margin: 0 0 4px; } .meta { color: #7c6f60; margin-bottom: 24px; }
    .verse { border-left: 4px solid #c2410c; background: #fdf3e7; padding: 8px 12px; margin: 10px 0; }
    blockquote { border-left: 3px solid #c2410c; margin: 8px 0; padding-left: 12px; color: #5b4f42; }
    img, .drawing { max-width: 100%; border-radius: 8px; margin: 8px 0; border: 1px solid #e7d8c3; }
    .muted { color: #7c6f60; } .check { margin: 4px 0; }
    footer { margin-top: 32px; color: #a8998a; font-size: 12px; }
  </style></head><body>
    <h1>${esc(note.title || 'Note')}</h1><div class="meta">${esc(date)}</div>
    ${parts.join('\n')}
    <footer>Made with My Guide by BBotnics Industries</footer>
  </body></html>`;
}

export async function sharePdf(note, bible) {
  const { uri } = await Print.printToFileAsync({ html: await noteHtml(note, bible) });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: note.title || 'Note', UTI: 'com.adobe.pdf' });
}
