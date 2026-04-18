const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('visualCode', {
  ping: () => ipcRenderer.invoke('debug:ping'),
  pathsHome: () => ipcRenderer.invoke('paths:home'),
  platform: () => ipcRenderer.invoke('os:platform'),
  settingsGet: () => ipcRenderer.invoke('settings:get'),
  settingsSet: (partial) => ipcRenderer.invoke('settings:set', partial),
  pickDirectory: () => ipcRenderer.invoke('dialog:pickDirectory'),
  analyzeContext: (dirPath) => ipcRenderer.invoke('context:analyze', dirPath),
  sendToTerminal: (text) => ipcRenderer.invoke('terminal:send', text),
  writeClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),
});
