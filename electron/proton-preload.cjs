const { contextBridge, ipcRenderer } = require('electron');

if (location.protocol === 'chrome-extension:' && location.hostname === 'jplgfhpmjnbigmhklmmbgecoobifkmpa') {
contextBridge.exposeInMainWorld('cypherProtonVpn', Object.freeze({
  get: () => ipcRenderer.invoke('cypher-proton:proxy:get'),
  set: value => ipcRenderer.invoke('cypher-proton:proxy:set', value),
  clear: () => ipcRenderer.invoke('cypher-proton:proxy:clear'),
  openUrl: url => ipcRenderer.invoke('cypher-proton:open-url', url),
}));
}
