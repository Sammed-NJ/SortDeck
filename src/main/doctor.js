// Troubleshoot: finds what's broken and repairs what it safely can.
// No Electron imports - app-specific checks (start with Windows, Start menu shortcut) are passed in as `extra`.
const fs = require('fs');
const { saveConfig } = require('./config');

function writable(p) { try { fs.accessSync(p, fs.constants.W_OK); return true; } catch { return false; } }

function jsonProblem(file, { required = false, isArray = false } = {}) {
  let v;
  try { v = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch (e) {
    if (e.code === 'ENOENT') return required ? 'The file is missing' : null;
    return e instanceof SyntaxError ? 'The file is damaged' : e.message;
  }
  return isArray && !Array.isArray(v) ? 'The file is damaged' : null;
}

// -> [{ id, label, ok, detail, fix }]  fix: repair() can fix it
async function check({ dataDir, configFile, activityFile, cfg, extra = [] }) {
  const out = [];
  const add = (id, label, problem, detail, fix = true) => out.push({ id, label, ok: !problem, detail: problem || detail || '', fix: !!problem && fix });

  add('data', 'Settings folder', writable(dataDir) ? null : `Can't write to ${dataDir}`, dataDir);
  add('config', 'Settings file', jsonProblem(configFile, { required: true }), 'OK');
  add('activity', 'Activity log', jsonProblem(activityFile, { isArray: true }), 'OK');
  for (const f of cfg.folders.filter((x) => x.enabled)) {
    const problem = !fs.existsSync(f.path) ? 'Folder not found - reconnect the drive, or remove or re-pick it in Folders & rules'
      : !writable(f.path) ? 'No permission to change this folder' : null;
    add(`folder:${f.id}`, f.path, problem, 'OK', false);
  }
  for (const x of extra) {
    let problem;
    try { problem = await x.test(); } catch (e) { problem = e.message; }
    add(x.id, x.label, problem, 'OK', !!x.fix);
  }
  return out;
}

// fixes every fixable problem, then checks again
async function repair(ctx) {
  const { dataDir, configFile, activityFile, cfg, activity = [], extra = [] } = ctx;
  for (const p of (await check(ctx)).filter((r) => r.fix)) {
    try {
      if (p.id === 'data') fs.mkdirSync(dataDir, { recursive: true });
      else if (p.id === 'config') saveConfig(configFile, cfg);
      else if (p.id === 'activity') fs.writeFileSync(activityFile, JSON.stringify(Array.isArray(activity) ? activity : []));
      else await extra.find((x) => x.id === p.id)?.fix();
    } catch { /* still broken: the re-check below reports it */ }
  }
  return check(ctx);
}

module.exports = { check, repair };
