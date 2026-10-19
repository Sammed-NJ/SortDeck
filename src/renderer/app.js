// Shared helpers, navigation, overview, settings and saving. folders.js and rules.js build on these globals.
const $ = (s) => document.querySelector(s);

// tiny DOM builder - text always goes through append/textContent, never innerHTML
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (v != null && v !== false) el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c);
  return el;
}

const PALETTE = ['#0ea5e9', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899', '#14b8a6', '#6366f1', '#84cc16', '#f97316'];
function colorFor(name) {
  if (name === 'Other' || name === 'Folders') return '#94a3b8';
  let n = 0;
  for (const ch of String(name).toLowerCase()) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[n % PALETTE.length];
}
const baseName = (p) => String(p).replace(/[\\/]+$/, '').split(/[\\/]/).pop() || p;
// a short minimum wait so quick jobs still show they ran instead of flashing past
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const busyLabel = (btn, text) => { btn.disabled = true; btn.replaceChildren(icon('arrow-path', 'ico spin'), text); };
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
function ago(ms) {
  if (!ms) return 'never';
  const s = (Date.now() - ms) / 1000;
  if (s < 10) return 'just now';
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

let toastTimer;
function toast(text, isError = false) {
  const t = $('#toast');
  t.textContent = text;
  t.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), isError ? 6000 : 3500);
}

// ---------- navigation ----------
function show(view) {
  document.querySelectorAll('.nav').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== `view-${view}`; });
}
document.querySelectorAll('.nav[data-view]').forEach((b) => b.addEventListener('click', () => show(b.dataset.view)));

// tag-style input: Enter / comma (and space, for extensions) commits, Backspace removes the last tag
const normExt = (s) => s.trim().replace(/^\.+/, '').toLowerCase();
function chipInput(values, placeholder, onChange, { split = /[,;\s]+/, normalize = normExt, keys = ['Enter', ',', ';', ' '] } = {}) {
  let list = [...values];
  const input = h('input', { class: 'chip-input', placeholder, spellcheck: 'false' });
  const wrap = h('div', { class: 'chips', onclick: () => input.focus() });
  const draw = (focus) => {
    wrap.replaceChildren(...list.map((v, i) => h('span', { class: 'chip' }, v,
      h('button', { type: 'button', class: 'chip-x', title: `Remove ${v}`, 'aria-label': `Remove ${v}`, onclick: (e) => { e.stopPropagation(); list.splice(i, 1); draw(); onChange([...list]); } }, icon('x-mark')))), input);
    if (focus) input.focus();
  };
  const commit = (focus) => {
    const add = input.value.split(split).map(normalize).filter(Boolean);
    input.value = '';
    if (!add.length) return;
    list = [...new Set([...list, ...add])];
    draw(focus);
    onChange([...list]);
  };
  input.addEventListener('keydown', (e) => {
    if (keys.includes(e.key)) { e.preventDefault(); commit(true); }
    else if (e.key === 'Backspace' && !input.value && list.length) { list.pop(); draw(true); onChange([...list]); }
  });
  input.addEventListener('blur', () => commit(false));
  input.addEventListener('paste', () => setTimeout(() => commit(true)));
  draw();
  return wrap;
}

// ---------- config form (all folders + settings), saved together ----------
let form = null;
let savedJson = '';
let dirty = false;

function markDirty() {
  dirty = JSON.stringify(form) !== savedJson;
  $('#savebar').hidden = !dirty;
  if (!dirty) $('#saveErrors').textContent = '';
}

async function loadForm() {
  const { form: f, note } = await window.api.getConfig();
  form = f;
  savedJson = JSON.stringify(form);
  renderSettings();
  renderFolders();
  markDirty();
  renderOverview();
  if (note) toast(note, true);
}

async function save() {
  if (!dirty) return true;
  const r = await window.api.saveConfig(form);
  if (!r.ok) { $('#saveErrors').textContent = r.errors.join('  ·  '); $('#savebar').hidden = false; return false; }
  await loadForm();
  toast('Saved - organizing with the new settings.');
  refresh();
  return true;
}

$('#btnSave').addEventListener('click', save);
$('#btnRevert').addEventListener('click', () => { loadForm(); toast('Changes discarded.'); });
document.addEventListener('keydown', (e) => { if (e.ctrlKey && e.key.toLowerCase() === 's') { e.preventDefault(); save(); } });
window.addEventListener('beforeunload', (e) => { if (dirty) e.returnValue = false; });

// ---------- settings ----------
function renderSettings() {
  const s = form.settings;
  $('#setLogin').checked = s.launchAtLogin;
  $('#setNotify').checked = s.notifications;
  $('#setInterval').value = s.intervalSeconds;
  $('#setQuiet').checked = s.quietOn;
  $('#quietStart').value = s.quietStart;
  $('#quietEnd').value = s.quietEnd;
  $('#quietStart').disabled = $('#quietEnd').disabled = !s.quietOn;
  for (const r of document.querySelectorAll('input[name=theme]')) r.checked = r.value === s.theme;
  for (const r of document.querySelectorAll('input[name=accent]')) r.checked = r.value === s.accent;
  applyLook(s);
}
// theme switches live through main (nativeTheme); accent is CSS only
function applyLook(s) {
  document.documentElement.dataset.accent = s.accent;
  window.api.previewTheme(s.theme);
}
for (const name of ['theme', 'accent']) {
  for (const r of document.querySelectorAll(`input[name=${name}]`)) {
    r.addEventListener('change', () => { form.settings[name] = r.value; applyLook(form.settings); markDirty(); });
  }
}
const bindSetting = (sel, key, read = (el) => el.checked) => $(sel).addEventListener(sel.includes('Start') || sel.includes('End') || sel.includes('Interval') ? 'input' : 'change', (e) => {
  form.settings[key] = read(e.target);
  if (key === 'quietOn') $('#quietStart').disabled = $('#quietEnd').disabled = !form.settings.quietOn;
  markDirty();
});
bindSetting('#setLogin', 'launchAtLogin');
bindSetting('#setNotify', 'notifications');
bindSetting('#setQuiet', 'quietOn');
bindSetting('#quietStart', 'quietStart', (el) => el.value);
bindSetting('#quietEnd', 'quietEnd', (el) => el.value);
bindSetting('#setInterval', 'intervalSeconds', (el) => (el.value === '' ? null : Number(el.value)));
$('#btnEditJson').addEventListener('click', async () => {
  if (!(await window.api.openConfigFile())) toast('Could not open the config file.', true);
});

// ---------- overview ----------
let status = null;
let busy = false;
let lastSig = '';

async function refresh() {
  if (busy) return;
  busy = true;
  try { status = await window.api.status(); renderOverview(); renderFolderNav(); } finally { busy = false; }
}

const ACTION_WORD = { move: 'Moved to', copy: 'Copied to', recycle: 'Recycle Bin', keep: 'Kept', notify: 'Notified' };
// what SortDeck is really doing: [sidebar icon, sidebar text, overview title]
const STATES = {
  running: ['play-circle', 'Organizing', 'Organizing is on'],
  manual: ['cursor-arrow-rays', 'Only when you click', 'Ready when you are'],
  off: ['power', 'All folders off', 'All folders are off'],
  stopped: ['pause-circle', 'Paused', 'Organizing is paused'],
  missing: ['folder-plus', 'No folders yet', ''],
};

function renderOverview() {
  if (!form) return;
  const hasFolders = form.folders.length > 0;
  $('#welcome').hidden = hasFolders;
  $('#dashboard').hidden = !hasFolders;
  if (!hasFolders) { renderSuggestions(); }
  if (!status) return;

  // only Instant / On a schedule folders organize by themselves; "Only when I click" waits for the user
  const on = form.folders.filter((f) => f.enabled).length;
  const auto = form.folders.filter((f) => f.enabled && f.trigger !== 'manual').length;
  const state = status.paused ? 'stopped' : auto ? 'running' : on ? 'manual' : hasFolders ? 'off' : 'missing';
  document.body.dataset.state = state;
  const [ic, label, title] = STATES[state];
  $('#navIcon').innerHTML = ICONS[ic]; // constant markup
  $('#navStatus').textContent = label;
  if (!hasFolders) return;

  $('#statusTitle').textContent = title;
  $('#statusSub').textContent = {
    running: `${plural(auto, 'folder')} organized automatically${on > auto ? `, ${on - auto} only when you click` : ''}.`,
    manual: 'Nothing moves until you click Organize now.',
    off: 'Turn a folder on in Folders & rules to start organizing.',
    stopped: 'New files stay where they land until you resume.',
  }[state];
  $('#btnPause').textContent = status.paused ? 'Resume' : 'Pause';
  $('#btnPause').hidden = state === 'manual' || state === 'off'; // nothing automatic to pause
  $('#btnSweep').disabled = status.paused || state === 'off';

  $('#statFolders').textContent = on;
  const off = form.folders.length - on;
  $('#statFoldersSub').textContent = [auto && `${auto} automatic`, on - auto && `${on - auto} when you click`, off && `${off} off`].filter(Boolean).join(' · ');
  $('#statToday').textContent = status.today.toLocaleString();
  const last = status.activity[0];
  $('#statLast').textContent = last ? ago(last.time) : 'never';
  $('#statLastSub').textContent = last ? `${last.item} → ${last.dest ? baseName(last.dest) : ACTION_WORD[last.action]}` : '';

  const sig = JSON.stringify([status.folders, status.activity.slice(0, 40).map((a) => [a.time, a.item]), form.folders.map((f) => [f.id, f.path, f.enabled, f.rules.length]), Math.floor(Date.now() / 60000)]);
  if (sig === lastSig) return;
  lastSig = sig;

  $('#folderCards').replaceChildren(...form.folders.map((f) => {
    const st = status.folders.find((s) => s.id === f.id);
    const problem = st && !st.exists ? 'Folder not found' : st?.error;
    return h('div', { class: 'folder' + (f.enabled ? '' : ' empty'), title: 'Open rules', onclick: () => { selectFolder(f.id); show('folders'); } },
      h('span', { class: 'swatch', style: `background:${colorFor(baseName(f.path))}` }),
      h('span', { class: 'name' }, baseName(f.path)),
      h('span', { class: 'count' }, st?.today ? `${st.today} today` : ''),
      h('div', { class: 'meta' }, problem ? h('span', { class: 'bad-text' }, problem)
        : h('span', {}, `${whenLabel(f)} · ${plural(f.rules.length, 'rule')}${f.sortByType ? ' + sort by type' : ''}`)));
  }));

  $('#activityList').replaceChildren(...(status.activity.length ? status.activity.slice(0, 40).map((a) => {
    const where = a.dest ? baseName(a.dest) : ACTION_WORD[a.action];
    const c = colorFor(where);
    return h('div', { class: 'file' + (a.ok ? '' : ' failed'), title: a.ok ? 'Show in Explorer' : a.error, onclick: () => (a.to || a.dest) && window.api.openPath(a.to || a.dest) },
      h('span', { class: 'tile', style: `background:color-mix(in srgb, ${c} 16%, transparent);color:${c}` }, (a.item.includes('.') ? a.item.split('.').pop() : 'dir').slice(0, 4)),
      h('div', { style: 'min-width:0' },
        h('div', { class: 'fname' }, a.item),
        h('div', { class: 'fsub' }, a.ok ? `${a.action === 'move' || a.action === 'copy' ? ACTION_WORD[a.action] + ' ' : ''}${where} · ${a.rule} · ${baseName(a.folder)}` : `Failed: ${a.error}`)),
      h('span', { class: 'when' }, ago(a.time)));
  }) : [h('div', { class: 'empty-note' }, 'Nothing organized yet - drop a file into a watched folder.')]));
}

$('#btnPause').addEventListener('click', async () => {
  const paused = !status.paused;
  await window.api.pause(paused);
  // keep any unsaved edits: only the saved copy's paused flag changed
  const saved = JSON.parse(savedJson);
  saved.settings.paused = form.settings.paused = paused;
  savedJson = JSON.stringify(saved);
  markDirty();
  refresh();
});
$('#btnSweep').addEventListener('click', async (e) => {
  if (document.body.dataset.state === 'manual') { // nothing runs by itself: open a folder's Organize now dialog
    selectFolder(form.folders.find((f) => f.enabled).id);
    show('folders');
    openRunDialog();
    return;
  }
  const b = e.currentTarget;
  busyLabel(b, 'Organizing...');
  try {
    const [n] = await Promise.all([window.api.sweep(), wait(800)]);
    toast(n ? `Organized ${plural(n, 'item')}.` : 'Everything is already organized.');
  } finally { b.textContent = 'Organize now'; b.disabled = false; }
  refresh();
});

window.api.onActivity(() => refresh());
window.addEventListener('focus', () => { if (!dirty) loadForm(); refresh(); });

window.api.info().then((i) => {
  $('#configPath').textContent = i.configPath;
  $('#version').textContent = `SortDeck ${i.version}`;
  $('#curVersion').textContent = i.version;
  if (!i.packaged) for (const b of [$('#btnUninstall'), $('#btnUninstallAll')]) { b.disabled = true; b.title = 'Only in the installed app'; }
});

// ---------- troubleshoot ----------
// results stay folded away unless the user runs a check or something is wrong;
// a clean run opens, ticks each item off, then folds closed leaving a one-line summary
let foldTimer;
function showChecks(results, animate) {
  const bad = results.filter((r) => !r.ok);
  clearTimeout(foldTimer);
  $('#checkList').replaceChildren(...results.map((r, i) => h('div', { class: 'check-row' + (r.ok ? '' : ' bad') + (animate ? ' reveal' : ''), style: `--i:${i}` },
    icon(r.ok ? 'check-circle' : 'exclamation-triangle', 'check-mark'),
    h('div', { style: 'min-width:0' }, h('div', { class: 'fname' }, r.label), h('div', { class: 'fsub' }, r.detail)))));
  const sum = $('#checkSummary');
  sum.className = 'check-summary' + (bad.length ? ' bad' : '');
  sum.replaceChildren(icon(bad.length ? 'exclamation-triangle' : 'check-circle'), bad.length ? `${plural(bad.length, 'problem')} found` : 'No problems found');
  const clean = animate && !bad.length;
  sum.hidden = clean; // a clean run shows the summary once the list has folded away
  $('#checkWrap').classList.toggle('open', animate || bad.length > 0);
  if (clean) foldTimer = setTimeout(() => { $('#checkWrap').classList.remove('open'); sum.hidden = false; }, 1200 + results.length * 120);
  $('#btnRepair').hidden = !bad.some((r) => r.fix);
  $('#problemBanner').hidden = !bad.length;
  $('#problemText').textContent = `SortDeck found ${plural(bad.length, 'problem')}.`;
  return bad;
}
async function runCheck(quiet) {
  const b = $('#btnCheck');
  if (quiet) { showChecks(await window.api.checkProblems(), false); return; }
  busyLabel(b, 'Checking...');
  try {
    const [results] = await Promise.all([window.api.checkProblems(), wait(700)]);
    showChecks(results, true);
  } finally { b.textContent = 'Run check'; b.disabled = false; }
}
$('#btnCheck').addEventListener('click', () => runCheck(false));
$('#btnRepair').addEventListener('click', async () => {
  const b = $('#btnRepair');
  busyLabel(b, 'Repairing...');
  try {
    const [results] = await Promise.all([window.api.repairProblems(), wait(700)]);
    const bad = showChecks(results, true);
    toast(bad.length ? `Repaired what could be fixed. ${plural(bad.length, 'problem')} still need you.` : 'Everything is repaired.', bad.length > 0);
    if (!dirty) loadForm();
    refresh();
  } finally { b.textContent = 'Repair'; b.disabled = false; }
});
$('#btnProblems').addEventListener('click', () => show('settings'));

// ---------- updates ----------
$('#btnCheckUpdate').addEventListener('click', async () => {
  const b = $('#btnCheckUpdate');
  b.disabled = true; b.textContent = 'Checking...';
  try {
    const u = await window.api.checkUpdate();
    const text = {
      available: `SortDeck ${u.latest} is available - you have ${u.current}.`,
      latest: `You're up to date (${u.current}).`,
      none: `You have ${u.current}. No downloadable release is published yet.`,
      error: `Couldn't check for updates (${u.error}). Check your internet connection.`,
    }[u.status];
    $('#updateText').textContent = text;
    $('#btnInstallUpdate').hidden = u.status !== 'available';
    $('#btnInstallUpdate').textContent = u.canInstall ? 'Download and install' : 'Open download page';
    $('#btnReleases').hidden = u.status === 'error';
    toast(text, u.status === 'error');
  } finally { b.disabled = false; b.textContent = 'Check for updates'; }
});
$('#btnInstallUpdate').addEventListener('click', async () => {
  const b = $('#btnInstallUpdate');
  const label = b.textContent;
  b.disabled = true; b.textContent = 'Downloading...';
  const r = await window.api.installUpdate();
  if (r.ok) { toast('Installing the update - SortDeck will reopen.'); return; }
  toast(r.error, true);
  b.disabled = false; b.textContent = label;
});
$('#btnReleases').addEventListener('click', () => window.api.openReleases());
$('#btnFeedback').addEventListener('click', () => window.api.openLink('feedback'));
document.querySelectorAll('[data-link]').forEach((b) => b.addEventListener('click', () => window.api.openLink(b.dataset.link)));
$('#btnGoUninstall').addEventListener('click', () => $('#uninstallCard').scrollIntoView({ behavior: 'smooth', block: 'center' }));

// ---------- uninstall (main shows the warning and does the work) ----------
async function uninstall(withData) {
  const r = await window.api.uninstall(withData);
  if (r.ok) toast('Uninstalling SortDeck...');
  else if (r.error) toast(r.error, true);
}
$('#btnUninstall').addEventListener('click', () => uninstall(false));
$('#btnUninstallAll').addEventListener('click', () => uninstall(true));

// ---------- start (after folders.js and rules.js have loaded) ----------
document.addEventListener('DOMContentLoaded', () => loadForm().then(refresh).then(() => runCheck(true)));
setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 5000);
