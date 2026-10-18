// The organizer engine: watches folders and applies their rules, then sort-by-type.
// No Electron imports - trash/notify are injected so it runs under plain node for tests.
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { RESERVED, TERMINAL, samePath } = require('./config');

const SKIP_NAMES = new Set(['desktop.ini', 'thumbs.db', '.ds_store']);
const SETTLE_MS = 3000;     // leave files alone until they've been quiet this long (still being written)
const DEBOUNCE_MS = 1500;   // batch bursts of watcher events

const norm = (s) => String(s).trim().replace(/^\.+/, '').toLowerCase();
const wildcard = (p) => new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
const resolveIn = (base, p) => (path.isAbsolute(p) ? p : path.join(base, p));

// the site a file came from: Windows saves it in the Zone.Identifier stream of every browser download
async function readSource(p) {
  try {
    const z = await fsp.readFile(p + ':Zone.Identifier', 'utf8');
    return z.split(/\r?\n/).filter((l) => /^(HostUrl|ReferrerUrl)=/i.test(l)).join(' ');
  } catch { return ''; }
}

async function testCondition(c, item, now) {
  const v = String(c.value ?? '');
  const name = item.name.toLowerCase();
  const lv = v.toLowerCase();
  switch (c.field) {
    case 'name':
      switch (c.op) {
        case 'contains': return name.includes(lv);
        case 'starts': return name.startsWith(lv);
        case 'ends': return name.endsWith(lv);
        case 'equals': return name === lv;
        case 'wildcard': return wildcard(v).test(item.name);
        case 'regex': try { return new RegExp(v, 'i').test(item.name); } catch { return false; }
      }
      return false;
    case 'ext': {
      const hit = !item.isDir && v.split(/[,;\s]+/).map(norm).includes(item.ext);
      return c.op === 'notin' ? !hit : hit;
    }
    case 'size': {
      if (item.isDir) return false; // ponytail: folder sizes aren't measured
      const mb = item.size / 1048576;
      return c.op === 'lt' ? mb < Number(v) : mb > Number(v);
    }
    case 'age': {
      const mins = (now - item.mtimeMs) / 60000;
      const limit = Number(v) * ({ minutes: 1, hours: 60 }[c.unit] ?? 1440);
      return c.op === 'newer' ? mins < limit : mins > limit;
    }
    case 'source': {
      if (item.source === undefined) item.source = item.isDir ? '' : (await readSource(item.path)).toLowerCase();
      const hit = item.source.includes(lv);
      return c.op === 'notcontains' ? !hit : hit;
    }
    case 'type': return (v === 'folder') === item.isDir;
  }
  return false;
}

async function matchRule(rule, item, now = Date.now()) {
  if (rule.conditions.length) {   // no conditions = applies to every item
    const hits = [];
    for (const c of rule.conditions) hits.push(await testCondition(c, item, now));
    if (rule.match === 'any' ? !hits.some(Boolean) : !hits.every(Boolean)) return false;
  }
  for (const x of rule.exceptions) if (await testCondition(x, item, now)) return false;
  return true;
}

async function exists(p) { try { await fsp.lstat(p); return true; } catch { return false; } }

async function freePath(dir, name, isDir) {
  const ext = isDir ? '' : path.extname(name);
  const base = isDir ? name : path.basename(name, ext);
  let dest = path.join(dir, name);
  for (let i = 1; await exists(dest); i++) dest = path.join(dir, `${base} (${i})${ext}`);
  return dest;
}

async function transfer(item, destDir, copy) {
  if (!copy && samePath(path.dirname(item.path), destDir)) return item.path; // already there
  await fsp.mkdir(destDir, { recursive: true });
  const dest = await freePath(destDir, item.name, item.isDir);
  if (copy) { await fsp.cp(item.path, dest, { recursive: true, errorOnExist: true, force: false }); return dest; }
  try {
    await fsp.rename(item.path, dest);
  } catch (e) {
    if (e.code !== 'EXDEV') throw e;   // other drive: copy, then remove the original
    await fsp.cp(item.path, dest, { recursive: true, errorOnExist: true, force: false });
    await fsp.rm(item.path, { recursive: true, force: true });
  }
  return dest;
}

function inQuietHours(q, date = new Date()) {
  if (!q) return false;
  const mins = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const now = date.getHours() * 60 + date.getMinutes();
  const s = mins(q.start), e = mins(q.end);
  return s <= e ? now >= s && now < e : now >= s || now < e;
}

// subfolders of a watched folder that are destinations, not things to sort
function skipDirs(folder, allFolders) {
  const names = [...Object.keys(folder.categories), ...RESERVED, ...folder.protected];
  for (const r of folder.rules) for (const a of r.actions) {
    if (a.dest && !path.isAbsolute(a.dest)) names.push(a.dest.split(/[\\/]/)[0]);
  }
  for (const f of allFolders) if (samePath(path.dirname(f.path), folder.path)) names.push(path.basename(f.path));
  return new Set(names.map((n) => n.toLowerCase()));
}

async function listItems(folder, allFolders, now, { settle = true } = {}) {
  let entries;
  try { entries = await fsp.readdir(folder.path, { withFileTypes: true }); } catch (e) { return { items: [], error: e }; }
  const skip = skipDirs(folder, allFolders);
  const ignore = new Set(folder.ignore);
  const items = [];
  let unsettled = false;
  for (const d of entries) {
    const lower = d.name.toLowerCase();
    if (SKIP_NAMES.has(lower) || d.name.startsWith('~$') || d.name.startsWith('.')) continue;
    const isDir = d.isDirectory();
    if (!isDir && !d.isFile()) continue;
    if (isDir && skip.has(lower)) continue;
    const ext = isDir ? '' : path.extname(d.name).slice(1).toLowerCase();
    if (!isDir && ignore.has(ext)) continue;
    const p = path.join(folder.path, d.name);
    let st;
    try { st = await fsp.stat(p); } catch { continue; }
    if (settle && now - st.mtimeMs < SETTLE_MS) { unsettled = true; continue; }
    items.push({ name: d.name, path: p, isDir, ext, size: st.size, mtimeMs: st.mtimeMs });
  }
  return { items, unsettled };
}

class Organizer {
  constructor({ trash = async () => { throw new Error('no trash'); }, notify = () => {}, onActivity = () => {}, now = Date.now } = {}) {
    Object.assign(this, { trash, notify, onActivity, now });
    this.cfg = { settings: { paused: true }, folders: [] };
    this.watchers = new Map();
    this.timers = new Map();
    this.busy = new Map();
    this.status = new Map();     // folderId -> { error, lastRun }
    this.schedules = new Map();  // folderId -> interval timer ("every N minutes" folders)
    this.nextRun = new Map();    // folderId -> when its next scheduled run is due
    this.failed = new Set();     // paths we've already warned about
  }

  // folders organized without a click: "instant" (watcher + safety re-check) and "interval" (own timer)
  autoFolders(trigger) {
    return this.cfg.folders.filter((f) => f.enabled && (trigger ? f.trigger === trigger : f.trigger !== 'manual'));
  }

  setConfig(cfg) {
    this.cfg = cfg;
    this.stop();
    if (cfg.settings.paused) return;
    for (const f of this.autoFolders('instant')) this.watch(f);
    this.interval = setInterval(() => this.sweepAll('instant'), cfg.settings.intervalSeconds * 1000).unref();
    for (const f of this.autoFolders('interval')) {
      this.schedules.set(f.id, setInterval(() => this.sweep(f.id), f.intervalMinutes * 60000).unref());
      this.nextRun.set(f.id, this.now() + f.intervalMinutes * 60000);
    }
    this.sweepAll('instant'); // interval folders wait for their first tick
  }

  stop() {
    for (const w of this.watchers.values()) w.close();
    this.watchers.clear();
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    for (const t of this.schedules.values()) clearInterval(t);
    this.schedules.clear();
    this.nextRun.clear();
    clearInterval(this.interval);
  }

  watch(folder) {
    try {
      const w = fs.watch(folder.path, { persistent: false }, () => this.schedule(folder.id));
      w.on('error', () => { w.close(); this.watchers.delete(folder.id); });
      this.watchers.set(folder.id, w);
    } catch { /* missing folder: the interval sweep reports it and retries */ }
  }

  schedule(id, ms = DEBOUNCE_MS) {
    clearTimeout(this.timers.get(id));
    this.timers.set(id, setTimeout(() => { this.timers.delete(id); this.sweep(id); }, ms).unref());
  }

  sweepAll(trigger) { return Promise.all(this.autoFolders(trigger).map((f) => this.sweep(f.id))); }

  // automatic pass: enabled+automatic rules, then sort-by-type for whatever no rule handled
  async sweep(id) {
    const folder = this.cfg.folders.find((f) => f.id === id);
    if (!folder || !folder.enabled || folder.trigger === 'manual') return [];
    if (this.cfg.settings.paused || inQuietHours(this.cfg.settings.quietHours)) return [];
    if (this.busy.get(id)) { this.busy.set(id, 'again'); return []; }
    this.busy.set(id, true);
    if (folder.trigger === 'interval') this.nextRun.set(id, this.now() + folder.intervalMinutes * 60000);
    try {
      if (folder.trigger === 'instant' && !this.watchers.has(id)) this.watch(folder);
      const rules = folder.rules.filter((r) => r.enabled && r.auto);
      const { items, unsettled, error } = await listItems(folder, this.cfg.folders, this.now());
      this.status.set(id, { error: error ? (error.code === 'ENOENT' ? 'Folder not found' : error.message) : null, lastRun: this.now() });
      const report = [];
      for (const item of items) report.push(...(await this.processItem(folder, item, rules, { fallback: folder.sortByType })));
      this.finish(report, false);
      if (unsettled) this.schedule(id, SETTLE_MS);
      return report;
    } finally {
      const again = this.busy.get(id) === 'again';
      this.busy.delete(id);
      if (again) this.schedule(id);
    }
  }

  // manual "Organize now": given rules, once, on the folder (or a subfolder); optionally sort the rest by type
  async run(folder, rules, { preview = false, target, fallback = false } = {}) {
    const dir = target ? resolveIn(folder.path, target) : folder.path;
    const scope = { ...folder, path: dir };
    const { items, error } = await listItems(scope, this.cfg.folders, this.now(), { settle: false });
    if (error) throw new Error(error.code === 'ENOENT' ? `Folder not found: ${dir}` : error.message);
    const report = [];
    // relative destinations stay relative to the watched folder, not the target
    for (const item of items) report.push(...(await this.processItem(folder, item, rules, { preview, fallback: fallback && !target })));
    this.finish(report, preview);
    return report;
  }

  async processItem(folder, item, rules, { preview = false, fallback = false } = {}) {
    const out = [];
    const entry = (rule, action, dest, ok, error) => ({ time: this.now(), folder: folder.path, item: item.name, rule, action, dest, ok, error });
    for (const r of rules) {
      if (!(await matchRule(r, item, this.now()))) continue;
      for (const a of r.actions.filter((x) => x.type === 'copy' || x.type === 'notify')) {
        if (a.type === 'notify') {
          if (!preview) this.notify(item.name, a.message || `Matched rule: ${r.name}`);
          out.push(entry(r.name, 'notify', a.message || '', true));
        } else {
          out.push(await this.act(item, 'copy', resolveIn(folder.path, a.dest), preview, (ok, dest, err) => entry(r.name, 'copy', dest, ok, err)));
        }
      }
      const term = r.actions.find((x) => TERMINAL.includes(x.type));
      if (term) {
        const dest = term.type === 'move' ? resolveIn(folder.path, term.dest) : '';
        out.push(await this.act(item, term.type, dest, preview, (ok, d, err) => entry(r.name, term.type, d, ok, err)));
        return out;
      }
      if (r.stop) break;
    }
    if (fallback) {
      let cat = item.isDir ? 'Folders' : 'Other';
      if (!item.isDir) for (const [k, exts] of Object.entries(folder.categories)) if (exts.includes(item.ext)) { cat = k; break; }
      out.push(await this.act(item, 'move', path.join(folder.path, cat), preview, (ok, d, err) => entry('Sort by type', 'move', d, ok, err)));
    }
    return out;
  }

  async act(item, type, dest, preview, make) {
    if (preview || type === 'keep') return make(true, dest);
    try {
      let to;   // where the item ended up (may be renamed "name (1)")
      if (type === 'recycle') await this.trash(item.path);
      else to = await transfer(item, dest, type === 'copy');
      this.failed.delete(item.path);
      return { ...make(true, dest), to };
    } catch (e) {
      // locked / in use: stays put and is retried on the next sweep; warn once per item
      const first = !this.failed.has(item.path);
      this.failed.add(item.path);
      return { ...make(false, dest, e.code === 'EBUSY' || e.code === 'EPERM' ? 'File in use - will retry' : e.message), quiet: !first };
    }
  }

  finish(report, preview) {
    if (preview) return;
    const logged = report.filter((r) => !r.quiet);
    if (!logged.length) return;
    this.onActivity(logged);
    if (!this.cfg.settings.notifications) return;
    const done = logged.filter((r) => r.ok && r.action !== 'notify');
    const bad = logged.filter((r) => !r.ok);
    if (done.length === 1) this.notify(done[0].item, describe(done[0]));
    else if (done.length > 1) this.notify(`Organized ${done.length} items`, [...new Set(done.map((r) => path.basename(r.dest || r.folder)))].slice(0, 4).join(', '));
    if (bad.length) this.notify(`Couldn't organize ${bad.length} item${bad.length > 1 ? 's' : ''}`, `${bad[0].item}: ${bad[0].error}`);
  }
}

function describe(r) {
  return { move: `Moved to ${path.basename(r.dest)}`, copy: `Copied to ${path.basename(r.dest)}`, recycle: 'Sent to Recycle Bin', keep: 'Kept in place' }[r.action] ?? r.action;
}

module.exports = { Organizer, matchRule, testCondition, inQuietHours, listItems, transfer, readSource };
