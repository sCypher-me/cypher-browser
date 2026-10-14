const { contextBridge, ipcRenderer } = require('electron');
const invokeActions = new Set([
  'appearance:music:select','appearance:wallpaper:select','back','bookmark:add','bookmark:remove','bookmark:toggle',
  'connection:check','connection:select','data:clear','devtools','download:action','download:directory:clear',
  'download:directory:open','download:directory:select','extension:install','extension:install-webstore','extension:remove',
  'extension:toggle','find','forward','history:clear','history:remove','home:focus','home:image:select','home:note',
  'home:tasks','mod:apply','mod:export','mod:import','mod:remove','navigate','page:translate','print','profile:photo:select',
  'reload','save','settings','site-permission:clear','site-permission:remove','state','stop','system:default-browser',
  'system:dns-settings','system:proxy','system:restart','tab:close','tab:move','tab:mute','tab:new','tab:pin',
  'tab:restore','tab:select','update:ack','update:check','update:dismiss','update:install','viewport','vpn:connect',
  'vpn:disconnect','vpn:list','vpn:settings','window:close','window:fullscreen','window:maximize','window:minimize','zoom',
]);
contextBridge.exposeInMainWorld('cypher', {
  invoke: (action, payload) => invokeActions.has(action) ? ipcRenderer.invoke('cypher:command', action, payload) : Promise.reject(new Error('Ação indisponível para a interface do Cypher.')),
  onState: callback => { const listener = (_event, state) => callback(state); ipcRenderer.on('cypher:state', listener); return () => ipcRenderer.removeListener('cypher:state', listener); },
  onShortcut: callback => { const listener = (_event, action) => callback(action); ipcRenderer.on('cypher:shortcut', listener); return () => ipcRenderer.removeListener('cypher:shortcut', listener); },
});
