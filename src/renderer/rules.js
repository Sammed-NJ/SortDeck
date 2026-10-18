// Rules page: Outlook-style rule list, rule editor dialog, "Run rules now" dialog.
// Rules belong to the selected folder (curFolder() in folders.js). Uses globals from app.js.

const FIELDS = [['name', 'File name'], ['ext', 'Extension'], ['size', 'Size'], ['age', 'Age (last modified)'], ['source', 'Downloaded from (website)'], ['type', 'Item type']];
const OPS = {
  name: [['contains', 'contains'], ['starts', 'starts with'], ['ends', 'ends with'], ['equals', 'is exactly'], ['wildcard', 'matches wildcard (*, ?)'], ['regex', 'matches regex']],
  ext: [['in', 'is one of'], ['notin', 'is not one of']],
  size: [['gt', 'is larger than'], ['lt', 'is smaller than']],
  age: [['older', 'is older than'], ['newer', 'is newer than']],
  source: [['contains', 'contains'], ['notcontains', 'does not contain']],
  type: [['is', 'is']],
};
const PLACEHOLDER = { name: 'e.g. invoice', ext: 'e.g. pdf, docx', source: 'e.g. github.com' };
const ACTION_TYPES = [['move', 'Move to folder'], ['copy', 'Copy to folder'], ['recycle', 'Send to Recycle Bin'], ['keep', 'Leave it where it is'], ['notify', 'Show a notification']];
const ICONS = {
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',
};

function iconBtn(icon, label, onclick, cls = '') {
  const b = h('button', { type: 'button', class: `icon-btn ${cls}`, title: label, 'aria-label': label, onclick });
  b.innerHTML = ICONS[icon]; // constant markup, no user data
  return b;
}
function sel(options, value, onchange, cls = '') {
  const s = h('select', { class: cls, onchange: (e) => onchange(e.target.value) }, ...options.map(([v, l]) => h('option', { value: v }, l)));
  s.value = value;
  return s;
}
function folderInput(value, onchange, placeholder = 'Folder inside Downloads, or a full path') {
  const input = h('input', { type: 'text', class: 'v', list: 'folderOptions', value: value ?? '', placeholder, spellcheck: 'false', oninput: (e) => onchange(e.target.value) });
  const browse = h('button', { type: 'button', class: 'btn small', onclick: async () => {
    const p = await window.api.pickFolder(curFolder()?.path);
    if (p != null) { input.value = p; onchange(p); }
  } }, 'Browse...');
  return h('div', { class: 'folder-input' }, input, browse);
}

function defaultCond(field = 'name') {
  return { field, op: OPS[field][0][0], value: { size: 10, age: 30, type: 'file' }[field] ?? '', ...(field === 'age' ? { unit: 'days' } : {}) };
}
const newRule = () => ({ name: '', enabled: true, auto: true, match: 'all', conditions: [defaultCond()], exceptions: [], actions: [{ type: 'move', dest: '' }], stop: true });

// ---------- plain-language summary ----------
function condText(c) {
  const label = Object.fromEntries(OPS[c.field] ?? [])[c.op] ?? c.op;
  switch (c.field) {
    case 'name': return `name ${label} "${c.value}"`;
    case 'ext': return `extension ${c.op === 'notin' ? 'is not' : 'is'} ${c.value || '...'}`;
    case 'size': return `size ${c.op === 'gt' ? 'over' : 'under'} ${c.value} MB`;
    case 'age': return `${c.op === 'older' ? 'older' : 'newer'} than ${c.value} ${c.unit || 'days'}`;
    case 'source': return `downloaded from ${c.op === 'notcontains' ? 'anywhere but ' : ''}"${c.value}"`;
    case 'type': return `is a ${c.value}`;
    default: return '?';
  }
}
function actionText(a) {
  return { move: `move to ${a.dest || '...'}`, copy: `copy to ${a.dest || '...'}`, recycle: 'send to Recycle Bin', keep: 'leave it where it is', notify: 'show a notification' }[a.type] ?? '?';
}
function summary(r) {
  const p = h('p', { class: 'rule-sum' });
  const join = (items, word) => items.forEach((t, i) => { if (i) p.append(` ${word} `); p.append(h('b', {}, t)); });
  if (r.conditions.length) { p.append('When '); join(r.conditions.map(condText), r.match === 'any' ? 'or' : 'and'); } else p.append('For every item');
  p.append('  →  ');
  join(r.actions.map(actionText), 'and');
  if (r.exceptions.length) { p.append(', except if '); join(r.exceptions.map(condText), 'or'); }
  return p;
}

// ---------- rule list ----------
function renderRules() {
  const list = $('#ruleList');
  const folder = curFolder();
  if (!list || !folder) return;
  const rules = folder.rules;
  if (!rules.length) {
    list.replaceChildren(h('div', { class: 'card empty-rules' },
      h('h3', {}, 'No rules yet'),
      h('p', { class: 'muted' }, 'Rules file things by name, extension, size, age or the website they came from - for example: move invoices to Finance, or send installers older than 30 days to the Recycle Bin.'),
      h('button', { class: 'btn primary', onclick: () => openRuleEditor(-1) }, '+ Create your first rule')));
    return;
  }
  const move = (i, d) => { [rules[i], rules[i + d]] = [rules[i + d], rules[i]]; renderRules(); markDirty(); };
  list.replaceChildren(...rules.map((r, i) => h('div', { class: 'rule' + (r.enabled ? '' : ' off') },
    h('div', { class: 'rule-order' },
      h('span', { class: 'rule-num' }, i + 1),
      i > 0 ? iconBtn('up', 'Move up', () => move(i, -1), 'tiny') : null,
      i < rules.length - 1 ? iconBtn('down', 'Move down', () => move(i, 1), 'tiny') : null),
    h('div', { class: 'rule-main', title: 'Edit rule', onclick: () => openRuleEditor(i) },
      h('div', { class: 'rule-title' },
        h('span', { class: 'rule-name' }, r.name || 'Untitled rule'),
        folder.trigger === 'manual' ? null : h('span', { class: 'tag' + (r.auto ? ' auto' : '') }, r.auto ? 'Automatic' : 'Manual only'),
        r.stop ? h('span', { class: 'tag' }, 'Stops other rules') : null,
        r.enabled ? null : h('span', { class: 'tag' }, 'Off')),
      summary(r)),
    h('div', { class: 'rule-actions' },
      h('button', { class: 'btn small', onclick: () => openRunDialog([i]) }, 'Run'),
      h('label', { class: 'switch', title: r.enabled ? 'Turn rule off' : 'Turn rule on' },
        h('input', { type: 'checkbox', checked: r.enabled, onchange: (e) => { r.enabled = e.target.checked; renderRules(); markDirty(); } }), h('span')),
      iconBtn('trash', 'Delete rule', () => { rules.splice(i, 1); renderRules(); markDirty(); toast('Rule deleted - Revert to undo.'); }, 'danger')),
  )));
}

// ---------- results (preview / run) ----------
function shortPath(p) {
  const base = (curFolder()?.path ?? '').replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();
  p = p && p.replace(/\//g, '\\');
  return p && base && p.toLowerCase().startsWith(base + '\\') ? p.slice(base.length + 1) : p;
}
function resultList(res, preview) {
  if (!res.ok) return h('div', { class: 'dlg-errors' }, res.errors.join('  ·  '));
  const rows = res.report;
  if (!rows.length) return h('p', { class: 'muted result-head' }, preview ? 'Nothing matches right now.' : 'Nothing matched - no changes made.');
  const failed = rows.filter((r) => !r.ok).length;
  const label = (r) => ({ move: `→ ${shortPath(r.dest)}`, copy: `copy → ${shortPath(r.dest)}`, recycle: 'Recycle Bin', keep: 'kept in place', notify: 'notification' }[r.action] ?? r.action);
  return h('div', { class: 'results' },
    h('p', { class: 'result-head' }, preview
      ? `${plural(rows.length, 'action')} would run:`
      : `${plural(rows.length - failed, 'action')} done${failed ? `, ${failed} failed (file in use?)` : ''}.`),
    h('div', { class: 'result-rows' }, ...rows.slice(0, 300).map((r) => h('div', { class: 'result' + (r.ok ? '' : ' bad') },
      h('span', { class: 'fname', title: r.item }, r.item),
      h('span', { class: 'muted rname' }, r.rule),
      h('span', { class: 'ract' }, label(r))))));
}

// ---------- rule editor ----------
let draft = null;
let draftIndex = -1;

function condRows(list) {
  return list.map((c, i) => {
    const parts = [sel(FIELDS, c.field, (v) => { list[i] = defaultCond(v); renderEditor(); }, 'f')];
    if (c.field === 'type') {
      parts.push(sel([['file', 'a file'], ['folder', 'a folder']], c.value, (v) => { c.value = v; }, 'o'));
    } else {
      parts.push(sel(OPS[c.field], c.op, (v) => { c.op = v; }, 'o'));
      if (c.field === 'size' || c.field === 'age') {
        parts.push(h('input', { type: 'number', min: '0', step: 'any', class: 'v num', value: c.value, oninput: (e) => { c.value = e.target.value; } }));
        parts.push(c.field === 'size' ? h('span', { class: 'muted unit' }, 'MB')
          : sel([['minutes', 'minutes'], ['hours', 'hours'], ['days', 'days']], c.unit || 'days', (v) => { c.unit = v; }, 'u'));
      } else {
        parts.push(h('input', { type: 'text', class: 'v', value: c.value ?? '', placeholder: PLACEHOLDER[c.field], spellcheck: 'false', oninput: (e) => { c.value = e.target.value; } }));
      }
    }
    parts.push(iconBtn('x', 'Remove', () => { list.splice(i, 1); renderEditor(); }));
    return h('div', { class: 'row' }, ...parts);
  });
}

function actionRows() {
  return draft.actions.map((a, i) => {
    const parts = [sel(ACTION_TYPES, a.type, (v) => {
      draft.actions[i] = v === 'move' || v === 'copy' ? { type: v, dest: a.dest ?? '' } : v === 'notify' ? { type: v, message: '' } : { type: v };
      renderEditor();
    }, 'f')];
    if (a.type === 'move' || a.type === 'copy') parts.push(folderInput(a.dest, (v) => { a.dest = v; }));
    if (a.type === 'notify') parts.push(h('input', { type: 'text', class: 'v', placeholder: `Message (default: "Matched rule: ${draft.name || 'name'}")`, value: a.message ?? '', oninput: (e) => { a.message = e.target.value; } }));
    if (a.type === 'recycle') parts.push(h('span', { class: 'muted inline-hint' }, 'Can be restored from the Recycle Bin.'));
    if (a.type === 'keep') parts.push(h('span', { class: 'muted inline-hint' }, 'Stays put; default sorting is skipped.'));
    parts.push(iconBtn('x', 'Remove', () => { draft.actions.splice(i, 1); renderEditor(); }));
    return h('div', { class: 'row' }, ...parts);
  });
}

const optSwitch = (label, key) => h('label', { class: 'opt' },
  h('span', { class: 'switch' }, h('input', { type: 'checkbox', checked: draft[key], onchange: (e) => { draft[key] = e.target.checked; } }), h('span')), label);

function renderEditor(extra) {
  const preview = h('div', { class: 'dlg-preview' }, extra ?? null);
  const errors = h('div', { class: 'dlg-errors' });
  const save = async () => {
    const v = await window.api.validateRule(draft);
    if (v.errors.length) { errors.textContent = v.errors.join('  ·  '); return; }
    const rules = curFolder().rules;
    if (draftIndex >= 0) rules[draftIndex] = v.rule; else rules.push(v.rule);
    $('#ruleDialog').close();
    renderRules();
    markDirty();
  };
  const runPreview = async (btn) => {
    btn.disabled = true; btn.textContent = 'Checking...';
    const res = await window.api.runRules(curFolder(), [draft], null, true);
    renderEditor(resultList(res, true));
  };

  $('#ruleDialog').replaceChildren(h('form', { class: 'dlg', onsubmit: (e) => { e.preventDefault(); save(); } },
    h('header', {}, h('h1', {}, draftIndex >= 0 ? 'Edit rule' : 'New rule'), iconBtn('x', 'Close', () => $('#ruleDialog').close())),
    h('div', { class: 'dlg-body' },
      h('label', { class: 'field' }, h('span', {}, 'Rule name'),
        h('input', { type: 'text', class: 'rule-name-input', value: draft.name, placeholder: 'e.g. Invoices to Finance', oninput: (e) => { draft.name = e.target.value; } })),
      h('p', { class: 'muted hint' }, `Applies to items arriving in ${curFolder().path}. Folders below are relative to it - or pick any full path.`),
      h('section', {},
        h('div', { class: 'sec-head' }, h('h3', {}, 'When'),
          h('span', { class: 'muted' }, 'Match'), sel([['all', 'all'], ['any', 'any']], draft.match, (v) => { draft.match = v; }, 'mini'),
          h('span', { class: 'muted' }, 'of these conditions')),
        ...condRows(draft.conditions),
        draft.conditions.length ? null : h('p', { class: 'muted hint' }, 'No conditions - the rule applies to every item.'),
        h('button', { type: 'button', class: 'link', onclick: () => { draft.conditions.push(defaultCond()); renderEditor(); } }, '+ Add condition')),
      h('section', {},
        h('h3', {}, 'Do this'),
        ...actionRows(),
        h('button', { type: 'button', class: 'link', onclick: () => { draft.actions.push({ type: 'copy', dest: '' }); renderEditor(); } }, '+ Add action')),
      h('section', {},
        h('h3', {}, 'Except if any of these are true'),
        ...condRows(draft.exceptions),
        h('button', { type: 'button', class: 'link', onclick: () => { draft.exceptions.push(defaultCond('size')); renderEditor(); } }, '+ Add exception')),
      h('section', { class: 'opts' },
        curFolder().trigger === 'manual' ? null : optSwitch('Include in automatic runs', 'auto'),
        optSwitch('Stop processing more rules', 'stop'),
        optSwitch('Rule is on', 'enabled')),
      preview),
    h('footer', {},
      errors,
      h('button', { type: 'button', class: 'btn', onclick: (e) => runPreview(e.currentTarget) }, 'Preview matches'),
      h('button', { type: 'button', class: 'btn', onclick: () => $('#ruleDialog').close() }, 'Cancel'),
      h('button', { type: 'submit', class: 'btn primary' }, draftIndex >= 0 ? 'Update rule' : 'Add rule'))));
}

function openRuleEditor(i) {
  draftIndex = i;
  draft = structuredClone(i >= 0 ? curFolder().rules[i] : newRule());
  fillFolderOptions();
  renderEditor();
  $('#ruleDialog').showModal();
  if (i < 0) $('#ruleDialog .rule-name-input').focus();
}

// ---------- organize now (all of a folder's rules) / run one rule ----------
function openRunDialog(only) {
  const folder = curFolder();
  if (!folder) return;
  if (!folder.rules.length && !folder.sortByType) { toast('Add a rule or turn on sort by file type first.'); return; }
  const picks = folder.rules.map((r, i) => (only ? only.includes(i) : r.enabled));
  fillFolderOptions();
  // a single rule's Run button runs just that rule; "Organize now" also sorts the rest by type
  const state = { own: true, scope: '', sortRest: !only && folder.sortByType, result: null };
  const d = $('#runDialog');

  const go = async (preview, btn) => {
    const rules = folder.rules.filter((_, i) => picks[i]);
    btn.disabled = true; btn.textContent = preview ? 'Checking...' : 'Organizing...';
    state.result = resultList(await window.api.runRules(folder, rules, state.own ? null : state.scope, preview, state.own && state.sortRest), preview);
    draw();
    if (!preview) { lastSig = ''; refresh(); }
  };

  function draw() {
    d.replaceChildren(h('div', { class: 'dlg' },
      h('header', {}, h('h1', {}, only ? 'Run rule' : `Organize ${baseName(folder.path)} now`), iconBtn('x', 'Close', () => d.close())),
      h('div', { class: 'dlg-body' },
        h('p', { class: 'muted' }, 'Runs once, right now - including manual-only and turned-off rules you tick. Use Preview first to see exactly what will happen. Unsaved edits are used as they are.'),
        folder.rules.length ? h('section', {}, h('h3', {}, 'Rules'),
          ...folder.rules.map((r, i) => h('label', { class: 'check' },
            h('input', { type: 'checkbox', checked: picks[i], onchange: (e) => { picks[i] = e.target.checked; } }),
            h('span', {}, r.name || 'Untitled rule'),
            h('span', { class: 'muted small' }, r.enabled ? '' : 'off')))) : null,
        h('section', {}, h('h3', {}, 'Run on'),
          sel([['own', `${baseName(folder.path)} (this folder)`], ['pick', 'A subfolder or another folder...']], state.own ? 'own' : 'pick', (v) => { state.own = v === 'own'; draw(); }),
          state.own ? null : folderInput(state.scope, (v) => { state.scope = v; }, 'e.g. Installers, or a full path')),
        folder.sortByType && state.own ? h('label', { class: 'check' },
          h('input', { type: 'checkbox', checked: state.sortRest, onchange: (e) => { state.sortRest = e.target.checked; } }),
          h('span', {}, 'Then sort the rest by file type'),
          h('span', { class: 'muted small' }, 'items no rule moved, recycled or kept')) : null,
        state.result ? h('div', { class: 'dlg-preview' }, state.result) : null),
      h('footer', {},
        h('span', { class: 'grow' }),
        h('button', { type: 'button', class: 'btn', onclick: (e) => go(true, e.currentTarget) }, 'Preview'),
        h('button', { type: 'button', class: 'btn', onclick: () => d.close() }, 'Close'),
        h('button', { type: 'button', class: 'btn primary', onclick: (e) => go(false, e.currentTarget) }, only ? 'Run now' : 'Organize now'))));
  }
  draw();
  d.showModal();
}

// folder suggestions for destination inputs: this folder's type groups + folders other rules use
function fillFolderOptions() {
  const f = curFolder();
  const names = new Set([...f.categories.map((c) => c.name).filter(Boolean), 'Other', 'Folders']);
  for (const r of f.rules) for (const a of r.actions) if (a.dest) names.add(a.dest);
  $('#folderOptions').replaceChildren(...[...names].sort((a, b) => a.localeCompare(b)).map((n) => h('option', { value: n })));
}
