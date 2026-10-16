const INTERNAL = new Set(['newtab', 'settings', 'security', 'profile', 'extensions', 'bookmarks', 'history', 'downloads', 'mods']);
const { defaultHome, sanitizeHome } = require('./home-layout.mjs');
const defaults = {
  tabPosition: 'side', sidebarWidth: 248, appearanceMode: 'dark', accent: '#b6f36a', surface: '#111513',
  background: '#090c0b', radius: 14, font: 'system', wallpaper: 'orbital', wallpaperImageData: '',
  buttonShape: 'soft', interfaceEffect: 'signal', soundEffectsEnabled: false, soundTheme: 'cypher',
  backgroundMusicData: '', backgroundMusicName: '', backgroundMusicEnabled: false,
  motion: true, compact: false, searchEngine: 'duckduckgo', customSearchUrl: '', activeMod: 'cypher-original',
  connectionMode: 'normal', torSocksPort: 9050, i2pHttpPort: 4444, profilePhoto: '',
  restoreSession: false, startupMode: 'home', startupPages: [], showHomeFirst: false,
  openLinksInNewTab: true, showSearchSuggestions: true, sendDoNotTrack: false,
  blockAds: false, blockTrackers: true, blockThirdPartyCookies: false,
  preferredLanguages: ['pt-BR','en-US'], spellCheckEnabled: true, spellCheckLanguages: ['pt-BR'], translationEnabled: true,
  hardwareAcceleration: true, webrtcPolicy: 'default',
  showBookmarksBar: false, suggestBookmarks: true, suggestHistory: true,
  clearDataOnExit: false, clearHistoryOnExit: false, confirmCloseWithMultipleTabs: false,
  defaultZoom: 1, downloadDirectory: '', startWithWindows: false,
  home: defaultHome,
};
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
  for (const [key, values] of Object.entries({ tabPosition: ['side','top'], appearanceMode: ['dark','light'], font: ['system','mono'], wallpaper: ['orbital','grid','none','custom'], buttonShape: ['soft','square','pill'], interfaceEffect: ['signal','glow','scanline','none'], soundTheme: ['cypher','soft','arcade'], searchEngine: [...Object.keys(engines),'custom'], connectionMode: ['normal','tor','i2p'], startupMode: ['home','restore','specific'], webrtcPolicy: ['default','default_public_and_private_interfaces','default_public_interface_only','disable_non_proxied_udp'] })) {
    if (values.includes(input[key])) output[key] = input[key];
  }
  for (const key of ['motion','compact','restoreSession','showHomeFirst','openLinksInNewTab','showSearchSuggestions','sendDoNotTrack','blockAds','blockTrackers','blockThirdPartyCookies','spellCheckEnabled','translationEnabled','hardwareAcceleration','showBookmarksBar','suggestBookmarks','suggestHistory','clearDataOnExit','clearHistoryOnExit','confirmCloseWithMultipleTabs','startWithWindows','soundEffectsEnabled','backgroundMusicEnabled']) if (typeof input[key] === 'boolean') output[key] = input[key];
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
  if (Number.isFinite(input.defaultZoom)) output.defaultZoom = Math.max(0.75, Math.min(1.5, input.defaultZoom));
  for (const key of ['torSocksPort','i2pHttpPort']) if (Number.isInteger(input[key])) output[key] = Math.max(1,Math.min(65535,input[key]));
  output.downloadDirectory = typeof input.downloadDirectory === 'string' && input.downloadDirectory.length <= 4096 ? input.downloadDirectory : (base.downloadDirectory || '');
  output.customSearchUrl = typeof input.customSearchUrl === 'string' && input.customSearchUrl.length <= 500 ? input.customSearchUrl : (base.customSearchUrl || '');
  output.profilePhoto = typeof input.profilePhoto === 'string' && input.profilePhoto.length <= 2_800_000 && /^data:image\/(?:png|jpeg|webp);base64,[\da-z+/=]+$/i.test(input.profilePhoto) ? input.profilePhoto : (base.profilePhoto || '');
  output.wallpaperImageData = typeof input.wallpaperImageData === 'string' && input.wallpaperImageData.length <= 4_200_000 && /^data:image\/(?:png|jpeg|webp);base64,[\da-z+/=]+$/i.test(input.wallpaperImageData) ? input.wallpaperImageData : (base.wallpaperImageData || '');
  output.backgroundMusicData = typeof input.backgroundMusicData === 'string' && input.backgroundMusicData.length <= 14_000_000 && /^data:audio\/(?:mpeg|wav|ogg|webm);base64,[\da-z+/=]+$/i.test(input.backgroundMusicData) ? input.backgroundMusicData : (base.backgroundMusicData || '');
  output.backgroundMusicName = typeof input.backgroundMusicName === 'string' ? input.backgroundMusicName.slice(0,120) : (base.backgroundMusicName || '');
  output.home = sanitizeHome(input.home,base.home || defaultHome);
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
  return { id: `custom-${require('node:crypto').randomUUID()}`, name: input.name.trim().slice(0,64),
    author: String(input.author || 'Comunidade').slice(0,64), description: String(input.description || 'Seu espaço, suas regras.').slice(0,240),
    settings, custom: true };
}
module.exports = { defaults, resolveAddress, sanitizeSettings, validateMod };
