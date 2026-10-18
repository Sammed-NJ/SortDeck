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
      h('button', { type: 'button', class: 'chip-x', title: `Remove ${v}`, 'aria-label': `Remove ${v}`, onclick: (e) => { e.stopPropagation(); list.splice(i, 1); draw(); onChange([...list]); } }, '×'))), input);
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

function renderOverview() {
  if (!form) return;
  const hasFolders = form.folders.length > 0;
  $('#welcome').hidden = hasFolders;
  $('#dashboard').hidden = !hasFolders;
  if (!hasFolders) { renderSuggestions(); }
  if (!status) return;

  const watching = form.folders.filter((f) => f.enabled).length;
  const state = status.paused ? 'stopped' : watching ? 'running' : 'missing';
  document.body.dataset.state = state;
  $('#navStatus').textContent = { running: 'Organizing', stopped: 'Paused', missing: 'No folders on' }[state];
  if (!hasFolders) return;

  $('#statusTitle').textContent = status.paused ? 'Organizing is paused' : 'Organizing is on';
  $('#statusSub').textContent = status.paused ? 'New files stay where they land until you resume.'
    : `Watching ${plural(watching, 'folder')} - new files are sorted as soon as they arrive.`;
  $('#btnPause').textContent = status.paused ? 'Resume' : 'Pause';
  $('#btnSweep').disabled = status.paused;

  $('#statFolders').textContent = watching;
  $('#statFoldersSub').textContent = form.folders.length > watching ? `${form.folders.length - watching} turned off` : 'all on';
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
$('#btnSweep').addEventListener('click', async () => {
  const n = await window.api.sweep();
  toast(n ? `Organized ${plural(n, 'item')}.` : 'Everything is already organized.');
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
function showChecks(results) {
  const bad = results.filter((r) => !r.ok);
  $('#checkList').hidden = false;
  $('#checkList').replaceChildren(...results.map((r) => h('div', { class: 'check' + (r.ok ? '' : ' bad') },
    h('span', { class: 'check-mark' }, r.ok ? '✓' : '!'),
    h('div', { style: 'min-width:0' }, h('div', { class: 'fname' }, r.label), h('div', { class: 'fsub' }, r.detail)))));
  $('#btnRepair').hidden = !bad.some((r) => r.fix);
  $('#problemBanner').hidden = !bad.length;
  $('#problemText').textContent = `SortDeck found ${plural(bad.length, 'problem')}.`;
  return bad;
}
async function runCheck(quiet) {
  const bad = showChecks(await window.api.checkProblems());
  if (!quiet) toast(bad.length ? `Found ${plural(bad.length, 'problem')}.` : 'No problems found.', bad.length > 0);
}
$('#btnCheck').addEventListener('click', () => runCheck(false));
$('#btnRepair').addEventListener('click', async () => {
  $('#btnRepair').disabled = true;
  try {
    const bad = showChecks(await window.api.repairProblems());
    toast(bad.length ? `Repaired what could be fixed. ${plural(bad.length, 'problem')} still need you.` : 'Everything is repaired.', bad.length > 0);
    if (!dirty) loadForm();
    refresh();
  } finally { $('#btnRepair').disabled = false; }
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
