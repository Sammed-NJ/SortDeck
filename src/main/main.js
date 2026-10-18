// Electron main process: window, tray, start-with-Windows, and the organizer engine.
const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, shell, dialog, nativeTheme } = require('electron');
const fs = require('fs');
const path = require('path');
const { loadConfig, saveConfig, toForm, buildConfig, validateRule, validateFolder, newFolder, samePath } = require('./config');
const { Organizer } = require('./engine');

const APP_NAME = 'SortDeck';
app.setName(APP_NAME);
// Windows groups taskbar buttons and caches their icon by this id; it must match the installer's
// shortcut (build.appId). Dev runs (plain electron.exe) get their own id so they can't poison that cache.
app.setAppUserModelId(app.isPackaged ? 'com.sortdeck.app' : 'com.sortdeck.app.dev');
const DATA = app.getPath('userData');
const CONFIG = path.join(DATA, 'config.json');
const ACTIVITY = path.join(DATA, 'activity.json');
const ICON = path.join(__dirname, '..', '..', 'build', 'icon.png');
const ICON_ICO = path.join(__dirname, '..', '..', 'build', 'icon.ico'); // multi-size: crisp taskbar/tray at any scale
const startHidden = process.argv.includes('--hidden');

let win = null;
let tray = null;
let quitting = false;
let cfg = loadConfig(CONFIG).cfg;
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
    webPreferences: { preload: path.join(__dirname, '..', 'preload.js'), contextIsolation: true, sandbox: true },
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
  const { error } = loadConfig(CONFIG);
  return { form: toForm(cfg), error };
});

ipcMain.handle('config:save', (_e, form) => {
  const { errors, cfg: next } = buildConfig(form);
  if (errors.length) return { ok: false, errors };
  next.settings.trayHintShown = cfg.settings.trayHintShown; // set by main, not the form
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
    })),
    activity: activity.slice(0, 100),
    today: activity.filter((a) => a.time >= today && a.ok).length,
  };
});

ipcMain.handle('organizer:pause', (_e, paused) => { setPaused(!!paused); return true; });
ipcMain.handle('organizer:sweep', async () => {
  const reports = await Promise.all(cfg.folders.filter((f) => f.enabled).map((f) => organizer.sweep(f.id)));
  return reports.flat().length;
});

ipcMain.handle('rules:validate', (_e, rule) => validateRule(rule));

ipcMain.handle('rules:run', async (_e, folderForm, rules, target, preview) => {
  const f = validateFolder({ ...folderForm, rules }, 'Folder');
  if (f.errors.length) return { ok: false, errors: f.errors };
  if (!f.folder.rules.length) return { ok: false, errors: ['Pick at least one rule.'] };
  try {
    return { ok: true, report: await organizer.run(f.folder, f.folder.rules, { preview: !!preview, target: target ? String(target) : undefined }) };
  } catch (e) {
    return { ok: false, errors: [e.message] };
  }
});

ipcMain.handle('folders:suggest', () => ['downloads', 'desktop', 'documents', 'pictures']
  .map((k) => ({ key: k, path: app.getPath(k) }))
  .filter((s) => fs.existsSync(s.path)));

ipcMain.handle('folders:new', (_e, p, sortByType) =>
  toForm({ settings: cfg.settings, folders: [newFolder(String(p), { sortByType: !!sortByType })] }).folders[0]);

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

ipcMain.handle('app:info', () => ({ version: app.getVersion(), configPath: CONFIG }));

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
