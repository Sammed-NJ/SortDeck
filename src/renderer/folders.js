// Watched folders: welcome suggestions, add-folder dialog, folder list and the per-folder page.
// Uses globals from app.js; the rule list/editor lives in rules.js.

let selectedId = null;
const curFolder = () => form.folders.find((f) => f.id === selectedId) ?? form.folders[0] ?? null;
const SUGGEST = {
  downloads: ['Downloads', 'Sort new downloads into Images, Documents, Installers...', true],
  desktop: ['Desktop', 'Keep the desktop clear', true],
  documents: ['Documents', 'File documents with your own rules', false],
  pictures: ['Pictures', 'Group photos and screenshots', false],
};
const ICON_FOLDER = '<svg viewBox="0 0 24 24"><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h4l2 2h7A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/></svg>';
function folderIcon() { const s = h('span', { class: 'ficon' }); s.innerHTML = ICON_FOLDER; return s; } // constant markup

// ---------- welcome ----------
let suggestionsDrawn = false;
async function renderSuggestions() {
  if (suggestionsDrawn) return;
  suggestionsDrawn = true;
  const list = await window.api.suggestFolders();
  $('#suggestions').replaceChildren(
    ...list.map((s) => h('button', { class: 'suggest card', onclick: () => openAddDialog(s.path, SUGGEST[s.key][2]) },
      folderIcon(), h('b', {}, SUGGEST[s.key][0]), h('span', { class: 'muted small' }, SUGGEST[s.key][1]))),
    h('button', { class: 'suggest card dashed', onclick: () => pickAndAdd() }, folderIcon(), h('b', {}, 'Another folder...'), h('span', { class: 'muted small' }, 'Any folder or drive')));
}

// ---------- add folder ----------
async function pickAndAdd() {
  const p = await window.api.pickFolder();
  if (p) openAddDialog(p, true);
}

function openAddDialog(p, sortByType) {
  if (form.folders.some((f) => f.path.toLowerCase() === p.toLowerCase())) {
    toast(`${baseName(p)} is already in your list.`);
    selectFolder(form.folders.find((f) => f.path.toLowerCase() === p.toLowerCase()).id);
    show('folders');
    return;
  }
  const d = $('#addDialog');
  const CHOICES = {
    setup: { title: 'Set up rules first', desc: 'Nothing moves yet. Add your rules, preview them, then choose when this folder is organized - instantly, on a schedule, or only when you click.', button: 'Add folder', opts: { trigger: 'manual', sortByType: false } },
    quick: { title: 'Sort by file type right away', desc: 'Items already here are moved into Images, Documents, Installers... now, and new ones as they arrive. You can still add rules.', button: 'Start organizing', opts: { trigger: 'instant', sortByType: true } },
  };
  let choice = 'setup';
  const submit = h('button', { type: 'submit', class: 'btn primary' }, CHOICES.setup.button);
  const card = (key) => h('label', { class: 'choice' },
    h('input', { type: 'radio', name: 'addMode', checked: key === choice, onchange: () => { choice = key; submit.textContent = CHOICES[key].button; } }),
    h('span', {}, h('b', {}, CHOICES[key].title), h('span', { class: 'muted small' }, CHOICES[key].desc)));

  d.replaceChildren(h('form', { class: 'dlg', onsubmit: async (e) => {
    e.preventDefault();
    const folder = await window.api.newFolder(p, CHOICES[choice].opts);
    form.folders.push(folder);
    selectedId = folder.id;
    d.close();
    renderFolders();
    markDirty();
    if (await save()) {
      show('folders');
      toast(choice === 'setup' ? `${baseName(p)} added - nothing moves until you choose when to organize.` : `Now organizing ${baseName(p)}.`);
    }
  } },
    h('header', {}, h('h1', {}, `Add ${baseName(p)}`), h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', onclick: () => d.close() }, '×')),
    h('div', { class: 'dlg-body' },
      h('p', { class: 'path' }, p),
      h('div', { class: 'choices' }, card('setup'), card('quick'))),
    h('footer', {}, h('span', { class: 'grow' }),
      h('button', { type: 'button', class: 'btn', onclick: () => d.close() }, 'Cancel'),
      submit)));
  d.showModal();
}
$('#btnAddFolder').addEventListener('click', pickAndAdd);
$('#btnAddFolder2').addEventListener('click', pickAndAdd);

// ---------- folder list + page ----------
function selectFolder(id) { selectedId = id; renderFolders(); }

function renderFolders() {
  renderFolderNav();
  renderFolderDetail();
}

const everyText = (m) => (m % 60 === 0 ? plural(m / 60, 'hour') : plural(m, 'minute'));
function whenLabel(f) {
  if (!f.enabled) return 'Off';
  return { instant: 'Instant', interval: `Every ${everyText(f.intervalMinutes)}`, manual: 'Manual' }[f.trigger];
}

// "When to organize": instant / every N / only when I click / off  (off = enabled false, trigger kept)
function scheduleCard(f) {
  const mode = f.enabled ? f.trigger : 'off';
  const st = status?.folders.find((s) => s.id === f.id);
  const hint = {
    instant: 'New items are organized a few seconds after they arrive.',
    interval: st?.nextRun && !status?.paused ? `Next check ${new Date(st.nextRun).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : 'Checked on a schedule - good for busy folders.',
    manual: 'Nothing moves until you click Organize now. Perfect while you set up and test rules.',
    off: 'This folder is ignored.',
  }[mode];
  const hours = f.intervalMinutes % 60 === 0;
  const setEvery = (n, unit) => { f.intervalMinutes = Math.round(Number(n) * (unit === 'hours' ? 60 : 1)); markDirty(); renderFolderNav(); };
  let unit = hours ? 'hours' : 'minutes';
  const num = h('input', { type: 'number', min: '1', class: 'num', value: hours ? f.intervalMinutes / 60 : f.intervalMinutes, oninput: (e) => setEvery(e.target.value, unit) });
  return h('div', { class: 'card schedule', 'data-tour': 'schedule' },
    h('div', { class: 'schedule-row' },
      h('div', {}, h('h3', {}, 'When to organize'), h('p', { class: 'muted small' }, hint)),
      h('div', { class: 'inline' },
        sel([['instant', 'Instantly, as items arrive'], ['interval', 'On a schedule'], ['manual', 'Only when I click "Organize now"'], ['off', 'Off']], mode, (v) => {
          f.enabled = v !== 'off';
          if (v !== 'off') f.trigger = v;
          markDirty(); renderFolderDetail(); renderFolderNav();
        }),
        mode === 'interval' ? [h('span', { class: 'muted' }, 'every'), num,
          sel([['minutes', 'minutes'], ['hours', 'hours']], unit, (v) => { unit = v; setEvery(num.value, unit); })] : null)));
}

function renderFolderNav() {
  if (!form) return;
  const cur = curFolder();
  $('#folderNav').replaceChildren(...form.folders.map((f) => {
    const st = status?.folders.find((s) => s.id === f.id);
    const bad = st && (!st.exists || st.error);
    return h('button', { class: 'fnav' + (f.id === cur?.id ? ' active' : '') + (f.enabled ? '' : ' off'), title: f.path, onclick: () => selectFolder(f.id) },
      h('span', { class: 'swatch', style: `background:${bad ? 'var(--bad)' : colorFor(baseName(f.path))}` }),
      h('span', { class: 'fnav-name' }, baseName(f.path)),
      h('span', { class: 'muted small' }, whenLabel(f)));
  }));
}

function renderFolderDetail() {
  const f = curFolder();
  const box = $('#folderDetail');
  if (!f) {
    box.replaceChildren(h('div', { class: 'card empty-rules' }, h('h3', {}, 'No folders yet'),
      h('p', { class: 'muted' }, 'Add a folder to start organizing it.'),
      h('button', { class: 'btn primary', onclick: pickAndAdd }, '+ Add folder')));
    return;
  }
  selectedId = f.id;
  const remove = () => {
    if (!confirm(`Stop organizing ${baseName(f.path)}?\n\nIts rules are removed. Files already organized stay where they are.`)) return;
    form.folders = form.folders.filter((x) => x.id !== f.id);
    selectedId = null;
    renderFolders();
    markDirty();
    save();
  };

  box.replaceChildren(
    h('div', { class: 'fhead card' },
      h('div', { style: 'min-width:0' }, h('h1', {}, baseName(f.path)), h('p', { class: 'path' }, f.path)),
      h('div', { class: 'actions' },
        h('button', { class: 'btn', onclick: async () => { if (!(await window.api.openPath(f.path))) toast('Folder not found.', true); } }, 'Open'),
        h('button', { class: 'btn danger-text', onclick: remove }, 'Remove'),
        h('button', { class: 'btn primary', title: 'Preview, then run this folder\'s rules once', onclick: () => openRunDialog(), 'data-tour': 'organize' }, 'Organize now...'))),
    scheduleCard(f),

    h('div', { class: 'section-head' },
      h('div', {}, h('h2', {}, 'Rules'), h('p', { class: 'muted small' }, 'Checked top to bottom for every new item.')),
      h('button', { class: 'btn primary', 'data-tour': 'newrule', onclick: () => openRuleEditor(-1) }, '+ New rule')),
    h('div', { id: 'ruleList', class: 'rule-list' }),

    h('div', { class: 'section-head' },
      h('div', {}, h('h2', {}, 'Sort by file type'), h('p', { class: 'muted small' }, 'For items no rule moved, recycled or kept. Unknown types go to Other, loose folders to Folders.')),
      h('label', { class: 'switch', 'data-tour': 'sortbytype' }, h('input', { type: 'checkbox', checked: f.sortByType, onchange: (e) => { f.sortByType = e.target.checked; renderFolderDetail(); markDirty(); } }), h('span'))),
    f.sortByType ? h('div', { class: 'cat-editor' }, ...catRows(f),
      h('button', { class: 'link', onclick: () => { f.categories.push({ name: '', exts: [] }); renderFolderDetail(); markDirty(); const n = document.querySelectorAll('.cat-name'); n[n.length - 1]?.focus(); } }, '+ Add file type group')) : null,

    h('div', { class: 'section-head' }, h('div', {}, h('h2', {}, 'Folder options'))),
    h('div', { class: 'card settings' },
      h('div', { class: 'setting stack' },
        h('div', {}, h('h3', {}, 'Ignore these extensions'), h('p', { class: 'muted' }, 'Unfinished downloads and temp files - left alone until they become real files.')),
        chipInput(f.ignore, 'Add extension...', (v) => { f.ignore = v; markDirty(); })),
      h('div', { class: 'setting stack' },
        h('div', {}, h('h3', {}, 'Never move these subfolders'), h('p', { class: 'muted' }, 'Folders inside this one that should stay put.')),
        chipInput(f.protected, 'Add folder name...', (v) => { f.protected = v; markDirty(); }, { split: /[,;]+/, normalize: (s) => s.trim(), keys: ['Enter', ',', ';'] }))));
  renderRules();
}

function catRows(f) {
  return f.categories.map((c, i) => {
    const swatch = h('span', { class: 'swatch', style: `background:${colorFor(c.name)}` });
    const del = iconBtn('trash', `Delete ${c.name || 'group'}`, () => { f.categories.splice(i, 1); renderFolderDetail(); markDirty(); }, 'danger');
    return h('div', { class: 'cat-row' }, swatch,
      h('input', { class: 'cat-name', value: c.name, placeholder: 'Folder name', spellcheck: 'false', 'aria-label': 'Folder name',
        oninput: (e) => { c.name = e.target.value; swatch.style.background = colorFor(c.name); markDirty(); } }),
      chipInput(c.exts, c.exts.length ? 'Add extension...' : 'Type extensions, e.g. epub mobi', (v) => { c.exts = v; markDirty(); }),
      del);
  });
}
