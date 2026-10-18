// Guided tour: highlights each part of the app and explains it. Starts by itself on first launch
// (Skip / Maybe later), and any time from the ? button in the title bar. Uses globals from app.js and folders.js.

const hasFolders = () => form.folders.length > 0;

const TOUR = [
  { intro: true, view: 'overview', title: 'Welcome to SortDeck', text: 'SortDeck keeps your folders tidy. Tell it what to look for and what to do, and it files everything as it arrives. Take a one-minute tour?' },
  { view: 'overview', target: '.nav[data-view=overview]', title: 'Overview', text: 'Your home screen: whether SortDeck is running, how much it organized today, and the latest activity.' },
  { view: 'overview', target: '#suggestions', title: 'Pick a folder', text: 'Start here. Choose Downloads, Desktop or any other folder you want kept tidy.' },
  { view: 'overview', target: '#btnSweep', title: 'Organize now', text: 'Runs every automatic folder right away instead of waiting.' },
  { view: 'overview', target: '#btnPause', title: 'Pause', text: 'Stops automatic organizing for a while. Manual runs still work.' },
  { view: 'folders', target: '.nav[data-view=folders]', title: 'Folders & rules', text: 'Every folder you add lives here, each with its own rules and schedule.' },
  { view: 'folders', target: '#btnAddFolder', title: 'Add a folder', text: 'Pick any folder or drive. Choose "Set up rules first" and nothing moves until you say so.' },
  { view: 'folders', target: '[data-tour=schedule]', title: 'When to organize', text: 'Instantly as files arrive, on a schedule, only when you click, or off.' },
  { view: 'folders', target: '[data-tour=newrule]', title: 'Build a rule', text: 'When something matches - name, type, size, age, or the website it came from - move it, copy it, recycle it, keep it or get notified. Add "except if" for the exceptions.' },
  { view: 'folders', target: '[data-tour=sortbytype]', title: 'Sort by file type', text: 'Anything no rule handled can go into Images, Documents, Installers and more.' },
  { view: 'folders', target: '[data-tour=organize]', title: 'Preview, then run', text: 'See exactly what will move before anything happens, then run it once.' },
  { view: 'settings', target: '.nav[data-view=settings]', title: 'Settings', text: 'Theme and accent color, start with Windows, notifications, quiet hours, updates, troubleshooting and uninstall.' },
  { target: '#btnFeedback', title: 'Send feedback', text: 'SortDeck is in beta. Tell me what to improve - this opens my contact form.' },
  { target: '#btnTour', title: 'Replay the tour', text: 'Click this any time to see the tour again.' },
  { outro: true, view: 'overview', title: "You're all set", text: 'Want a head start? SortDeck can add your Downloads folder with one rule per file type. Nothing moves until you preview and run it.' },
];

let tourAt = -1;
let tourList = [];   // steps worked out when the tour starts or moves
const visible = (el) => !!el && el.getClientRects().length > 0;
const tourEl = (id) => document.getElementById(id);

function tourSteps() {
  // only steps whose target exists right now (e.g. folder steps need a folder); each page is shown to check
  return TOUR.filter((s) => {
    if (!s.target) return true;
    if (s.view) show(s.view);
    return visible(document.querySelector(s.target));
  });
}
// the page a step belongs to; steps without one (sidebar, title bar) keep the previous step's page
function tourView(i) {
  for (let k = i; k >= 0; k--) if (tourList[k].view) return tourList[k].view;
  return 'overview';
}

function startTour() {
  for (const d of document.querySelectorAll('dialog[open]')) d.close();
  if (hasFolders() && !selectedId) selectFolder(form.folders[0].id);
  if (!tourEl('tourBlock')) {
    document.body.append(
      h('div', { id: 'tourBlock', class: 'tour-block' }),   // eats clicks: the app is locked while touring
      h('div', { id: 'tourSpot', class: 'tour-spot' }),
      h('div', { id: 'tourCard', class: 'tour-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'tourTitle' }));
    window.addEventListener('resize', placeTour);
    document.addEventListener('keydown', tourKeys, true);
  }
  tourAt = 0;
  tourList = tourSteps();
  drawTour();
}

function endTour(state) {
  for (const id of ['tourBlock', 'tourSpot', 'tourCard']) tourEl(id)?.remove();
  window.removeEventListener('resize', placeTour);
  document.removeEventListener('keydown', tourKeys, true);
  tourAt = -1;
  show('overview');
  // saved by main straight away; keep the Settings form clean
  const saved = JSON.parse(savedJson);
  saved.settings.tour = form.settings.tour = state;
  savedJson = JSON.stringify(saved);
  markDirty();
  window.api.setTour(state);
}

function tourKeys(e) {
  if (tourAt < 0) return;
  e.stopPropagation();
  if (e.key === 'Escape') { e.preventDefault(); endTour('later'); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); goTour(1); }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); goTour(-1); }
}

function goTour(d) {
  tourList = tourSteps();
  tourAt = Math.min(tourList.length - 1, Math.max(0, tourAt + d));
  drawTour();
}

function drawTour() {
  const steps = tourList;
  const s = steps[tourAt];
  show(tourView(tourAt));
  const first = s.intro;
  const last = s.outro;
  const btn = (label, cls, onclick) => h('button', { type: 'button', class: `btn ${cls}`, onclick }, label);
  const count = steps.length - 2;   // intro and outro aren't counted

  tourEl('tourCard').replaceChildren(
    h('h2', { id: 'tourTitle' }, s.title),
    h('p', {}, s.text),
    h('div', { class: 'tour-foot' },
      first || last ? null : h('span', { class: 'tour-count' }, `${tourAt} of ${count}`),
      h('span', { class: 'grow' }),
      first ? [btn('Skip', '', () => endTour('done')), btn('Maybe later', '', () => endTour('later')), btn('Start tour', 'primary', () => goTour(1))]
        : last ? [btn('Finish', '', () => endTour('done')),
          btn('Add starter rules', 'primary', async () => { endTour('done'); await createStarterRules(); })]
          : [h('button', { type: 'button', class: 'link tour-skip', onclick: () => endTour('done') }, 'Skip tour'),
            btn('Back', '', () => goTour(-1)), btn(tourAt === count ? 'Done' : 'Next', 'primary', () => goTour(1))]));
  tourEl('tourCard').querySelector('.btn.primary')?.focus();
  placeTour();
}

function placeTour() {
  if (tourAt < 0) return;
  const s = tourList[tourAt];
  const spot = tourEl('tourSpot');
  const card = tourEl('tourCard');
  const el = s.target && document.querySelector(s.target);
  tourEl('tourBlock').classList.toggle('dim', !el);   // intro/outro: plain dim, no spotlight
  if (!el) {
    spot.hidden = true;
    Object.assign(card.style, { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' });
    return;
  }
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect();
  const pad = 6;
  spot.hidden = false;
  Object.assign(spot.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });

  // beside the target if there's room (sidebar, buttons), otherwise below or above
  card.style.transform = 'none';
  const cw = card.offsetWidth, ch = card.offsetHeight, gap = 16, vw = innerWidth, vh = innerHeight;
  let left, top;
  if (r.right + gap + cw < vw && r.height < 120) { left = r.right + gap; top = r.top + r.height / 2 - ch / 2; }
  else if (r.bottom + gap + ch < vh) { left = r.left; top = r.bottom + gap; }
  else { left = r.left; top = r.top - gap - ch; }
  card.style.left = `${Math.max(12, Math.min(left, vw - cw - 12))}px`;
  card.style.top = `${Math.max(52, Math.min(top, vh - ch - 12))}px`;
}

// ---------- starter rules for Downloads ----------
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

$('#btnTour').addEventListener('click', startTour);

// first launch (or "Maybe later" last time): start once the config has loaded
document.addEventListener('DOMContentLoaded', () => {
  const wait = () => (form ? (form.settings.tour !== 'done' && setTimeout(startTour, 400)) : setTimeout(wait, 100));
  wait();
});
