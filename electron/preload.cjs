const { contextBridge, ipcRenderer } = require('electron');
const invokeActions = new Set([
  'appearance:music:select','appearance:wallpaper:select','appearance:wallpaper-video:select','back','bookmark:add','bookmark:remove','bookmark:toggle',
  'connection:check','connection:select','data:clear','devtools','download:action','download:directory:clear',
  'download:directory:open','download:directory:select','extension:install','extension:install-cypher','extension:install-webstore','extension:remove',
  'extension:toggle','find','forward','history:clear','history:remove','home:focus','home:image:select','home:note',
  'home:tasks','media:background:set','media:control','media:select','media:window:close','media:window:show-tab','media:window:toggle','mod:apply','mod:export','mod:import','mod:remove','navigate','page:translate','print','profile:photo:select','profile:sync:configure','profile:sync:run','profile:sync:disconnect',
  'reload','save','settings','site-data:clear','site-permission:clear','site-permission:remove','state','stop','system:default-browser','password:list','password:save','password:delete','password:fill','password:generate','clipboard:write',
  'workspace:list','workspace:create','workspace:rename','workspace:delete','workspace:switch','research:add','research:update','research:remove','tabs:organize','tabs:suggest-groups','profile:list','profile:create','profile:switch',
  'system:dns-settings','system:proxy','system:restart','tab:close','tab:move','tab:mute','tab:new','tab:pin',
  'tab:restore','tab:select','update:ack','update:check','update:dismiss','update:install','viewport','vpn:proton:account',
  'vpn:proton:open','vpn:proton:status','vpn:proton:verify','window:close','window:fullscreen','window:maximize','window:minimize','zoom',
]);
contextBridge.exposeInMainWorld('cypher', {
  invoke: (action, payload) => invokeActions.has(action) ? ipcRenderer.invoke('cypher:command', action, payload) : Promise.reject(new Error('Ação indisponível para a interface do Cypher.')),
  onState: callback => { const listener = (_event, state) => callback(state); ipcRenderer.on('cypher:state', listener); return () => ipcRenderer.removeListener('cypher:state', listener); },
  onShortcut: callback => { const listener = (_event, action) => callback(action); ipcRenderer.on('cypher:shortcut', listener); return () => ipcRenderer.removeListener('cypher:shortcut', listener); },
});
