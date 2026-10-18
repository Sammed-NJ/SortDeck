// The only bridge between the page and the main process.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (form) => ipcRenderer.invoke('config:save', form),
  openConfigFile: () => ipcRenderer.invoke('config:openFile'),
  status: () => ipcRenderer.invoke('status'),
  previewTheme: (theme) => ipcRenderer.invoke('theme:preview', theme),
  pause: (paused) => ipcRenderer.invoke('organizer:pause', paused),
  sweep: () => ipcRenderer.invoke('organizer:sweep'),
  validateRule: (rule) => ipcRenderer.invoke('rules:validate', rule),
  runRules: (folder, rules, target, preview, sortByType) => ipcRenderer.invoke('rules:run', folder, rules, target, preview, sortByType),
  suggestFolders: () => ipcRenderer.invoke('folders:suggest'),
  newFolder: (p, opts) => ipcRenderer.invoke('folders:new', p, opts),
  pickFolder: (base) => ipcRenderer.invoke('pick:folder', base),
  openPath: (p) => ipcRenderer.invoke('open:path', p),
  info: () => ipcRenderer.invoke('app:info'),
  checkProblems: () => ipcRenderer.invoke('doctor:check'),
  repairProblems: () => ipcRenderer.invoke('doctor:repair'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  openReleases: () => ipcRenderer.invoke('update:page'),
  uninstall: (withData) => ipcRenderer.invoke('app:uninstall', !!withData),
  onActivity: (fn) => ipcRenderer.on('activity', () => fn()),
});
