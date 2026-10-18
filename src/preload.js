// The only bridge between the page and the main process.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (form) => ipcRenderer.invoke('config:save', form),
  openConfigFile: () => ipcRenderer.invoke('config:openFile'),
  status: () => ipcRenderer.invoke('status'),
  pause: (paused) => ipcRenderer.invoke('organizer:pause', paused),
  sweep: () => ipcRenderer.invoke('organizer:sweep'),
  validateRule: (rule) => ipcRenderer.invoke('rules:validate', rule),
  runRules: (folder, rules, target, preview) => ipcRenderer.invoke('rules:run', folder, rules, target, preview),
  suggestFolders: () => ipcRenderer.invoke('folders:suggest'),
  newFolder: (p, sortByType) => ipcRenderer.invoke('folders:new', p, sortByType),
  pickFolder: (base) => ipcRenderer.invoke('pick:folder', base),
  openPath: (p) => ipcRenderer.invoke('open:path', p),
  info: () => ipcRenderer.invoke('app:info'),
  onActivity: (fn) => ipcRenderer.on('activity', () => fn()),
});
