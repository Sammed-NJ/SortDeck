// node tests/config.test.js - config load/validate/save round trip
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadConfig, saveConfig, toForm, buildConfig, validateRule, newFolder } = require('../src/main/config');

const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'forg-cfg-')), 'config.json');

// no file -> empty config with default settings
let { cfg, error } = loadConfig(tmp);
assert.equal(error, null);
assert.deepEqual(cfg.folders, []);
assert.equal(cfg.settings.intervalSeconds, 30);

// add folders, round-trip through the UI form and disk
cfg.folders.push(newFolder('C:\\Users\\me\\Downloads'), newFolder('D:\\Projects', { sortByType: false }));
const form = toForm(cfg);
form.folders[0].categories.push({ name: 'Bücher', exts: ['.EPUB', 'mobi', 'epub'] });
form.folders[0].rules.push({ name: 'Invoices', conditions: [{ field: 'name', op: 'contains', value: 'invoice' }], actions: [{ type: 'move', dest: 'Finance\\Invoices\\' }] });
form.settings.quietOn = true; form.settings.quietStart = '22:00'; form.settings.quietEnd = '07:00';
let built = buildConfig(form);
assert.deepEqual(built.errors, []);
assert.deepEqual(built.cfg.folders[0].categories['Bücher'], ['epub', 'mobi']);
assert.equal(built.cfg.folders[0].rules[0].actions[0].dest, 'Finance\\Invoices', 'trailing slash trimmed');
assert.ok(built.cfg.folders[0].rules[0].id, 'rules get ids');
assert.deepEqual(built.cfg.settings.quietHours, { start: '22:00', end: '07:00' });
saveConfig(tmp, built.cfg);
({ cfg } = loadConfig(tmp));
assert.deepEqual(cfg, built.cfg);
assert.equal(cfg.folders[1].sortByType, false);

// broken file -> restored from the backup saveConfig keeps; no backup either -> defaults + error
fs.writeFileSync(tmp, '{ nope');
let restored;
({ cfg, error, restored } = loadConfig(tmp));
assert.ok(error && restored);
assert.deepEqual(cfg, built.cfg);
fs.writeFileSync(tmp + '.bak', '{ nope');
({ cfg, error } = loadConfig(tmp));
assert.ok(error);
assert.deepEqual(cfg.folders, []);

// folder + settings validation
const bad = buildConfig({
  settings: { intervalSeconds: 1, quietOn: true, quietStart: '25:00', quietEnd: '07:00' },
  folders: [
    { path: 'relative\\path', categories: [], rules: [] },
    { path: 'C:\\A', sortByType: true, categories: [{ name: 'Other', exts: ['x'] }, { name: 'P', exts: ['png'] }, { name: 'p', exts: ['jpg'] }, { name: 'Q', exts: ['png'] }, { name: 'R:', exts: ['r'] }, { name: 'S', exts: [] }], protected: ['ok', 'no?'], rules: [] },
    { path: 'c:\\a', categories: [], rules: [] },
  ],
});
const msg = bad.errors.join('\n');
for (const s of ['Check interval', 'Quiet hours', 'choose a valid folder', 'built in', 'listed twice', 'in both P and Q', 'not a valid folder name', 'needs at least one', 'protected folder', 'added twice']) {
  assert.ok(msg.includes(s), `expected error containing "${s}" in:\n${msg}`);
}

// rule validation
let v = validateRule({ name: 'Ok', conditions: [{ field: 'ext', op: 'in', value: '.PDF; docx pdf' }, { field: 'age', op: 'older', value: '30' }], actions: [{ type: 'copy', dest: 'D:\\Backup' }, { type: 'recycle' }] });
assert.deepEqual(v.errors, []);
assert.equal(v.rule.conditions[0].value, 'pdf, docx');
assert.deepEqual(v.rule.conditions[1], { field: 'age', op: 'older', value: 30, unit: 'days' });
v = validateRule({ name: '', conditions: [{ field: 'name', op: 'regex', value: '(' }, { field: 'size', op: 'gt', value: 'big' }, { field: 'x', op: 'y' }], actions: [{ type: 'move', dest: '' }, { type: 'keep' }, { type: 'copy', dest: 'a?b' }] });
const rmsg = v.errors.join('\n');
for (const s of ['needs a name', 'not a valid regex', 'needs a number', 'unknown condition', 'choose a folder', 'only one of', 'not a valid folder']) {
  assert.ok(rmsg.includes(s), `expected rule error containing "${s}" in:\n${rmsg}`);
}
assert.ok(validateRule({ name: 'x', actions: [] }).errors.some((e) => e.includes('at least one action')));

// theme + accent: defaults, kept when valid, unknown values fall back
({ cfg } = loadConfig(path.join(path.dirname(tmp), 'none.json')));
assert.equal(cfg.settings.theme, 'system');
assert.equal(cfg.settings.accent, 'teal');
const themed = buildConfig({ ...toForm(cfg), settings: { ...toForm(cfg).settings, theme: 'dark', accent: 'pink' } });
assert.equal(themed.cfg.settings.theme, 'dark');
assert.equal(themed.cfg.settings.accent, 'pink');
const junk = buildConfig({ ...toForm(cfg), settings: { ...toForm(cfg).settings, theme: 'neon', accent: 'red' } });
assert.equal(junk.cfg.settings.theme, 'system');
assert.equal(junk.cfg.settings.accent, 'teal');
// guided tour state: new by default, kept when valid
assert.equal(cfg.settings.tour, 'new');
assert.equal(buildConfig({ ...toForm(cfg), settings: { ...toForm(cfg).settings, tour: 'later' } }).cfg.settings.tour, 'later');
assert.equal(buildConfig({ ...toForm(cfg), settings: { ...toForm(cfg).settings, tour: 'x' } }).cfg.settings.tour, 'new');

fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
console.log('config.test.js: all checks passed');
