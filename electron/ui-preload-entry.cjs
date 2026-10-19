// Entrada do preload da interface. O preload roda em sandbox e não consegue carregar pacotes,
// então scripts/build-preload.cjs junta este arquivo, o preload.cjs e o elemento
// <browser-action-list> (botões das extensões) num único electron/preload.bundle.cjs.
require('./preload.cjs');
const { injectBrowserAction } = require('electron-chrome-extensions/browser-action');

if (location.protocol === 'cypher-ui:' || location.hostname === 'localhost') injectBrowserAction();
