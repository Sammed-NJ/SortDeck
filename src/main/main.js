// Electron main process: window, tray, start-with-Windows, and the organizer engine.
const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, shell, dialog, nativeTheme } = require('electron');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { loadConfig, saveConfig, toForm, buildConfig, validateRule, validateFolder, newFolder, samePath, THEMES, TOURS } = require('./config');
const { Organizer } = require('./engine');
const doctor = require('./doctor');
const update = require('./update');

const APP_NAME = 'SortDeck';
const APP_ID = 'com.sortdeck.app';
app.setName(APP_NAME);
// Windows groups taskbar buttons and caches their icon by this id; it must match the installer's
// shortcut (build.appId). Dev runs (plain electron.exe) get their own id so they can't poison that cache.
app.setAppUserModelId(app.isPackaged ? APP_ID : `${APP_ID}.dev`);
const DATA = app.getPath('userData');
const CONFIG = path.join(DATA, 'config.json');
const ACTIVITY = path.join(DATA, 'activity.json');
const ICON = path.join(__dirname, '..', '..', 'build', 'icon.png');
const ICON_ICO = path.join(__dirname, '..', '..', 'build', 'icon.ico'); // multi-size: crisp taskbar/tray at any scale
const startHidden = process.argv.includes('--hidden');

let win = null;
let tray = null;
let quitting = false;
const boot = loadConfig(CONFIG);
let cfg = boot.cfg;
let bootNote = null;   // told to the page once
if (boot.error && fs.existsSync(CONFIG)) {   // keep the damaged file for the user, never just overwrite it
  try { fs.copyFileSync(CONFIG, CONFIG.replace(/\.json$/, '.damaged.json')); } catch { /* best effort */ }
}
if (!boot.error && !boot.restored && !fs.existsSync(CONFIG)) {   // first run: write defaults so Troubleshoot sees a file
  try { saveConfig(CONFIG, cfg); } catch { /* troubleshoot will report it */ }
}
if (boot.restored) {
  try { saveConfig(CONFIG, cfg); } catch { /* troubleshoot will report it */ }
  bootNote = 'Your settings file was damaged or missing, so it was restored from the last backup.';
} else if (boot.error) {
  bootNote = `Your settings file was damaged and there was no backup, so settings were reset. The damaged copy is config.damaged.json. (${boot.error})`;
}
let activity = [];
try { activity = JSON.parse(fs.readFileSync(ACTIVITY, 'utf8')); } catch { activity = []; }

const organizer = new Organizer({
  trash: (p) => shell.trashItem(p),
  notify: (title, body) => { if (Notification.isSupported()) new Notification({ title, body, icon: ICON, silent: true }).show(); },
  onActivity: (entries) => {
    activity = [...entries.reverse(), ...activity].slice(0, 500);
    fs.promises.writeFile(ACTIVITY, JSON.stringify(activity)).catch(() => {});
    win?.webContents.send('activity');
  },
});

function applyConfig(next) {
  cfg = next;
  nativeTheme.themeSource = cfg.settings.theme;   // drives prefers-color-scheme in the page and the titlebar colors
  organizer.setConfig(cfg);
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: cfg.settings.launchAtLogin, args: ['--hidden'] });
  updateTray();
}

// ---------- window + tray ----------
function showWindow() {
  if (!win || win.isDestroyed()) createWindow();
  else { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
}

const overlay = () => (nativeTheme.shouldUseDarkColors
  ? { color: '#141619', symbolColor: '#c9ced6', height: 40 }
  : { color: '#eceef2', symbolColor: '#3b4048', height: 40 });

function createWindow() {
  win = new BrowserWindow({
    width: 1120, height: 740, minWidth: 900, minHeight: 600,
    title: APP_NAME, icon: ICON_ICO, show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#17191c' : '#f5f6f8',
    titleBarStyle: 'hidden', titleBarOverlay: overlay(),
    webPreferences: { preload: path.join(__dirname, '..', 'preload.js'), contextIsolation: true, sandbox: true, devTools: !app.isPackaged },
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.on('will-prevent-unload', (e) => {
    const choice = dialog.showMessageBoxSync(win, {
      type: 'question', buttons: ['Discard changes', 'Keep editing'], defaultId: 1, cancelId: 1,
      title: APP_NAME, message: 'You have unsaved changes.', detail: 'Close without saving them?',
    });
    if (choice === 0) e.preventDefault();
  });
  // closing the window keeps organizing in the tray; Quit from the tray menu really exits
  win.on('close', (e) => {
    if (quitting) return;
    e.preventDefault();
    win.hide();
    if (!cfg.settings.trayHintShown) {
      cfg.settings.trayHintShown = true;
      saveConfig(CONFIG, cfg);
      organizer.notify(APP_NAME, 'Still organizing in the background. Open or quit it from the tray icon.');
    }
  });
}

function updateTray() {
  if (!tray) return;
  const paused = cfg.settings.paused;
  tray.setToolTip(`${APP_NAME} - ${paused ? 'paused' : `watching ${cfg.folders.filter((f) => f.enabled).length} folder(s)`}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: `Open ${APP_NAME}`, click: showWindow },
    { type: 'separator' },
    { label: 'Organize now', enabled: !paused, click: () => organizer.sweepAll() },
    { label: 'Pause organizing', type: 'checkbox', checked: paused, click: (i) => setPaused(i.checked) },
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit(); } },
  ]));
}

function setPaused(paused) {
  const next = structuredClone(cfg);
  next.settings.paused = paused;
  saveConfig(CONFIG, next);
  applyConfig(next);
  win?.webContents.send('activity');
}

// ---------- IPC (the only things the page can ask for) ----------
const isAllowedPath = (p) => typeof p === 'string' && path.isAbsolute(p) && cfg.folders.some((f) => {
  const rel = path.relative(f.path, p);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}) || cfg.folders.some((f) => f.rules.some((r) => r.actions.some((a) => a.dest && path.isAbsolute(a.dest) && samePath(a.dest, p))));

ipcMain.handle('config:get', () => {
  const note = bootNote;
  bootNote = null;
  return { form: toForm(cfg), note };
});

ipcMain.handle('config:save', (_e, form) => {
  const { errors, cfg: next } = buildConfig(form);
  if (errors.length) return { ok: false, errors };
  next.settings.trayHintShown = cfg.settings.trayHintShown; // set by main, not the form
  next.settings.tour = cfg.settings.tour;
  try { saveConfig(CONFIG, next); } catch (e) { return { ok: false, errors: [`Could not save: ${e.message}`] }; }
  applyConfig(next);
  return { ok: true, errors: [] };
});

ipcMain.handle('status', () => {
  const today = new Date().setHours(0, 0, 0, 0);
  return {
    paused: cfg.settings.paused,
    folders: cfg.folders.map((f) => ({
      id: f.id,
      exists: fs.existsSync(f.path),
      error: organizer.status.get(f.id)?.error ?? null,
      today: activity.filter((a) => a.time >= today && a.ok && samePath(a.folder, f.path)).length,
      nextRun: organizer.nextRun.get(f.id) ?? null,
    })),
    activity: activity.slice(0, 100),
    today: activity.filter((a) => a.time >= today && a.ok).length,
  };
});

// guided tour progress, saved straight away (not part of the Settings form)
ipcMain.handle('tour:set', (_e, state) => {
  if (!TOURS.includes(state)) return false;
  cfg.settings.tour = state;
  try { saveConfig(CONFIG, cfg); } catch { return false; }
  return true;
});

// live preview while choosing in Settings; Save keeps it, Revert re-applies the saved theme
ipcMain.handle('theme:preview', (_e, theme) => { if (THEMES.includes(theme)) nativeTheme.themeSource = theme; return nativeTheme.shouldUseDarkColors; });

ipcMain.handle('organizer:pause', (_e, paused) => { setPaused(!!paused); return true; });
ipcMain.handle('organizer:sweep', async () => (await organizer.sweepAll()).flat().length);

ipcMain.handle('rules:validate', (_e, rule) => validateRule(rule));

ipcMain.handle('rules:run', async (_e, folderForm, rules, target, preview, sortByType) => {
  const f = validateFolder({ ...folderForm, rules }, 'Folder');
  if (f.errors.length) return { ok: false, errors: f.errors };
  if (!f.folder.rules.length && !sortByType) return { ok: false, errors: ['Pick at least one rule, or sort by file type.'] };
  try {
    return { ok: true, report: await organizer.run(f.folder, f.folder.rules, { preview: !!preview, target: target ? String(target) : undefined, fallback: !!sortByType }) };
  } catch (e) {
    return { ok: false, errors: [e.message] };
  }
});

ipcMain.handle('folders:suggest', () => ['downloads', 'desktop', 'documents', 'pictures']
  .map((k) => ({ key: k, path: app.getPath(k) }))
  .filter((s) => fs.existsSync(s.path)));

ipcMain.handle('folders:new', (_e, p, opts) => {
  const trigger = ['instant', 'interval', 'manual'].includes(opts?.trigger) ? opts.trigger : 'manual';
  return toForm({ settings: cfg.settings, folders: [newFolder(String(p), { sortByType: !!opts?.sortByType, trigger })] }).folders[0];
});

ipcMain.handle('pick:folder', async (e, base) => {
  const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), {
    defaultPath: base || app.getPath('home'), properties: ['openDirectory', 'createDirectory'],
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const p = r.filePaths[0];
  if (base) {   // inside the watched folder -> store it relative, so the rule survives the folder moving
    const rel = path.relative(base, p);
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) return rel;
  }
  return p;
});

ipcMain.handle('open:path', async (_e, p) => {
  if (!isAllowedPath(p) || !fs.existsSync(p)) return false;
  if (fs.statSync(p).isDirectory()) return !(await shell.openPath(p));
  shell.showItemInFolder(p);
  return true;
});

ipcMain.handle('config:openFile', async () => {
  if (!fs.existsSync(CONFIG)) saveConfig(CONFIG, cfg);
  return !(await shell.openPath(CONFIG));
});

// fixed links only - the page can't open arbitrary URLs
const LINKS = {
  portfolio: 'https://www.sammednj.in/',
  feedback: 'https://www.sammednj.in/#contact',
  website: 'https://www.sammednj.in/sortdeck',
};
ipcMain.handle('open:link', (_e, key) => (Object.hasOwn(LINKS, key) ? shell.openExternal(LINKS[key]).then(() => true) : false));

ipcMain.handle('app:info', () => ({ version: app.getVersion(), configPath: CONFIG, packaged: app.isPackaged }));

// ---------- troubleshoot ----------
const START_MENU_LINK = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', `${APP_NAME}.lnk`);
const loginArgs = { args: ['--hidden'] };
// installed-app checks only: a dev run has no shortcut and no login item
const extraChecks = () => (!app.isPackaged ? [] : [
  {
    id: 'shortcut', label: 'Start menu shortcut (needed for notifications)',
    test: () => {
      if (!fs.existsSync(START_MENU_LINK)) return 'The shortcut is missing';
      return samePath(shell.readShortcutLink(START_MENU_LINK).target, process.execPath) ? null : 'The shortcut points somewhere else';
    },
    fix: () => shell.writeShortcutLink(START_MENU_LINK, fs.existsSync(START_MENU_LINK) ? 'replace' : 'create', {
      target: process.execPath, appUserModelId: APP_ID, icon: process.execPath, iconIndex: 0, description: APP_NAME,
    }),
  },
  {
    id: 'login', label: 'Start with Windows',
    test: () => (app.getLoginItemSettings(loginArgs).openAtLogin === cfg.settings.launchAtLogin ? null : 'Not set up the way Settings says'),
    fix: () => app.setLoginItemSettings({ openAtLogin: cfg.settings.launchAtLogin, ...loginArgs }),
  },
]);
const doctorCtx = () => ({ dataDir: DATA, configFile: CONFIG, activityFile: ACTIVITY, cfg, activity, extra: extraChecks() });

ipcMain.handle('doctor:check', () => doctor.check(doctorCtx()));
ipcMain.handle('doctor:repair', async () => {
  const result = await doctor.repair(doctorCtx());
  applyConfig(cfg);   // restart watchers and timers too
  return result;
});

// ---------- updates (only when the user clicks) ----------
let lastUpdate = null;
ipcMain.handle('update:check', async () => {
  try { lastUpdate = await update.checkForUpdate(app.getVersion()); } catch (e) { lastUpdate = null; return { status: 'error', error: e.message }; }
  return { ...lastUpdate, canInstall: app.isPackaged };
});
ipcMain.handle('update:install', async () => {
  const u = lastUpdate;   // never a URL from the page: only what the last check found on GitHub
  if (u?.status !== 'available' || !update.isTrustedDownload(u.url) || !/^SortDeck-Setup-[\w.-]+\.exe$/i.test(u.name)) return { ok: false, error: 'Check for updates first.' };
  if (!app.isPackaged) { shell.openExternal(u.page); return { ok: false, error: 'Running from source - opened the release page instead.' }; }
  try {
    const res = await fetch(u.url);
    if (!res.ok) throw new Error(`download failed (${res.status})`);
    const file = path.join(app.getPath('temp'), u.name);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    // the installer updates in place, keeps settings and reopens SortDeck
    spawn(file, [], { detached: true, stdio: 'ignore' }).unref();
    quitting = true;
    setTimeout(() => app.quit(), 300);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Couldn't download the update: ${e.message}` };
  }
});
ipcMain.handle('update:page', () => shell.openExternal(lastUpdate?.page?.startsWith(update.RELEASES) ? lastUpdate.page : update.RELEASES));

// ---------- uninstall (installed app only; confirmation lives here, not in the page) ----------
ipcMain.handle('app:uninstall', async (e, withData) => {
  const uninstaller = path.join(path.dirname(process.execPath), `Uninstall ${APP_NAME}.exe`);
  if (!app.isPackaged || !fs.existsSync(uninstaller)) {
    return { ok: false, error: 'Uninstall works from the installed app. Use Windows Settings > Apps instead.' };
  }
  const r = await dialog.showMessageBox(BrowserWindow.fromWebContents(e.sender), {
    type: 'warning', title: APP_NAME, noLink: true, defaultId: 1, cancelId: 1,
    message: withData ? `You're about to uninstall ${APP_NAME} and delete all its data.` : `You're about to uninstall ${APP_NAME}.`,
    detail: (withData
      ? 'Your watched folders, rules, settings and activity history will be deleted for good. This cannot be undone.'
      : 'Your folders, rules and settings are kept, so reinstalling picks up where you left off.')
      + '\n\nYour files are not touched - everything stays where SortDeck put it.',
    buttons: [withData ? 'Uninstall and delete data' : 'Uninstall', 'Cancel'],
    checkboxLabel: withData ? 'I understand my SortDeck data will be deleted' : undefined,
  });
  if (r.response !== 0) return { ok: false, cancelled: true };
  if (withData && !r.checkboxChecked) return { ok: false, error: 'Nothing was uninstalled - tick the box to confirm deleting your data.' };
  // the uninstaller closes us if we're still running; --delete-app-data removes %APPDATA%\SortDeck
  spawn(uninstaller, withData ? ['--delete-app-data'] : [], { detached: true, stdio: 'ignore' }).unref();
  quitting = true;
  setTimeout(() => app.quit(), 200);
  return { ok: true };
});

// ---------- startup ----------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.whenReady().then(() => {
    tray = new Tray(ICON_ICO);
    tray.on('click', showWindow);
    nativeTheme.on('updated', () => { if (win && !win.isDestroyed()) win.setTitleBarOverlay(overlay()); });
    applyConfig(cfg);
    if (!startHidden) createWindow();
  });
  app.on('window-all-closed', (e) => e.preventDefault?.()); // stay alive in the tray
  app.on('before-quit', () => { quitting = true; organizer.stop(); });
}
