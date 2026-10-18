const INTERNAL = new Set(['newtab', 'settings', 'security', 'profile', 'extensions', 'bookmarks', 'history', 'downloads', 'mods', 'productivity']);
const { defaultHome, sanitizeHome } = require('./home-layout.mjs');
const defaults = {
  skin: 'recorte', tabPosition: 'side', sidebarWidth: 210, appearanceMode: 'dark', accent: '#ff5436', surface: '#151310',
  background: '#0a0908', radius: 14, font: 'system', wallpaper: 'none', wallpaperImageData: '', wallpaperVideoPath: '', wallpaperVideoName: '',
  buttonShape: 'soft', interfaceEffect: 'signal', soundEffectsEnabled: false, soundTheme: 'cypher',
  backgroundMusicData: '', backgroundMusicName: '', backgroundMusicEnabled: false,
  motion: true, compact: false, interfaceTextScale: 1.2, searchEngine: 'duckduckgo', customSearchUrl: '', activeMod: 'recorte-noite',
  connectionMode: 'normal', torSocksPort: 9050, i2pHttpPort: 4444, profilePhoto: '',
  restoreSession: false, startupMode: 'home', startupPages: [], showHomeFirst: false,
  openLinksInNewTab: true, showSearchSuggestions: true, sendDoNotTrack: false,
  blockAds: true, blockTrackers: true, blockThirdPartyCookies: false,
  blockPopups: true, popupExceptions: [],
  passwordAutofillEnabled: false, trackingExceptions: [],
  preferredLanguages: ['pt-BR','en-US'], spellCheckEnabled: true, spellCheckLanguages: ['pt-BR'], translationEnabled: true,
  hardwareAcceleration: true, webrtcPolicy: 'default',
  showBookmarksBar: false, suggestBookmarks: true, suggestHistory: true,
  clearDataOnExit: false, clearHistoryOnExit: false, confirmCloseWithMultipleTabs: false,
  memorySaverEnabled: true, memorySaverMinutes: 20,
  defaultZoom: 1, downloadDirectory: '', startWithWindows: false,
  home: defaultHome,
  tokens: { cut: 12, density: 1, barHeight: 52, borderWidth: 1, displayFont: 'big-shoulders', bodyFont: 'work-sans' },
  toolbarOrder: ['navigation','address','routes','skin','media','customize','menu'], toolbarHidden: [], toolbarPosition: 'top',
  tabsAutoHide: false, showRail: true, workspaceAccent: false, customCss: '', skinPackage: '',
  shortcuts: {}, routeRules: [], containers: [], blockCookieBanners: true, webPanels: [], panelWidth: 380,
  modSoundsEnabled: true, modSoundsVolume: 0.6, modMusicEnabled: true, modMusicVolume: 0.5, modPageEffects: true,
  sendErrorReports: false, updateChannel: 'stable',
};
const toolbarItems = ['navigation','address','routes','skin','media','customize','menu'];
const hideableToolbarItems = ['navigation','routes','skin','media','customize'];
const fontChoices = { display: ['big-shoulders','work-sans','system','serif','mono'], body: ['work-sans','system','serif','mono'] };
const shortcutActions = {
  'tab:new': 'CmdOrCtrl+T', 'tab:private': 'CmdOrCtrl+Shift+N', 'tab:close': 'CmdOrCtrl+W', 'tab:restore': 'CmdOrCtrl+Shift+T',
  'tab:next': 'Ctrl+Tab', 'tab:previous': 'Ctrl+Shift+Tab', palette: 'CmdOrCtrl+Shift+A', inspector: 'CmdOrCtrl+E', address: 'CmdOrCtrl+L',
  find: 'CmdOrCtrl+F', bookmark: 'CmdOrCtrl+D', history: 'CmdOrCtrl+H', downloads: 'CmdOrCtrl+J', reload: 'CmdOrCtrl+R',
  reader: 'CmdOrCtrl+Shift+R', capture: 'CmdOrCtrl+Shift+S', split: 'CmdOrCtrl+Shift+D', print: 'CmdOrCtrl+P', save: 'CmdOrCtrl+S',
  fullscreen: 'F11', 'zoom:in': 'CmdOrCtrl+=', 'zoom:out': 'CmdOrCtrl+-', 'zoom:reset': 'CmdOrCtrl+0', devtools: 'F12',
};
const bangs = {
  g: 'https://www.google.com/search?q=', ddg: 'https://duckduckgo.com/?q=', b: 'https://www.bing.com/search?q=',
  yt: 'https://www.youtube.com/results?search_query=', gh: 'https://github.com/search?q=', w: 'https://pt.wikipedia.org/w/index.php?search=',
  wen: 'https://en.wikipedia.org/w/index.php?search=', so: 'https://stackoverflow.com/search?q=', mdn: 'https://developer.mozilla.org/search?q=',
  npm: 'https://www.npmjs.com/search?q=', maps: 'https://www.google.com/maps/search/', img: 'https://duckduckgo.com/?ia=images&iax=images&q=',
  tr: 'https://translate.google.com/?sl=auto&tl=pt&text=', r: 'https://www.reddit.com/search/?q=', ml: 'https://lista.mercadolivre.com.br/',
};
function sanitizeCss(value) {
  if (typeof value !== 'string') return '';
  return value.slice(0, 100000)
    .replace(/<\/?style/gi, '')
    .replace(/@import[^;]*;?/gi, '')
    .replace(/url\(\s*(['"]?)(?!data:(?:image\/(?:png|jpeg|webp|gif|svg\+xml)|font\/woff2?)[;,])[^)]*\)/gi, 'none')
    .replace(/expression\s*\(|-moz-binding|behavior\s*:/gi, '');
}
function sanitizeTokens(input, base = defaults.tokens) {
  const output = { ...base };
  if (!input || typeof input !== 'object') return output;
  if (Number.isFinite(input.cut)) output.cut = Math.round(Math.max(0, Math.min(28, input.cut)));
  if (Number.isFinite(input.density)) output.density = Math.round(Math.max(0.85, Math.min(1.25, input.density)) * 100) / 100;
  if (Number.isFinite(input.barHeight)) output.barHeight = Math.round(Math.max(40, Math.min(72, input.barHeight)));
  if (Number.isFinite(input.borderWidth)) output.borderWidth = Math.round(Math.max(0, Math.min(3, input.borderWidth)));
  if (fontChoices.display.includes(input.displayFont)) output.displayFont = input.displayFont;
  if (fontChoices.body.includes(input.bodyFont)) output.bodyFont = input.bodyFont;
  return output;
}
function sanitizeHostList(list, limit) {
  return [...new Set((Array.isArray(list) ? list : []).filter(value => typeof value === 'string' && value.length <= 253 && /^[a-z\d.-]+$/i.test(value)).map(value => value.toLowerCase()))].slice(0, limit);
}
function validAccelerator(value) {
  return typeof value === 'string' && value.length <= 40 && /^(?:(?:CmdOrCtrl|Ctrl|Alt|Shift|Super)\+)*(?:[A-Z0-9]|F(?:[1-9]|1[0-2])|Tab|Space|Enter|Backspace|Delete|Up|Down|Left|Right|Home|End|PageUp|PageDown|=|-|,|\.|\/|;)$/.test(value);
}
const engines = { duckduckgo: 'https://duckduckgo.com/?q=', google: 'https://www.google.com/search?q=', bing: 'https://www.bing.com/search?q=' };
function resolveAddress(value, engine = 'duckduckgo', customSearchUrl = '') {
  const input = String(value || '').trim();
  if (!input) return 'cypher://newtab';
  if (/^cypher:\/\//i.test(input)) {
    const page = input.slice(9).split(/[/?#]/)[0];
    if (!INTERNAL.has(page)) throw new Error('Página do Cypher não encontrada.');
    return `cypher://${page}`;
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(input) && !/^(?:localhost|(?:[\w-]+\.)+[\w-]+):\d+(?:\/|$)/.test(input)) {
    const url = new URL(input);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Este endereço não é permitido. Use HTTP ou HTTPS.');
    return url.href;
  }
  if (!/\s/.test(input) && /^(localhost|(?:[\w-]+\.)+[\w-]+)(:\d+)?([/?#].*)?$/.test(input)) {
    const host = input.split(/[/:?#]/, 1)[0].toLowerCase();
    const localNetwork = host.endsWith('.onion') || host.endsWith('.i2p');
    return new URL(`${/^localhost(?::|\/|$)/.test(input) || localNetwork ? 'http' : 'https'}://${input}`).href;
  }
  const bang = /^!([a-z]{1,6})\s+(.+)$/i.exec(input);
  if (bang && Object.hasOwn(bangs, bang[1].toLowerCase())) return bangs[bang[1].toLowerCase()] + encodeURIComponent(bang[2].trim());
  if (engine === 'custom' && typeof customSearchUrl === 'string' && customSearchUrl.includes('{query}')) {
    try {
      const template = customSearchUrl.replace('{query}', 'cypher-query');
      if (new URL(template).protocol === 'https:') return customSearchUrl.replace('{query}', encodeURIComponent(input));
    } catch {}
  }
  return (engines[engine] || engines.duckduckgo) + encodeURIComponent(input);
}
function sanitizeSettings(input = {}, base = defaults) {
  if (!input || typeof input !== 'object') input = {};
  const output = { ...base };
  for (const key of ['accent', 'surface', 'background']) if (/^#[\da-f]{6}$/i.test(input[key])) output[key] = input[key];
  for (const [key, values] of Object.entries({ updateChannel: ['stable','preview'], skin: ['recorte','classic'], tabPosition: ['side','top'], appearanceMode: ['dark','light','system'], toolbarPosition: ['top','bottom'], font: ['system','mono'], wallpaper: ['orbital','grid','none','custom','video'], buttonShape: ['soft','square','pill'], interfaceEffect: ['signal','glow','scanline','none'], soundTheme: ['cypher','soft','arcade'], searchEngine: [...Object.keys(engines),'custom'], connectionMode: ['normal','tor','i2p'], startupMode: ['home','restore','specific'], webrtcPolicy: ['default','default_public_and_private_interfaces','default_public_interface_only','disable_non_proxied_udp'] })) {
    if (values.includes(input[key])) output[key] = input[key];
  }
  for (const key of ['sendErrorReports','modSoundsEnabled','modMusicEnabled','modPageEffects','tabsAutoHide','showRail','workspaceAccent','blockCookieBanners','motion','compact','restoreSession','showHomeFirst','openLinksInNewTab','showSearchSuggestions','sendDoNotTrack','blockAds','blockTrackers','blockThirdPartyCookies','blockPopups','passwordAutofillEnabled','spellCheckEnabled','translationEnabled','hardwareAcceleration','showBookmarksBar','suggestBookmarks','suggestHistory','clearDataOnExit','clearHistoryOnExit','confirmCloseWithMultipleTabs','startWithWindows','soundEffectsEnabled','backgroundMusicEnabled','memorySaverEnabled']) if (typeof input[key] === 'boolean') output[key] = input[key];
  if (Number.isFinite(input.memorySaverMinutes)) output.memorySaverMinutes = Math.max(5, Math.min(120, Math.round(input.memorySaverMinutes)));
  if (Array.isArray(input.trackingExceptions)) output.trackingExceptions = [...new Set(input.trackingExceptions.filter(value => typeof value === 'string' && value.length <= 253 && /^[a-z\d.-]+$/i.test(value)).map(value => value.toLowerCase()))].slice(0,500);
  if (Array.isArray(input.popupExceptions)) output.popupExceptions = [...new Set(input.popupExceptions.filter(value => typeof value === 'string' && value.length <= 253 && /^[a-z\d.-]+$/i.test(value)).map(value => value.toLowerCase()))].slice(0,500);
  if (input.startupMode === 'home' || input.startupMode === 'restore' || input.startupMode === 'specific') {
    output.startupMode = input.startupMode;
    output.restoreSession = input.startupMode === 'restore';
  } else if (typeof input.restoreSession === 'boolean') {
    output.startupMode = input.restoreSession ? 'restore' : 'home';
  } else output.restoreSession = output.startupMode === 'restore';
  if (Array.isArray(input.startupPages)) output.startupPages = input.startupPages.slice(0,10).flatMap(value => {
    if (typeof value !== 'string' || value.length > 2048) return [];
    try { const url = new URL(value.trim()); return ['http:','https:'].includes(url.protocol) ? [url.href] : []; } catch { return []; }
  });
  const languageCodes = new Set(['pt-BR','pt','en-US','en','es','fr','de','it','ja','ko','zh-CN']);
  for (const key of ['preferredLanguages','spellCheckLanguages']) if (Array.isArray(input[key])) {
    output[key] = [...new Set(input[key].filter(code => typeof code === 'string' && languageCodes.has(code)))].slice(0,8);
  }
  if (Number.isFinite(input.radius)) output.radius = Math.max(0, Math.min(24, input.radius));
  if (Number.isFinite(input.sidebarWidth)) output.sidebarWidth = Math.max(210, Math.min(360, input.sidebarWidth));
  if (Number.isFinite(input.interfaceTextScale)) output.interfaceTextScale = Math.round(Math.max(1, Math.min(1.4, input.interfaceTextScale)) * 100) / 100;
  if (Number.isFinite(input.defaultZoom)) output.defaultZoom = Math.max(0.75, Math.min(1.5, input.defaultZoom));
  for (const key of ['torSocksPort','i2pHttpPort']) if (Number.isInteger(input[key])) output[key] = Math.max(1,Math.min(65535,input[key]));
  output.downloadDirectory = typeof input.downloadDirectory === 'string' && input.downloadDirectory.length <= 4096 ? input.downloadDirectory : (base.downloadDirectory || '');
  output.customSearchUrl = typeof input.customSearchUrl === 'string' && input.customSearchUrl.length <= 500 ? input.customSearchUrl : (base.customSearchUrl || '');
  output.profilePhoto = typeof input.profilePhoto === 'string' && input.profilePhoto.length <= 2_800_000 && /^data:image\/(?:png|jpeg|webp);base64,[\da-z+/=]+$/i.test(input.profilePhoto) ? input.profilePhoto : (base.profilePhoto || '');
  output.wallpaperImageData = typeof input.wallpaperImageData === 'string' && input.wallpaperImageData.length <= 4_200_000 && /^data:image\/(?:png|jpeg|webp);base64,[\da-z+/=]+$/i.test(input.wallpaperImageData) ? input.wallpaperImageData : (base.wallpaperImageData || '');
  output.wallpaperVideoPath = typeof input.wallpaperVideoPath === 'string' && input.wallpaperVideoPath.length <= 4096 ? input.wallpaperVideoPath : (base.wallpaperVideoPath || '');
  output.wallpaperVideoName = typeof input.wallpaperVideoName === 'string' ? input.wallpaperVideoName.slice(0,160) : (base.wallpaperVideoName || '');
  output.backgroundMusicData = typeof input.backgroundMusicData === 'string' && input.backgroundMusicData.length <= 14_000_000 && /^data:audio\/(?:mpeg|wav|ogg|webm);base64,[\da-z+/=]+$/i.test(input.backgroundMusicData) ? input.backgroundMusicData : (base.backgroundMusicData || '');
  output.backgroundMusicName = typeof input.backgroundMusicName === 'string' ? input.backgroundMusicName.slice(0,120) : (base.backgroundMusicName || '');
  output.home = sanitizeHome(input.home,base.home || defaultHome);
  output.tokens = sanitizeTokens(input.tokens, base.tokens || defaults.tokens);
  if (Array.isArray(input.toolbarOrder)) {
    const order = [...new Set(input.toolbarOrder.filter(item => toolbarItems.includes(item)))];
    output.toolbarOrder = [...order, ...toolbarItems.filter(item => !order.includes(item))];
  } else output.toolbarOrder = Array.isArray(base.toolbarOrder) ? base.toolbarOrder : defaults.toolbarOrder;
  output.toolbarHidden = Array.isArray(input.toolbarHidden) ? [...new Set(input.toolbarHidden.filter(item => hideableToolbarItems.includes(item)))] : (base.toolbarHidden || []);
  output.customCss = typeof input.customCss === 'string' ? sanitizeCss(input.customCss) : (base.customCss || '');
  output.skinPackage = typeof input.skinPackage === 'string' && /^(?:|skin-[a-f\d-]{36})$/.test(input.skinPackage) ? input.skinPackage : (base.skinPackage || '');
  if (input.shortcuts && typeof input.shortcuts === 'object') {
    output.shortcuts = {};
    for (const [action, accelerator] of Object.entries(input.shortcuts)) if (Object.hasOwn(shortcutActions, action) && validAccelerator(accelerator)) output.shortcuts[action] = accelerator;
  } else output.shortcuts = base.shortcuts || {};
  if (Array.isArray(input.routeRules)) output.routeRules = input.routeRules.slice(0, 200).flatMap(rule => rule && ['tor','i2p'].includes(rule.mode) && sanitizeHostList([rule.host], 1).length ? [{ host: String(rule.host).toLowerCase(), mode: rule.mode }] : [])
    .filter((rule, index, list) => list.findIndex(other => other.host === rule.host) === index);
  else output.routeRules = base.routeRules || [];
  if (Array.isArray(input.containers)) output.containers = input.containers.slice(0, 12).flatMap(item => item && typeof item.id === 'string' && /^[a-z\d-]{1,40}$/.test(item.id) && typeof item.name === 'string' && item.name.trim()
    ? [{ id: item.id, name: item.name.trim().slice(0, 32), color: /^#[\da-f]{6}$/i.test(item.color) ? item.color : '#ff5436' }] : []);
  else output.containers = base.containers || [];
  if (Array.isArray(input.webPanels)) output.webPanels = input.webPanels.slice(0, 8).flatMap(item => {
    if (!item || typeof item.id !== 'string' || !/^[a-z\d-]{1,40}$/.test(item.id) || typeof item.url !== 'string' || item.url.length > 2048) return [];
    try { const url = new URL(item.url); return url.protocol === 'https:' ? [{ id: item.id, url: url.href, title: String(item.title || url.hostname).slice(0, 48) }] : []; } catch { return []; }
  });
  else output.webPanels = base.webPanels || [];
  for (const key of ['modSoundsVolume','modMusicVolume']) if (Number.isFinite(input[key])) output[key] = Math.round(Math.max(0, Math.min(1, input[key])) * 100) / 100;
  if (Number.isFinite(input.panelWidth)) output.panelWidth = Math.round(Math.max(280, Math.min(560, input.panelWidth)));
  return output;
}
function validateMod(input) {
  if (!input || input.schemaVersion !== 1 || typeof input.name !== 'string' || !input.name.trim()) throw new Error('O mod precisa de schemaVersion: 1 e um nome.');
  const settings = sanitizeSettings(input.settings);
  settings.profilePhoto = '';
  settings.connectionMode = defaults.connectionMode;
  settings.torSocksPort = defaults.torSocksPort;
  settings.i2pHttpPort = defaults.i2pHttpPort;
  settings.restoreSession = defaults.restoreSession;
  settings.startupMode = defaults.startupMode;
  settings.startupPages = defaults.startupPages;
  settings.showHomeFirst = defaults.showHomeFirst;
  settings.openLinksInNewTab = defaults.openLinksInNewTab;
  settings.showSearchSuggestions = defaults.showSearchSuggestions;
  settings.showBookmarksBar = defaults.showBookmarksBar;
  settings.suggestBookmarks = defaults.suggestBookmarks;
  settings.suggestHistory = defaults.suggestHistory;
  settings.sendDoNotTrack = defaults.sendDoNotTrack;
  settings.blockAds = defaults.blockAds;
  settings.blockTrackers = defaults.blockTrackers;
  settings.blockThirdPartyCookies = defaults.blockThirdPartyCookies;
  settings.blockPopups = defaults.blockPopups;
  settings.popupExceptions = defaults.popupExceptions;
  settings.passwordAutofillEnabled = defaults.passwordAutofillEnabled;
  settings.trackingExceptions = defaults.trackingExceptions;
  settings.preferredLanguages = defaults.preferredLanguages;
  settings.spellCheckEnabled = defaults.spellCheckEnabled;
  settings.spellCheckLanguages = defaults.spellCheckLanguages;
  settings.translationEnabled = defaults.translationEnabled;
  settings.hardwareAcceleration = defaults.hardwareAcceleration;
  settings.webrtcPolicy = defaults.webrtcPolicy;
  settings.clearDataOnExit = defaults.clearDataOnExit;
  settings.clearHistoryOnExit = defaults.clearHistoryOnExit;
  settings.confirmCloseWithMultipleTabs = defaults.confirmCloseWithMultipleTabs;
  settings.defaultZoom = defaults.defaultZoom;
  settings.downloadDirectory = '';
  settings.startWithWindows = defaults.startWithWindows;
  settings.customSearchUrl = '';
  settings.customCss = ''; settings.skinPackage = ''; settings.shortcuts = {}; settings.routeRules = []; settings.containers = []; settings.webPanels = []; settings.blockCookieBanners = defaults.blockCookieBanners;
  return { id: `custom-${require('node:crypto').randomUUID()}`, name: input.name.trim().slice(0,64),
    author: String(input.author || 'Comunidade').slice(0,64), description: String(input.description || 'Seu espaço, suas regras.').slice(0,240),
    settings, custom: true };
}
function validateSkinPackage(input) {
  if (!input || input.schemaVersion !== 1 || input.type !== 'cypher-skin' || typeof input.name !== 'string' || !input.name.trim()) throw new Error('O pacote precisa de schemaVersion: 1, type: "cypher-skin" e um nome.');
  if (typeof input.css !== 'string' || input.css.length > 100000) throw new Error('O CSS da pele está ausente ou excede 100 KB.');
  return { id: `skin-${require('node:crypto').randomUUID()}`, name: input.name.trim().slice(0, 64), author: String(input.author || 'Comunidade').slice(0, 64),
    description: String(input.description || '').slice(0, 240), base: ['recorte','classic'].includes(input.base) ? input.base : 'recorte',
    css: sanitizeCss(input.css), tokens: sanitizeTokens(input.tokens) };
}
module.exports = { defaults, resolveAddress, sanitizeSettings, validateMod, sanitizeCss, validateSkinPackage, shortcutActions, bangs };
