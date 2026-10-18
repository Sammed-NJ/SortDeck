// node tests/doctor.test.js - config backup/restore and troubleshoot check/repair
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadConfig, saveConfig, newFolder } = require('../src/main/config');
const doctor = require('../src/main/doctor');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sortdeck-doc-'));
  const configFile = path.join(dir, 'config.json');
  const activityFile = path.join(dir, 'activity.json');
  const watched = fs.mkdtempSync(path.join(os.tmpdir(), 'sortdeck-w-'));

  // save writes a backup; a damaged or deleted config comes back from it
  const cfg = loadConfig(configFile).cfg;
  cfg.folders.push(newFolder(watched), newFolder(path.join(dir, 'gone')));
  saveConfig(configFile, cfg);
  assert.ok(fs.existsSync(configFile + '.bak'));
  fs.writeFileSync(configFile, '{ broken');
  let r = loadConfig(configFile);
  assert.ok(r.error && r.restored);
  assert.equal(r.cfg.folders.length, 2);
  fs.unlinkSync(configFile);
  r = loadConfig(configFile);
  assert.ok(r.restored && !r.error);
  fs.writeFileSync(configFile + '.bak', 'junk');
  fs.writeFileSync(configFile, 'junk');
  r = loadConfig(configFile);
  assert.ok(r.error && !r.restored);
  assert.deepEqual(r.cfg.folders, [], 'no good copy -> defaults');

  // check: damaged config + activity, missing folder, failing extra check
  fs.writeFileSync(activityFile, '{"not":"a list"}');
  let fixed = false;
  const extra = [{ id: 'x', label: 'Extra', test: () => (fixed ? null : 'broken'), fix: () => { fixed = true; } }];
  const ctx = { dataDir: dir, configFile, activityFile, cfg, activity: [{ item: 'a' }], extra };
  let res = await doctor.check(ctx);
  const byId = (id) => res.find((x) => x.id === id);
  assert.equal(byId('data').ok, true);
  assert.equal(byId('config').ok, false);
  assert.equal(byId('activity').ok, false);
  assert.equal(byId(`folder:${cfg.folders[0].id}`).ok, true);
  const missing = byId(`folder:${cfg.folders[1].id}`);
  assert.ok(!missing.ok && !missing.fix, 'missing folder reported, not auto-fixed');
  assert.ok(byId('x').fix);

  // repair fixes everything fixable, leaves the missing folder for the user
  res = await doctor.repair(ctx);
  assert.deepEqual(res.filter((x) => !x.ok).map((x) => x.id), [`folder:${cfg.folders[1].id}`]);
  assert.equal(loadConfig(configFile).cfg.folders.length, 2);
  assert.deepEqual(JSON.parse(fs.readFileSync(activityFile, 'utf8')), [{ item: 'a' }]);
  assert.ok(fixed);

  // missing activity log is fine (nothing organized yet); missing config is not
  fs.unlinkSync(activityFile);
  fs.unlinkSync(configFile);
  res = await doctor.check({ ...ctx, extra: [] });
  assert.equal(res.find((x) => x.id === 'activity').ok, true);
  assert.equal(res.find((x) => x.id === 'config').ok, false);

  console.log('doctor tests passed');
})().catch((e) => { console.error(e); process.exit(1); });
