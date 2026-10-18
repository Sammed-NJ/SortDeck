// node tests/engine.test.js - runs the organizer engine against a throwaway folder
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Organizer, inQuietHours } = require('../src/main/engine');
const { buildConfig, toForm, newFolder } = require('../src/main/config');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forg-'));
const dir = path.join(root, 'Inbox');
const OLD = Date.now() - 60_000; // older than the "still being written" window
function file(rel, kb = 1, mtime = OLD) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, Buffer.alloc(kb * 1024));
  fs.utimesSync(p, mtime / 1000, mtime / 1000);
  return p;
}
const has = (rel) => fs.existsSync(path.join(dir, rel));

(async () => {
  // build through the same validation the app uses
  const folder = newFolder(dir);
  folder.rules = [
    { name: 'From GitHub', conditions: [{ field: 'source', op: 'contains', value: 'github.com' }], actions: [{ type: 'move', dest: 'GitHub' }] },
    { name: 'Invoices', conditions: [{ field: 'name', op: 'contains', value: 'invoice' }], exceptions: [{ field: 'ext', op: 'in', value: 'zip' }], actions: [{ type: 'move', dest: 'Finance\\Invoices' }] },
    { name: 'Keep', conditions: [{ field: 'name', op: 'starts', value: 'keep-' }], actions: [{ type: 'keep' }] },
    { name: 'Big or shot', match: 'any', conditions: [{ field: 'size', op: 'gt', value: 0.5 }, { field: 'name', op: 'wildcard', value: 'Screenshot*' }], actions: [{ type: 'copy', dest: 'Backup' }, { type: 'move', dest: 'Big' }] },
    { name: 'Off', enabled: false, conditions: [], actions: [{ type: 'recycle' }] },
    { name: 'Manual', auto: false, conditions: [{ field: 'ext', op: 'in', value: 'txt' }], actions: [{ type: 'move', dest: 'Manual' }] },
    { name: 'Old to trash', conditions: [{ field: 'age', op: 'older', value: 30, unit: 'days' }, { field: 'ext', op: 'in', value: 'exe' }], actions: [{ type: 'recycle' }] },
  ];
  const form = toForm({ settings: { notifications: true, launchAtLogin: false, paused: false, intervalSeconds: 30, quietHours: null }, folders: [folder] });
  const { errors, cfg } = buildConfig(form);
  assert.deepEqual(errors, []);

  file('Invoice-March.pdf');
  file('invoice-pack.zip');
  file('keep-me.pdf');
  file('Screenshot 1.png');
  file('large.bin', 700);
  file('notes.txt');
  file('photo.jpg');
  file('mystery.xyz');
  file('half.crdownload');
  file('fresh.pdf', 1, Date.now());            // still being written
  file('old-setup.exe', 1, Date.now() - 45 * 86400_000);
  file('new-setup.exe');
  fs.mkdirSync(path.join(dir, 'SomeFolder'));
  fs.utimesSync(path.join(dir, 'SomeFolder'), OLD / 1000, OLD / 1000);
  const gh = file('tool.zip');
  fs.writeFileSync(gh + ':Zone.Identifier', '[ZoneTransfer]\r\nZoneId=3\r\nHostUrl=https://github.com/o/r/tool.zip\r\n');
  fs.utimesSync(gh, OLD / 1000, OLD / 1000);   // writing the stream bumps mtime

  const trashed = [];
  const notes = [];
  let activity = [];
  const org = new Organizer({ trash: async (p) => { trashed.push(path.basename(p)); fs.rmSync(p); }, notify: (t, b) => notes.push([t, b]), onActivity: (a) => { activity = a; } });
  org.cfg = cfg;                                 // no watchers/timers in tests
  const report = await org.sweep(cfg.folders[0].id);

  assert.ok(has('GitHub/tool.zip'), 'downloaded-from condition');
  assert.ok(has('Finance/Invoices/Invoice-March.pdf'), 'name contains -> nested folder');
  assert.ok(has('Archives/invoice-pack.zip'), 'exception -> falls through to sort by type');
  assert.ok(has('keep-me.pdf'), 'keep leaves it in place');
  assert.ok(has('Big/Screenshot 1.png') && has('Backup/Screenshot 1.png'), 'match any + copy and move');
  assert.ok(has('Big/large.bin') && has('Backup/large.bin'), 'size condition');
  assert.ok(has('Documents/notes.txt'), 'manual-only rule skipped by automatic sweep');
  assert.ok(has('Images/photo.jpg'), 'sort by type');
  assert.ok(has('Other/mystery.xyz'), 'unknown extension -> Other');
  assert.ok(has('Folders/SomeFolder'), 'loose folder -> Folders');
  assert.ok(has('half.crdownload'), 'unfinished download ignored');
  assert.ok(has('fresh.pdf'), 'file still being written is left for later');
  assert.deepEqual(trashed, ['old-setup.exe'], 'only the old installer recycled');
  assert.ok(has('Installers/new-setup.exe'));
  assert.equal(report.length, activity.length);
  assert.ok(report.every((r) => r.ok));
  assert.deepEqual(notes.length, 1, 'one grouped notification, not one per file');
  assert.match(notes[0][0], /Organized \d+ items/);

  // name collision -> "name (1).ext"
  file('photo.jpg');
  await org.sweep(cfg.folders[0].id);
  assert.ok(has('Images/photo (1).jpg'), 'collision renamed');

  // manual run: preview changes nothing, run does it; relative dest stays relative to the watched folder
  const manual = cfg.folders[0].rules.filter((r) => r.name === 'Manual');
  const prev = await org.run(cfg.folders[0], manual, { preview: true, target: 'Documents' });
  assert.deepEqual(prev.map((r) => [r.item, r.action]), [['notes.txt', 'move']]);
  assert.ok(has('Documents/notes.txt'), 'preview is read-only');
  const done = await org.run(cfg.folders[0], manual, { target: 'Documents' });
  assert.ok(done[0].ok && has('Manual/notes.txt'), 'manual run moves');

  // "only when I click" folder: automatic sweeps never touch it; Organize now (with preview) does
  const manualFolder = { ...cfg.folders[0], trigger: 'manual' };
  org.cfg = { ...cfg, folders: [manualFolder] };
  file('clickme.jpg');
  assert.deepEqual(await org.sweep(manualFolder.id), [], 'manual folder skipped by sweep');
  await org.sweepAll();
  assert.ok(has('clickme.jpg'), 'manual folder untouched by sweepAll');
  const rulesNow = manualFolder.rules.filter((r) => r.enabled);
  const look = await org.run(manualFolder, rulesNow, { preview: true, fallback: true });
  assert.ok(look.some((r) => r.item === 'clickme.jpg' && r.rule === 'Sort by type'), 'preview includes sort by type');
  assert.ok(has('clickme.jpg'), 'preview read-only');
  await org.run(manualFolder, rulesNow, { fallback: true });
  assert.ok(has('Images/clickme.jpg'), 'Organize now sorts by type');

  // "every N minutes" folder gets its own schedule; instant folders get a watcher
  org.setConfig({ ...cfg, folders: [{ ...cfg.folders[0], trigger: 'interval', intervalMinutes: 15 }] });
  assert.equal(org.schedules.size, 1);
  assert.equal(org.watchers.size, 0, 'interval folder is not watched');
  assert.ok(org.nextRun.get(cfg.folders[0].id) > Date.now() + 14 * 60000);
  org.setConfig(cfg);
  assert.equal(org.schedules.size, 0);
  assert.equal(org.watchers.size, 1, 'instant folder is watched');
  org.stop();

  // paused / quiet hours: automatic sweep does nothing
  file('later.jpg');
  org.cfg = { ...cfg, settings: { ...cfg.settings, paused: true } };
  await org.sweep(cfg.folders[0].id);
  assert.ok(has('later.jpg'), 'paused');
  assert.equal(inQuietHours({ start: '22:00', end: '07:00' }, new Date(2026, 0, 1, 23, 30)), true);
  assert.equal(inQuietHours({ start: '22:00', end: '07:00' }, new Date(2026, 0, 1, 12, 0)), false);

  org.stop();
  fs.rmSync(root, { recursive: true, force: true });
  console.log('engine.test.js: all checks passed');
})().catch((e) => { console.error(e); process.exit(1); });
