// Draws the My Guide icon and store graphics (original artwork, BBotnics Industries) and renders them to PNG
// with a headless Chromium browser. Run: node store/art/make-art.mjs "<path to chrome or msedge>"
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const browser = process.argv[2];
if (!browser) throw new Error('pass the path to chrome.exe or msedge.exe');

// Open Bible with the morning sun rising behind it, in a 1024 × 1024 box.
const glyph = (paper = '#fff8ee', line = '#ecd4b8', sun = '#fde68a', ray = 'rgba(253,230,138,0.55)') => `
  <g>
    ${[-62, -38, -14, 14, 38, 62].map((a) => `<rect x="506" y="190" width="12" height="120" rx="6" fill="${ray}" transform="rotate(${a} 512 470)"/>`).join('')}
    <circle cx="512" cy="470" r="150" fill="${sun}"/>
    <path d="M512 610 C 430 560 300 552 196 588 L 196 812 C 300 778 430 786 512 836 Z" fill="${paper}"/>
    <path d="M512 610 C 594 560 724 552 828 588 L 828 812 C 724 778 594 786 512 836 Z" fill="${paper}"/>
    <path d="M512 612 L 512 834" stroke="${line}" stroke-width="10" stroke-linecap="round"/>
    ${[0, 1, 2, 3].map((i) => `
      <path d="M248 ${640 + i * 40} C 330 ${618 + i * 40} 410 ${622 + i * 40} 470 ${648 + i * 40}" stroke="${line}" stroke-width="9" fill="none" stroke-linecap="round"/>
      <path d="M776 ${640 + i * 40} C 694 ${618 + i * 40} 614 ${622 + i * 40} 554 ${648 + i * 40}" stroke="${line}" stroke-width="9" fill="none" stroke-linecap="round"/>`).join('')}
  </g>`;

const gradient = `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f59a52"/><stop offset="1" stop-color="#b8400c"/></linearGradient></defs>`;
const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${gradient}${body}</svg>`;
// Android adaptive icons crop to the middle 66/108 of the layer; keep the drawing inside it.
const centred = (scale, inner) => `<g transform="translate(${512 - 512 * scale} ${512 - 480 * scale}) scale(${scale})">${inner}</g>`;

const art = {
  'assets/icon.png': [1024, 1024, svg(1024, 1024, `<rect width="1024" height="1024" fill="url(#bg)"/>${centred(0.92, glyph())}`)],
  'assets/android-icon-background.png': [512, 512, svg(512, 512, '<rect width="512" height="512" fill="url(#bg)"/>')],
  'assets/android-icon-foreground.png': [512, 512, svg(512, 512, `<g transform="scale(0.5)">${centred(0.66, glyph())}</g>`)],
  'assets/android-icon-monochrome.png': [432, 432, svg(432, 432, `<g transform="scale(0.421875)">${centred(0.66, glyph('#fff', 'rgba(0,0,0,0)', '#fff', 'rgba(255,255,255,0.8)'))}</g>`)],
  'assets/splash-icon.png': [1024, 1024, svg(1024, 1024, `<rect x="212" y="212" width="600" height="600" rx="132" fill="url(#bg)"/><g transform="translate(212 212) scale(0.5859)">${centred(0.92, glyph())}</g>`)],
  'assets/favicon.png': [48, 48, svg(48, 48, `<rect width="48" height="48" rx="10" fill="url(#bg)"/><g transform="scale(0.046875)">${centred(0.95, glyph())}</g>`)],
  'store/icon-512.png': [512, 512, svg(512, 512, `<rect width="512" height="512" fill="url(#bg)"/><g transform="scale(0.5)">${centred(0.92, glyph())}</g>`)],
  'store/feature-graphic.png': [1024, 500, svg(1024, 500, `
    <rect width="1024" height="500" fill="url(#bg)"/>
    <g transform="translate(10 -10) scale(0.5)">${glyph()}</g>
    <text x="500" y="215" font-family="Segoe UI, Arial, sans-serif" font-size="84" font-weight="800" fill="#fff8ee">My Guide</text>
    <text x="504" y="280" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="600" fill="#fde68a">Bible · Notes · Prayer</text>
    <text x="504" y="330" font-family="Segoe UI, Arial, sans-serif" font-size="25" fill="#fff8ee" opacity="0.9">Reads to you · listens with you · offline</text>
    <text x="504" y="420" font-family="Segoe UI, Arial, sans-serif" font-size="22" fill="#fff8ee" opacity="0.75">by BBotnics Industries</text>`)],
};

const tmp = fs.mkdtempSync(path.join(process.env.TEMP ?? '/tmp', 'myguide-art-'));
for (const [out, [w, h, markup]] of Object.entries(art)) {
  const html = path.join(tmp, 'page.html');
  fs.writeFileSync(html, `<!doctype html><html><body style="margin:0;background:transparent">${markup}</body></html>`);
  fs.writeFileSync(path.join(here, `${path.basename(out, '.png')}.svg`), markup);
  const dest = path.join(root, out);
  execFileSync(browser, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000',
    `--window-size=${w},${h}`, `--screenshot=${dest}`, `file:///${html.replace(/\\/g, '/')}`], { stdio: 'ignore' });
  const png = fs.readFileSync(dest);
  console.log(out, `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
