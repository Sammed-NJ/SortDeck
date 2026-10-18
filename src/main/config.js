// Config: watched folders, each with Outlook-style rules + optional sort-by-file-type.
// Stored as JSON in the app's user-data folder. No Electron imports - testable with plain node.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RESERVED = ['Other', 'Folders'];
const DEFAULT_CATEGORIES = {
  Images: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico', 'heic'],
  Documents: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt', 'md', 'rtf', 'odt'],
  Installers: ['exe', 'msi', 'msix', 'appx'],
  Archives: ['zip', 'rar', '7z', 'tar', 'gz', 'iso'],
  Data: ['sql', 'csv', 'json', 'xml', 'db'],
  Video: ['mp4', 'mkv', 'mov', 'avi', 'webm'],
  Audio: ['mp3', 'wav', 'flac', 'm4a', 'ogg'],
};
// unfinished downloads from Chrome/Edge, Firefox, Safari, Opera
const DEFAULT_IGNORE = ['crdownload', 'part', 'partial', 'download', 'tmp', 'opdownload'];
const DEFAULT_SETTINGS = { notifications: true, launchAtLogin: true, paused: false, intervalSeconds: 30, quietHours: null };

const OPS = {
  name: ['contains', 'starts', 'ends', 'equals', 'wildcard', 'regex'],
  ext: ['in', 'notin'],
  size: ['gt', 'lt'],
  age: ['older', 'newer'],
  source: ['contains', 'notcontains'],
  type: ['is'],
};
const ACTIONS = ['move', 'copy', 'recycle', 'keep', 'notify'];
const TERMINAL = ['move', 'recycle', 'keep'];
const UNITS = ['minutes', 'hours', 'days'];
const TIME = /^([01]?\d|2[0-3]):[0-5]\d$/;
const BAD_NAME = /[<>:"/\\|?*\x00-\x1f]|[. ]$/;

const arr = (v) => [].concat(v ?? []);
const uid = () => crypto.randomBytes(5).toString('hex');
const badPath = (p) => /[<>"|?*\x00-\x1f]/.test(p) || /:/.test(p.replace(/^[a-zA-Z]:[\\/]/, ''));
const samePath = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

function normExts(list) {
  return [...new Set(arr(list).flatMap((s) => String(s).split(/[,;\s]+/)).map((s) => s.trim().replace(/^\.+/, '').toLowerCase()).filter(Boolean))];
}

function newFolder(p, { sortByType = true } = {}) {
  return { id: uid(), path: p, enabled: true, sortByType, categories: structuredClone(DEFAULT_CATEGORIES), ignore: [...DEFAULT_IGNORE], protected: [], rules: [] };
}

function normalizeRule(r) {
  return {
    id: String(r?.id || uid()),
    name: String(r?.name ?? ''),
    enabled: r?.enabled !== false,
    auto: r?.auto !== false,
    match: r?.match === 'any' ? 'any' : 'all',
    conditions: arr(r?.conditions).filter(Boolean).map((c) => ({ ...c })),
    exceptions: arr(r?.exceptions).filter(Boolean).map((c) => ({ ...c })),
    actions: arr(r?.actions).filter(Boolean).map((a) => ({ ...a })),
    stop: !!r?.stop,
  };
}

function normalizeFolder(f) {
  const cats = f?.categories && typeof f.categories === 'object' ? f.categories : DEFAULT_CATEGORIES;
  return {
    id: String(f?.id || uid()),
    path: String(f?.path ?? ''),
    enabled: f?.enabled !== false,
    sortByType: !!f?.sortByType,
    categories: Object.fromEntries(Object.entries(cats).map(([k, v]) => [k, normExts(v)])),
    ignore: f?.ignore ? normExts(f.ignore) : [...DEFAULT_IGNORE],
    protected: arr(f?.protected).map(String),
    rules: arr(f?.rules).filter(Boolean).map(normalizeRule),
  };
}

function normalizeConfig(c) {
  const s = { ...DEFAULT_SETTINGS, ...(c?.settings ?? {}) };
  return {
    version: 2,
    settings: {
      notifications: !!s.notifications,
      launchAtLogin: !!s.launchAtLogin,
      paused: !!s.paused,
      trayHintShown: !!s.trayHintShown,
      intervalSeconds: Number.isInteger(s.intervalSeconds) && s.intervalSeconds >= 5 ? s.intervalSeconds : 30,
      quietHours: s.quietHours?.start && s.quietHours?.end ? { start: String(s.quietHours.start), end: String(s.quietHours.end) } : null,
    },
    folders: arr(c?.folders).filter(Boolean).map(normalizeFolder),
  };
}

function loadConfig(file) {
  if (!fs.existsSync(file)) return { cfg: normalizeConfig({}), error: null };
  try {
    return { cfg: normalizeConfig(JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))), error: null };
  } catch (e) {
    return { cfg: normalizeConfig({}), error: e.message };
  }
}

function saveConfig(file, cfg) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}

// ---------- config <-> the shape the UI edits (categories as an ordered list) ----------
function toForm(cfg) {
  const hhmm = (t) => (/^\d:\d\d$/.test(t) ? '0' + t : t);
  const q = cfg.settings.quietHours;
  return {
    settings: { ...cfg.settings, quietOn: !!q, quietStart: hhmm(q?.start ?? '22:00'), quietEnd: hhmm(q?.end ?? '07:00') },
    folders: cfg.folders.map((f) => ({ ...structuredClone(f), categories: Object.entries(f.categories).map(([name, exts]) => ({ name, exts })) })),
  };
}

// ---------- validation ----------
function cleanCondition(c, where, errors) {
  if (!OPS[c?.field] || !OPS[c.field].includes(c?.op)) { errors.push(`${where}: unknown condition.`); return null; }
  const out = { field: c.field, op: c.op };
  if (c.field === 'size' || c.field === 'age') {
    out.value = Number(c.value);
    if (c.value === '' || c.value == null || !Number.isFinite(out.value) || out.value < 0) errors.push(`${where}: ${c.field} needs a number.`);
    if (c.field === 'age') out.unit = UNITS.includes(c.unit) ? c.unit : 'days';
  } else if (c.field === 'type') {
    out.value = c.value === 'folder' ? 'folder' : 'file';
  } else if (c.field === 'ext') {
    out.value = normExts(c.value).join(', ');
    if (!out.value) errors.push(`${where}: list at least one extension.`);
  } else {
    out.value = String(c.value ?? '').trim();
    if (!out.value) errors.push(`${where}: a condition has no text.`);
    if (c.op === 'regex') { try { new RegExp(out.value); } catch { errors.push(`${where}: "${out.value}" is not a valid regex.`); } }
  }
  return out;
}

function validateRule(input, label = 'Rule') {
  const errors = [];
  const r = normalizeRule(input);
  const name = r.name.trim();
  const where = `"${name || label}"`;
  if (!name) errors.push(`${label} needs a name.`);
  const conditions = r.conditions.map((c) => cleanCondition(c, where, errors)).filter(Boolean);
  const exceptions = r.exceptions.map((c) => cleanCondition(c, where, errors)).filter(Boolean);
  const actions = [];
  for (const a of r.actions) {
    if (!ACTIONS.includes(a?.type)) { errors.push(`${where}: unknown action.`); continue; }
    if (a.type === 'move' || a.type === 'copy') {
      const dest = String(a.dest ?? '').trim().replace(/[\\/]+$/, '');
      if (!dest) errors.push(`${where}: choose a folder to ${a.type} to.`);
      else if (badPath(dest)) errors.push(`${where}: "${dest}" is not a valid folder.`);
      actions.push({ type: a.type, dest });
    } else if (a.type === 'notify') {
      actions.push({ type: 'notify', message: String(a.message ?? '').trim() });
    } else {
      actions.push({ type: a.type });
    }
  }
  if (!actions.length) errors.push(`${where}: add at least one action.`);
  if (actions.filter((a) => TERMINAL.includes(a.type)).length > 1) errors.push(`${where}: use only one of move / Recycle Bin / leave in place.`);
  return { errors, rule: { ...r, name, conditions, exceptions, actions } };
}

function validateFolder(f, label) {
  const errors = [];
  const p = String(f?.path ?? '').trim();
  const where = p ? path.basename(p) || p : label;
  if (!p || !path.isAbsolute(p) || badPath(p)) errors.push(`${label}: choose a valid folder.`);

  const categories = {};
  const owner = {};
  for (const c of arr(f?.categories)) {
    const name = String(c?.name ?? '').trim();
    const exts = normExts(c?.exts);
    if (!name && !exts.length) continue;
    if (!name) { errors.push(`${where}: a file type group has extensions but no folder name.`); continue; }
    if (BAD_NAME.test(name)) { errors.push(`${where}: "${name}" is not a valid folder name.`); continue; }
    if (RESERVED.some((r) => r.toLowerCase() === name.toLowerCase())) { errors.push(`${where}: "${name}" is built in.`); continue; }
    if (Object.keys(categories).some((k) => k.toLowerCase() === name.toLowerCase())) { errors.push(`${where}: "${name}" is listed twice.`); continue; }
    if (!exts.length) { errors.push(`${where}: "${name}" needs at least one extension.`); continue; }
    for (const e of exts) {
      if (owner[e]) errors.push(`${where}: .${e} is in both ${owner[e]} and ${name}.`);
      else owner[e] = name;
    }
    categories[name] = exts;
  }
  if (f?.sortByType && !Object.keys(categories).length) errors.push(`${where}: add at least one file type group, or turn off sort by type.`);

  const prot = [...new Set(arr(f?.protected).map((s) => String(s).trim()).filter(Boolean))];
  for (const s of prot) if (BAD_NAME.test(s)) errors.push(`${where}: protected folder "${s}" is not a valid name.`);

  const rules = arr(f?.rules).map((r, i) => {
    const v = validateRule(r, `Rule ${i + 1}`);
    errors.push(...v.errors.map((e) => `${where}: ${e}`));
    return v.rule;
  });

  return {
    errors,
    folder: { id: String(f?.id || uid()), path: p, enabled: f?.enabled !== false, sortByType: !!f?.sortByType, categories, ignore: normExts(f?.ignore), protected: prot, rules },
  };
}

// UI form -> validated config
function buildConfig(form) {
  const errors = [];
  const s = form?.settings ?? {};
  const interval = Number(s.intervalSeconds);
  if (!Number.isInteger(interval) || interval < 5 || interval > 3600) errors.push('Check interval must be a whole number between 5 and 3600 seconds.');
  let quietHours = null;
  if (s.quietOn) {
    const start = String(s.quietStart ?? '').trim();
    const end = String(s.quietEnd ?? '').trim();
    if (!TIME.test(start) || !TIME.test(end)) errors.push('Quiet hours must be HH:mm, e.g. 22:00.');
    else if (start === end) errors.push('Quiet hours start and end must differ.');
    else quietHours = { start, end };
  }
  const folders = arr(form?.folders).map((f, i) => {
    const v = validateFolder(f, `Folder ${i + 1}`);
    errors.push(...v.errors);
    return v.folder;
  });
  folders.forEach((f, i) => {
    if (f.path && folders.slice(0, i).some((g) => g.path && samePath(g.path, f.path))) errors.push(`${f.path} is added twice.`);
  });
  return {
    errors,
    cfg: {
      version: 2,
      settings: { notifications: !!s.notifications, launchAtLogin: !!s.launchAtLogin, paused: !!s.paused, trayHintShown: !!s.trayHintShown, intervalSeconds: interval, quietHours },
      folders,
    },
  };
}

module.exports = {
  RESERVED, DEFAULT_CATEGORIES, DEFAULT_IGNORE, OPS, TERMINAL, samePath,
  newFolder, normalizeConfig, loadConfig, saveConfig, toForm, buildConfig, validateRule, validateFolder,
};
