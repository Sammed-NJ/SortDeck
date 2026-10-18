// node tests/update.test.js - version order, picking the newest installer, trusted download URLs
const assert = require('assert');
const { compareVersions: cmp, checkForUpdate, isTrustedDownload } = require('../src/main/update');

(async () => {
  const order = ['0.1.0-beta.2', '0.1.0-beta.3', '0.1.0-beta.10', '0.1.0-rc.1', '0.1.0', '0.1.1', '1.0.0'];
  for (let i = 1; i < order.length; i++) assert.ok(cmp(order[i - 1], order[i]) < 0, `${order[i - 1]} < ${order[i]}`);
  assert.equal(cmp('v0.1.0-beta.3', '0.1.0-beta.3'), 0);

  const asset = (v) => ({ name: `SortDeck-Setup-${v}.exe`, browser_download_url: `https://github.com/Sammed-NJ/SortDeck/releases/download/v${v}/SortDeck-Setup-${v}.exe` });
  const fake = (list) => async () => ({ ok: true, json: async () => list });
  const list = [
    { tag_name: 'v0.1.0-beta.3', assets: [asset('0.1.0-beta.3')] },
    { tag_name: 'v0.1.0-beta.5', draft: true, assets: [asset('0.1.0-beta.5')] },
    { tag_name: 'v0.1.0-beta.4', assets: [asset('0.1.0-beta.4')], html_url: 'https://github.com/Sammed-NJ/SortDeck/releases/tag/v0.1.0-beta.4' },
    { tag_name: 'v0.1.0-beta.9', assets: [] },
  ];
  const u = await checkForUpdate('0.1.0-beta.3', fake(list));
  assert.equal(u.status, 'available');
  assert.equal(u.latest, '0.1.0-beta.4', 'drafts and releases without an installer are skipped');
  assert.ok(isTrustedDownload(u.url));
  assert.equal((await checkForUpdate('0.1.0-beta.4', fake(list))).status, 'latest');
  assert.equal((await checkForUpdate('0.1.0-beta.3', fake([]))).status, 'none');
  await assert.rejects(checkForUpdate('1.0.0', async () => ({ ok: false, status: 403 })));

  assert.ok(!isTrustedDownload('https://evil.com/Sammed-NJ/SortDeck/releases/download/x.exe'));
  assert.ok(!isTrustedDownload('http://github.com/Sammed-NJ/SortDeck/releases/download/x.exe'));
  assert.ok(!isTrustedDownload('https://github.com/someone/else/releases/download/x.exe'));
  // installer names: short for betas, v-prefixed for official releases
  const { artifactName } = require('../scripts/dist');
  assert.equal(artifactName('0.1.0-beta.5'), 'SortDeck-Setup-beta.5.exe');
  assert.equal(artifactName('1.0.0'), 'SortDeck-Setup-v1.0.0.exe');
  assert.ok(/^SortDeck-Setup-.+\.exe$/i.test(artifactName('2.3.1-rc.2')), 'update check still recognises the installer');

  console.log('update.test.js: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
