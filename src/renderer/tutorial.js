// Tutorial: a short walk-through of folders, rules and schedules, ending with starter rules for Downloads.
// Uses globals from app.js and folders.js.

const TUTORIAL = [
  {
    title: 'Welcome to SortDeck',
    body: [
      'SortDeck keeps folders tidy for you. Tell it what to look for and what to do, and it files everything as it arrives.',
      'This takes about a minute. At the end you can create starter rules for your Downloads folder.',
    ],
  },
  {
    title: '1. Add a folder',
    body: [
      'Click "+ Add folder" and pick any folder: Downloads, Desktop, a project folder or a USB drive.',
      'Choose "Set up rules first" and nothing moves until you say so. Each folder has its own rules and settings.',
    ],
  },
  {
    title: '2. Build a rule',
    body: ['Open the folder and click "New rule". A rule has three parts:'],
    list: [
      ['When', 'what to look for - name contains "invoice", extension is pdf, older than 30 days, downloaded from github.com...'],
      ['Do this', 'move or copy to a folder, send to the Recycle Bin, leave it, or notify you.'],
      ['Except if', 'skip items that also match this, for example "size over 500 MB".'],
    ],
    example: 'When extension is pdf  ->  Move to Documents  ->  Except if name contains "draft"',
  },
  {
    title: '3. Order matters',
    body: [
      'Rules are checked top to bottom. The first rule that moves, recycles or keeps an item finishes it - later rules never see it.',
      'Put specific rules (Invoices) above general ones (all PDFs). Use the arrows to reorder.',
    ],
  },
  {
    title: '4. Try it safely',
    body: [
      'Click "Organize now..." then "Preview". You see every file and where it would go - nothing moves.',
      'Happy? Click "Organize now". Anything sent to the Recycle Bin can be restored, and files are never overwritten.',
    ],
  },
  {
    title: '5. Choose when it runs',
    body: ['In "When to organize" pick one:'],
    list: [
      ['Instantly', 'new items are filed a few seconds after they arrive.'],
      ['On a schedule', 'every N minutes or hours.'],
      ['Only when I click', 'nothing happens until you press Organize now.'],
    ],
  },
  {
    title: 'Start with Downloads',
    body: [
      'Create one rule per file type for your Downloads folder - Images, Documents, Installers, Archives, Data, Video, Audio - plus "Everything else to Other".',
      'They are ordinary rules you can edit, reorder or delete. The folder is set to "Only when I click", so nothing moves until you preview and run it.',
      'SortDeck is in beta. Use "Send feedback" in the sidebar any time to tell me what to improve.',
    ],
    starter: true,
  },
];

async function createStarterRules() {
  const dl = (await window.api.suggestFolders()).find((s) => s.key === 'downloads');
  if (!dl) { toast("Couldn't find your Downloads folder.", true); return false; }
  const fresh = await window.api.newFolder(dl.path, { trigger: 'manual', sortByType: false });
  let folder = form.folders.find((f) => f.path.toLowerCase() === dl.path.toLowerCase());
  if (!folder) { folder = fresh; form.folders.push(folder); }

  const rule = (name, conditions, dest) => ({ name, enabled: true, auto: true, match: 'all', conditions, exceptions: [], actions: [{ type: 'move', dest }], stop: true });
  const starters = [
    ...fresh.categories.map((c) => rule(`${c.name} to ${c.name}`, [{ field: 'ext', op: 'in', value: c.exts.join(', ') }], c.name)),
    rule('Everything else to Other', [{ field: 'type', op: 'is', value: 'file' }], 'Other'),
  ];
  const have = new Set(folder.rules.map((r) => r.name.toLowerCase()));
  const added = starters.filter((r) => !have.has(r.name.toLowerCase()));
  folder.rules.push(...added);

  selectedId = folder.id;
  renderFolders();
  markDirty();
  if (!(await save())) return false;
  show('folders');
  toast(added.length ? `Added ${plural(added.length, 'starter rule')} to Downloads. Use Organize now > Preview to try them.` : 'Downloads already has the starter rules.');
  return true;
}

function openTutorial(step = 0) {
  const d = $('#tutorialDialog');
  const s = TUTORIAL[step];
  const last = step === TUTORIAL.length - 1;
  d.replaceChildren(h('div', { class: 'dlg tutorial' },
    h('header', {}, h('h1', {}, s.title), h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', onclick: () => d.close() }, '×')),
    h('div', { class: 'dlg-body' },
      ...s.body.map((p) => h('p', {}, p)),
      s.list && h('ul', { class: 'tut-list' }, ...s.list.map(([b, t]) => h('li', {}, h('b', {}, b), ` - ${t}`))),
      s.example && h('p', { class: 'tut-example' }, s.example)),
    h('footer', {},
      h('span', { class: 'tut-dots', 'aria-label': `Step ${step + 1} of ${TUTORIAL.length}` }, ...TUTORIAL.map((_, i) => h('i', { class: i === step ? 'on' : '' }))),
      h('span', { class: 'grow' }),
      step > 0 && h('button', { type: 'button', class: 'btn', onclick: () => openTutorial(step - 1) }, 'Back'),
      last
        ? [h('button', { type: 'button', class: 'btn', onclick: () => d.close() }, 'Finish'),
          h('button', { type: 'button', class: 'btn primary', onclick: async (e) => { e.target.disabled = true; if (await createStarterRules()) d.close(); else e.target.disabled = false; } }, 'Create starter rules')]
        : h('button', { type: 'button', class: 'btn primary', onclick: () => openTutorial(step + 1) }, step === 0 ? 'Start' : 'Next'))));
  if (!d.open) d.showModal();
}

$('#btnTutorial').addEventListener('click', () => openTutorial());
$('#btnTutorialWelcome').addEventListener('click', () => openTutorial());
