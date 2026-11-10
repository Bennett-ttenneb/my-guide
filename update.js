// Asks GitHub whether a newer release of the app exists. Sends nothing about the user; fails silently offline.
const LATEST = 'https://api.github.com/repos/Bennett-ttenneb/my-guide/releases/latest';
export const DOWNLOAD_URL = 'https://github.com/Bennett-ttenneb/my-guide/releases/latest';

const parts = (v) => String(v).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);

export function isNewer(latest, current) {
  const a = parts(latest), b = parts(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  }
  return false;
}

// Resolves to the newer version number (e.g. "2.4.0"), or null when up to date or unreachable.
export async function checkForUpdate() {
  try {
    const current = require('./app.json').expo.version;
    const res = await fetch(LATEST, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return null;
    const tag = (await res.json()).tag_name;
    return tag && isNewer(tag, current) ? String(tag).replace(/^v/, '') : null;
  } catch {
    return null;
  }
}
