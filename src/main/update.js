// Update check against GitHub Releases. No Electron imports; fetch is passed in for tests.
const REPO = 'Sammed-NJ/SortDeck';
const RELEASES = `https://github.com/${REPO}/releases`;

// semver compare incl. pre-release ("0.1.0-beta.3" < "0.1.0-beta.10" < "0.1.0")
function compareVersions(a, b) {
  const parse = (v) => {
    const [core, pre] = String(v).replace(/^v/, '').split('-', 2);
    return { core: core.split('.').map((n) => Number(n) || 0), pre: pre ? pre.split('.') : [] };
  };
  const x = parse(a), y = parse(b);
  for (let i = 0; i < 3; i++) if ((x.core[i] ?? 0) !== (y.core[i] ?? 0)) return (x.core[i] ?? 0) - (y.core[i] ?? 0);
  if (!x.pre.length || !y.pre.length) return y.pre.length - x.pre.length; // release beats pre-release
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i], q = y.pre[i];
    if (p === undefined || q === undefined) return p === undefined ? -1 : 1;
    if (p === q) continue;
    const pn = /^\d+$/.test(p), qn = /^\d+$/.test(q);
    if (pn && qn) return Number(p) - Number(q);
    if (pn !== qn) return pn ? -1 : 1;
    return p < q ? -1 : 1;
  }
  return 0;
}

// version of a release: its tag (v1.0.0), or for the rolling `beta` release the one in its title
const SEMVER = /\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?/;
function versionOf(r) {
  const m = (SEMVER.exec(String(r.tag_name || '')) || SEMVER.exec(String(r.name || '')));
  return m ? m[0] : null;
}

// -> { status: 'latest' | 'available' | 'none', current, latest?, url?, page?, notes? }
async function checkForUpdate(current, fetchImpl = fetch) {
  const res = await fetchImpl(`https://api.github.com/repos/${REPO}/releases?per_page=20`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'SortDeck' },
  });
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  const releases = (await res.json()).filter((r) => !r.draft)
    .map((r) => ({ r, v: versionOf(r), asset: (r.assets || []).find((a) => /^SortDeck-Setup-.+\.exe$/i.test(a.name)) }))
    .filter((x) => x.asset && x.v)
    .sort((a, b) => compareVersions(b.v, a.v));
  if (!releases.length) return { status: 'none', current, page: RELEASES };
  const { r, v: latest, asset } = releases[0];
  if (compareVersions(latest, current) <= 0) return { status: 'latest', current, latest, page: RELEASES };
  return { status: 'available', current, latest, url: asset.browser_download_url, name: asset.name, page: r.html_url, notes: String(r.body || '').slice(0, 600) };
}

// only ever download installers from GitHub over https
const isTrustedDownload = (u) => {
  try {
    const { protocol, hostname, pathname } = new URL(u);
    return protocol === 'https:' && hostname === 'github.com' && pathname.startsWith(`/${REPO}/releases/download/`);
  } catch { return false; }
};

module.exports = { compareVersions, versionOf, checkForUpdate, isTrustedDownload, RELEASES };
