const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('cypher', {
  invoke: (action, payload) => ipcRenderer.invoke('cypher:command', action, payload),
  onState: callback => { const listener = (_event, state) => callback(state); ipcRenderer.on('cypher:state', listener); return () => ipcRenderer.removeListener('cypher:state', listener); },
  onShortcut: callback => { const listener = (_event, action) => callback(action); ipcRenderer.on('cypher:shortcut', listener); return () => ipcRenderer.removeListener('cypher:shortcut', listener); },
});
