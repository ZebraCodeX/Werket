// Bridge between the Electron main process and the Werket renderer.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('werketDesktop', {
  platform: 'desktop',
  version: process.versions.electron,
  openProject: () => ipcRenderer.invoke('project:open'),
  saveProject: (json) => ipcRenderer.invoke('project:save', json),
  openTextFile: () => ipcRenderer.invoke('file:open'),
  saveTextFile: (defaultName, text) => ipcRenderer.invoke('file:save', { defaultName, text }),
  onMenu: (callback) => {
    const listener = (_event, command, payload) => callback(command, payload);
    ipcRenderer.on('menu', listener);
    return () => ipcRenderer.removeListener('menu', listener);
  },
});
