const { app, BrowserWindow, WebContentsView, ipcMain, session, Menu, dialog, shell, clipboard, ClipboardItem, nativeTheme, protocol, net, safeStorage, screen, nativeImage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID, randomBytes } = require('node:crypto');
const { defaults, resolveAddress, sanitizeSettings, validateMod, validateSkinPackage, shortcutActions } = require('./domain.cjs');
const { createUpdater } = require('./updater.cjs');
const { notesBetween } = require('./changelog.cjs');
const { compareVersions: compareCypherVersions, parseVersion } = require('./versions.cjs');
const { MAX_CRX_BYTES, unpackCrx } = require('./crx.cjs');
const { extractCypherPackage } = require('./cypher-package.cjs');
const modPackage = require('./mod-package.cjs');
const { createPrivacyServices } = require('./privacy-services.cjs');
const { createErrorReporter } = require('./error-reports.cjs');
const { normalizePasswordOrigin, passwordsFromCsv, sha1Hex, pwnedCountForHash } = require('./password-tools.cjs');
const browserImport = require('./importers.cjs');
const { classifyLoadError, errorName, createHttpsUpgrader } = require('./https-mode.cjs');
const { execFile } = require('node:child_process');
const { FiltersEngine, Request } = require('@ghostery/adblocker');

const privacyServices = createPrivacyServices({ app });

app.setName('Cypher');
// Prevent speculative hostname lookups from bypassing anonymous proxies.
app.commandLine.appendSwitch('dns-prefetch-disable');
nativeTheme.themeSource = 'dark';
function applyNativeTheme() { nativeTheme.themeSource = store?.settings.appearanceMode === 'system' ? 'system' : 'dark'; }
protocol.registerSchemesAsPrivileged([{ scheme: 'cypher-ui', privileges: { standard: true, secure: true } }, { scheme: 'cypher-wallpaper', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }, { scheme: 'cypher-mod', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
let win, playerWindow, rendererUrl = '', store, storePath, activeId, activeProfileId = 'default', profileRegistry = [{ id:'default', name:'Pessoal' }], profileSwitching = false, nowPlayingTabId = null, saveTimer, profileSyncTimer, profileSyncInterval, profileSyncReady = false, profileSyncBusy = false, updater, closing = false, closePromptOpen = false, allowWindowClose = false, quitting = false, exitCleanupStarted = false, privacyShutdownStarted = false, privacyShutdownComplete = false;
let hardwareAccelerationAtLaunch = true, mediaTimer = null;
const protonExtensionId = 'jplgfhpmjnbigmhklmmbgecoobifkmpa';
let protonExtensionReady = false, protonPopupWindow = null, protonProxyValue = null;
let trackerEngine = null;
let adEngine = null;
let trackerList = { available: false, adsAvailable: false, name: 'EasyList + EasyPrivacy', source: 'https://easylist.to/', lastModified: '', networkRuleCount: 0, adRuleCount: 0, blockedRequests: 0, blockedAds: 0, blockedTrackers: 0, bySite:{} };
let trackerCountTimer = null;
let errorReporter = null;
process.on('uncaughtException', error => { console.error('Erro não tratado no processo principal:', error); errorReporter?.record('main', error); });
process.on('unhandledRejection', reason => { console.error('Promessa rejeitada sem tratamento:', reason); errorReporter?.record('promise', reason); });
function updateConfig() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'update-config.json'), 'utf8')) || {}; } catch { return {}; }
}
// O instalador grava a escolha de relatórios de erro no registro; ela é importada uma única vez.
function importInstallerConsent() {
  // Só o app instalado conversa com o registro do instalador; execuções de desenvolvimento e testes não.
  if (process.platform !== 'win32' || !app.isPackaged || store.errorReportConsentImported) return;
  store.errorReportConsentImported = true; persist();
  execFile('reg', ['query', 'HKCU\\Software\\Cypher', '/v', 'SendErrorReports'], { windowsHide: true, timeout: 4000 }, (error, stdout) => {
    if (error || !/SendErrorReports\s+REG_DWORD\s+0x1\b/i.test(String(stdout))) return;
    store.settings = sanitizeSettings({ sendErrorReports: true }, store.settings); persist(); emit();
  });
}
function syncInstallerConsent(enabled) {
  if (process.platform !== 'win32' || !app.isPackaged) return;
  execFile('reg', ['add', 'HKCU\\Software\\Cypher', '/v', 'SendErrorReports', '/t', 'REG_DWORD', '/d', enabled ? '1' : '0', '/f'], { windowsHide: true, timeout: 4000 }, () => {});
}
try {
  const userDataPath = app.getPath('userData');
  let startupProfileId = 'default';
  try {
    const registry = JSON.parse(fs.readFileSync(path.join(userDataPath, 'cypher-profiles.json'), 'utf8'));
    if (/^[a-f\d-]{36}$/i.test(registry.activeProfileId) && Array.isArray(registry.profiles) && registry.profiles.some(item => item?.id === registry.activeProfileId)) startupProfileId = registry.activeProfileId;
  } catch {}
  activeProfileId = startupProfileId;
  const bootstrapPath = startupProfileId === 'default' ? path.join(userDataPath, 'cypher.json') : path.join(userDataPath, 'profiles', startupProfileId, 'cypher.json');
  const bootstrap = JSON.parse(fs.readFileSync(bootstrapPath, 'utf8'));
  if (bootstrap.settings?.hardwareAcceleration === false) { app.disableHardwareAcceleration(); hardwareAccelerationAtLaunch = false; }
} catch {}
const pendingExternalUrls = process.argv.filter(value => /^https?:\/\//i.test(value)).slice(0,10);
const isCypherPackageFile = value => {
  if (typeof value !== 'string' || !value.toLowerCase().endsWith('.cypherext')) return false;
  try { return fs.statSync(value).isFile(); } catch { return false; }
};
const pendingCypherPackages = process.argv.slice(1).filter(isCypherPackageFile).slice(0,10);
const hasInstanceLock = app.requestSingleInstanceLock();
if (!hasInstanceLock) app.quit();
else app.on('second-instance', (_event, commandLine) => {
  const urls = commandLine.filter(value => /^https?:\/\//i.test(value)).slice(0,10);
  const packages = commandLine.filter(isCypherPackageFile).slice(0,10);
  if (win && !win.isDestroyed()) {
    win.show(); win.focus();
    for (const url of urls) { try { addTab(url, false, 'normal'); } catch {} }
    for (const packageFile of packages) void installExternalCypherPackage(packageFile);
  } else { pendingExternalUrls.push(...urls); pendingCypherPackages.push(...packages); }
});
app.on('open-file', (event, packageFile) => {
  if (!isCypherPackageFile(packageFile)) return;
  event.preventDefault();
  if (win && !win.isDestroyed() && store) { win.show(); win.focus(); void installExternalCypherPackage(packageFile); }
  else pendingCypherPackages.push(packageFile);
});
let viewport = { x: 248, y: 106, width: 900, height: 650 }, obscured = false;
let split = null, openPanelId = '', panelBounds = null, statsTimer = null;
const panelViews = new Map();
const httpsUpgrader = createHttpsUpgrader();
const certificateExceptions = new Set();
const tabs = [], closedTabs = [], popupRequests = [], downloadItems = new Map(), reservedDownloadPaths = new Set(), configuredSessions = new Set(), privateSessions = new Set();
let blockedPopupCount = 0;
const proxyReady = new WeakMap();
const sitePermissionTypes = new Set(['media','geolocation','notifications','fullscreen','clipboard-sanitized-write','clipboard-read']);
// Como no Chrome: botões "Copiar" dos sites escrevem sem perguntar (o Chromium já exige o clique do usuário).
const autoGrantedPermissions = new Set(['clipboard-sanitized-write']);
let privatePartition = `cypher-private-${randomUUID()}`;
const builtInMods = [
  { id: 'recorte-noite', name: 'Recorte Noite', author: 'Cypher', description: 'Silhuetas cortadas, tipografia condensada e um laranja que corta a noite.', settings: { ...defaults } },
  { id: 'cypher-original', name: 'Cypher Original', author: 'Cypher', description: 'Grafite profundo. Verde elétrico. O visual clássico.', settings: { ...defaults, skin: 'classic', sidebarWidth: 248, accent: '#b6f36a', surface: '#111513', background: '#090c0b', wallpaper: 'orbital' } },
  { id: 'ultraviolet', name: 'Ultraviolet', author: 'Cypher', description: 'Uma frequência diferente. Roxo, sombras e órbitas.', settings: { ...defaults, accent: '#b5a0ff', surface: '#15121d', background: '#0b0910', wallpaper: 'orbital' } },
  { id: 'ember', name: 'Ember', author: 'Cypher', description: 'Tons de carvão e um brilho que não se apaga.', settings: { ...defaults, accent: '#ff9b6a', surface: '#1b1412', background: '#100b09', wallpaper: 'grid' } },
  { id: 'arctic', name: 'Arctic Signal', author: 'Cypher', description: 'Azul glacial, linhas precisas e silêncio visual.', settings: { ...defaults, accent: '#78d9ee', surface: '#10191e', background: '#080e12', radius: 6, font: 'mono', wallpaper: 'grid' } },
];
function profileDirectory(id = activeProfileId) {
  return id === 'default' ? app.getPath('userData') : path.join(app.getPath('userData'), 'profiles', id);
}
function profileStorePath(id = activeProfileId) { return path.join(profileDirectory(id), 'cypher.json'); }
function loadProfileRegistry() {
  const file = path.join(app.getPath('userData'), 'cypher-profiles.json');
  try {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (Array.isArray(saved.profiles)) profileRegistry = [{ id:'default', name:'Pessoal' }, ...saved.profiles.filter(item => item && /^[a-f\d-]{36}$/i.test(item.id) && typeof item.name === 'string').slice(0,20).map(item => ({ id:item.id, name:item.name.trim().slice(0,48) || 'Perfil' }))];
    if (!profileRegistry.some(item => item.id === 'default')) profileRegistry.unshift({ id:'default', name:'Pessoal' });
    if (profileRegistry.some(item => item.id === saved.activeProfileId)) activeProfileId = saved.activeProfileId;
  } catch {}
}
function persistProfileRegistry() {
  const file = path.join(app.getPath('userData'), 'cypher-profiles.json');
  fs.mkdirSync(path.dirname(file), { recursive:true });
  fs.writeFileSync(file, JSON.stringify({ activeProfileId, profiles:profileRegistry.filter(item => item.id !== 'default') }, null, 2));
}
const builtinModRoot = path.join(__dirname, 'builtin-mods');
const builtinMods = new Map();
const modComponents = ['theme', 'wallpaper', 'sounds', 'music', 'pageStyles', 'shader', 'fonts', 'interfaceCss'];
let pickedModFiles = new Map();
function loadBuiltinMods() {
  builtinMods.clear();
  let folders = [];
  try { folders = fs.readdirSync(builtinModRoot, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name); } catch { return; }
  for (const folder of folders) {
    const root = path.join(builtinModRoot, folder);
    try {
      const manifest = modPackage.validateModManifest(JSON.parse(fs.readFileSync(path.join(root, modPackage.MANIFEST), 'utf8')));
      builtinMods.set(manifest.id, { root, manifest });
    } catch (error) { console.warn(`Mod embutido ignorado (${folder}):`, error.message); }
  }
}
function installedModsRoot() { return path.resolve(app.getPath('userData'), 'mods'); }
function modRoot(record) {
  if (!record) return '';
  if (record.source === 'builtin') return builtinMods.get(record.id)?.root || '';
  const root = path.resolve(installedModsRoot(), record.id);
  return root.startsWith(installedModsRoot() + path.sep) ? root : '';
}
function sanitizeModRecord(item) {
  if (!item || typeof item.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/.test(item.id)) return null;
  try {
    const manifest = item.source === 'builtin' && builtinMods.has(item.id) ? builtinMods.get(item.id).manifest : modPackage.validateModManifest(item.manifest);
    const toggles = Object.fromEntries(modComponents.map(key => [key, item.toggles?.[key] !== false]));
    const css = { pageStyles: Array.isArray(item.css?.pageStyles) ? item.css.pageStyles.slice(0, 40).flatMap(entry => entry && Array.isArray(entry.matches) ? [{ matches: entry.matches.filter(host => typeof host === 'string').slice(0, 20), css: modPackage.sanitizeCss(entry.css) }] : []) : [], interfaceCss: modPackage.sanitizeCss(item.css?.interfaceCss || '') };
    const previous = item.previousTheme && typeof item.previousTheme === 'object' ? sanitizeSettings(item.previousTheme, defaults) : null;
    return { id: manifest.id, source: ['builtin', 'catalog', 'file'].includes(item.source) ? item.source : 'file', manifest, enabled: item.enabled === true, toggles, css,
      previousTheme: previous ? { accent: previous.accent, surface: previous.surface, background: previous.background, skin: previous.skin, appearanceMode: previous.appearanceMode, tokens: previous.tokens } : null,
      installedAt: Number.isFinite(item.installedAt) ? item.installedAt : Date.now() };
  } catch { return null; }
}
function modRecord(id) { return store.modPackages.find(item => item.id === id); }
function modFileUrl(id, file) { return `cypher-mod://${encodeURIComponent(id)}/${file.split('/').map(encodeURIComponent).join('/')}`; }
function modEffects() {
  const enabled = (store.modPackages || []).filter(item => item.enabled);
  const last = component => [...enabled].reverse().find(item => item.toggles[component] && item.manifest.components[component]);
  const wallpaper = last('wallpaper'), sounds = last('sounds'), music = last('music'), shader = last('shader');
  const fonts = {};
  for (const item of enabled) if (item.toggles.fonts) for (const font of item.manifest.components.fonts || []) fonts[font.use] = { family: `${font.family} ${item.id}`, url: modFileUrl(item.id, font.file) };
  return {
    wallpaper: wallpaper ? { url: modFileUrl(wallpaper.id, wallpaper.manifest.components.wallpaper.file), type: wallpaper.manifest.components.wallpaper.type, dim: wallpaper.manifest.components.wallpaper.dim, modId: wallpaper.id } : null,
    sounds: sounds && store.settings.modSoundsEnabled ? { volume: sounds.manifest.components.sounds.volume, files: Object.fromEntries(modPackage.soundKeys.filter(key => sounds.manifest.components.sounds[key]).map(key => [key, modFileUrl(sounds.id, sounds.manifest.components.sounds[key])])) } : null,
    music: music && store.settings.modMusicEnabled ? { base: modFileUrl(music.id, music.manifest.components.music.base), active: music.manifest.components.music.active ? modFileUrl(music.id, music.manifest.components.music.active) : '', volume: music.manifest.components.music.volume, modId: music.id } : null,
    shader: shader ? shader.manifest.components.shader : null,
    fonts,
    interfaceCss: enabled.filter(item => item.toggles.interfaceCss && item.css.interfaceCss).map(item => item.css.interfaceCss).join('\n\n'),
  };
}
const shaderCss = (preset, intensity) => {
  const i = Math.max(0.1, Math.min(1, intensity || 0.6));
  const overlay = background => `html::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:2147483647;${background}}`;
  return ({
    crt: `html{filter:contrast(${1 + 0.1 * i}) saturate(${1 + 0.15 * i})!important}${overlay(`background:repeating-linear-gradient(to bottom,rgba(0,0,0,${0.22 * i}) 0 1px,transparent 1px 3px),radial-gradient(ellipse at center,transparent 60%,rgba(0,0,0,${0.45 * i}));`)}`,
    sepia: `html{filter:sepia(${i})!important}`,
    neon: `html{filter:saturate(${1 + 0.9 * i}) contrast(${1 + 0.12 * i}) hue-rotate(${-8 * i}deg)!important}`,
    noir: `html{filter:grayscale(${i}) contrast(${1 + 0.2 * i})!important}`,
    warm: `html{filter:sepia(${0.25 * i}) saturate(${1 + 0.1 * i}) brightness(${1 - 0.03 * i})!important}`,
    cool: `html{filter:hue-rotate(${-14 * i}deg) saturate(${1 + 0.1 * i})!important}`,
    vignette: overlay(`background:radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,${0.6 * i}));`),
    dream: `html{filter:saturate(${1 + 0.3 * i}) brightness(${1 + 0.04 * i}) contrast(${1 - 0.06 * i})!important}`,
  })[preset] || '';
};
function hostMatches(host, pattern) { const clean = pattern.replace(/^\*\./, ''); return host === clean || host.endsWith(`.${clean}`); }
function pageModCss(url) {
  if (!store?.settings.modPageEffects) return '';
  let host = '';
  try { const parsed = new URL(url); if (!['http:', 'https:'].includes(parsed.protocol)) return ''; host = parsed.hostname.toLowerCase(); } catch { return ''; }
  const parts = [];
  for (const item of store.modPackages.filter(record => record.enabled && record.toggles.pageStyles)) for (const style of item.css.pageStyles) if (style.matches.some(pattern => hostMatches(host, pattern))) parts.push(style.css);
  const effects = modEffects();
  if (effects.shader) parts.push(shaderCss(effects.shader.preset, effects.shader.intensity));
  return parts.join('\n');
}
async function applyPageMods(tab) {
  const wc = tab.view?.webContents;
  if (!wc || wc.isDestroyed()) return;
  if (tab.modCssKey) { const key = tab.modCssKey; tab.modCssKey = ''; await wc.removeInsertedCSS(key).catch(() => {}); }
  const css = pageModCss(wc.getURL());
  if (css) tab.modCssKey = await wc.insertCSS(css).catch(() => '');
}
function refreshPageMods() { for (const tab of tabs) void applyPageMods(tab); }
function applyModTheme(record) {
  const theme = record.manifest.components.theme;
  if (!theme) return;
  const current = store.settings;
  record.previousTheme = { accent: current.accent, surface: current.surface, background: current.background, skin: current.skin, appearanceMode: current.appearanceMode, tokens: current.tokens };
  store.settings = sanitizeSettings({ ...theme, tokens: { ...current.tokens, ...(theme.tokens || {}) } }, store.settings);
  store.settings.activeMod = '';
}
function restoreModTheme(record) {
  if (!record.previousTheme) return;
  store.settings = sanitizeSettings(record.previousTheme, store.settings);
  record.previousTheme = null;
}
function setModEnabled(record, enabled) {
  if (record.enabled === enabled) return;
  record.enabled = enabled;
  if (record.toggles.theme) { if (enabled) applyModTheme(record); else restoreModTheme(record); }
}
async function installModFolder(root, source) {
  const manifest = await modPackage.readModFolder(root);
  const css = await modPackage.readModCss(root, manifest);
  const existing = modRecord(manifest.id);
  if (existing) { setModEnabled(existing, false); store.modPackages = store.modPackages.filter(item => item.id !== manifest.id); }
  const record = { id: manifest.id, source, manifest, enabled: false, toggles: Object.fromEntries(modComponents.map(key => [key, true])), css, previousTheme: null, installedAt: Date.now() };
  store.modPackages.push(record);
  setModEnabled(record, true);
  return record;
}
async function installModPackageFile(file, source) {
  const staging = path.resolve(installedModsRoot(), `.staging-${randomUUID()}`);
  await fs.promises.mkdir(installedModsRoot(), { recursive: true });
  const manifest = await modPackage.extractModPackage(file, staging);
  if (builtinMods.has(manifest.id)) { await fs.promises.rm(staging, { recursive: true, force: true }); throw new Error('Este mod já vem embutido no Cypher.'); }
  const target = path.resolve(installedModsRoot(), manifest.id);
  if (!target.startsWith(installedModsRoot() + path.sep)) throw new Error('ID de mod inválido.');
  const existing = modRecord(manifest.id);
  if (existing) setModEnabled(existing, false);
  await fs.promises.rm(target, { recursive: true, force: true });
  await fs.promises.rename(staging, target);
  const record = await installModFolder(target, source);
  persist(); refreshPageMods(); emit();
  return record.id;
}
function modCatalogBase() {
  try { const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'update-config.json'), 'utf8')); return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(config.repository || '') ? { url: `https://github.com/${config.repository}/releases/download/mods-catalog/`, key: String(config.updateSigningPublicKey || '').trim() } : null; } catch { return null; }
}
async function fetchLimited(url, limit) {
  const response = await net.fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`O catálogo respondeu ${response.status}.`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > limit) throw new Error('O arquivo do catálogo excede o tamanho permitido.');
  return buffer;
}
let modCatalogCache = null;
async function modCatalog() {
  const builtin = [...builtinMods.values()].map(({ manifest, root }) => ({ id: manifest.id, name: manifest.name, version: manifest.version, author: manifest.author, description: manifest.description, tags: manifest.tags, components: Object.keys(manifest.components), preview: manifest.preview ? modFileUrlForBuiltin(manifest.id, manifest.preview) : '', source: 'builtin' }));
  const base = modCatalogBase();
  if (!base || !base.key) return { mods: builtin, remote: false, message: 'Esta versão do Cypher mostra só os mods embutidos.' };
  try {
    if (!modCatalogCache || Date.now() - modCatalogCache.at > 15 * 60 * 1000) {
      const index = modPackage.verifySignedJson(JSON.parse((await fetchLimited(base.url + 'index.json', 4 * 1024 * 1024)).toString('utf8')), base.key);
      if (index.schemaVersion !== 1 || !Array.isArray(index.mods)) throw new Error('Formato de catálogo desconhecido.');
      modCatalogCache = { at: Date.now(), mods: index.mods.slice(0, 500).flatMap(entry => entry && typeof entry.id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/.test(entry.id) && typeof entry.package === 'string' && /^[a-z0-9.-]+\.cyphermod$/.test(entry.package) && typeof entry.sha512 === 'string' ? [{
        id: entry.id, name: String(entry.name || entry.id).slice(0, 64), version: String(entry.version || ''), author: String(entry.author || '').slice(0, 64), description: String(entry.description || '').slice(0, 400),
        tags: Array.isArray(entry.tags) ? entry.tags.filter(tag => typeof tag === 'string').slice(0, 6) : [], components: Array.isArray(entry.components) ? entry.components.filter(key => modComponents.includes(key)) : [],
        preview: typeof entry.preview === 'string' && /^data:image\/(?:png|jpeg|webp|svg\+xml);base64,[\dA-Za-z+/=]+$/.test(entry.preview) && entry.preview.length < 400_000 ? entry.preview : '',
        package: entry.package, sha512: entry.sha512, size: Number(entry.size) || 0, source: 'catalog' }] : []) };
    }
    const ids = new Set(builtin.map(item => item.id));
    return { mods: [...builtin, ...modCatalogCache.mods.filter(item => !ids.has(item.id))], remote: true, message: '' };
  } catch (error) { return { mods: builtin, remote: false, message: `Não foi possível carregar o catálogo online: ${error.message}` }; }
}
function modFileUrlForBuiltin(id, file) { return modFileUrl(id, file); }
function loadStore(profileId = activeProfileId) {
  activeProfileId = profileId;
  storePath = profileStorePath(profileId);
  fs.mkdirSync(path.dirname(storePath), { recursive:true });
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(storePath, 'utf8')); } catch (error) {
    if (error.code !== 'ENOENT') { try { fs.copyFileSync(storePath, storePath + '.backup'); } catch {} }
  }
  const notes = {};
  if (saved.homeData?.notes && typeof saved.homeData.notes === 'object') for (const [id,value] of Object.entries(saved.homeData.notes)) {
    if (typeof value === 'string' && id !== '__proto__') notes[id] = value.slice(0,20000);
  }
  store = { settings: sanitizeSettings(saved.settings), errorReportConsentImported: saved.errorReportConsentImported === true, bookmarks: [], history: [], downloads: [], extensions: [], sitePermissions: [], passwords: [], mods: [], savedTabs: Array.isArray(saved.savedTabs) ? saved.savedTabs : [],
    activeWorkspaceId: typeof saved.activeWorkspaceId === 'string' ? saved.activeWorkspaceId.slice(0,80) : 'personal',
    workspaces: Array.isArray(saved.workspaces) ? saved.workspaces.slice(0,30).flatMap(item => item && typeof item.id === 'string' && typeof item.name === 'string' ? [{ id:item.id.slice(0,80), name:item.name.trim().slice(0,48) || 'Espaço', color:/^#[\da-f]{6}$/i.test(item.color) ? item.color : '#78d9ee', tabs:Array.isArray(item.tabs) ? item.tabs.slice(0,100).flatMap(tab => { try { const url = new URL(tab.url); return ['http:','https:'].includes(url.protocol) ? [{ url:url.href, title:String(tab.title || url.hostname).slice(0,180), pinned:tab.pinned === true, group:typeof tab.group === 'string' ? tab.group.slice(0,50) : '' }] : []; } catch { return []; } }) : [] }] : []) : [],
    researchItems: Array.isArray(saved.researchItems) ? saved.researchItems.slice(0,1000).flatMap(item => { try { const url = new URL(item.url); return ['http:','https:'].includes(url.protocol) && typeof item.id === 'string' ? [{ id:item.id.slice(0,80), url:url.href, title:String(item.title || url.hostname).slice(0,180), note:String(item.note || '').slice(0,5000), tags:Array.isArray(item.tags) ? item.tags.filter(tag => typeof tag === 'string').slice(0,8).map(tag => tag.slice(0,32)) : [], savedAt:Number.isFinite(item.savedAt) ? item.savedAt : Date.now(), read:item.read === true }] : []; } catch { return []; } }) : [],
    profileSync: { endpoint: String(saved.profileSync?.endpoint || '').slice(0,2048), username: String(saved.profileSync?.username || '').slice(0,256), passwordEncrypted: String(saved.profileSync?.passwordEncrypted || '').slice(0,8192), deviceId: /^[a-f\d-]{36}$/i.test(saved.profileSync?.deviceId || '') ? saved.profileSync.deviceId : randomUUID(), localUpdatedAt: Number.isFinite(saved.profileSync?.localUpdatedAt) ? saved.profileSync.localUpdatedAt : 0, lastSync: Number.isFinite(saved.profileSync?.lastSync) ? saved.profileSync.lastSync : 0 },
    homeData: { notes, focus: { endsAt: null, remaining: 1500, duration: 1500 }, focusById: {}, tasksById: {} } };
  if (store.settings.wallpaperVideoPath && !safeWallpaperFile(store.settings.wallpaperVideoPath)) {
    store.settings.wallpaperVideoPath = '';
    store.settings.wallpaperVideoName = '';
    if (store.settings.wallpaper === 'video') store.settings.wallpaper = 'orbital';
  }
  if (saved.trackerProtectionConfigured !== true) {
    store.settings.blockTrackers = true;
    store.trackerProtectionConfigured = true;
    persist();
  }
  store.settings.backgroundMusicEnabled = false;
  const savedFocus = saved.homeData?.focus;
  if (savedFocus && [savedFocus.duration,savedFocus.remaining].every(Number.isFinite)) {
    store.homeData.focus = { duration: Math.max(60,Math.min(7200,savedFocus.duration)), remaining: Math.max(0,Math.min(7200,savedFocus.remaining)), endsAt: Number.isFinite(savedFocus.endsAt) ? Math.min(savedFocus.endsAt,Date.now()+7200000) : null };
  }
  const focusWidgets = new Set(store.settings.home.widgets.filter(widget => widget.type === 'focus').map(widget => widget.id));
  if (saved.homeData?.focusById && typeof saved.homeData.focusById === 'object') for (const [id,value] of Object.entries(saved.homeData.focusById)) {
    if (!focusWidgets.has(id) || !value || ![value.duration,value.remaining].every(Number.isFinite)) continue;
    store.homeData.focusById[id] = { duration: Math.max(60,Math.min(7200,value.duration)), remaining: Math.max(0,Math.min(7200,value.remaining)), endsAt: Number.isFinite(value.endsAt) ? Math.min(value.endsAt,Date.now()+7200000) : null };
  }
  const taskWidgets = new Set(store.settings.home.widgets.filter(widget => widget.type === 'tasks').map(widget => widget.id));
  if (saved.homeData?.tasksById && typeof saved.homeData.tasksById === 'object') for (const [id,items] of Object.entries(saved.homeData.tasksById)) {
    if (!taskWidgets.has(id) || !Array.isArray(items)) continue;
    store.homeData.tasksById[id] = items.slice(0,50).flatMap(item => item && typeof item.id === 'string' && typeof item.title === 'string'
      ? [{ id: item.id.slice(0,80), title: item.title.slice(0,180), done: item.done === true }]
      : []);
  }
  for (const id of taskWidgets) if (!store.homeData.tasksById[id]) store.homeData.tasksById[id] = [];
  for (const key of ['bookmarks','history','downloads','mods']) if (Array.isArray(saved[key])) store[key] = saved[key];
  store.modPackages = Array.isArray(saved.modPackages) ? saved.modPackages.slice(0, 100).map(sanitizeModRecord).filter(Boolean).filter((item, index, list) => list.findIndex(other => other.id === item.id) === index) : [];
  store.skins = Array.isArray(saved.skins) ? saved.skins.slice(0,50).flatMap(item => {
    try { const skin = validateSkinPackage({ ...item, schemaVersion:1, type:'cypher-skin' }); return [{ ...skin, id: typeof item.id === 'string' && /^skin-[a-f\d-]{36}$/.test(item.id) ? item.id : skin.id }]; } catch { return []; }
  }) : [];
  if (store.settings.skinPackage && !store.skins.some(item => item.id === store.settings.skinPackage)) store.settings.skinPackage = '';
  store.privacyStats = {};
  if (saved.privacyStats && typeof saved.privacyStats === 'object') for (const [day, value] of Object.entries(saved.privacyStats).slice(-60)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !value || typeof value !== 'object') continue;
    store.privacyStats[day] = Object.fromEntries(['ads','trackers','requests','normal','tor','i2p'].map(key => [key, Number.isFinite(value[key]) ? Math.max(0, Math.floor(value[key])) : 0]));
  }
  if (!store.workspaces.length) store.workspaces = [{ id:'personal', name:'Pessoal', color:'#78d9ee', tabs:store.savedTabs.filter(item => item && typeof item.url === 'string').slice(0,100).map(item => ({ url:item.url, title:item.title || item.url, pinned:item.pinned === true, group:item.group || '' })) }];
  if (!store.workspaces.some(item => item.id === store.activeWorkspaceId)) store.activeWorkspaceId = store.workspaces[0]?.id || 'personal';
  store.passwordNever = Array.isArray(saved.passwordNever) ? [...new Set(saved.passwordNever.map(normalizePasswordOrigin).filter(Boolean))].slice(0,500) : [];
  if (Array.isArray(saved.passwords)) store.passwords = saved.passwords.slice(0,1000).flatMap(entry => {
    if (!entry || typeof entry.id !== 'string' || typeof entry.username !== 'string' || typeof entry.passwordEncrypted !== 'string') return [];
    const origin = normalizePasswordOrigin(entry.origin);
    if (!origin || entry.passwordEncrypted.length > 8192 || !/^[A-Za-z\d+/]+={0,2}$/.test(entry.passwordEncrypted)) return [];
    return [{ id: entry.id.slice(0,80), origin, username: entry.username.slice(0,256), passwordEncrypted: entry.passwordEncrypted, updated: Number.isFinite(entry.updated) ? entry.updated : Date.now(), leaked: Number.isFinite(entry.leaked) ? Math.max(0, Math.floor(entry.leaked)) : 0, reused: entry.reused === true, checkedAt: Number.isFinite(entry.checkedAt) ? entry.checkedAt : 0 }];
  });
  if (Array.isArray(saved.extensions)) store.extensions = saved.extensions.slice(0,100).flatMap(extension => {
    if (!extension || typeof extension.id !== 'string' || typeof extension.path !== 'string' || extension.path.length > 4096) return [];
    const source = ['chrome-web-store','cypher-package'].includes(extension.source) ? extension.source : 'local';
    const packageId = source === 'cypher-package' && typeof extension.packageId === 'string' && /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(extension.packageId) ? extension.packageId : '';
    const extensionPath = path.resolve(extension.path);
    if (source === 'cypher-package' && (!packageId || extensionPath.toLowerCase() !== path.resolve(app.getPath('userData'),'cypher-extension-packages',packageId).toLowerCase())) return [];
    return [{ id: extension.id.slice(0,128), path: extensionPath, name: String(extension.name || 'Extensão').slice(0,128), version: String(extension.version || '').slice(0,40), enabled: extension.enabled !== false, source, packageId, error: '' }];
  });
  if (Array.isArray(saved.sitePermissions)) store.sitePermissions = saved.sitePermissions.slice(0,2000).flatMap(rule => {
    if (!rule || typeof rule.origin !== 'string' || !sitePermissionTypes.has(rule.permission) || typeof rule.allowed !== 'boolean') return [];
    try {
      const origin = new URL(rule.origin).origin;
      if (!['http:','https:'].includes(new URL(origin).protocol) || origin !== rule.origin) return [];
      return [{ id: `${origin}|${rule.permission}`, origin, permission: rule.permission, allowed: rule.allowed, updated: Number.isFinite(rule.updated) ? rule.updated : Date.now() }];
    } catch { return []; }
  });
  for (const item of store.downloads) if (['progressing','paused'].includes(item.state)) item.state = 'interrupted';
  if ([...builtInMods, ...store.mods].some(m => m.id === saved.settings?.activeMod)) store.settings.activeMod = saved.settings.activeMod;
}
function persist() {
  clearTimeout(saveTimer);
  if (profileSyncReady && !profileSyncBusy && store?.profileSync) store.profileSync.localUpdatedAt = Date.now();
  saveTimer = setTimeout(flush, 200);
  if (profileSyncReady && !profileSyncBusy && store?.profileSync?.endpoint) {
    clearTimeout(profileSyncTimer);
    profileSyncTimer = setTimeout(() => void syncProfile().catch(error => console.warn('Sincronização do perfil:', error.message)), 5000);
  }
}
function wallpaperDirectory() { return path.resolve(app.getPath('userData'), 'wallpapers'); }
function safeWallpaperFile(value) {
  if (typeof value !== 'string' || !value) return null;
  const root = wallpaperDirectory(), resolved = path.resolve(value);
  if (!resolved.startsWith(root + path.sep) || !/\.(?:mp4|webm|ogv)$/i.test(resolved)) return null;
  try { return fs.statSync(resolved).isFile() ? resolved : null; } catch { return null; }
}
function flush() {
  if (!storePath) return;
  try {
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    for (const workspace of store.workspaces || []) {
      const liveTabs = tabs.filter(t => !t.private && t.connectionMode === 'normal' && t.workspaceId === workspace.id && /^https?:\/\//i.test(t.url)).slice(0,100);
      if (liveTabs.length) workspace.tabs = liveTabs.map(t => ({ url:t.url, title:t.title, pinned:t.pinned, group:t.group || '' }));
    }
    fs.writeFileSync(storePath + '.tmp', JSON.stringify({ ...store, savedTabs: tabs.filter(t => !t.private && t.connectionMode === 'normal' && /^https?:\/\//i.test(t.url)).map(t => ({ url: t.url, title:t.title, pinned: t.pinned, workspaceId:t.workspaceId, group:t.group || '', containerId:t.containerId || '' })), downloads: store.downloads.filter(d => !d.private && (d.connectionMode || 'normal') === 'normal') }, null, 2));
    fs.renameSync(storePath + '.tmp', storePath);
  } catch (error) { console.error('Não foi possível salvar o perfil:', error.message); }
}
function passwordVaultSnapshot() {
  return store.passwords.map(({ id, origin, username, updated, leaked, reused, checkedAt }) => ({ id, origin, username, updated, leaked: leaked || 0, reused: !!reused, checkedAt: checkedAt || 0 }));
}
// Login enviado numa aba: fica aqui (fora do objeto da aba, que vai para a interface) até a
// página sair do formulário; aí vira o pedido "Salvar senha?".
const loginCandidates = new Map();
let passwordPrompt = null, passwordPromptTimer = null;
const pwnedCache = new Map();
function passwordPromptSnapshot() {
  if (!passwordPrompt || !tabs.some(tab => tab.id === passwordPrompt.tabId)) return null;
  const { id, tabId, origin, username, update, leaked } = passwordPrompt;
  return { id, tabId, origin, username, update, leaked };
}
function clearPasswordPrompt() { passwordPrompt = null; clearTimeout(passwordPromptTimer); emit(); }
async function leakCount(hash) {
  try { return await pwnedCountForHash(hash, (url, options) => net.fetch(url, options), pwnedCache); }
  catch (error) { console.warn('Verificação de vazamentos indisponível:', error.message); return -1; }
}
function loginCaptured(tab, origin, username, password) {
  if (!store.settings.passwordSavePrompt || tab.private || tab.connectionMode !== 'normal' || !origin || store.passwordNever.includes(origin)) return;
  if (!safeStorage.isEncryptionAvailable()) return;
  const sameUser = store.passwords.filter(entry => entry.origin === origin && (!username || entry.username === username));
  for (const entry of sameUser) { try { if (decryptPassword(entry) === password) return; } catch {} }
  const existing = username ? store.passwords.find(entry => entry.origin === origin && entry.username === username) : null;
  loginCandidates.set(tab.id, { origin, username, passwordEncrypted: encryptPassword(password), hash: sha1Hex(password), update: !!existing, at: Date.now() });
  setTimeout(() => void maybeOfferPassword(tab, false), 2500);
}
const passwordFieldStillFilled = "[...document.querySelectorAll('input[type=password]')].some(field => field.value && field.offsetParent)";
async function maybeOfferPassword(tab, navigated) {
  const candidate = loginCandidates.get(tab.id);
  if (!candidate || !tabs.includes(tab) || Date.now() - candidate.at > 60_000) { loginCandidates.delete(tab.id); return; }
  // Sem navegação: só oferece quando o formulário de senha sumiu (login feito por script).
  if (!navigated && await tab.view?.webContents.executeJavaScript(passwordFieldStillFilled, true).catch(() => true) !== false) return;
  loginCandidates.delete(tab.id);
  passwordPrompt = { id: randomUUID(), tabId: tab.id, origin: candidate.origin, username: candidate.username, update: candidate.update, passwordEncrypted: candidate.passwordEncrypted, leaked: 0 };
  const prompt = passwordPrompt;
  clearTimeout(passwordPromptTimer);
  passwordPromptTimer = setTimeout(() => { if (passwordPrompt === prompt) clearPasswordPrompt(); }, 120_000);
  emit();
  if (store.settings.passwordLeakCheck) {
    const count = await leakCount(candidate.hash);
    if (passwordPrompt === prompt && count > 0) { prompt.leaked = count; emit(); }
  }
}
async function checkPasswordLeaks() {
  const hashes = new Map();
  for (const entry of store.passwords) { try { hashes.set(entry.id, sha1Hex(decryptPassword(entry))); } catch {} }
  const uses = new Map();
  for (const hash of hashes.values()) uses.set(hash, (uses.get(hash) || 0) + 1);
  let leaked = 0, failed = 0;
  for (const entry of store.passwords) {
    const hash = hashes.get(entry.id);
    if (!hash) continue;
    entry.reused = uses.get(hash) > 1;
    const count = await leakCount(hash);
    if (count < 0) { failed++; continue; }
    entry.leaked = count; entry.checkedAt = Date.now();
    if (count > 0) leaked++;
  }
  persist(); emit();
  if (failed && failed === hashes.size) throw new Error('Não foi possível falar com o serviço de vazamentos agora. Tente mais tarde.');
  return { checked: hashes.size - failed, leaked, reused: store.passwords.filter(entry => entry.reused).length };
}
function savePasswordEntry(origin, username, passwordEncrypted) {
  const existing = store.passwords.find(entry => entry.origin === origin && entry.username === username);
  if (existing) { existing.passwordEncrypted = passwordEncrypted; existing.updated = Date.now(); existing.leaked = 0; existing.checkedAt = 0; return 'updated'; }
  store.passwords.unshift({ id:randomUUID(), origin, username, passwordEncrypted, updated:Date.now() });
  store.passwords = store.passwords.slice(0,1000);
  return 'added';
}
function encryptPassword(value) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('O cofre exige a criptografia segura do sistema operacional.');
  if (typeof value !== 'string' || !value || value.length > 4096) throw new Error('Informe uma senha válida com até 4096 caracteres.');
  return safeStorage.encryptString(value).toString('base64');
}
function generatePassword(length = 24) {
  const size = Math.max(16, Math.min(64, Number.isFinite(length) ? Math.round(length) : 24));
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+[]{}';
  let result = '';
  while (result.length < size) {
    const bytes = randomBytes(Math.ceil((size - result.length) * 1.5));
    for (const byte of bytes) {
      if (byte >= 256 - (256 % alphabet.length)) continue;
      result += alphabet[byte % alphabet.length];
      if (result.length >= size) break;
    }
  }
  return result;
}
function decryptPassword(entry) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('A criptografia segura do sistema não está disponível neste dispositivo.');
  try { return safeStorage.decryptString(Buffer.from(entry.passwordEncrypted, 'base64')); }
  catch { throw new Error('Não foi possível abrir esta senha protegida pelo Windows.'); }
}
async function fillSavedPassword(tab, entry) {
  if (!tab || tab.private || tab.connectionMode !== 'normal' || !tab.view || tab.view.webContents.isDestroyed()) throw new Error('O preenchimento só está disponível em abas normais, fora de janelas privadas, Tor e I2P.');
  if (normalizePasswordOrigin(tab.url) !== entry.origin) throw new Error('A senha só pode ser preenchida no mesmo domínio em que foi salva.');
  const username = entry.username, password = decryptPassword(entry), wc = tab.view.webContents;
  const fillOnPage = (savedUsername, savedPassword) => {
    const passwordField = [...document.querySelectorAll('input[type="password"]')].find(field => !field.disabled && !field.readOnly && !field.value);
    if (!passwordField) return false;
    const form = passwordField.form;
    if (form) { try { if (new URL(form.action || location.href, location.href).origin !== location.origin) return false; } catch { return false; } }
    const fields = [...(form || document).querySelectorAll('input')].filter(field => !field.disabled && !field.readOnly && !field.value && ['text','email','tel','url'].includes((field.type || '').toLowerCase()));
    const usernameField = fields.find(field => /user|login|email|identifier|account/i.test(`${field.name} ${field.id} ${field.autocomplete}`)) || fields.filter(field => field.compareDocumentPosition(passwordField) & Node.DOCUMENT_POSITION_FOLLOWING).pop();
    const setValue = (field, value) => {
      const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value')?.set;
      setter ? setter.call(field, value) : field.value = value;
      field.dispatchEvent(new Event('input', { bubbles:true }));
      field.dispatchEvent(new Event('change', { bubbles:true }));
    };
    if (savedUsername && usernameField) setValue(usernameField, savedUsername);
    setValue(passwordField, savedPassword);
    return true;
  };
  return wc.executeJavaScript(`(${fillOnPage.toString()})(${JSON.stringify(username)},${JSON.stringify(password)})`, true);
}
function maybeAutofillPassword(tab) {
  if (!store?.settings.passwordAutofillEnabled || tab?.private || tab?.connectionMode !== 'normal' || !tab?.view) return;
  const origin = normalizePasswordOrigin(tab.url);
  if (!origin) return;
  const matches = store.passwords.filter(entry => entry.origin === origin);
  if (matches.length === 1) {
    let filled = false;
    const fill = async () => {
      if (filled || !tabs.includes(tab) || !tab.url || normalizePasswordOrigin(tab.url) !== origin) return;
      try { filled = await fillSavedPassword(tab, matches[0]); }
      catch (error) { filled = true; console.warn('Não foi possível preencher a senha salva:', error.message); }
    };
    void fill();
    for (const delay of [350,900,1800]) setTimeout(() => void fill(), delay);
  }
}
function profileSyncSnapshot() {
  const profile = store?.profileSync;
  return { configured: !!profile?.endpoint, endpoint: profile?.endpoint || '', username: profile?.username || '', syncing: profileSyncBusy, lastSync: profile?.lastSync || 0, error: profile?.lastError || '' };
}
function profileDataForSync() {
  const settings = { ...store.settings, wallpaperVideoPath: '', wallpaperVideoName: '', downloadDirectory: '', startWithWindows: false, connectionMode: 'normal', torSocksPort: defaults.torSocksPort, i2pHttpPort: defaults.i2pHttpPort };
  if (settings.wallpaper === 'video') settings.wallpaper = 'orbital';
  return {
    settings, bookmarks: store.bookmarks, history: store.history.slice(0,1000),
    savedTabs: tabs.filter(tab => !tab.private && tab.connectionMode === 'normal' && /^https?:\/\//.test(tab.url)).map(tab => ({ url: tab.url, pinned: tab.pinned })).slice(0,50),
    sitePermissions: store.sitePermissions, homeData: store.homeData,
  };
}
function profileSyncAuth() {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('A criptografia segura do Windows não está disponível neste dispositivo.');
  const profile = store.profileSync;
  let password = '';
  try { password = safeStorage.decryptString(Buffer.from(profile.passwordEncrypted, 'base64')); }
  catch { throw new Error('Não foi possível abrir a senha criptografada salva. Informe a senha novamente.'); }
  return `Basic ${Buffer.from(`${profile.username}:${password}`, 'utf8').toString('base64')}`;
}
async function profileSyncRequest(method, body) {
  const profile = store.profileSync;
  const url = new URL(profile.endpoint);
  if (url.protocol !== 'https:' && !['localhost','127.0.0.1'].includes(url.hostname)) throw new Error('A sincronização exige HTTPS. HTTP só é aceito em um servidor local de teste.');
  const mode = store.settings.connectionMode || 'normal';
  const routeTab = { private:false, connectionMode:mode };
  const ses = session.fromPartition(sessionPartition(routeTab));
  setupSession(ses, mode);
  if (mode !== 'normal') {
    await privacyServices.start(mode, connectionPort(mode));
    await privacyServices.stopOther(mode);
  }
  await prepareProxy(routeTab, ses);
  const response = await ses.fetch(url.href, { method, redirect:'error', signal:AbortSignal.timeout(25000), headers:{ Authorization:profileSyncAuth(), ...(body ? { 'Content-Type':'application/json; charset=utf-8' } : {}) }, ...(body ? { body:JSON.stringify(body) } : {}) });
  return response;
}
async function syncProfile() {
  if (profileSyncBusy || !store?.profileSync?.endpoint) return profileSyncSnapshot();
  profileSyncBusy = true; store.profileSync.lastError = ''; emit();
  try {
    const response = await profileSyncRequest('GET');
    if (response.status === 404) {
      const document = { schema:1, deviceId:store.profileSync.deviceId, updatedAt:store.profileSync.localUpdatedAt || Date.now(), profile:profileDataForSync() };
      const uploaded = await profileSyncRequest('PUT', document);
      if (!uploaded.ok) throw new Error(`O servidor recusou a gravação do perfil (HTTP ${uploaded.status}).`);
      store.profileSync.localUpdatedAt = document.updatedAt;
    } else {
      if (!response.ok) throw new Error(`O servidor de sincronização respondeu HTTP ${response.status}.`);
      const length = Number(response.headers.get('content-length') || 0);
      if (length > 20 * 1024 * 1024) throw new Error('O arquivo de sincronização ultrapassa 20 MB.');
      const raw = await response.text();
      if (Buffer.byteLength(raw, 'utf8') > 20 * 1024 * 1024) throw new Error('O arquivo de sincronização ultrapassa 20 MB.');
      let remote;
      try { remote = JSON.parse(raw); } catch { throw new Error('O arquivo remoto não contém um perfil Cypher válido.'); }
      if (remote?.schema !== 1 || !Number.isFinite(remote.updatedAt) || !remote.profile || typeof remote.profile !== 'object') throw new Error('O arquivo remoto usa um formato de perfil incompatível.');
      if (remote.updatedAt > store.profileSync.localUpdatedAt || store.profileSync.localUpdatedAt === 0) {
        profileSyncBusy = true;
        const incoming = remote.profile;
        const mergeRecords = (remoteItems, localItems, identity) => {
          const merged = new Map();
          for (const item of [...(Array.isArray(localItems) ? localItems : []), ...(Array.isArray(remoteItems) ? remoteItems : [])]) {
            if (!item || typeof item !== 'object') continue;
            const key = identity(item);
            if (key) merged.set(key, item);
          }
          return [...merged.values()];
        };
        const localProfileExists = store.bookmarks.length > 0 || store.history.length > 0 || store.savedTabs.length > 0
          || Object.keys(store.homeData.notes || {}).length > 0 || Object.keys(store.homeData.focusById || {}).length > 0
          || Object.values(store.homeData.tasksById || {}).some(items => Array.isArray(items) && items.length > 0);
        store.settings = sanitizeSettings(incoming.settings, store.settings);
        if (store.settings.wallpaper === 'video' && !store.settings.wallpaperVideoPath) store.settings.wallpaper = 'orbital';
        if (Array.isArray(incoming.bookmarks)) {
          const remotes = incoming.bookmarks.filter(item => item && typeof item.url === 'string' && /^https?:\/\//i.test(item.url)).map(item => ({ id:String(item.id || randomUUID()), title:String(item.title || item.url).slice(0,512), url:String(item.url).slice(0,4096), date:Number.isFinite(item.date) ? item.date : Date.now() }));
          store.bookmarks = mergeRecords(remotes, store.bookmarks, item => item.url).slice(-1000);
        }
        if (Array.isArray(incoming.history)) {
          const remotes = incoming.history.filter(item => item && typeof item.url === 'string' && /^https?:\/\//i.test(item.url)).map(item => ({ id:String(item.id || randomUUID()), title:String(item.title || item.url).slice(0,512), url:String(item.url).slice(0,4096), date:Number.isFinite(item.date) ? item.date : Date.now() }));
          store.history = mergeRecords(remotes, store.history, item => `${item.id}:${item.date}`).sort((a,b) => b.date-a.date).slice(0,1000);
        }
        if (Array.isArray(incoming.savedTabs)) {
          const remotes = incoming.savedTabs.filter(item => item && typeof item.url === 'string' && /^https?:\/\//i.test(item.url)).map(item => ({ url:String(item.url).slice(0,4096), pinned:item.pinned === true }));
          store.savedTabs = mergeRecords(remotes, store.savedTabs, item => item.url).slice(0,50);
        }
        if (Array.isArray(incoming.sitePermissions)) {
          const remotes = incoming.sitePermissions.slice(0,2000).filter(item => item && typeof item.origin === 'string' && sitePermissionTypes.has(item.permission) && typeof item.allowed === 'boolean').flatMap(item => {
            try { const origin = new URL(item.origin).origin; return origin === item.origin && ['http:','https:'].includes(new URL(origin).protocol) ? [{ id:`${origin}|${item.permission}`, origin, permission:item.permission, allowed:item.allowed, updated:Number.isFinite(item.updated) ? item.updated : Date.now() }] : []; } catch { return []; }
          });
          store.sitePermissions = mergeRecords(remotes, store.sitePermissions, item => item.id).slice(-2000);
        }
        if (incoming.homeData && typeof incoming.homeData === 'object') {
          const incomingNotes = incoming.homeData.notes && typeof incoming.homeData.notes === 'object' ? incoming.homeData.notes : {};
          const notes = Object.fromEntries(Object.entries(incomingNotes).filter(([id,value]) => id !== '__proto__' && typeof value === 'string').slice(0,100).map(([id,value]) => [id.slice(0,128),value.slice(0,20000)]));
          const focusWidgetIds = new Set(store.settings.home.widgets.filter(widget => widget.type === 'focus').map(widget => widget.id));
          const taskWidgetIds = new Set(store.settings.home.widgets.filter(widget => widget.type === 'tasks').map(widget => widget.id));
          const incomingFocusById = incoming.homeData.focusById && typeof incoming.homeData.focusById === 'object' ? incoming.homeData.focusById : {};
          const focusById = Object.fromEntries(Object.entries(incomingFocusById).filter(([id,value]) => focusWidgetIds.has(id) && value && [value.duration,value.remaining].every(Number.isFinite)).slice(0,50).map(([id,value]) => [id, {
            duration:Math.max(60,Math.min(7200,value.duration)), remaining:Math.max(0,Math.min(7200,value.remaining)),
            endsAt:Number.isFinite(value.endsAt) ? Math.max(0,Math.min(value.endsAt,Date.now()+7200000)) : null,
          }]));
          const incomingTasksById = incoming.homeData.tasksById && typeof incoming.homeData.tasksById === 'object' ? incoming.homeData.tasksById : {};
          const tasksById = Object.fromEntries(Object.entries(incomingTasksById).filter(([id,items]) => taskWidgetIds.has(id) && Array.isArray(items)).slice(0,50).map(([id,items]) => {
            const remoteTasks = items.slice(0,50).flatMap(item => item && typeof item.id === 'string' && typeof item.title === 'string'
              ? [{ id:item.id.slice(0,80), title:item.title.slice(0,180), done:item.done === true }]
              : []);
            const localTasks = localProfileExists && Array.isArray(store.homeData.tasksById[id]) ? store.homeData.tasksById[id] : [];
            const merged = new Map([...remoteTasks,...localTasks].map(item => [item.id,item]));
            return [id,[...merged.values()].slice(-50)];
          }));
          store.homeData = {
            ...store.homeData,
            notes:localProfileExists ? { ...notes,...store.homeData.notes } : notes,
            focusById:localProfileExists ? { ...focusById,...store.homeData.focusById } : { ...store.homeData.focusById,...focusById },
            tasksById:localProfileExists ? { ...tasksById,...store.homeData.tasksById } : { ...store.homeData.tasksById,...tasksById },
          };
          if (!localProfileExists && incoming.homeData.focus && [incoming.homeData.focus.duration,incoming.homeData.focus.remaining].every(Number.isFinite)) store.homeData.focus = { duration:Math.max(60,Math.min(7200,incoming.homeData.focus.duration)), remaining:Math.max(0,Math.min(7200,incoming.homeData.focus.remaining)), endsAt:Number.isFinite(incoming.homeData.focus.endsAt) ? incoming.homeData.focus.endsAt : null };
        }
        store.profileSync.localUpdatedAt = localProfileExists && store.profileSync.localUpdatedAt === 0 ? Date.now() : remote.updatedAt;
        if (localProfileExists && remote.updatedAt > 0 && store.profileSync.localUpdatedAt > remote.updatedAt) {
          const uploaded = await profileSyncRequest('PUT', { schema:1, deviceId:store.profileSync.deviceId, updatedAt:store.profileSync.localUpdatedAt, profile:profileDataForSync() });
          if (!uploaded.ok) throw new Error(`O servidor recusou a gravação do perfil mesclado (HTTP ${uploaded.status}).`);
        }
        flush();
      } else if (remote.deviceId !== store.profileSync.deviceId || remote.updatedAt < store.profileSync.localUpdatedAt) {
        const uploaded = await profileSyncRequest('PUT', { schema:1, deviceId:store.profileSync.deviceId, updatedAt:store.profileSync.localUpdatedAt || Date.now(), profile:profileDataForSync() });
        if (!uploaded.ok) throw new Error(`O servidor recusou a gravação do perfil (HTTP ${uploaded.status}).`);
      }
    }
    store.profileSync.lastSync = Date.now(); store.profileSync.lastError = '';
    flush(); emit(); return profileSyncSnapshot();
  } catch (error) {
    store.profileSync.lastError = String(error?.message || error).slice(0,500);
    flush(); emit(); throw error;
  } finally { profileSyncBusy = false; emit(); }
}
function snapshot() {
  return { tabs: tabs.map(({ view, ...tab }) => tab), activeId, settings: store.settings, bookmarks: store.bookmarks,
    history: store.history, downloads: store.downloads, extensions: store.extensions.map(({ id, name, version, enabled, source, packageId, error }) => ({ id, name, version, enabled, source, packageId, error })),
    sitePermissions: store.sitePermissions, mods: [...builtInMods, ...store.mods], workspaces:store.workspaces, activeWorkspaceId:store.activeWorkspaceId,
    researchItems:store.researchItems, profileId:activeProfileId, profiles:profileRegistry.map(item => ({ ...item, active:item.id === activeProfileId })),
    profileSync: profileSyncSnapshot(), maximized: windowAlive() ? win.isMaximized() : false,
    trackerProtection: trackerList,
    popupProtection: { blockedCount: blockedPopupCount, pending: popupRequests.map(request => ({ ...request })) },
    hardwareAccelerationPending: store.settings.hardwareAcceleration !== hardwareAccelerationAtLaunch,
    onboarding,
    passwordPrompt: passwordPromptSnapshot(),
    update: updater?.getState() || { state: 'unconfigured', currentVersion: app.getVersion(), version: '', progress: 0, message: '', releaseNotes: '', repository: '' },
    homeData: active()?.private ? { notes: {}, focus: { endsAt: null, remaining: 1500, duration: 1500 }, focusById: {}, tasksById: {} } : store.homeData,
    nowPlaying: getNowPlaying(), skins: store.skins, privacyStats: Object.fromEntries(Object.entries(store.privacyStats).slice(-30)),
    split, openPanelId, systemDark: nativeTheme.shouldUseDarkColors,
    modPackages: store.modPackages.map(({ id, source, manifest, enabled, toggles, installedAt }) => ({ id, source, enabled, toggles, installedAt, name: manifest.name, version: manifest.version, author: manifest.author, description: manifest.description, tags: manifest.tags, components: Object.keys(manifest.components), preview: manifest.preview ? modFileUrl(id, manifest.preview) : '', shader: manifest.components.shader?.preset || '' })),
    modEffects: modEffects() };
}
function emit() {
  const state = snapshot();
  if (win && !win.isDestroyed()) win.webContents.send('cypher:state', state);
  if (playerWindow && !playerWindow.isDestroyed()) playerWindow.webContents.send('cypher:state', state);
}
function active() { return tabs.find(tab => tab.id === activeId); }
function profileSnapshot() { return profileRegistry.map(item => ({ ...item, active:item.id === activeProfileId })); }
function captureWorkspaceTabs(workspaceId = store.activeWorkspaceId) {
  const workspace = store.workspaces.find(item => item.id === workspaceId);
  if (!workspace) return;
  const liveTabs = tabs.filter(tab => !tab.private && tab.connectionMode === 'normal' && tab.workspaceId === workspaceId && /^https?:\/\//i.test(tab.url)).slice(0,100);
  if (liveTabs.length) workspace.tabs = liveTabs.map(tab => ({ url:tab.url, title:tab.title, pinned:tab.pinned, group:tab.group || '' }));
}
function switchWorkspace(id) {
  const target = store.workspaces.find(item => item.id === id);
  if (!target) return false;
  const alreadyOpen = tabs.some(tab => !tab.private && tab.connectionMode === 'normal' && tab.workspaceId === target.id && /^https?:\/\//i.test(tab.url));
  if (id === store.activeWorkspaceId && alreadyOpen) return false;
  if (id !== store.activeWorkspaceId) { captureWorkspaceTabs(); store.activeWorkspaceId = target.id; }
  let candidates = tabs.filter(tab => !tab.private && tab.connectionMode === 'normal' && tab.workspaceId === target.id);
  if (!alreadyOpen) {
    for (const saved of target.tabs.slice(0,100)) {
      try {
        const tabId = addTab(saved.url, false, 'normal', false);
        const tab = tabs.find(item => item.id === tabId);
        if (tab) { tab.workspaceId = target.id; tab.title = saved.title || tab.title; tab.pinned = !!saved.pinned; tab.group = saved.group || ''; }
      } catch {}
    }
    candidates = tabs.filter(tab => !tab.private && tab.connectionMode === 'normal' && tab.workspaceId === target.id);
  }
  if (!candidates.length) candidates = [tabs.find(tab => tab.workspaceId === target.id) || tabs.find(tab => !tab.private && tab.connectionMode === 'normal')].filter(Boolean);
  if (!candidates.length) addTab('cypher://newtab', false, 'normal', false);
  else {
    const previous = active(); if (previous) previous.lastActiveAt = Date.now();
    activeId = (candidates.find(tab => /^https?:\/\//i.test(tab.url)) || candidates[0]).id;
    const selected = active(); if (selected) selected.lastActiveAt = Date.now();
  }
  layout(); persist(); emit(); return true;
}
async function switchProfile(id) {
  const target = profileRegistry.find(item => item.id === id);
  if (!target) throw new Error('Este perfil não existe mais.');
  if (id === activeProfileId) return profileSnapshot();
  if (store.downloads.some(item => item.state === 'progressing' || item.state === 'paused')) throw new Error('Conclua ou cancele os downloads antes de trocar de perfil.');
  if (protonProxyValue) await setProtonProxy({ mode:'system' });
  if (protonPopupWindow && !protonPopupWindow.isDestroyed()) protonPopupWindow.close();
  flush();
  profileSyncReady = false; profileSyncBusy = false; clearTimeout(profileSyncTimer);
  profileSwitching = true;
  closePanels(); split = null;
  for (const tab of [...tabs]) {
    tab.suspending = true;
    if (tab.view) {
      const view = tab.view; tab.view = null;
      if (win && !win.isDestroyed()) win.contentView.removeChildView(view);
      if (!view.webContents.isDestroyed()) view.webContents.destroy();
    }
  }
  tabs.splice(0); activeId = ''; nowPlayingTabId = null;
  for (const privateSession of privateSessions) { void privateSession.clearStorageData(); void privateSession.clearCache(); }
  privateSessions.clear();
  activeProfileId = id; persistProfileRegistry(); loadStore(id); privatePartition = `cypher-private-${randomUUID()}`;
  protonExtensionReady = false; protonProxyValue = null;
  const homeId = addTab('cypher://newtab', false, store.settings.connectionMode);
  if (store.settings.startupMode === 'restore') for (const savedTab of store.savedTabs.slice(0,50)) {
    try { const tabId = addTab(savedTab.url, false, store.settings.connectionMode, true, undefined, { containerId: savedTab.containerId }); const restored = tabs.find(item => item.id === tabId); if (restored) { restored.pinned = !!savedTab.pinned; restored.group = savedTab.group || ''; restored.workspaceId = savedTab.workspaceId || store.activeWorkspaceId; } } catch {}
  }
  else if (store.settings.startupMode === 'specific') for (const url of store.settings.startupPages.slice(0,10)) { try { addTab(url, false, store.settings.connectionMode); } catch {} }
  profileSwitching = false; profileSyncReady = true;
  void loadBuiltInProtonVpn().then(() => loadStoredExtensions()).catch(error => console.warn('Não foi possível preparar as extensões do perfil:', error.message));
  if (homeId) selectTab(homeId);
  if (store.profileSync.endpoint) setTimeout(() => void syncProfile().catch(error => console.warn('Sincronização após troca de perfil:', error.message)), 1200);
  emit(); return profileSnapshot();
}
function createProfile(name) {
  const normalized = String(name || '').trim().slice(0,48);
  if (!normalized) throw new Error('Dê um nome ao perfil.');
  if (profileRegistry.length >= 21) throw new Error('O Cypher permite até 20 perfis adicionais.');
  const id = randomUUID();
  profileRegistry.push({ id, name:normalized });
  fs.mkdirSync(profileDirectory(id), { recursive:true }); persistProfileRegistry(); emit();
  return profileSnapshot();
}
function positionMediaPlayerWindow() {
  if (!win || win.isDestroyed() || !playerWindow || playerWindow.isDestroyed()) return;
  const parent = win.getBounds(), workArea = screen.getDisplayMatching(parent).workArea;
  const width = 372, height = 160;
  const x = Math.max(workArea.x, Math.min(parent.x + parent.width - width - 14, workArea.x + workArea.width - width));
  const y = Math.max(workArea.y, Math.min(parent.y + 58, workArea.y + workArea.height - height));
  playerWindow.setBounds({ x, y, width, height }, false);
}
function createMediaPlayerWindow() {
  if (!win || win.isDestroyed() || !rendererUrl) return;
  if (playerWindow && !playerWindow.isDestroyed()) { positionMediaPlayerWindow(); playerWindow.showInactive(); return; }
  playerWindow = new BrowserWindow({ parent:win, width:372, height:160, frame:false, transparent:true, backgroundColor:'#00000000', resizable:false, movable:false, skipTaskbar:true, show:false, hasShadow:false,
    webPreferences:{ preload:path.join(__dirname,'preload.cjs'), nodeIntegration:false, contextIsolation:true, sandbox:true, webSecurity:true, allowRunningInsecureContent:false } });
  playerWindow.setAlwaysOnTop(true, 'floating');
  playerWindow.webContents.on('will-navigate', event => event.preventDefault());
  playerWindow.webContents.setWindowOpenHandler(() => ({ action:'deny' }));
  playerWindow.on('close', event => { if (!quitting) { event.preventDefault(); playerWindow?.hide(); } });
  playerWindow.on('closed', () => { playerWindow = undefined; });
  playerWindow.once('ready-to-show', () => { positionMediaPlayerWindow(); if (playerWindow && !playerWindow.isDestroyed()) playerWindow.showInactive(); });
  void playerWindow.loadURL(`${rendererUrl}#mini-player`).catch(error => console.error('Não foi possível abrir o miniplayer:', error.message));
}
function toggleMediaPlayerWindow() {
  if (playerWindow && !playerWindow.isDestroyed() && playerWindow.isVisible()) playerWindow.hide();
  else createMediaPlayerWindow();
}
function showPlayingTab(tabId) {
  const target = tabs.find(entry => entry.id === tabId && entry.mediaInfo);
  if (target) selectTab(target.id);
  if (win && !win.isDestroyed()) { win.show(); win.focus(); }
  if (playerWindow && !playerWindow.isDestroyed()) playerWindow.hide();
}
function getNowPlaying() {
  let tab = tabs.find(entry => entry.id === nowPlayingTabId && entry.mediaPlaying && entry.mediaInfo);
  if (!tab) tab = [...tabs].reverse().find(entry => entry.mediaPlaying && entry.mediaInfo) || tabs.find(entry => entry.id === nowPlayingTabId && entry.mediaInfo) || [...tabs].reverse().find(entry => entry.mediaInfo);
  return tab?.mediaInfo ? { ...tab.mediaInfo, tabId: tab.id, tabTitle: tab.title, pageUrl: tab.url, playing: !!tab.mediaPlaying } : null;
}
function refreshMediaInfo(tab, started = false) {
  const wc = tab.view?.webContents;
  if (!wc || wc.isDestroyed()) return;
  const script = `(() => {
    const elements = [...document.querySelectorAll('audio,video')];
    const media = elements.find(item => !item.paused && !item.ended && item.readyState >= 2) || elements.find(item => !item.paused && !item.ended) || elements.find(item => item.currentSrc);
    const metadata = navigator.mediaSession?.metadata;
    const safeImageUrl = value => {
      if (typeof value !== 'string' || !value) return '';
      if (value.startsWith('data:image/')) return value.length <= 250000 ? value : '';
      try { const url = new URL(value, location.href); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; }
    };
    const artworkOptions = [...(metadata?.artwork || [])].map(item => ({ src: safeImageUrl(item.src), sizes: item.sizes || '' })).filter(item => item.src);
    artworkOptions.sort((a, b) => {
      const size = value => Math.max(0, ...String(value).split(/\\s+/).map(part => Number.parseInt(part.split('x')[0], 10) || 0));
      return size(b.sizes) - size(a.sizes);
    });
    const artworkUrl = artworkOptions[0]?.src || safeImageUrl((media?.tagName === 'VIDEO' ? media.poster : '') || document.querySelector('meta[property="og:image"]')?.content || document.querySelector('meta[name="twitter:image"]')?.content || document.querySelector('link[itemprop="thumbnailUrl"]')?.href || '');
    return { title: metadata?.title || media?.getAttribute('title') || document.title || location.hostname,
      artist: metadata?.artist || '', album: metadata?.album || '', artworkUrl,
      currentTime: Number.isFinite(media?.currentTime) ? media.currentTime : 0,
      duration: Number.isFinite(media?.duration) ? media.duration : 0,
      playing: !!media && !media.paused && !media.ended };
  })()`;
  wc.executeJavaScript(script, true).then(info => {
    if (!tabs.includes(tab) || wc.isDestroyed()) return;
    const actuallyPlaying = !!info?.playing || (started && wc.isCurrentlyAudible());
    tab.mediaPlaying = actuallyPlaying;
    if (actuallyPlaying) nowPlayingTabId = tab.id;
    const artworkUrl = typeof info?.artworkUrl === 'string' ? info.artworkUrl : '';
    const previousArtworkSource = tab.mediaArtworkSource || '';
    const directArtwork = artworkUrl.startsWith('data:image/') && artworkUrl.length <= 250000 ? artworkUrl : '';
    const artwork = directArtwork || (artworkUrl && artworkUrl === previousArtworkSource ? tab.mediaInfo?.artwork || '' : '');
    tab.mediaArtworkSource = artworkUrl;
    tab.mediaInfo = {
      title: String(info?.title || wc.getTitle() || new URL(tab.url).hostname).slice(0, 240),
      artist: String(info?.artist || '').slice(0, 160), album: String(info?.album || '').slice(0, 160),
      artwork,
      currentTime: Number.isFinite(info?.currentTime) ? Math.max(0, info.currentTime) : 0,
      duration: Number.isFinite(info?.duration) ? Math.max(0, info.duration) : 0,
    };
    emit();
    if (artworkUrl && !directArtwork && artworkUrl !== previousArtworkSource) {
      const artworkScript = `(async () => {
        try {
          const response = await fetch(${JSON.stringify(artworkUrl)}, { credentials: 'omit', cache: 'force-cache' });
          if (!response.ok || !response.headers.get('content-type')?.toLowerCase().startsWith('image/')) return '';
          const blob = await response.blob();
          if (blob.size > 180000) return '';
          return await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : ''); reader.onerror = () => resolve(''); reader.readAsDataURL(blob); });
        } catch { return ''; }
      })()`;
      wc.executeJavaScript(artworkScript, true).then(data => {
        if (!tabs.includes(tab) || wc.isDestroyed() || tab.mediaArtworkSource !== artworkUrl || typeof data !== 'string' || !data.startsWith('data:image/') || data.length > 250000) return;
        tab.mediaInfo = { ...tab.mediaInfo, artwork: data };
        emit();
      }).catch(() => {});
    }
  }).catch(() => {});
}
// Eventos de páginas e abas podem chegar depois de a janela ser destruída ao fechar o Cypher.
/** Itens de edição do menu do botão direito, com os rótulos em português e o estado de cada ação. */
function editMenuItems(params) {
  const flags = params.editFlags || {};
  if (params.isEditable) return [
    { role: 'undo', label: 'Desfazer', enabled: !!flags.canUndo }, { role: 'redo', label: 'Refazer', enabled: !!flags.canRedo }, { type: 'separator' },
    { role: 'cut', label: 'Recortar', enabled: !!flags.canCut }, { role: 'copy', label: 'Copiar', enabled: !!flags.canCopy },
    { role: 'paste', label: 'Colar', enabled: !!flags.canPaste }, { role: 'selectAll', label: 'Selecionar tudo', enabled: !!flags.canSelectAll },
  ];
  return String(params.selectionText || '').trim() ? [{ role: 'copy', label: 'Copiar' }] : [];
}
// ===== Atualização: bloqueio de versões antigas e novidades depois de atualizar =====
const blockedActions = new Set(['navigate','tab:new','tab:duplicate','tab:restore','back','forward','reload','tab:reload','split:toggle','panel:toggle','panel:add','connection:select','page:reader','page:translate','password:fill']);
function updateBlocked() { return updater?.getState().blocked === true; }
const hadProfileAtLaunch = (() => { try { return fs.existsSync(path.join(app.getPath('userData'), 'cypher.json')); } catch { return false; } })();
let onboarding = null;
function versionFile() { return path.join(app.getPath('userData'), 'cypher-version.json'); }
function writeLastRunVersion(version) { try { fs.writeFileSync(versionFile(), JSON.stringify({ lastRunVersion: version })); } catch {} }
function bundledChangelog() {
  try { const list = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../dist/changelog.json'), 'utf8')); return Array.isArray(list) ? list.filter(entry => parseVersion(entry?.version) && Array.isArray(entry.items)) : []; }
  catch { return []; }
}
/** Mostra as novidades de todas as versões entre a última usada e a atual. */
function prepareOnboarding() {
  const current = app.getVersion();
  if (!parseVersion(current)) return;
  const entries = bundledChangelog();
  let last = '';
  try { last = JSON.parse(fs.readFileSync(versionFile(), 'utf8')).lastRunVersion || ''; } catch {}
  if (!parseVersion(last)) {
    // Primeira vez com este controle: quem já tinha perfil acabou de atualizar a partir da versão anterior.
    const previous = entries.map(entry => entry.version).filter(version => compareCypherVersions(version, current) < 0).sort(compareCypherVersions).pop();
    last = hadProfileAtLaunch && previous ? previous : current;
  }
  const versions = compareCypherVersions(current, last) > 0 ? notesBetween(entries, last, current) : [];
  if (versions.length) onboarding = { from: last, to: current, versions };
  else writeLastRunVersion(current);
}
function acknowledgeOnboarding() { onboarding = null; writeLastRunVersion(app.getVersion()); }
function windowAlive() { return !!win && !win.isDestroyed(); }
function shortcut(action) { if (windowAlive()) win.webContents.send('cypher:shortcut', action); }
async function sendPageSnapshot() {
  if (!win || win.isDestroyed()) return;
  const views = win.contentView.children.filter(view => view.webContents && !view.webContents.isDestroyed() && (typeof view.getVisible !== 'function' || view.getVisible()));
  const capture = async view => {
    const bounds = view.getBounds();
    if (bounds.width < 2 || bounds.height < 2) return null;
    const image = await view.webContents.capturePage();
    if (image.isEmpty()) return null;
    return { ...bounds, dataUrl: `data:image/jpeg;base64,${image.toJPEG(78).toString('base64')}` };
  };
  try {
    const shots = await Promise.race([Promise.all(views.map(capture)), new Promise(resolve => setTimeout(() => resolve([]), 300))]);
    if (windowAlive()) win.webContents.send('cypher:page-snapshot', shots.filter(Boolean));
  } catch { if (windowAlive()) win.webContents.send('cypher:page-snapshot', []); }
}
function layout() {
  if (!win || win.isDestroyed()) return;
  const [width, height] = win.getContentSize();
  const clampRect = rect => {
    const x = Math.min(Math.max(0, Math.round(rect.x)), width);
    const y = Math.min(Math.max(0, Math.round(rect.y)), height);
    return { x, y, width: Math.max(0, Math.min(Math.round(rect.width), width - x)), height: Math.max(0, Math.min(Math.round(rect.height), height - y)) };
  };
  const bounds = clampRect(viewport);
  const pair = split && [split.left, split.right].includes(activeId) ? [tabs.find(t => t.id === split.left), tabs.find(t => t.id === split.right)] : null;
  const splitActive = !!pair && pair.every(t => t && t.view && !t.url.startsWith('cypher://') && !t.error);
  const leftWidth = splitActive ? Math.max(0, Math.round(bounds.width * split.ratio) - 3) : 0;
  const boundsFor = tab => {
    if (!splitActive) return bounds;
    if (tab.id === split.left) return { ...bounds, width: leftWidth };
    return { x: bounds.x + leftWidth + 6, y: bounds.y, width: Math.max(0, bounds.width - leftWidth - 6), height: bounds.height };
  };
  for (const tab of tabs) if (tab.view) {
    const tabBounds = boundsFor(tab);
    tab.view.setBounds(tab.connectionMode === 'normal' ? tabBounds : letterboxBounds(tabBounds));
    const inWorkspace = tab.private || tab.connectionMode !== 'normal' || tab.workspaceId === store.activeWorkspaceId;
    const shown = splitActive ? tab.id === split.left || tab.id === split.right : tab.id === activeId;
    tab.view.setVisible(shown && inWorkspace && !obscured && !updateBlocked() && !tab.url.startsWith('cypher://') && !tab.error);
    try { tab.view.webContents.setBackgroundThrottling(store.settings.memorySaverEnabled && !shown); } catch {}
  }
  for (const [id, view] of panelViews) {
    const visible = id === openPanelId && !!panelBounds && !obscured;
    if (visible) view.setBounds(clampRect(panelBounds));
    view.setVisible(visible);
  }
}
function closePanels() {
  for (const view of panelViews.values()) {
    if (win && !win.isDestroyed()) win.contentView.removeChildView(view);
    if (!view.webContents.isDestroyed()) view.webContents.close();
  }
  panelViews.clear(); openPanelId = '';
}
function panelView(panel) {
  const existing = panelViews.get(panel.id);
  if (existing && !existing.webContents.isDestroyed()) return existing;
  const ses = session.fromPartition(normalPartition());
  setupSession(ses, 'normal');
  const view = new WebContentsView({ webPreferences: { session: ses, nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, allowRunningInsecureContent: false } });
  view.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//i.test(url)) addTab(url, false, 'normal'); return { action: 'deny' }; });
  view.webContents.on('will-navigate', (event, url) => { if (!/^https?:\/\//i.test(url)) event.preventDefault(); });
  view.webContents.on('dom-ready', () => { if (store.settings.blockCookieBanners) void view.webContents.insertCSS(cookieBannerCss).catch(() => {}); });
  win.contentView.addChildView(view);
  panelViews.set(panel.id, view);
  void view.webContents.loadURL(panel.url).catch(error => console.warn('Painel lateral:', error.message));
  return view;
}
function localDay(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function bumpStat(key, amount = 1) {
  if (!store?.privacyStats) return;
  const day = localDay();
  if (!store.privacyStats[day]) {
    store.privacyStats[day] = { ads:0, trackers:0, requests:0, normal:0, tor:0, i2p:0 };
    const days = Object.keys(store.privacyStats).sort();
    for (const old of days.slice(0, Math.max(0, days.length - 60))) delete store.privacyStats[old];
  }
  store.privacyStats[day][key] += amount;
  if (!statsTimer) statsTimer = setTimeout(() => { statsTimer = null; persist(); }, 10000);
}
const cookieBannerCss = `#onetrust-consent-sdk,#onetrust-banner-sdk,#CybotCookiebotDialog,#CybotCookiebotDialogBodyUnderlay,.qc-cmp2-container,#qc-cmp2-container,#didomi-host,#didomi-popup,.fc-consent-root,#usercentrics-root,#cookie-law-info-bar,.cky-consent-container,.cc-window,.cc-banner,#cookiescript_injected,#truste-consent-track,.truste_box_overlay,#sp_message_container_,div[id^="sp_message_container_"],.osano-cm-window,#cmpbox,#cmpbox2,.cmp-root,#gdpr-cookie-message,.cookie-banner,.cookie-consent,.cookie-notice,#cookie-banner,#cookie-consent,#cookie-notice,#cookieConsent,.js-cookie-consent{display:none!important;visibility:hidden!important}html.didomi-popup-open,body.didomi-popup-open,html.sp-message-open,body.sp-message-open{overflow:auto!important}`;
const readerScript = `(() => {
  if (document.documentElement.dataset.cypherReader) { location.reload(); return 'off'; }
  const textOf = el => [...el.querySelectorAll('p')].reduce((total, p) => total + p.innerText.trim().length, 0);
  let best = [...document.querySelectorAll('article, main, [role=main], .post, .article, .entry-content, #content, .content')].sort((a, b) => textOf(b) - textOf(a))[0];
  if (!best || textOf(best) < 400) {
    const parents = new Map();
    for (const p of document.querySelectorAll('p')) parents.set(p.parentElement, (parents.get(p.parentElement) || 0) + p.innerText.length);
    best = [...parents].sort((a, b) => b[1] - a[1])[0]?.[0];
  }
  if (!best || textOf(best) < 200) return 'none';
  const clone = best.cloneNode(true);
  clone.querySelectorAll('script,style,noscript,iframe,form,nav,aside,footer,header,button,input,select,textarea,[aria-hidden="true"],[class*="share"],[class*="related"],[class*="newsletter"],[class*="advert"]').forEach(node => node.remove());
  clone.querySelectorAll('*').forEach(node => { for (const attribute of [...node.attributes]) if (!['href','src','alt','title'].includes(attribute.name)) node.removeAttribute(attribute.name); });
  const title = (document.querySelector('h1')?.innerText || document.title || '').trim();
  clone.querySelectorAll('h1').forEach(node => { if (node.innerText.trim() === title) node.remove(); });
  document.documentElement.dataset.cypherReader = '1';
  document.querySelectorAll('link[rel="stylesheet"], style').forEach(node => node.remove());
  const heading = document.createElement('h1'); heading.textContent = title;
  const site = document.createElement('p'); site.className = 'cypher-reader-site'; site.textContent = location.hostname.replace(/^www\\./, '');
  document.body.replaceChildren(site, heading, clone);
  scrollTo(0, 0); return 'on';
})()`;
function readerCss() {
  const accent = store.settings.accent;
  return `html[data-cypher-reader]{background:#151310!important;color:#ece6d8!important}html[data-cypher-reader] body{max-width:720px!important;margin:0 auto!important;padding:64px 28px 120px!important;font:20px/1.75 Georgia,"Times New Roman",serif!important;background:none!important;color:inherit!important}html[data-cypher-reader] h1{font:800 48px/1.02 "Arial Narrow","Segoe UI",sans-serif!important;text-transform:uppercase;letter-spacing:.3px;margin:0 0 36px!important;color:#ece6d8!important}html[data-cypher-reader] .cypher-reader-site{font:600 14px "Arial Narrow",sans-serif!important;letter-spacing:3px;text-transform:uppercase;color:${accent}!important;margin:0 0 8px!important}html[data-cypher-reader] img,html[data-cypher-reader] video{max-width:100%!important;height:auto!important}html[data-cypher-reader] a{color:${accent}!important}html[data-cypher-reader] p{margin:0 0 1.2em!important}html[data-cypher-reader] h2,html[data-cypher-reader] h3{font-family:"Arial Narrow",sans-serif!important;text-transform:uppercase;letter-spacing:.3px}html[data-cypher-reader] pre,html[data-cypher-reader] code{font:15px Consolas,monospace!important;white-space:pre-wrap!important}html[data-cypher-reader] *{background:transparent!important;box-shadow:none!important;position:static!important;max-width:100%}`;
}
function validImageData(value) { return typeof value === 'string' && value.length <= 40_000_000 && /^data:image\/png;base64,[\dA-Za-z+/=]+$/.test(value); }
function letterboxBounds(bounds) {
  const width = Math.floor(bounds.width / 200) * 200;
  const height = Math.floor(bounds.height / 100) * 100;
  if (width < 200 || height < 100) return bounds;
  return {
    x: bounds.x + Math.floor((bounds.width - width) / 2),
    y: bounds.y + Math.floor((bounds.height - height) / 2),
    width,
    height,
  };
}
function update(tab) {
  const wc = tab.view?.webContents;
  if (wc && !wc.isDestroyed()) {
    tab.canGoBack = wc.navigationHistory.canGoBack();
    tab.canGoForward = wc.navigationHistory.canGoForward();
    tab.loading = wc.isLoading();
    tab.audible = wc.isCurrentlyAudible();
    tab.zoom = wc.getZoomFactor();
  }
  emit();
}
function selectTab(id) {
  const target = tabs.find(tab => tab.id === id);
  if (!target) return;
  const previous = active(); if (previous && previous.id !== target.id) previous.lastActiveAt = Date.now();
  if (!target.private && target.connectionMode === 'normal' && target.workspaceId && store.workspaces.some(item => item.id === target.workspaceId)) store.activeWorkspaceId = target.workspaceId;
  target.lastActiveAt = Date.now();
  activeId = id;
  if (target.suspended) restoreSuspendedTab(target);
  layout(); emit();
}
function restoreSuspendedTab(tab) {
  if (!tab?.suspended) return;
  tab.suspended = false; tab.lastActiveAt = Date.now(); tab.error = null; tab.errorInfo = null; tab.loading = false;
  if (/^https?:\/\//i.test(tab.url)) { attachView(tab); navigate(tab, tab.url); }
  else { layout(); emit(); }
}
async function suspendTab(tab) {
  const view = tab?.view;
  if (!view || view.webContents.isDestroyed() || !/^https?:\/\//i.test(tab.url) || tab.id === activeId || tab.private || tab.connectionMode !== 'normal' || tab.pinned || tab.loading || tab.audible || tab.mediaPlaying || tab.error || tab.suspended) return false;
  let safeToDiscard = false;
  try {
    safeToDiscard = await view.webContents.executeJavaScript(`(() => {
      const dirty = [...document.querySelectorAll('input,textarea,select')].some(element => element.value !== element.defaultValue || element.checked !== element.defaultChecked);
      const editable = [...document.querySelectorAll('[contenteditable="true"]')].some(element => element.innerText.trim().length > 0);
      const activeMedia = [...document.querySelectorAll('audio,video')].some(element => !element.paused && !element.ended);
      return !dirty && !editable && !activeMedia;
    })()`, true);
  } catch { return false; }
  if (!safeToDiscard || !tabs.includes(tab) || tab.id === activeId) return false;
  tab.suspending = true; tab.view = null; tab.suspended = true; tab.loading = false;
  if (win && !win.isDestroyed()) win.contentView.removeChildView(view);
  if (!view.webContents.isDestroyed()) view.webContents.destroy();
  emit(); return true;
}
function suspendIdleTabs() {
  if (!store?.settings.memorySaverEnabled) return;
  const cutoff = Date.now() - store.settings.memorySaverMinutes * 60_000;
  for (const tab of tabs) if (!tab.lastActiveAt) tab.lastActiveAt = Date.now();
  for (const tab of tabs) if (tab.lastActiveAt < cutoff) void suspendTab(tab);
}
function loadTrackerEngine() {
  const resourcesPath = path.join(__dirname, 'resources');
  let privacyError = '', adError = '';
  try {
    const metadata = JSON.parse(fs.readFileSync(path.join(resourcesPath, 'easyprivacy.json'), 'utf8'));
    trackerEngine = FiltersEngine.deserialize(fs.readFileSync(path.join(resourcesPath, 'easyprivacy.bin')));
    trackerList = { ...trackerList, lastModified: metadata.lastModified || '', fetchedAt: metadata.fetchedAt, networkRuleCount: metadata.networkRuleCount || 0, available: true };
  } catch (error) { trackerEngine = null; privacyError = error.message; }
  try {
    const metadata = JSON.parse(fs.readFileSync(path.join(resourcesPath, 'easylist.json'), 'utf8'));
    adEngine = FiltersEngine.deserialize(fs.readFileSync(path.join(resourcesPath, 'easylist.bin')));
    trackerList = { ...trackerList, adRuleCount: metadata.networkRuleCount || 0, adsAvailable: true };
  } catch (error) { adEngine = null; adError = error.message; }
  trackerList.error = [privacyError && `EasyPrivacy: ${privacyError}`, adError && `EasyList: ${adError}`].filter(Boolean).join(' · ');
  console.info(`Proteção de rede ativa: ${trackerList.adRuleCount.toLocaleString('pt-BR')} regras de anúncios e ${trackerList.networkRuleCount.toLocaleString('pt-BR')} regras de rastreamento.`);
}
function matchFilterRequest(engine, details) {
  if (!engine) return false;
  try {
    const sourceUrl = (details.resourceType === 'mainFrame' ? [details.url] : [details.frame?.top?.url, details.webContents?.mainFrame?.url, details.initiatorOrigin, details.initiator, details.referrer])
      .find(value => typeof value === 'string' && /^https?:\/\//i.test(value)) || '';
    const result = engine.match(Request.fromRawDetails({ url:details.url, type:details.resourceType || 'other', sourceUrl }));
    return result.match === true && !result.exception;
  } catch (error) { console.warn('Falha ao avaliar regra de bloqueio:', error.message); return false; }
}
function matchTrackerRequest(details) {
  return matchFilterRequest(trackerEngine, details);
}
function noteProtectionBlocked(isAd = false, isTracker = false) {
  trackerList.blockedRequests++;
  bumpStat('requests'); if (isAd) bumpStat('ads'); if (isTracker) bumpStat('trackers');
  if (isAd) trackerList.blockedAds++;
  if (isTracker) trackerList.blockedTrackers++;
  if (trackerCountTimer) return;
  trackerCountTimer = setTimeout(() => { trackerCountTimer = null; emit(); }, 500);
}
function connectionPort(mode) { return mode === 'tor' ? store.settings.torSocksPort : mode === 'i2p' ? store.settings.i2pHttpPort : 0; }
function normalPartition() { return activeProfileId === 'default' ? 'persist:cypher' : `persist:cypher-profile-${activeProfileId}`; }
function sessionPartition(tab) {
  const mode = tab.connectionMode || 'normal';
  if (tab.private) return `${privatePartition}-${mode}-${connectionPort(mode)}`;
  if (mode === 'normal' && tab.containerId) return `persist:cypher-container-${activeProfileId}-${tab.containerId}`;
  if (mode === 'normal') return normalPartition();
  return `cypher-${activeProfileId}-${mode}-${connectionPort(mode)}`;
}
function proxyConfig(mode) {
  if (mode === 'normal') return { mode: 'system' };
  const port = connectionPort(mode);
  if (mode === 'tor') return { mode: 'fixed_servers', proxyRules: `socks5://127.0.0.1:${port}`, proxyBypassRules: '<-loopback>' };
  return { mode: 'fixed_servers', proxyRules: `http=127.0.0.1:${port};https=127.0.0.1:${port}`, proxyBypassRules: '<-loopback>' };
}
function prepareProxy(tab, ses) {
  if (tab.private) privateSessions.add(ses);
  if (!proxyReady.has(ses)) {
    const ready = ses.setProxy(proxyConfig(tab.connectionMode)).then(() => ses.closeAllConnections());
    proxyReady.set(ses, ready);
  }
  return proxyReady.get(ses);
}
function protonExtensionDirectory() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'proton-vpn')
    : path.resolve(__dirname, '../vendor/proton-vpn-browser-extension/distribution-cypher');
}
async function loadBuiltInProtonVpn() {
  const ses = session.fromPartition(normalPartition());
  try {
    if (ses.extensions.getExtension(protonExtensionId)) { protonExtensionReady = true; return true; }
    ses.registerPreloadScript({ type:'frame', filePath:path.join(__dirname, 'proton-preload.cjs') });
    const loaded = await ses.extensions.loadExtension(protonExtensionDirectory(), { allowFileAccess:false });
    if (loaded.id !== protonExtensionId) {
      ses.extensions.removeExtension(loaded.id);
      throw new Error('O identificador da extensão Proton embutida não corresponde ao esperado.');
    }
    protonExtensionReady = true;
    return true;
  } catch (error) {
    protonExtensionReady = false;
    console.error('Não foi possível carregar a VPN Proton integrada:', error.message);
    return false;
  }
}
function assertProtonBridgeSender(event) {
  let url;
  try { url = new URL(event.senderFrame?.url || ''); } catch { throw new Error('Origem da integração VPN inválida.'); }
  if (event.sender.session !== session.fromPartition(normalPartition()) || url.protocol !== 'chrome-extension:' || url.hostname !== protonExtensionId) {
    throw new Error('A integração VPN só pode ser chamada pelo painel Proton embutido.');
  }
}
function protonVpnStatus() {
  const proxy = protonProxyValue?.rules?.singleProxy;
  const connecting = proxy?.host === 'localhost' && proxy?.port === 9;
  return { bundled:true, available:protonExtensionReady, active:!!proxy && !connecting, connecting, server:proxy?.host || '', version:'1.3.6' };
}
async function setProtonProxy(value) {
  const ses = session.fromPartition(normalPartition());
  let config;
  if (value?.mode === 'fixed_servers') {
    const proxy = value?.rules?.singleProxy;
    if (!proxy || !['http','https'].includes(proxy.scheme) || !Number.isInteger(proxy.port) || proxy.port < 1 || proxy.port > 65535 || typeof proxy.host !== 'string' || proxy.host.length > 253 || /[\s/@?#]/.test(proxy.host)) throw new Error('A configuração de proxy recebida da extensão Proton é inválida.');
    const bypass = Array.isArray(value.rules.bypassList) ? value.rules.bypassList.filter(item => typeof item === 'string' && item.length <= 255).slice(0,100).join(',') : '';
    config = { mode:'fixed_servers', proxyRules:proxy.scheme + '://' + proxy.host + ':' + proxy.port, ...(bypass ? { proxyBypassRules:bypass } : {}) };
  } else if (value?.mode === 'pac_script') {
    throw new Error('O tunelamento dividido do Proton não está disponível na integração Cypher.');
  } else if (value?.mode === 'system') {
    config = { mode:'system' };
  } else {
    throw new Error('Modo de proxy Proton não permitido.');
  }
  await ses.setProxy(config);
  await ses.closeAllConnections();
  protonProxyValue = value.mode === 'system' ? null : value;
  for (const tab of tabs) {
    if (tab.private || tab.connectionMode !== 'normal' || !tab.view || tab.view.webContents.isDestroyed()) continue;
    try { tab.view.webContents.setWebRTCIPHandlingPolicy(protonProxyValue ? 'disable_non_proxied_udp' : store.settings.webrtcPolicy); } catch {}
  }
  emit();
  return true;
}
async function openProtonVpn() {
  if (!protonExtensionReady) throw new Error('O painel Proton integrado não foi carregado. Reinstale ou atualize o Cypher.');
  if (protonPopupWindow && !protonPopupWindow.isDestroyed()) {
    protonPopupWindow.show();
    protonPopupWindow.focus();
    return { opened:true };
  }
  const ses = session.fromPartition(normalPartition());
  protonPopupWindow = new BrowserWindow({ width:420, height:640, minWidth:380, minHeight:520, parent:win, show:false, backgroundColor:'#0a0d0c', autoHideMenuBar:true,
    webPreferences:{ session:ses, nodeIntegration:false, contextIsolation:true, sandbox:true, webSecurity:true } });
  protonPopupWindow.setMenuBarVisibility(false);
  protonPopupWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) addTab(url, false, 'normal');
    return { action:'deny' };
  });
  protonPopupWindow.on('closed', () => { protonPopupWindow = null; });
  await protonPopupWindow.loadURL('chrome-extension://' + protonExtensionId + '/popup.html');
  protonPopupWindow.show();
  protonPopupWindow.focus();
  return { opened:true };
}
function registerProtonIpcBridge() {
  ipcMain.handle('cypher-proton:proxy:get', event => {
    assertProtonBridgeSender(event);
    return { active:!!protonProxyValue, value:protonProxyValue };
  });
  ipcMain.handle('cypher-proton:proxy:set', async (event, value) => {
    assertProtonBridgeSender(event);
    if (!protonExtensionReady) throw new Error('A extensão Proton embutida não está carregada.');
    return setProtonProxy(value);
  });
  ipcMain.handle('cypher-proton:proxy:clear', async event => {
    assertProtonBridgeSender(event);
    return setProtonProxy({ mode:'system' });
  });
  ipcMain.handle('cypher-proton:open-url', (event, value) => {
    assertProtonBridgeSender(event);
    let url;
    try { url = new URL(String(value || '')); } catch { throw new Error('Endereço solicitado pela extensão Proton inválido.'); }
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('A extensão Proton só pode abrir endereços HTTPS sem credenciais.');
    return { id:addTab(url.href, false, 'normal') };
  });
}
function addTab(address = 'cypher://newtab', isPrivate = false, connectionMode = store.settings.connectionMode, activate = true, navigationOptions, options = {}) {
  const url = resolveAddress(address, store.settings.searchEngine, store.settings.customSearchUrl);
  if (!['normal','tor','i2p'].includes(connectionMode)) connectionMode = store.settings.connectionMode;
  const tab = { id: randomUUID(), title: 'Nova aba', url: 'cypher://newtab', private: !!isPrivate,
    connectionMode, pinned: false, muted: false, audible: false, loading: false, canGoBack: false, canGoForward: false, zoom: 1, error: null,
    workspaceId:!isPrivate && connectionMode === 'normal' ? store.activeWorkspaceId : undefined, group:'', suspended:false, lastActiveAt:Date.now(),
    containerId: !isPrivate && connectionMode === 'normal' && store.settings.containers.some(item => item.id === options.containerId) ? options.containerId : '' };
  tabs.push(tab); if (activate || !activeId) activeId = tab.id;
  navigate(tab, url, navigationOptions); emit();
  return tab.id;
}
function isReplayablePopup(value, postBody) {
  try {
    const parsed = new URL(String(value || ''));
    return ['http:','https:'].includes(parsed.protocol) && !parsed.username && !parsed.password && (!postBody || !!popupNavigationOptions(postBody));
  } catch { return false; }
}
function popupNavigationOptions(postBody) {
  if (!postBody) return undefined;
  if (!Array.isArray(postBody.data) || !postBody.data.length || postBody.data.length > 1000 || !postBody.data.every(item => item && ['rawData','file'].includes(item.type))) return null;
  let contentType = postBody.contentType;
  if (contentType === 'multipart/form-data') {
    if (typeof postBody.boundary !== 'string' || !postBody.boundary || postBody.boundary.length > 200 || /[\r\n]/.test(postBody.boundary)) return null;
    contentType += `; boundary=${postBody.boundary}`;
  } else if (contentType !== 'application/x-www-form-urlencoded') return null;
  return { postData: postBody.data, extraHeaders: `Content-Type: ${contentType}\n` };
}
function queueBlockedPopup(tab, value, details = {}) {
  const rawUrl = typeof value === 'string' && value ? value : 'about:blank';
  const truncated = rawUrl.length > 2048;
  let url = rawUrl.slice(0, 2048), canOpen = !truncated && !details.postBody && isReplayablePopup(rawUrl);
  try {
    const parsed = new URL(url);
    parsed.username = ''; parsed.password = '';
    url = ['http:','https:'].includes(parsed.protocol) ? parsed.href : 'about:blank';
  } catch { url = 'about:blank'; }
  let openerHost = '';
  try { openerHost = new URL(tab.url).hostname.toLowerCase(); } catch {}
  blockedPopupCount += 1;
  const existing = popupRequests.find(request => request.tabId === tab.id && request.url === url && request.canOpen === canOpen);
  if (existing) { existing.count += 1; existing.date = Date.now(); }
  else popupRequests.unshift({ id: randomUUID(), tabId: tab.id, openerTitle: String(tab.title || openerHost || 'Página atual').slice(0,160), openerHost, url, count: 1, date: Date.now(), canOpen, formPost: !!details.postBody, private: !!tab.private, connectionMode: tab.connectionMode });
  if (popupRequests.length > 40) popupRequests.length = 40;
  emit();
}
function removePopupRequest(id) {
  const index = popupRequests.findIndex(request => request.id === id);
  if (index < 0) return null;
  return popupRequests.splice(index, 1)[0];
}
function removeTab(tab) {
  const index = tabs.indexOf(tab);
  if (index < 0) return;
  loginCandidates.delete(tab.id);
  if (passwordPrompt?.tabId === tab.id) { passwordPrompt = null; clearTimeout(passwordPromptTimer); }
  if (split && (split.left === tab.id || split.right === tab.id)) split = null;
  const wasActive = activeId === tab.id;
  tabs.splice(index, 1);
  if (!tab.private && tab.connectionMode === 'normal' && tab.workspaceId && !tabs.some(item => !item.private && item.connectionMode === 'normal' && item.workspaceId === tab.workspaceId && /^https?:\/\//i.test(item.url))) {
    const workspace = store.workspaces.find(item => item.id === tab.workspaceId);
    if (workspace) workspace.tabs = [];
  }
  if (nowPlayingTabId === tab.id) nowPlayingTabId = null;
  if (!tab.private) closedTabs.push({ url: tab.url, title: tab.title, connectionMode: tab.connectionMode });
  if (closedTabs.length > 20) closedTabs.shift();
  if (wasActive) {
    const visible = tabs.filter(item => item.private || item.connectionMode !== 'normal' || item.workspaceId === store.activeWorkspaceId);
    activeId = visible[Math.min(index, visible.length - 1)]?.id || visible[0]?.id || '';
    if (!activeId && !closing && !profileSwitching) addTab('cypher://newtab', false, 'normal');
  }
  if (!tabs.length && !closing && !profileSwitching) addTab();
  if (tab.private && !tabs.some(t => t.private)) {
    const sessions = [...privateSessions];
    privateSessions.clear();
    privatePartition = `cypher-private-${randomUUID()}`;
    for (const privateSession of sessions) { void privateSession.clearStorageData(); void privateSession.clearCache(); }
    store.downloads = store.downloads.filter(d => !d.private || downloadItems.has(d.id));
  }
  layout(); persist(); emit();
}
function closeTab(id) {
  const tab = tabs.find(t => t.id === id);
  if (!tab) return;
  if (tab.view && !tab.view.webContents.isDestroyed()) tab.view.webContents.close({ waitForBeforeUnload: true });
  else removeTab(tab);
}
function setupSession(ses, mode = 'normal') {
  if (configuredSessions.has(ses)) return;
  configuredSessions.add(ses);
  const grants = new Set();
  try {
    ses.setSpellCheckerEnabled(store.settings.spellCheckEnabled);
    ses.setSpellCheckerLanguages(store.settings.spellCheckLanguages.length ? store.settings.spellCheckLanguages : [store.settings.preferredLanguages[0] || 'pt-BR']);
  } catch (error) { console.warn('Não foi possível configurar a verificação ortográfica:', error.message); }
  const advertisingHosts = new Set(['doubleclick.net','googlesyndication.com','googleadservices.com','adservice.google.com','adroll.com','taboola.com','outbrain.com']);
  const isThirdParty = details => {
    try {
      const initiator = details.initiatorOrigin || details.initiator;
      if (!initiator || initiator === 'null') return false;
      return new URL(initiator).hostname.toLowerCase() !== new URL(details.url).hostname.toLowerCase();
    } catch { return false; }
  };
  const matchesHost = (hostname, hostSet) => [...hostSet].some(host => hostname === host || hostname.endsWith(`.${host}`));
  ses.webRequest.onBeforeRequest({ urls: ['http://*/*','https://*/*'] }, (details, callback) => {
    let blocked = false;
    if (details.resourceType === 'mainFrame' && mode === 'normal' && /^http:/i.test(details.url)) {
      const webContentsId = details.webContentsId ?? details.webContents?.id;
      const tab = tabs.find(entry => entry.view?.webContents.id === webContentsId);
      const redirectURL = tab && tab.connectionMode === 'normal' ? httpsUpgrader.rewrite(details.url, store.settings.httpsMode) : null;
      if (redirectURL) return callback({ redirectURL });
    }
    try {
      const hostname = new URL(details.url).hostname.toLowerCase();
      const webContentsId = details.webContentsId ?? details.webContents?.id;
      const tab = tabs.find(entry => entry.view?.webContents.id === webContentsId);
      const requestMode = tab?.connectionMode || mode;
      const anonymousRoute = requestMode === 'tor' || requestMode === 'i2p';
      const sourceUrl = details.resourceType === 'mainFrame' ? details.url : (details.frame?.top?.url || details.webContents?.mainFrame?.url || details.initiatorOrigin || details.initiator || details.referrer || '');
      let exemptForSite = false;
      try { exemptForSite = store.settings.trackingExceptions.includes(new URL(sourceUrl).hostname.toLowerCase()); } catch {}
      const trackerBlocked = !exemptForSite && (anonymousRoute || store.settings.blockTrackers) && matchTrackerRequest(details);
      const adsBlocked = !exemptForSite && store.settings.blockAds && (matchFilterRequest(adEngine, details) || matchesHost(hostname, advertisingHosts));
      blocked = adsBlocked || trackerBlocked;
      if (blocked) {
        noteProtectionBlocked(adsBlocked, trackerBlocked);
        let site = '';
        try { site = new URL(sourceUrl).hostname.toLowerCase(); } catch {}
      if (site && (trackerList.bySite[site] || Object.keys(trackerList.bySite).length < 500)) {
          const counts = trackerList.bySite[site] || { blockedRequests:0, blockedAds:0, blockedTrackers:0 };
          counts.blockedRequests++;
          if (adsBlocked) counts.blockedAds++;
          if (trackerBlocked) counts.blockedTrackers++;
          trackerList.bySite[site] = counts;
        }
      }
    } catch {}
    callback(blocked ? { cancel: true } : {});
  });
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    const requestHeaders = { ...details.requestHeaders };
    if (store.settings.sendDoNotTrack) requestHeaders.DNT = '1';
    if (mode !== 'normal') requestHeaders['Accept-Language'] = 'en-US,en;q=0.5';
    else if (store.settings.preferredLanguages.length) requestHeaders['Accept-Language'] = store.settings.preferredLanguages.map((language, index) => `${language}${index ? `;q=${Math.max(0.1,1-index*0.1).toFixed(1)}` : ''}`).join(',');
    if ((mode !== 'normal' || store.settings.blockThirdPartyCookies) && isThirdParty(details)) for (const key of Object.keys(requestHeaders)) if (key.toLowerCase() === 'cookie') delete requestHeaders[key];
    callback({ requestHeaders });
  });
  ses.webRequest.onHeadersReceived((details, callback) => {
    if (!details.responseHeaders) return callback({});
    const responseHeaders = { ...(details.responseHeaders || {}) };
    if ((mode !== 'normal' || store.settings.blockThirdPartyCookies) && isThirdParty(details)) for (const key of Object.keys(responseHeaders)) if (['set-cookie','set-cookie2'].includes(key.toLowerCase())) delete responseHeaders[key];
    callback({ responseHeaders });
  });
  ses.setPermissionCheckHandler((wc, permission, origin) => {
    const tab = tabs.find(entry => entry.view?.webContents === wc);
    if (!tab || !sitePermissionTypes.has(permission)) return false;
    const rule = !tab.private && store.sitePermissions.find(entry => entry.origin === origin && entry.permission === permission);
    if (autoGrantedPermissions.has(permission)) return rule ? rule.allowed : true;
    if (tab.connectionMode !== 'normal') return false;
    return rule ? rule.allowed : grants.has(`${origin}:${permission}`);
  });
  ses.setPermissionRequestHandler(async (wc, permission, callback, details) => {
    if (!sitePermissionTypes.has(permission) || !tabs.some(t => t.view?.webContents === wc)) return callback(false);
    const tab = tabs.find(entry => entry.view?.webContents === wc);
    let origin;
    try { origin = new URL(details.requestingUrl || wc.getURL()).origin; } catch { return callback(false); }
    const savedRule = tab && !tab.private && store.sitePermissions.find(entry => entry.origin === origin && entry.permission === permission);
    if (autoGrantedPermissions.has(permission)) return callback(savedRule ? savedRule.allowed : true);
    if (tab.connectionMode !== 'normal') return callback(false);
    if (!/^https?:/.test(origin)) return callback(false);
    if (savedRule) return callback(savedRule.allowed);
    if (grants.has(`${origin}:${permission}`)) return callback(true);
    const names = { media: 'câmera ou microfone', geolocation: 'localização', notifications: 'notificações', fullscreen: 'tela cheia', 'clipboard-sanitized-write': 'copiar para a área de transferência', 'clipboard-read': 'ler o que você copiou (colar)' };
    const result = await dialog.showMessageBox(win, { type: 'question', title: 'Permissão do site', message: `${origin} quer acessar ${names[permission]}.`, buttons: ['Bloquear sempre','Permitir uma vez','Permitir sempre'], defaultId: 0, cancelId: 0 });
    if (wc.isDestroyed()) return callback(false);
    const ruleId = `${origin}|${permission}`;
    if (result.response === 0 && tab && !tab.private) {
      store.sitePermissions = store.sitePermissions.filter(entry => entry.id !== ruleId);
      store.sitePermissions.unshift({ id: ruleId, origin, permission, allowed: false, updated: Date.now() });
      persist(); emit();
    }
    if (result.response === 1) grants.add(`${origin}:${permission}`);
    if (result.response === 2 && tab && !tab.private) {
      store.sitePermissions = store.sitePermissions.filter(entry => entry.id !== ruleId);
      store.sitePermissions.unshift({ id: ruleId, origin, permission, allowed: true, updated: Date.now() });
      persist(); emit();
    }
    callback(result.response === 1 || result.response === 2);
  });
  ses.on('will-download', (_event, item, wc) => {
    const tab = tabs.find(t => t.view?.webContents === wc);
    const record = { id: randomUUID(), name: item.getFilename(), url: item.getURL(), total: item.getTotalBytes(), received: 0, state: 'progressing', date: Date.now(), path: '', private: tab?.private || false, connectionMode: tab?.connectionMode || 'normal' };
    if (store.settings.downloadDirectory) {
      try {
        const directory = path.resolve(store.settings.downloadDirectory);
        fs.mkdirSync(directory, { recursive: true });
        const parsed = path.parse(path.basename(item.getFilename()));
        let index = 0, destination;
        do {
          const suffix = index ? ` (${index})` : '';
          destination = path.join(directory, `${parsed.name}${suffix}${parsed.ext}`);
          index++;
        } while (fs.existsSync(destination) || reservedDownloadPaths.has(destination));
        item.setSavePath(destination); reservedDownloadPaths.add(destination);
      } catch (error) { console.error('Não foi possível usar a pasta de downloads escolhida:', error.message); }
    }
    store.downloads.unshift(record); downloadItems.set(record.id, item);
    item.on('updated', (_ev, state) => { record.received = item.getReceivedBytes(); record.total = item.getTotalBytes(); record.state = item.isPaused() ? 'paused' : state; emit(); });
    item.once('done', (_ev, state) => { record.state = state; record.path = item.getSavePath(); reservedDownloadPaths.delete(record.path); downloadItems.delete(record.id); persist(); emit(); });
    emit();
  });
}
function extensionManifest(directory) {
  const manifestPath = path.join(directory, 'manifest.json');
  const stats = fs.statSync(manifestPath);
  if (!stats.isFile() || stats.size > 512 * 1024) throw new Error('manifest.json ausente ou maior que 512 KB.');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!manifest || ![2,3].includes(manifest.manifest_version) || typeof manifest.name !== 'string' || typeof manifest.version !== 'string') throw new Error('O manifesto precisa ser uma extensão Manifest V2 ou V3 válida.');
  return manifest;
}
function extensionPermissionDetails(manifest) {
  const declared = [...new Set([...(Array.isArray(manifest.permissions) ? manifest.permissions : []), ...(Array.isArray(manifest.host_permissions) ? manifest.host_permissions : [])].filter(value => typeof value === 'string'))];
  if (!declared.length) return 'A extensão não declara permissões especiais no manifesto.';
  const shown = declared.slice(0,20);
  return `Acesso solicitado:\n${shown.map(value => `• ${value}`).join('\n')}${declared.length > shown.length ? `\n• e mais ${declared.length - shown.length}` : ''}`;
}
async function confirmExtensionInstall(manifest) {
  const name = /^__MSG_.*__$/.test(manifest.name) ? manifest.short_name || 'Extensão' : manifest.name;
  const result = await dialog.showMessageBox(win, {
    type:'warning', title:'Permissões da extensão', message:`Adicionar ${String(name).slice(0,128)} ao Cypher?`,
    detail:`Extensões são código de terceiros e podem ler ou alterar páginas de acordo com as permissões abaixo.\n\n${extensionPermissionDetails(manifest)}\n\nO Chromium integrado oferece compatibilidade parcial com as APIs do Chrome.`,
    buttons:['Cancelar','Adicionar extensão'], defaultId:0, cancelId:0,
  });
  return result.response === 1;
}
async function installExtension(directory, options = {}) {
  const extensionPath = path.resolve(directory);
  const manifest = extensionManifest(extensionPath);
  if (options.expectedId === protonExtensionId || manifest.name === 'Proton VPN: Fast & Secure') throw new Error('O Proton VPN já vem integrado ao Cypher e não precisa ser instalado como extensão separada.');
  if (store.extensions.some(extension => extension.path === extensionPath)) throw new Error('Esta pasta já foi adicionada ao Cypher.');
  if (store.extensions.length >= 100) throw new Error('O limite é de 100 extensões instaladas.');
  if (options.expectedId && store.extensions.some(extension => extension.id === options.expectedId)) throw new Error('Esta extensão já está instalada. Remova a versão existente antes de instalar novamente.');
  if (!(await confirmExtensionInstall(manifest))) return { cancelled:true };
  const loaded = await session.fromPartition(normalPartition()).extensions.loadExtension(extensionPath, { allowFileAccess: false });
  if (store.extensions.some(extension => extension.id === loaded.id)) {
    throw new Error('Uma extensão com este identificador já está instalada. Remova-a antes de adicionar outra versão.');
  }
  if (options.expectedId && loaded.id !== options.expectedId) {
    session.fromPartition(normalPartition()).extensions.removeExtension(loaded.id);
    throw new Error('O identificador instalado não corresponde à assinatura e ao link da Chrome Web Store.');
  }
  const name = /^__MSG_.*__$/.test(manifest.name) ? manifest.short_name || 'Extensão' : manifest.name;
  const extensionSource = ['chrome-web-store','cypher-package'].includes(options.source) ? options.source : 'local';
  store.extensions.unshift({ id: loaded.id, path: extensionPath, name: String(options.displayName || loaded.name || name).slice(0,128), version: String(options.displayVersion || loaded.version || manifest.version).slice(0,40), enabled: true, source:extensionSource, packageId:extensionSource === 'cypher-package' ? options.packageId : '', error: '' });
  persist(); emit();
  return snapshot().extensions;
}
function extensionIdFromStoreUrl(value) {
  let url;
  try { url = new URL(String(value || '').trim()); } catch { throw new Error('Cole o endereço de uma extensão da Chrome Web Store.'); }
  const allowedHosts = new Set(['chromewebstore.google.com','chrome.google.com']);
  if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname.toLowerCase())) throw new Error('Use um endereço HTTPS da Chrome Web Store.');
  const id = url.pathname.match(/\/detail\/[^/]+\/([a-p]{32})(?:\/|$)/i)?.[1] || '';
  if (!/^[a-p]{32}$/.test(id)) throw new Error('Este endereço não contém um identificador de extensão válido.');
  return id;
}
async function downloadChromeStoreCrx(extensionId) {
  const routeTab = { connectionMode:active()?.connectionMode || store.settings.connectionMode, private:false };
  const ses = session.fromPartition(sessionPartition(routeTab));
  setupSession(ses, routeTab.connectionMode); await prepareProxy(routeTab, ses);
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 45000);
  let address = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=${encodeURIComponent(process.versions.chrome)}&acceptformat=crx3&x=${encodeURIComponent(`id=${extensionId}&installsource=ondemand&uc`)}`;
  try {
    for (let redirects = 0; redirects <= 5; redirects++) {
      const response = await ses.fetch(address, { redirect:'manual', signal:controller.signal, headers:{ 'Accept':'application/octet-stream' } });
      if ([301,302,303,307,308].includes(response.status)) {
        const target = new URL(response.headers.get('location') || '', address);
        const host = target.hostname.toLowerCase();
        if (target.protocol !== 'https:' || !(host === 'clients2.google.com' || host === 'googleusercontent.com' || host.endsWith('.googleusercontent.com'))) throw new Error('A Chrome Web Store enviou o pacote de um domínio não reconhecido.');
        address = target.href; continue;
      }
      if (!response.ok) throw new Error(`A Chrome Web Store não disponibilizou o pacote da extensão (HTTP ${response.status}).`);
      const size = Number(response.headers.get('content-length') || 0);
      if (size > MAX_CRX_BYTES) throw new Error('O pacote da extensão ultrapassa o limite de 50 MB.');
      const chunks = []; let total = 0;
      if (!response.body) throw new Error('A Chrome Web Store retornou um pacote vazio.');
      for await (const chunk of response.body) {
        const bytes = Buffer.from(chunk); total += bytes.length;
        if (total > MAX_CRX_BYTES) { controller.abort(); throw new Error('O pacote da extensão ultrapassa o limite de 50 MB.'); }
        chunks.push(bytes);
      }
      return Buffer.concat(chunks, total);
    }
    throw new Error('A Chrome Web Store redirecionou o download muitas vezes.');
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('O download da extensão expirou. Confira a conexão e tente novamente.');
    throw error;
  } finally { clearTimeout(timeout); }
}
async function installChromeStoreExtension(value) {
  const extensionId = extensionIdFromStoreUrl(value);
  if (extensionId === protonExtensionId) throw new Error('O Proton VPN já vem integrado ao Cypher e não precisa ser instalado como extensão separada.');
  if (store.extensions.some(extension => extension.id === extensionId)) throw new Error('Esta extensão já está instalada.');
  const packageBytes = await downloadChromeStoreCrx(extensionId);
  const extensionsRoot = path.resolve(app.getPath('userData'), 'extensions');
  const extensionPath = path.resolve(extensionsRoot, extensionId);
  if (!extensionPath.startsWith(extensionsRoot + path.sep)) throw new Error('A pasta de instalação da extensão não é válida.');
  if (fs.existsSync(extensionPath)) throw new Error('Há arquivos antigos desta extensão no perfil. Remova a pasta local antes de instalar novamente.');
  try {
    await fs.promises.mkdir(extensionsRoot, { recursive:true });
    await unpackCrx(packageBytes, extensionId, extensionPath);
    const result = await installExtension(extensionPath, { expectedId:extensionId, source:'chrome-web-store' });
    if (result.cancelled) { await fs.promises.rm(extensionPath, { recursive:true, force:true }); return snapshot().extensions; }
    return result;
  } catch (error) {
    if (!store.extensions.some(extension => extension.id === extensionId)) await fs.promises.rm(extensionPath, { recursive:true, force:true }).catch(() => {});
    throw error;
  }
}
function cypherExtensionRoot() { return path.resolve(app.getPath('userData'), 'cypher-extension-packages'); }
function compareVersions(left, right) {
  const a = String(left).split(/[+-]/,1)[0].split('.').map(Number), b = String(right).split(/[+-]/,1)[0].split('.').map(Number);
  for (let index = 0; index < 3; index++) { const difference = (a[index] || 0) - (b[index] || 0); if (difference) return difference; }
  return 0;
}
async function installCypherExtensionPackage(packageFile) {
  if (!isCypherPackageFile(packageFile)) throw new Error('Escolha um arquivo .cypherext do Cypher.');
  const root = cypherExtensionRoot();
  await fs.promises.mkdir(root, { recursive:true });
  const stagePath = path.resolve(root, `.stage-${randomUUID()}`);
  let destination = '';
  try {
    const extracted = await extractCypherPackage(packageFile, stagePath);
    const { metadata } = extracted;
    if (metadata.minCypherVersion && compareVersions(app.getVersion(), metadata.minCypherVersion) < 0) throw new Error(`Esta extensão requer Cypher ${metadata.minCypherVersion} ou superior.`);
    if (store.extensions.some(extension => extension.packageId === metadata.id)) throw new Error(`Já existe uma extensão Cypher instalada com o ID “${metadata.id}”.`);
    if (store.extensions.length >= 100) throw new Error('O limite é de 100 extensões instaladas.');
    destination = path.resolve(root, metadata.id);
    if (!destination.startsWith(root + path.sep)) throw new Error('O ID do pacote não pode ser usado como pasta de instalação.');
    if (fs.existsSync(destination)) throw new Error('Já existe uma pasta para este pacote. Remova a pasta antiga antes de instalá-lo novamente.');
    await fs.promises.rename(stagePath, destination);
    const result = await installExtension(destination, { source:'cypher-package', packageId:metadata.id, displayName:metadata.name, displayVersion:metadata.version });
    if (result.cancelled) { await fs.promises.rm(destination, { recursive:true, force:true }); return snapshot().extensions; }
    return result;
  } catch (error) {
    await fs.promises.rm(stagePath, { recursive:true, force:true }).catch(() => {});
    if (destination && !store.extensions.some(extension => extension.path === destination)) await fs.promises.rm(destination, { recursive:true, force:true }).catch(() => {});
    throw error;
  }
}
async function installExternalCypherPackage(packageFile) {
  try { await installCypherExtensionPackage(packageFile); }
  catch (error) {
    if (win && !win.isDestroyed()) await dialog.showMessageBox(win, { type:'error', title:'Não foi possível instalar a extensão', message:'O pacote Cypher não pôde ser instalado.', detail:String(error?.message || error).slice(0,1000), buttons:['OK'] });
  }
}
function installStoreClickHandler(tab) {
  const wc = tab.view?.webContents;
  if (!wc || wc.isDestroyed()) return;
  let current;
  try { current = new URL(tab.url); } catch { return; }
  if (!['chromewebstore.google.com','chrome.google.com'].includes(current.hostname.toLowerCase())) return;
  const script = `(() => {
    if (window.__cypherWebStoreInstallBridge) return;
    window.__cypherWebStoreInstallBridge = true;
    let pending = false;
    document.addEventListener('click', event => {
      if (pending) return;
      const path = typeof event.composedPath === 'function' ? event.composedPath() : [event.target];
      const button = path.find(node => node instanceof Element && /^(BUTTON|A)$/.test(node.tagName));
      if (!button) return;
      const label = [button.innerText, button.getAttribute('aria-label'), button.getAttribute('title'), button.getAttribute('data-label')].filter(Boolean).join(' ').replace(/\\s+/g, ' ').trim();
      if (!/(?:^|\s)(?:add to chrome|adicionar ao chrome|install extension|instalar extens[aã]o|install|instalar)(?:\s|$)/i.test(label)) return;
      const id = location.pathname.match(/\\/detail\\/[^/]+\\/([a-p]{32})(?:\\/|$)/i)?.[1];
      if (!id) return;
      event.preventDefault(); event.stopImmediatePropagation(); pending = true;
      location.assign('cypher://install-extension/' + id);
    }, true);
  })()`;
  void wc.executeJavaScript(script, true).catch(() => {});
}
function handleStoreInstallNavigation(tab, event, targetUrl) {
  const match = String(targetUrl).match(/^cypher:\/\/install-extension\/([a-p]{32})\/?$/i);
  if (!match) return false;
  event.preventDefault();
  let host = '';
  try { host = new URL(tab.url).hostname.toLowerCase(); } catch {}
  if (!['chromewebstore.google.com','chrome.google.com'].includes(host)) return true;
  const url = `https://chromewebstore.google.com/detail/extensao/${match[1]}`;
  void installChromeStoreExtension(url).catch(async error => {
    console.error('Não foi possível instalar a extensão pela Chrome Web Store:', error.message);
    if (win && !win.isDestroyed()) await dialog.showMessageBox(win, { type:'error', title:'Instalação da extensão', message:'O Cypher não conseguiu instalar esta extensão.', detail:error.message, buttons:['OK'] });
  });
  return true;
}
async function loadStoredExtensions() {
  const ses = session.fromPartition(normalPartition());
  for (const extension of store.extensions) {
    if (!extension.enabled) continue;
    if (extension.id === protonExtensionId) { extension.error = 'Já incluída no Cypher'; continue; }
    try {
      const loaded = ses.extensions.getExtension(extension.id) || await ses.extensions.loadExtension(extension.path, { allowFileAccess: false });
      extension.id = loaded.id;
      extension.name = String(loaded.name || extension.name).slice(0,128);
      extension.version = String(loaded.version || extension.version).slice(0,40);
      extension.error = '';
    } catch (error) {
      extension.error = String(error?.message || error).slice(0,400);
    }
  }
  persist();
}
function attachView(tab) {
  const ses = session.fromPartition(sessionPartition(tab));
  setupSession(ses, tab.connectionMode);
  void prepareProxy(tab, ses).catch(error => showTabError(tab, 'route', { description: `Não foi possível configurar ${tab.connectionMode}: ${error.message}` }));
  const loginWatcher = !tab.private && tab.connectionMode === 'normal' ? { preload: path.join(__dirname, 'tab-preload.cjs') } : {};
  const view = new WebContentsView({ webPreferences: { session: ses, nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, allowRunningInsecureContent: false, ...loginWatcher } });
  tab.view = view;
  win.contentView.addChildView(view);
  const wc = view.webContents;
  if (tab.connectionMode !== 'normal') {
    const chromeMajor = String(process.versions.chrome || '').split('.')[0];
    const normalizedUserAgent = wc.getUserAgent()
      .replace(/\s+(?:Electron|Cypher)\/[^\s]+/gi, '')
      .replace(/Chrome\/[\d.]+/i, `Chrome/${chromeMajor}.0.0.0`);
    wc.setUserAgent(normalizedUserAgent);
  }
  wc.setZoomFactor(store.settings.defaultZoom);
  wc.setWebRTCIPHandlingPolicy(tab.connectionMode === 'normal' ? (protonProxyValue ? 'disable_non_proxied_udp' : store.settings.webrtcPolicy) : 'disable_non_proxied_udp');
  wc.setWindowOpenHandler(({ url, postBody }) => {
    let openerHost = '';
    try { openerHost = new URL(tab.url).hostname.toLowerCase(); } catch {}
    const exception = openerHost && store.settings.popupExceptions.includes(openerHost);
    const allowed = !store.settings.blockPopups || exception;
    const replayable = isReplayablePopup(url, postBody);
    if (!allowed || !replayable) {
      queueBlockedPopup(tab, url, { postBody });
    } else {
      const loadOptions = popupNavigationOptions(postBody);
      if (store.settings.openLinksInNewTab) addTab(url, tab.private, tab.connectionMode, true, loadOptions);
      else setImmediate(() => { if (tabs.includes(tab)) navigate(tab, url, loadOptions); });
    }
    return { action: 'deny' };
  });
  wc.on('will-navigate', (event, url) => { if (handleStoreInstallNavigation(tab, event, url)) return; if (!/^https?:\/\//.test(url)) event.preventDefault(); });
  wc.on('will-redirect', (event, url) => { if (handleStoreInstallNavigation(tab, event, url)) return; if (!/^https?:\/\//.test(url)) event.preventDefault(); });
  wc.on('did-start-loading', () => { tab.loading = true; tab.error = null; tab.errorInfo = null; tab.mediaPlaying = false; tab.mediaInfo = null; tab.mediaArtworkSource = ''; if (nowPlayingTabId === tab.id) nowPlayingTabId = null; update(tab); layout(); });
  wc.on('did-stop-loading', () => update(tab));
  wc.on('dom-ready', () => { if (store.settings.blockCookieBanners) void wc.insertCSS(cookieBannerCss).catch(() => {}); tab.modCssKey = ''; void applyPageMods(tab); });
  wc.on('focus', () => { if (split && [split.left, split.right].includes(tab.id) && activeId !== tab.id) { activeId = tab.id; emit(); } });
  wc.on('page-title-updated', (_event, title) => { tab.title = title; if (/^https?:\/\//i.test(tab.url)) tab.lastExternalTitle = title; update(tab); if (tab.mediaInfo) refreshMediaInfo(tab, tab.mediaPlaying); });
  wc.on('did-navigate', (_event, url) => {
    tab.url = url; tab.error = null; tab.errorInfo = null;
    tab.certificateWarning = /^https:/i.test(url) && certificateExceptions.has(hostOf(url));
    httpsUpgrader.succeeded(url);
    if (loginCandidates.has(tab.id)) void maybeOfferPassword(tab, true);
    tab.lastActiveAt = Date.now();
    tab.lastExternalUrl = url; tab.lastExternalTitle = wc.getTitle() || url;
    if (!tab.private && tab.connectionMode === 'normal') {
      store.history.unshift({ id: randomUUID(), url, title: wc.getTitle() || url, date: Date.now() });
      store.history = store.history.slice(0,1000); persist();
    }
    layout(); update(tab);
  });
  wc.on('did-navigate-in-page', (_event, url, mainFrame) => { if (mainFrame) { tab.url = url; update(tab); if (loginCandidates.has(tab.id)) void maybeOfferPassword(tab, true); installStoreClickHandler(tab); maybeAutofillPassword(tab); } });
  wc.on('did-finish-load', () => {
    installStoreClickHandler(tab);
    maybeAutofillPassword(tab);
    if (tab.mediaPlaying) refreshMediaInfo(tab, true);
    if (!tab.private && tab.connectionMode === 'normal') { const entry = store.history.find(h => h.url === tab.url); if (entry) { entry.title = wc.getTitle(); persist(); } }
    update(tab);
  });
  wc.on('did-fail-load', (_event, code, description, failedUrl, mainFrame) => {
    if (!mainFrame || code === -3) return;
    const fallback = httpsUpgrader.failed(failedUrl, code);
    if (fallback && store.settings.httpsMode !== 'strict') { httpsUpgrader.allowHttp(hostOf(fallback)); void wc.loadURL(fallback).catch(() => {}); return; }
    if (/^https?:\/\//i.test(failedUrl)) tab.url = fallback || failedUrl;
    showTabError(tab, fallback ? 'https' : classifyLoadError(code), { code, url: fallback || failedUrl, description });
  });
  wc.on('render-process-gone', () => showTabError(tab, 'crashed', { url: tab.url, description: 'A página foi encerrada. Recarregue para continuar.' }));
  wc.on('media-started-playing', () => { tab.mediaPlaying = true; nowPlayingTabId = tab.id; refreshMediaInfo(tab, true); update(tab); });
  wc.on('media-paused', () => setTimeout(() => refreshMediaInfo(tab, false), 180));
  wc.on('audio-state-changed', (_event, audible) => { tab.audible = !!audible; if (audible) { tab.mediaPlaying = true; nowPlayingTabId = tab.id; } setTimeout(() => refreshMediaInfo(tab, !!audible), 120); update(tab); });
  wc.on('will-prevent-unload', async () => {
    const result = await dialog.showMessageBox(win, { type: 'question', message: 'Esta página pode ter alterações não salvas. Sair mesmo assim?', buttons: ['Ficar na página','Sair'], defaultId: 0, cancelId: 0 });
    if (result.response === 1) { wc.removeAllListeners('will-prevent-unload'); wc.close(); }
  });
  wc.on('enter-html-full-screen', () => { if (windowAlive()) win.setFullScreen(true); shortcut('page-fullscreen'); });
  wc.on('leave-html-full-screen', () => { if (windowAlive()) win.setFullScreen(false); shortcut('leave-fullscreen'); });
  wc.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'Escape') { shortcut('escape'); return; }
    if ((input.control || input.meta) && input.key.toLowerCase() === 'l') { event.preventDefault(); shortcut('address'); }
  });
  wc.on('found-in-page', (_event, result) => {
    if (tab.id === activeId && result.finalUpdate && windowAlive()) win.webContents.send('cypher:find-result', { matches: result.matches, active: result.activeMatchOrdinal });
  });
  wc.on('context-menu', (_event, params) => {
    const template = [];
    if (store.settings.translationEnabled && tab.connectionMode === 'normal' && /^https?:\/\//.test(tab.url)) template.push({ label: 'Traduzir esta página', click: () => { void command('page:translate').catch(error => console.error('Não foi possível abrir a tradução:', error.message)); } }, { type: 'separator' });
    if (/^https?:\/\//.test(params.linkURL)) template.push({ label: 'Abrir link em nova aba', click: () => addTab(params.linkURL, tab.private, tab.connectionMode) }, { label: 'Copiar endereço do link', click: () => void clipboard.writeText(params.linkURL) }, { type: 'separator' });
    if (params.isEditable) template.push(...editMenuItems(params), { type: 'separator' });
    else if (params.selectionText) template.push({ role: 'copy', label: 'Copiar' }, { label: 'Pesquisar seleção', click: () => addTab(resolveAddress(params.selectionText, store.settings.searchEngine, store.settings.customSearchUrl), tab.private, tab.connectionMode) }, { type: 'separator' });
    template.push({ label: 'Voltar', enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() }, { label: 'Avançar', enabled: wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() }, { label: 'Recarregar', click: () => wc.reload() }, { type: 'separator' }, { label: 'Salvar página…', click: () => savePage(tab) }, { label: 'Imprimir…', click: () => wc.print({}) }, { label: 'Inspecionar elemento', click: () => wc.inspectElement(params.x, params.y) });
    Menu.buildFromTemplate(template).popup({ window: win });
  });
  wc.once('destroyed', () => {
    if (win && !win.isDestroyed()) win.contentView.removeChildView(view);
    if (tab.suspending) { tab.suspending = false; return; }
    if (tab.view === view) removeTab(tab);
  });
  return view;
}
function hostOf(url) { try { return new URL(url).hostname.toLowerCase(); } catch { return ''; } }
/** Tela de erro da aba: `error` continua sendo o texto técnico; `errorInfo` diz qual tela mostrar. */
function showTabError(tab, kind, { code = 0, url = tab.url, description = '' } = {}) {
  tab.error = description ? `${description}${code ? ` (${code})` : ''}` : errorName(code);
  tab.errorInfo = { kind, code, name: code ? errorName(code) : '', host: hostOf(url), url };
  tab.loading = false; layout(); emit();
}
function navigate(tab, input, navigationOptions) {
  const url = resolveAddress(input, store.settings.searchEngine, store.settings.customSearchUrl);
  if (url.startsWith('cypher://') && /^https?:\/\//i.test(tab.url)) { tab.lastExternalUrl = tab.url; tab.lastExternalTitle = tab.title; }
  else if (/^https?:\/\//i.test(url)) { tab.lastExternalUrl = url; tab.lastExternalTitle = tab.title; }
  const hostname = new URL(url).hostname.toLowerCase();
  if (hostname.endsWith('.onion') && tab.connectionMode !== 'tor') {
    tab.url = url; showTabError(tab, 'route', { url, description: 'Endereços .onion só podem ser abertos com a rede Tor ativa.' }); return;
  }
  if (hostname.endsWith('.i2p') && tab.connectionMode !== 'i2p') {
    tab.url = url; showTabError(tab, 'route', { url, description: 'Endereços .i2p só podem ser abertos com a rede I2P ativa.' }); return;
  }
  const routeRule = !tab.private && tab.connectionMode === 'normal' && !url.startsWith('cypher://') && store.settings.routeRules.find(rule => hostname === rule.host || hostname.endsWith(`.${rule.host}`));
  if (routeRule) {
    const blank = !tab.view && tab.url === 'cypher://newtab';
    addTab(url, false, routeRule.mode);
    if (blank && tabs.length > 1) closeTab(tab.id);
    return;
  }
  tab.url = url; tab.error = null; tab.errorInfo = null;
  if (url.startsWith('cypher://')) {
    tab.loading = false; tab.title = ({ newtab: 'Nova aba', settings: 'Configurações', security: 'Segurança', profile: 'Perfil', extensions: 'Extensões', bookmarks: 'Favoritos', history: 'Histórico', downloads: 'Downloads', mods: 'Mods', productivity:'Espaços e pesquisa' })[url.slice(9)];
    tab.view?.webContents.stop(); layout(); emit(); return;
  }
  const view = tab.view || attachView(tab);
  tab.title = new URL(url).hostname; tab.loading = true;
  bumpStat(tab.connectionMode);
  const ses = view.webContents.session;
  const routeReady = tab.connectionMode === 'normal'
    ? Promise.resolve()
    : privacyServices.start(tab.connectionMode, connectionPort(tab.connectionMode));
  void routeReady.then(() => proxyReady.get(ses) || Promise.resolve()).then(() => navigationOptions ? view.webContents.loadURL(url, navigationOptions) : view.webContents.loadURL(url)).catch(error => {
    // Falha de carregamento (código de rede): a tela certa já veio do did-fail-load.
    if (Number.isFinite(error?.errno) && error.errno < 0) return;
    showTabError(tab, 'route', { url, description: `Não foi possível iniciar a conexão ${tab.connectionMode}: ${error.message}` });
  });
  layout(); emit();
}
function applyConnectionMode(mode) {
  store.settings.connectionMode = mode;
  for (const tab of [...tabs]) {
    const address = tab.url;
    tab.connectionMode = mode;
    tab.error = null; tab.errorInfo = null;
    if (tab.view && !tab.view.webContents.isDestroyed()) {
      const previousView = tab.view;
      if (win && !win.isDestroyed()) win.contentView.removeChildView(previousView);
      tab.view = null;
      previousView.webContents.destroy();
    }
    if (/^https?:\/\//i.test(address)) {
      tab.loading = true;
      attachView(tab);
      navigate(tab, address);
    } else {
      tab.loading = false;
    }
  }
  persist(); layout(); emit();
}
async function savePage(tab) {
  if (!tab?.view) return;
  const result = await dialog.showSaveDialog(win, { title: 'Salvar página', defaultPath: path.join(app.getPath('downloads'), 'pagina.html'), filters: [{ name: 'Página HTML', extensions: ['html'] }] });
  if (!result.canceled) await tab.view.webContents.savePage(result.filePath, 'HTMLComplete');
}
async function clearSiteData() {
  const sessions = new Set([
    session.fromPartition(normalPartition()),
    session.fromPartition(`cypher-${activeProfileId}-tor-${store.settings.torSocksPort}`),
    session.fromPartition(`cypher-${activeProfileId}-i2p-${store.settings.i2pHttpPort}`),
    ...tabs.map(tab => tab.view?.webContents.session).filter(Boolean),
  ]);
  await Promise.all([...sessions].map(async ses => {
    await ses.clearStorageData();
    await ses.clearCache();
  }));
}
function setSettings(payload) {
  const previous = store.settings;
  const previousShortcuts = JSON.stringify(previous.shortcuts || {});
  store.settings = sanitizeSettings(payload, store.settings); store.settings.activeMod = '';
  if (previous.sendErrorReports !== store.settings.sendErrorReports) syncInstallerConsent(store.settings.sendErrorReports);
  if (previous.updateChannel !== store.settings.updateChannel) updater?.setChannel(store.settings.updateChannel);
  if (store.settings.wallpaperVideoPath && !safeWallpaperFile(store.settings.wallpaperVideoPath)) {
    store.settings.wallpaperVideoPath = previous.wallpaperVideoPath || '';
    store.settings.wallpaperVideoName = previous.wallpaperVideoName || '';
  }
  if (previous.wallpaperVideoPath && previous.wallpaperVideoPath !== store.settings.wallpaperVideoPath) {
    const oldVideo = safeWallpaperFile(previous.wallpaperVideoPath);
    if (oldVideo) void fs.promises.rm(oldVideo, { force: true }).catch(() => {});
  }
  if (previous.startWithWindows !== store.settings.startWithWindows && process.platform === 'win32') {
    try {
      app.setLoginItemSettings({ openAtLogin: store.settings.startWithWindows, path: process.execPath, args: app.isPackaged ? [] : [app.getAppPath()] });
    } catch (error) { console.error('Não foi possível atualizar a inicialização com o Windows:', error.message); }
  }
  for (const ses of configuredSessions) {
    try {
      ses.setSpellCheckerEnabled(store.settings.spellCheckEnabled);
      ses.setSpellCheckerLanguages(store.settings.spellCheckLanguages.length ? store.settings.spellCheckLanguages : [store.settings.preferredLanguages[0] || 'pt-BR']);
    } catch (error) { console.warn('Não foi possível atualizar a verificação ortográfica:', error.message); }
  }
  for (const tab of tabs) if (tab.connectionMode === 'normal') {
    try { tab.view?.webContents.setWebRTCIPHandlingPolicy(store.settings.webrtcPolicy); } catch {}
  }
  const focusWidgets = store.settings.home.widgets.filter(widget => widget.type === 'focus');
  const validIds = new Set(focusWidgets.map(widget => widget.id));
  for (const id of Object.keys(store.homeData.focusById)) if (!validIds.has(id)) delete store.homeData.focusById[id];
  for (const widget of focusWidgets) {
    const duration = (widget.focusMinutes || 25) * 60;
    const timer = store.homeData.focusById[widget.id];
    if (!timer) store.homeData.focusById[widget.id] = { endsAt:null,remaining:duration,duration };
    else if (!timer.endsAt && timer.duration !== duration) store.homeData.focusById[widget.id] = { endsAt:null,remaining:duration,duration };
  }
  const taskWidgets = store.settings.home.widgets.filter(widget => widget.type === 'tasks');
  const taskIds = new Set(taskWidgets.map(widget => widget.id));
  for (const id of Object.keys(store.homeData.tasksById)) if (!taskIds.has(id)) delete store.homeData.tasksById[id];
  for (const widget of taskWidgets) if (!store.homeData.tasksById[widget.id]) store.homeData.tasksById[widget.id] = [];
  for (const id of [...panelViews.keys()]) if (!store.settings.webPanels.some(panel => panel.id === id)) { const view = panelViews.get(id); if (win && !win.isDestroyed()) win.contentView.removeChildView(view); if (!view.webContents.isDestroyed()) view.webContents.close(); panelViews.delete(id); if (openPanelId === id) openPanelId = ''; }
  if (JSON.stringify(store.settings.shortcuts) !== previousShortcuts) installMenu();
  applyNativeTheme();
  if (previous.modPageEffects !== store.settings.modPageEffects) refreshPageMods();
  layout(); persist(); emit();
}
async function command(action, payload) {
  const tab = active(), wc = tab?.view?.webContents;
  // Versão fora de circulação: só a interface, configurações e a própria atualização continuam.
  if (updateBlocked() && blockedActions.has(action) && !(action === 'navigate' && /^cypher:\/\//i.test(String(payload || '')))) throw new Error('Esta versão do Cypher saiu de circulação. Atualize para continuar navegando.');
  switch (action) {
    case 'state': return snapshot();
    case 'password:list': return passwordVaultSnapshot();
    case 'password:never:list': return store.passwordNever;
    case 'password:never:remove': store.passwordNever = store.passwordNever.filter(origin => origin !== payload); persist(); return store.passwordNever;
    case 'password:prompt:save': {
      if (!passwordPrompt || payload?.id !== passwordPrompt.id) throw new Error('Este pedido para salvar a senha expirou.');
      const username = typeof payload?.username === 'string' ? payload.username.trim().slice(0,256) : passwordPrompt.username;
      if (!username) throw new Error('Informe o usuário ou e-mail desta conta.');
      savePasswordEntry(passwordPrompt.origin, username, passwordPrompt.passwordEncrypted);
      clearPasswordPrompt(); persist(); return true;
    }
    case 'password:prompt:never': {
      if (passwordPrompt && payload?.id === passwordPrompt.id) { store.passwordNever = [passwordPrompt.origin, ...store.passwordNever.filter(origin => origin !== passwordPrompt.origin)].slice(0,500); persist(); }
      clearPasswordPrompt(); return true;
    }
    case 'password:prompt:dismiss': if (passwordPrompt && payload?.id === passwordPrompt.id) clearPasswordPrompt(); return true;
    case 'password:check': return checkPasswordLeaks();
    case 'password:import': {
      const result = await dialog.showOpenDialog(win, { title: 'Importar senhas (CSV)', properties: ['openFile'], filters: [{ name: 'Senhas exportadas', extensions: ['csv'] }] });
      if (result.canceled || !result.filePaths[0]) return null;
      if (fs.statSync(result.filePaths[0]).size > 10 * 1024 * 1024) throw new Error('O arquivo de senhas é grande demais (máximo de 10 MB).');
      const parsed = passwordsFromCsv(fs.readFileSync(result.filePaths[0], 'utf8'));
      if (parsed.error) throw new Error(parsed.error);
      let added = 0, updated = 0, unchanged = 0;
      for (const entry of parsed.entries) {
        const existing = store.passwords.find(item => item.origin === entry.origin && item.username === entry.username);
        if (existing) { try { if (decryptPassword(existing) === entry.password) { unchanged++; continue; } } catch {} }
        if (savePasswordEntry(entry.origin, entry.username, encryptPassword(entry.password)) === 'added') added++; else updated++;
      }
      persist(); emit();
      return { added, updated, unchanged, skipped: parsed.skipped };
    }
    case 'import:detect': return browserImport.detectBrowsers().map(browser => ({ id: browser.id, name: browser.name, profiles: browser.profiles.map(profile => ({ id: profile.id, name: profile.name })) }));
    case 'import:run': {
      const browser = browserImport.detectBrowsers().find(item => item.id === payload?.browser);
      const profile = browser?.profiles.find(item => item.id === payload?.profile);
      if (!browser || !profile) throw new Error('Não encontramos esse perfil. Ele pode ter sido removido.');
      const wanted = { bookmarks: payload?.bookmarks !== false, history: payload?.history !== false };
      if (!wanted.bookmarks && !wanted.history) throw new Error('Escolha o que importar.');
      const data = browserImport.readProfile(browser, profile, wanted);
      const merged = browserImport.mergeImport({ bookmarks: store.bookmarks, history: store.history }, data, randomUUID);
      store.bookmarks = merged.bookmarks; store.history = merged.history;
      persist(); emit();
      return { bookmarks: merged.addedBookmarks, history: merged.addedHistory, found: { bookmarks: data.bookmarks.length, history: data.history.length } };
    }
    case 'security:proceed': {
      const target = tabs.find(item => item.id === payload?.tabId) || tab;
      const info = target?.errorInfo;
      if (!info?.host || !['certificate','https'].includes(info.kind)) break;
      if (info.kind === 'certificate') certificateExceptions.add(info.host);
      else httpsUpgrader.allowHttp(info.host);
      navigate(target, info.url);
      return true;
    }
    case 'security:back': {
      const target = tabs.find(item => item.id === payload?.tabId) || tab;
      if (!target) break;
      const history = target.view?.webContents.navigationHistory;
      if (history?.canGoBack()) { target.error = null; target.errorInfo = null; history.goBack(); layout(); emit(); }
      else navigate(target, 'cypher://newtab');
      return true;
    }
    case 'password:generate': return generatePassword(payload?.length);
    case 'clipboard:write': {
      if (typeof payload !== 'string' || payload.length > 8192) throw new Error('Texto inválido para a área de transferência.');
      await clipboard.writeText(payload); return true;
    }
    case 'password:save': {
      const origin = normalizePasswordOrigin(payload?.origin);
      const username = typeof payload?.username === 'string' ? payload.username.trim().slice(0,256) : '';
      if (!origin) throw new Error('O cofre aceita endereços HTTPS. HTTP só é aceito para localhost.');
      if (!username) throw new Error('Informe o nome de usuário ou e-mail.');
      savePasswordEntry(origin, username, encryptPassword(payload?.password));
      persist(); emit();
      if (store.settings.passwordAutofillEnabled) for (const candidate of tabs) maybeAutofillPassword(candidate);
      return true;
    }
    case 'password:delete': {
      if (typeof payload !== 'string') break;
      store.passwords = store.passwords.filter(entry => entry.id !== payload);
      persist(); emit(); return passwordVaultSnapshot();
    }
    case 'password:fill': {
      const entry = store.passwords.find(item => item.id === payload?.id);
      const target = tabs.find(item => item.id === payload?.tabId);
      if (!entry || !target) throw new Error('O login ou a aba selecionada não está mais disponível.');
      const filled = await fillSavedPassword(target, entry);
      if (!filled) throw new Error('Não encontramos um formulário de login vazio e seguro nesta página.');
      return true;
    }
    case 'workspace:list': return store.workspaces;
    case 'workspace:create': {
      const name = String(payload?.name || '').trim().slice(0,48);
      if (!name) throw new Error('Dê um nome ao espaço.');
      if (store.workspaces.length >= 30) throw new Error('O Cypher permite até 30 espaços por perfil.');
      captureWorkspaceTabs();
      const created = { id:randomUUID(), name, color:/^#[\da-f]{6}$/i.test(payload?.color) ? payload.color : '#78d9ee', tabs:[] };
      store.workspaces.push(created); persist(); emit(); return created;
    }
    case 'workspace:rename': {
      const target = store.workspaces.find(item => item.id === payload?.id);
      const name = String(payload?.name || '').trim().slice(0,48);
      if (!target || !name) throw new Error('Não foi possível renomear este espaço.');
      target.name = name; persist(); emit(); return target;
    }
    case 'workspace:delete': {
      const target = store.workspaces.find(item => item.id === payload);
      if (!target || store.workspaces.length <= 1) throw new Error('O último espaço do perfil não pode ser removido.');
      const destination = store.workspaces.find(item => item.id !== target.id);
      if (target.id === store.activeWorkspaceId) captureWorkspaceTabs(target.id);
      if (destination) destination.tabs = [...destination.tabs, ...target.tabs].slice(0,100);
      for (const candidate of tabs) if (candidate.workspaceId === target.id) candidate.workspaceId = destination?.id;
      store.workspaces = store.workspaces.filter(item => item.id !== target.id);
      if (store.activeWorkspaceId === target.id) store.activeWorkspaceId = destination.id;
      persist(); layout(); emit(); return store.workspaces;
    }
    case 'workspace:switch': return switchWorkspace(payload);
    case 'research:add': {
      if (!tab || tab.private || tab.connectionMode !== 'normal') throw new Error('Salve páginas de pesquisa apenas em abas normais.');
      let url; try { url = new URL(String(payload?.url || tab.url)); } catch { throw new Error('Endereço da página inválido.'); }
      if (!['http:','https:'].includes(url.protocol)) throw new Error('A fila de pesquisa aceita apenas páginas HTTP e HTTPS.');
      const existing = store.researchItems.find(item => item.url === url.href);
      if (existing) return existing;
      const item = { id:randomUUID(), url:url.href, title:String(payload?.title || tab.title || url.hostname).slice(0,180), note:'', tags:[], savedAt:Date.now(), read:false };
      store.researchItems.unshift(item); store.researchItems = store.researchItems.slice(0,1000); persist(); emit(); return item;
    }
    case 'research:update': {
      const item = store.researchItems.find(entry => entry.id === payload?.id);
      if (!item) break;
      if (typeof payload.note === 'string') item.note = payload.note.slice(0,5000);
      if (typeof payload.read === 'boolean') item.read = payload.read;
      if (Array.isArray(payload.tags)) item.tags = [...new Set(payload.tags.filter(tag => typeof tag === 'string').map(tag => tag.trim().slice(0,32)).filter(Boolean))].slice(0,8);
      persist(); emit(); return item;
    }
    case 'research:remove': store.researchItems = store.researchItems.filter(item => item.id !== payload); persist(); emit(); break;
    case 'tabs:organize': {
      const assignments = Array.isArray(payload) ? payload.slice(0,200) : [];
      for (const assignment of assignments) {
        const target = tabs.find(item => item.id === assignment?.id && !item.private && item.connectionMode === 'normal');
        if (target) target.group = String(assignment.group || '').trim().slice(0,50);
      }
      persist(); emit(); return tabs.map(({ id, title, url, group }) => ({ id, title, url, group }));
    }
    case 'tabs:suggest-groups': {
      const groups = new Map();
      for (const entry of tabs) {
        if (entry.private || entry.connectionMode !== 'normal') continue;
        let group = 'Página inicial';
        try { group = new URL(entry.url).hostname.replace(/^www\./,'') || entry.title; } catch {}
        if (!groups.has(group)) groups.set(group, []);
        groups.get(group).push({ id:entry.id, title:entry.title, url:entry.url });
      }
      return [...groups].map(([name, items]) => ({ name, items }));
    }
    case 'profile:list': return profileSnapshot();
    case 'profile:create': return createProfile(payload?.name);
    case 'profile:switch': return switchProfile(payload);
    case 'extension:install': {
      const result = await dialog.showOpenDialog(win, { title: 'Selecionar extensão descompactada', properties: ['openDirectory'] });
      if (result.canceled || !result.filePaths[0]) break;
      return installExtension(result.filePaths[0]);
    }
    case 'extension:install-cypher': {
      const result = await dialog.showOpenDialog(win, { title:'Instalar pacote de extensão Cypher', properties:['openFile'], filters:[{ name:'Pacote de extensão Cypher', extensions:['cypherext'] }] });
      if (result.canceled || !result.filePaths[0]) break;
      return installCypherExtensionPackage(result.filePaths[0]);
    }
    case 'extension:install-webstore': return installChromeStoreExtension(payload);
    case 'extension:toggle': {
      const extension = store.extensions.find(entry => entry.id === payload?.id);
      if (!extension || typeof payload?.enabled !== 'boolean') break;
      const ses = session.fromPartition(normalPartition());
      if (payload.enabled) {
        const loaded = await ses.extensions.loadExtension(extension.path, { allowFileAccess: false });
        extension.name = String(loaded.name || extension.name).slice(0,128);
        extension.version = String(loaded.version || extension.version).slice(0,40);
        extension.error = '';
      } else {
        if (ses.extensions.getExtension(extension.id)) ses.extensions.removeExtension(extension.id);
      }
      extension.enabled = payload.enabled; persist(); emit(); break;
    }
    case 'extension:remove': {
      const extension = store.extensions.find(entry => entry.id === payload);
      if (!extension) break;
      const result = await dialog.showMessageBox(win, { type: 'question', title: 'Remover extensão', message: `Remover ${extension.name} do Cypher?`, detail: 'A pasta original não será apagada.', buttons: ['Cancelar','Remover'], defaultId: 0, cancelId: 0 });
      if (result.response !== 1) break;
      const ses = session.fromPartition(normalPartition());
      if (ses.extensions.getExtension(extension.id)) ses.extensions.removeExtension(extension.id);
      store.extensions = store.extensions.filter(entry => entry.id !== extension.id);
      if (extension.source === 'chrome-web-store') {
        const root = path.resolve(app.getPath('userData'), 'extensions'), target = path.resolve(extension.path);
        if (target.startsWith(root + path.sep)) await fs.promises.rm(target, { recursive:true, force:true });
      } else if (extension.source === 'cypher-package' && extension.packageId && /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(extension.packageId)) {
        const root = cypherExtensionRoot(), target = path.resolve(extension.path), expected = path.resolve(root, extension.packageId);
        if (target.toLowerCase() === expected.toLowerCase() && target.startsWith(root + path.sep)) await fs.promises.rm(target, { recursive:true, force:true });
      }
      persist(); emit(); break;
    }
    case 'site-permission:remove': {
      store.sitePermissions = store.sitePermissions.filter(entry => entry.id !== payload);
      persist(); emit(); break;
    }
    case 'site-data:clear': {
      const candidate = tab?.url?.startsWith('cypher://') ? tab.lastExternalUrl : tab?.url;
      let origin = '';
      try { const url = new URL(String(payload?.origin || '')); if (!['http:','https:'].includes(url.protocol) || url.username || url.password) throw new Error(); origin = url.origin; } catch { throw new Error('Origem do site inválida.'); }
      let currentOrigin = ''; try { currentOrigin = new URL(candidate).origin; } catch {}
      if (!tab || tab.private || tab.connectionMode !== 'normal' || origin !== currentOrigin) throw new Error('A limpeza só pode ser feita para a página normal atualmente selecionada.');
      await session.fromPartition(sessionPartition(tab)).clearStorageData({ origin });
      store.sitePermissions = store.sitePermissions.filter(entry => entry.origin !== origin);
      const hostname = new URL(origin).hostname.toLowerCase();
      store.settings.trackingExceptions = store.settings.trackingExceptions.filter(entry => entry !== hostname);
      store.settings.popupExceptions = store.settings.popupExceptions.filter(entry => entry !== hostname);
      persist(); emit(); return true;
    }
    case 'site-permission:clear': store.sitePermissions = []; persist(); emit(); break;
    case 'popup:action': {
      const request = popupRequests.find(item => item.id === payload?.id);
      const action = payload?.action;
      if (!request || !['dismiss','open-background','open-current','allow-site'].includes(action)) break;
      if (action === 'dismiss') { removePopupRequest(request.id); emit(); break; }
      if (action === 'allow-site') {
        if (request.private || request.connectionMode !== 'normal') throw new Error('Por privacidade, pop-ups de sessões privadas, Tor e I2P não podem criar exceções salvas.');
        if (!request.openerHost) throw new Error('Não foi possível identificar o site que abriu este pop-up.');
        setSettings({ popupExceptions: [...store.settings.popupExceptions, request.openerHost] });
      }
      if (!request.canOpen) {
        if (action === 'allow-site') { removePopupRequest(request.id); emit(); break; }
        throw new Error('Este pop-up não pode ser reaberto com segurança. A solicitação original não é um link HTTP ou HTTPS simples.');
      }
      const opener = tabs.find(item => item.id === request.tabId);
      if (action === 'open-current') {
        if (opener) { selectTab(opener.id); navigate(opener, request.url); }
        else addTab(request.url, request.private, request.connectionMode);
      } else addTab(request.url, request.private, request.connectionMode, false);
      removePopupRequest(request.id); emit(); break;
    }
    case 'popup:clear': popupRequests.length = 0; emit(); break;
    case 'tab:new': return addTab(payload?.url, payload?.private, payload?.connectionMode, true, undefined, { containerId: payload?.containerId });
    case 'tab:select': selectTab(payload); break;
    case 'tab:close': closeTab(payload); break;
    case 'tab:restore': { const previous = closedTabs.pop(); if (previous) addTab(previous.url, false, previous.connectionMode); break; }
    case 'tab:duplicate': { const target = tabs.find(t => t.id === payload); if (target) return addTab(target.url, target.private, target.connectionMode, true, undefined, { containerId: target.containerId }); break; }
    case 'modpkg:catalog': return modCatalog();
    case 'modpkg:install-builtin': {
      const builtin = builtinMods.get(payload);
      if (!builtin) throw new Error('Mod embutido não encontrado.');
      const existing = modRecord(builtin.manifest.id);
      if (existing) { setModEnabled(existing, true); persist(); refreshPageMods(); emit(); return existing.id; }
      await installModFolder(builtin.root, 'builtin'); persist(); refreshPageMods(); emit(); return builtin.manifest.id;
    }
    case 'modpkg:install-catalog': {
      const base = modCatalogBase();
      const catalog = await modCatalog();
      const entry = catalog.mods.find(item => item.id === payload && item.source === 'catalog');
      if (!base || !entry) throw new Error('Este mod não está no catálogo verificado.');
      const buffer = await fetchLimited(base.url + entry.package, 60 * 1024 * 1024);
      if (modPackage.sha512(buffer) !== entry.sha512) throw new Error('O pacote baixado não corresponde ao catálogo assinado.');
      const temp = path.join(app.getPath('temp'), `cypher-mod-${randomUUID()}.cyphermod`);
      await fs.promises.writeFile(temp, buffer);
      try { return await installModPackageFile(temp, 'catalog'); } finally { await fs.promises.rm(temp, { force: true }); }
    }
    case 'modpkg:import': {
      const result = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Mod do Cypher', extensions: ['cyphermod'] }] });
      if (result.canceled || !result.filePaths[0]) return null;
      return installModPackageFile(result.filePaths[0], 'file');
    }
    case 'modpkg:toggle': {
      const record = modRecord(payload?.id);
      if (!record) break;
      setModEnabled(record, payload.enabled === true); persist(); refreshPageMods(); emit(); break;
    }
    case 'modpkg:component': {
      const record = modRecord(payload?.id);
      if (!record || !modComponents.includes(payload.component)) break;
      const enabled = payload.enabled === true;
      if (payload.component === 'theme' && record.enabled && record.toggles.theme !== enabled) { if (enabled) applyModTheme(record); else restoreModTheme(record); }
      record.toggles[payload.component] = enabled; persist(); refreshPageMods(); emit(); break;
    }
    case 'modpkg:move': {
      const index = store.modPackages.findIndex(item => item.id === payload?.id);
      const target = index + (payload?.direction === 'up' ? 1 : -1);
      if (index < 0 || target < 0 || target >= store.modPackages.length) break;
      [store.modPackages[index], store.modPackages[target]] = [store.modPackages[target], store.modPackages[index]];
      persist(); refreshPageMods(); emit(); break;
    }
    case 'modpkg:remove': {
      const record = modRecord(payload);
      if (!record) break;
      setModEnabled(record, false);
      store.modPackages = store.modPackages.filter(item => item.id !== record.id);
      if (record.source !== 'builtin') { const root = modRoot(record); if (root) await fs.promises.rm(root, { recursive: true, force: true }); }
      persist(); refreshPageMods(); emit(); break;
    }
    case 'modpkg:pick-file': {
      const kind = payload?.kind;
      if (!['audio', 'image', 'video', 'font'].includes(kind)) throw new Error('Tipo de arquivo inválido.');
      const result = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Arquivo do mod', extensions: modPackage.allowedFiles[kind].map(ext => ext.slice(1)) }] });
      if (result.canceled || !result.filePaths[0]) return null;
      const stat = await fs.promises.stat(result.filePaths[0]);
      if (stat.size > (kind === 'video' ? 40 : 15) * 1024 * 1024) throw new Error(`O arquivo excede ${kind === 'video' ? 40 : 15} MB.`);
      const token = randomUUID();
      pickedModFiles.set(token, { file: result.filePaths[0], kind });
      return { token, name: path.basename(result.filePaths[0]) };
    }
    case 'modpkg:create': {
      const spec = payload || {};
      const id = String(spec.id || '').toLowerCase();
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/.test(id)) throw new Error('Use um ID no formato com.seunome.meu-mod.');
      const files = [];
      const components = {};
      const take = (token, kind, folder, name) => {
        const picked = pickedModFiles.get(token);
        if (!picked || picked.kind !== kind) return '';
        const relative = `${folder}/${name}${path.extname(picked.file).toLowerCase()}`;
        files.push({ name: relative, source: picked.file });
        return relative;
      };
      if (spec.theme) components.theme = { accent: store.settings.accent, surface: store.settings.surface, background: store.settings.background, skin: store.settings.skin, appearanceMode: store.settings.appearanceMode === 'light' ? 'light' : 'dark', tokens: store.settings.tokens };
      if (spec.wallpaper?.token) { const file = take(spec.wallpaper.token, pickedModFiles.get(spec.wallpaper.token)?.kind === 'video' ? 'video' : 'image', 'wallpaper', 'wallpaper'); if (file) components.wallpaper = { file, dim: 0.3 }; }
      else if (spec.wallpaper?.current && store.settings.wallpaper === 'custom' && store.settings.wallpaperImageData) {
        const match = /^data:image\/(png|jpeg|webp);base64,(.+)$/.exec(store.settings.wallpaperImageData);
        if (match) { const name = `wallpaper/wallpaper.${match[1] === 'jpeg' ? 'jpg' : match[1]}`; files.push({ name, data: Buffer.from(match[2], 'base64') }); components.wallpaper = { file: name, dim: 0.3 }; }
      }
      if (spec.sounds && typeof spec.sounds === 'object') { const sounds = { volume: 0.6 }; for (const key of modPackage.soundKeys) { const file = spec.sounds[key] && take(spec.sounds[key], 'audio', 'sounds', key); if (file) sounds[key] = file; } if (Object.keys(sounds).length > 1) components.sounds = sounds; }
      if (spec.music?.base) { const base = take(spec.music.base, 'audio', 'music', 'base'); const activeLayer = spec.music.active ? take(spec.music.active, 'audio', 'music', 'active') : ''; if (base) components.music = { base, active: activeLayer, volume: 0.45 }; }
      if (Array.isArray(spec.pageStyles)) components.pageStyles = spec.pageStyles.slice(0, 20).flatMap((style, index) => { const css = modPackage.sanitizeCss(String(style?.css || '')); const matches = String(style?.matches || '').split(/[\s,]+/).map(host => host.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')).filter(host => /^(?:\*\.)?[a-z\d-]+(?:\.[a-z\d-]+)+$/.test(host)); if (!css || !matches.length) return []; const name = `pages/estilo-${index + 1}.css`; files.push({ name, data: Buffer.from(css, 'utf8') }); return [{ matches, css: name }]; });
      if (spec.shader && modPackage.shaderPresets.includes(spec.shader) && spec.shader !== 'none') components.shader = { preset: spec.shader, intensity: Number.isFinite(spec.shaderIntensity) ? spec.shaderIntensity : 0.6 };
      if (spec.interfaceCss && store.settings.customCss) { files.push({ name: 'interface.css', data: Buffer.from(store.settings.customCss, 'utf8') }); components.interfaceCss = 'interface.css'; }
      const manifest = { format: 'cypher-mod', formatVersion: 1, id, name: String(spec.name || '').trim().slice(0, 64), version: /^\d+\.\d+\.\d+$/.test(spec.version || '') ? spec.version : '1.0.0', author: String(spec.author || 'Eu').slice(0, 64), description: String(spec.description || '').slice(0, 400), minCypherVersion: app.getVersion(), components };
      const entries = [{ name: modPackage.MANIFEST, data: Buffer.from(JSON.stringify(manifest, null, 2), 'utf8') }];
      for (const file of files) entries.push({ name: file.name, data: file.data || await fs.promises.readFile(file.source) });
      modPackage.validateModManifest(manifest, new Set(entries.map(entry => entry.name.toLowerCase())));
      const buffer = modPackage.writeZip(entries);
      const result = await dialog.showSaveDialog(win, { defaultPath: `${id}.cyphermod`, filters: [{ name: 'Mod do Cypher', extensions: ['cyphermod'] }] });
      if (result.canceled || !result.filePath) return null;
      await fs.promises.writeFile(result.filePath, buffer);
      if (spec.install) { const temp = path.join(app.getPath('temp'), `cypher-mod-${randomUUID()}.cyphermod`); await fs.promises.writeFile(temp, buffer); try { await installModPackageFile(temp, 'file'); } finally { await fs.promises.rm(temp, { force: true }); } }
      pickedModFiles = new Map();
      return result.filePath;
    }
    case 'tab:group': { const target = tabs.find(t => t.id === payload?.id); if (target) { target.group = String(payload.group || '').trim().slice(0, 50); persist(); emit(); } break; }
    case 'split:toggle': {
      if (split && [split.left, split.right].includes(activeId)) { split = null; layout(); emit(); break; }
      const current = active();
      if (!current || !/^https?:\/\//i.test(current.url)) throw new Error('Abra um site para dividir a tela.');
      const visible = item => item.private || item.connectionMode !== 'normal' || item.workspaceId === store.activeWorkspaceId;
      const requested = typeof payload === 'string' ? tabs.find(item => item.id === payload) : null;
      const partner = requested || tabs.filter(item => item.id !== current.id && visible(item) && /^https?:\/\//i.test(item.url)).sort((a, b) => (b.lastActiveAt || 0) - (a.lastActiveAt || 0))[0];
      if (!partner || partner.id === current.id || !/^https?:\/\//i.test(partner.url)) throw new Error('Abra outro site em uma aba para dividir a tela.');
      if (partner.suspended) restoreSuspendedTab(partner);
      split = { left: current.id, right: partner.id, ratio: 0.5 }; layout(); emit(); break;
    }
    case 'split:ratio': if (split && Number.isFinite(payload)) { split.ratio = Math.max(0.2, Math.min(0.8, payload)); layout(); emit(); } break;
    case 'split:swap': if (split) { split = { left: split.right, right: split.left, ratio: 1 - split.ratio }; layout(); emit(); } break;
    case 'split:close': split = null; layout(); emit(); break;
    case 'panel:toggle': {
      const panel = store.settings.webPanels.find(item => item.id === payload);
      if (!panel) break;
      if (openPanelId === panel.id) openPanelId = ''; else { panelView(panel); openPanelId = panel.id; }
      layout(); emit(); break;
    }
    case 'panel:add': {
      if (store.settings.webPanels.length >= 8) throw new Error('Você já tem 8 painéis. Remova um para adicionar outro.');
      const url = resolveAddress(String(payload?.url || ''), store.settings.searchEngine, store.settings.customSearchUrl);
      if (!/^https:\/\//i.test(url)) throw new Error('Use um endereço HTTPS para o painel lateral.');
      const id = randomUUID().slice(0, 8);
      store.settings = sanitizeSettings({ webPanels: [...store.settings.webPanels, { id, url, title: String(payload?.title || new URL(url).hostname.replace(/^www\./, '')) }] }, store.settings);
      panelView(store.settings.webPanels.find(item => item.id === id)); openPanelId = id; layout(); persist(); emit(); return id;
    }
    case 'panel:remove': {
      const view = panelViews.get(payload);
      if (view) { win.contentView.removeChildView(view); if (!view.webContents.isDestroyed()) view.webContents.close(); panelViews.delete(payload); }
      if (openPanelId === payload) openPanelId = '';
      store.settings = sanitizeSettings({ webPanels: store.settings.webPanels.filter(item => item.id !== payload) }, store.settings);
      layout(); persist(); emit(); break;
    }
    case 'page:reader': {
      const current = active();
      if (!current?.view || !/^https?:\/\//i.test(current.url)) throw new Error('O modo leitura funciona em sites abertos em uma aba.');
      const result = await current.view.webContents.executeJavaScript(readerScript);
      if (result === 'on') await current.view.webContents.insertCSS(readerCss());
      if (result === 'none') throw new Error('Não encontramos um texto principal nesta página.');
      return result;
    }
    case 'page:capture': {
      const current = active();
      if (!current?.view || !/^https?:\/\//i.test(current.url) || current.error) throw new Error('Abra um site para capturar a tela.');
      return (await current.view.webContents.capturePage()).toDataURL();
    }
    case 'capture:save': {
      if (!validImageData(payload)) throw new Error('Imagem de captura inválida.');
      const result = await dialog.showSaveDialog(win, { defaultPath: `cypher-captura-${localDay()}.png`, filters: [{ name: 'Imagem PNG', extensions: ['png'] }] });
      if (result.canceled || !result.filePath) return false;
      await fs.promises.writeFile(result.filePath, Buffer.from(payload.split(',')[1], 'base64')); return true;
    }
    case 'clipboard:image': {
      if (!validImageData(payload)) throw new Error('Imagem de captura inválida.');
      // Electron 44 trocou writeImage pela API assíncrona no padrão da web.
      const png = nativeImage.createFromDataURL(payload).toPNG();
      await clipboard.write([new ClipboardItem({ 'image/png': new Blob([png], { type: 'image/png' }) })]); return true;
    }
    case 'page:theme-color': {
      const current = active();
      if (!current?.view || !/^https?:\/\//i.test(current.url)) throw new Error('Abra um site para usar as cores dele.');
      const value = await current.view.webContents.executeJavaScript(`(() => { const meta = document.querySelector('meta[name="theme-color"]')?.content; const link = document.querySelector('header a, nav a, a'); const source = meta || (link && getComputedStyle(link).color) || getComputedStyle(document.body).color; const context = document.createElement('canvas').getContext('2d'); context.fillStyle = '#000000'; context.fillStyle = source; return context.fillStyle; })()`);
      return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value) ? value.toLowerCase() : null;
    }
    case 'skin:import': {
      const result = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Pele do Cypher', extensions: ['cypherskin', 'json'] }] });
      if (result.canceled || !result.filePaths[0]) return null;
      if ((await fs.promises.stat(result.filePaths[0])).size > 300_000) throw new Error('O arquivo da pele excede 300 KB.');
      let parsed; try { parsed = JSON.parse(await fs.promises.readFile(result.filePaths[0], 'utf8')); } catch { throw new Error('O arquivo da pele não é um JSON válido.'); }
      const skin = validateSkinPackage(parsed);
      store.skins = [...store.skins, skin].slice(-50); persist(); emit(); return skin.id;
    }
    case 'skin:apply': {
      const skin = store.skins.find(item => item.id === payload);
      store.settings = sanitizeSettings(skin ? { skinPackage: skin.id, skin: skin.base, tokens: skin.tokens } : { skinPackage: '' }, store.settings);
      persist(); emit(); break;
    }
    case 'skin:remove': store.skins = store.skins.filter(item => item.id !== payload); if (store.settings.skinPackage === payload) store.settings.skinPackage = ''; persist(); emit(); break;
    case 'skin:export': {
      const result = await dialog.showSaveDialog(win, { defaultPath: 'minha-pele.cypherskin', filters: [{ name: 'Pele do Cypher', extensions: ['cypherskin'] }] });
      if (result.canceled || !result.filePath) return false;
      const current = store.skins.find(item => item.id === store.settings.skinPackage);
      const name = String(payload?.name || current?.name || 'Minha pele').slice(0, 64);
      await fs.promises.writeFile(result.filePath, JSON.stringify({ schemaVersion: 1, type: 'cypher-skin', name, author: 'Cypher', description: 'Exportada do Cypher.', base: store.settings.skin, tokens: store.settings.tokens, css: [current?.css, store.settings.customCss].filter(Boolean).join('\n\n') }, null, 2));
      return true;
    }
    case 'tab:reload': { const target = tabs.find(t => t.id === payload); if (target?.view && !target.view.webContents.isDestroyed()) target.view.webContents.reload(); break; }
    case 'tab:close-others': {
      const keep = tabs.find(t => t.id === payload);
      if (!keep) break;
      const visible = item => item.private || item.connectionMode !== 'normal' || item.workspaceId === store.activeWorkspaceId;
      selectTab(keep.id);
      for (const item of tabs.filter(t => t.id !== keep.id && !t.pinned && visible(t))) closeTab(item.id);
      break;
    }
    case 'tab:pin': { const target = tabs.find(t => t.id === payload); if (target) target.pinned = !target.pinned; emit(); break; }
    case 'tab:mute': { const target = tabs.find(t => t.id === payload); if (target) { target.muted = !target.muted; target.view?.webContents.setAudioMuted(target.muted); emit(); } break; }
    case 'media:window:toggle': toggleMediaPlayerWindow(); break;
    case 'media:window:close': if (playerWindow && !playerWindow.isDestroyed()) playerWindow.hide(); break;
    case 'media:window:show-tab': showPlayingTab(payload); break;
    case 'media:background:set':
      if (typeof payload?.enabled !== 'boolean') throw new Error('Estado da música de fundo inválido.');
      if (payload.enabled && !store.settings.backgroundMusicData) throw new Error('Escolha uma faixa em Configurações → Aparência antes de reproduzir.');
      store.settings.backgroundMusicEnabled = payload.enabled; persist(); emit(); break;
    case 'media:select': {
      const target = tabs.find(entry => entry.id === payload && entry.mediaInfo);
      if (target) { nowPlayingTabId = target.id; emit(); }
      break;
    }
    case 'media:control': {
      const target = tabs.find(entry => entry.id === payload?.tabId && entry.view && !entry.view.webContents.isDestroyed());
      if (!target || !['toggle','play','pause','seek-back','seek-forward','seek'].includes(payload?.action)) break;
      nowPlayingTabId = target.id;
      const operation = payload.action;
      const value = Number.isFinite(payload.value) ? Math.max(0, Math.min(86400, payload.value)) : 0;
      await target.view.webContents.executeJavaScript(`(() => {
        const items = [...document.querySelectorAll('audio,video')];
        const media = items.find(item => !item.paused && !item.ended) || items.find(item => item.currentSrc) || items[0];
        if (!media) return false;
        const action = ${JSON.stringify(operation)}, value = ${value};
        if (action === 'pause') items.forEach(item => item.pause());
        else if (action === 'play') { if (media.paused) void media.play().catch(() => {}); }
        else if (action === 'toggle') { if (media.paused) void media.play().catch(() => {}); else items.forEach(item => item.pause()); }
        else if (action === 'seek') media.currentTime = Math.min(Number.isFinite(media.duration) ? media.duration : value, value);
        else if (action === 'seek-back') media.currentTime = Math.max(0, media.currentTime - 10);
        else if (action === 'seek-forward') media.currentTime = Math.min(Number.isFinite(media.duration) ? media.duration : media.currentTime + 10, media.currentTime + 10);
        return true;
      })()`, true).catch(() => false);
      setTimeout(() => refreshMediaInfo(target, operation === 'play' || operation === 'toggle'), 160);
      break;
    }
    case 'tab:move': { const from = tabs.findIndex(t => t.id === payload?.from), to = tabs.findIndex(t => t.id === payload?.to); if (from >= 0 && to >= 0) tabs.splice(to, 0, tabs.splice(from, 1)[0]); emit(); break; }
    case 'navigate': if (tab) navigate(tab, payload); break;
    case 'back': if (wc?.navigationHistory.canGoBack()) wc.navigationHistory.goBack(); break;
    case 'forward': if (wc?.navigationHistory.canGoForward()) wc.navigationHistory.goForward(); break;
    case 'reload': if (tab) navigate(tab, tab.url); break;
    case 'stop': wc?.stop(); break;
    case 'viewport': {
      if (!payload || !['x','y','width','height'].every(k => Number.isFinite(payload[k]))) break;
      const nextObscured = !!payload.obscured;
      // Antes de tirar a página da frente de um menu ou popover, guarda uma imagem dela
      // para a interface mostrar por baixo: o site parece continuar ali.
      if (nextObscured && !obscured) await sendPageSnapshot();
      // Com a página fora da frente, o teclado volta para a interface (Esc, setas, Enter).
      if (nextObscured && !obscured && win && !win.isDestroyed()) win.webContents.focus();
      viewport = payload; obscured = nextObscured;
      panelBounds = payload.panel && ['x','y','width','height'].every(k => Number.isFinite(payload.panel[k])) ? payload.panel : null;
      layout(); break;
    }
    case 'settings': setSettings(payload); break;
    case 'profile:sync:configure': {
      if (!safeStorage.isEncryptionAvailable()) throw new Error('A criptografia segura do Windows não está disponível neste dispositivo.');
      let endpoint;
      try { endpoint = new URL(String(payload?.endpoint || '').trim()); } catch { throw new Error('Informe o endereço HTTPS do arquivo WebDAV do perfil.'); }
      if (!['https:','http:'].includes(endpoint.protocol) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || (endpoint.protocol === 'http:' && !['localhost','127.0.0.1'].includes(endpoint.hostname))) throw new Error('Use uma URL HTTPS sem credenciais, parâmetros ou fragmentos; HTTP só é aceito em localhost.');
      if (endpoint.pathname === '/' || endpoint.pathname.length < 2) throw new Error('Informe o caminho completo do arquivo de perfil no servidor WebDAV.');
      const username = String(payload?.username || '').trim().slice(0,256), password = typeof payload?.password === 'string' ? payload.password : '';
      if (!username || username.includes(':')) throw new Error('Informe um usuário WebDAV válido, sem dois-pontos.');
      if (password.length > 1024) throw new Error('A senha do WebDAV deve ter até 1.024 caracteres.');
      if (!password && !store.profileSync.passwordEncrypted) throw new Error('Informe a senha do WebDAV.');
      store.profileSync.endpoint = endpoint.href;
      store.profileSync.username = username;
      if (password) store.profileSync.passwordEncrypted = safeStorage.encryptString(password).toString('base64');
      store.profileSync.lastError = '';
      flush(); emit();
      return syncProfile();
    }
    case 'profile:sync:run': return syncProfile();
    case 'profile:sync:disconnect': {
      store.profileSync.endpoint = ''; store.profileSync.username = ''; store.profileSync.passwordEncrypted = ''; store.profileSync.lastError = '';
      clearTimeout(profileSyncTimer); flush(); emit(); break;
    }
    case 'system:default-browser': {
      if (process.platform !== 'win32') throw new Error('A seleção do navegador padrão é feita nas configurações do sistema operacional.');
      const args = app.isPackaged ? [] : [app.getAppPath()];
      let registered = false;
      try {
        const registeredHttp = app.setAsDefaultProtocolClient('http', process.execPath, args);
        const registeredHttps = app.setAsDefaultProtocolClient('https', process.execPath, args);
        registered = registeredHttp && registeredHttps;
        if (!registered) console.warn('O Windows não aceitou registrar os protocolos HTTP e HTTPS para o Cypher.');
      } catch (error) { console.warn('Não foi possível registrar os protocolos do navegador:', error.message); }
      await shell.openExternal('ms-settings:defaultapps');
      return { opened: true, registered };
    }
    case 'system:proxy': {
      if (process.platform !== 'win32') throw new Error('As configurações de proxy são controladas pelo sistema operacional.');
      await shell.openExternal('ms-settings:network-proxy');
      return { opened: true };
    }
    case 'system:dns-settings': {
      if (process.platform !== 'win32') throw new Error('As configurações de DNS seguro são controladas pelo sistema operacional.');
      await shell.openExternal('ms-settings:network');
      return { opened: true };
    }
    case 'system:restart': {
      if (store.settings.hardwareAcceleration === hardwareAccelerationAtLaunch) return { restarted: false };
      app.relaunch();
      quitting = true; closing = true; flush(); app.quit();
      return { restarted: true };
    }
    case 'page:translate': {
      if (!store.settings.translationEnabled) throw new Error('Ative a tradução nas configurações de Idiomas e entrada.');
      if (!tab || !/^https?:\/\//.test(tab.url)) throw new Error('Abra primeiro uma página HTTP ou HTTPS para traduzir.');
      const targetLanguage = store.settings.preferredLanguages[0] || 'pt-BR';
      const url = `https://translate.google.com/translate?sl=auto&tl=${encodeURIComponent(targetLanguage)}&u=${encodeURIComponent(tab.url)}`;
      return addTab(url, tab.private, tab.connectionMode);
    }
    case 'diagnostics:list': return { reports: errorReporter?.list() || [], canSend: errorReporter?.canSend === true };
    case 'diagnostics:clear': errorReporter?.clear(); return { reports: [] };
    case 'diagnostics:report': {
      const message = String(payload?.message || '').slice(0, 2000);
      if (message) errorReporter?.record('interface', { message, stack: String(payload?.stack || '').slice(0, 8000) });
      return { recorded: Boolean(message) };
    }
    case 'diagnostics:issue': {
      const url = errorReporter?.issueUrl(String(updateConfig().repository || ''), String(payload || ''));
      if (!url) throw new Error('Relatório não encontrado.');
      await shell.openExternal(url);
      return { opened: true };
    }
    case 'update:check': return updater.check();
    case 'update:install': return updater.installNow();
    case 'update:dismiss': return updater.dismiss();
    case 'update:ack': acknowledgeOnboarding(); emit(); return true;
    case 'connection:check': {
      const mode = payload === 'tor' || payload === 'i2p' ? payload : 'normal';
      if (mode === 'normal') return { mode, available: true, port: null };
      const port = connectionPort(mode);
      return { mode, available: await privacyServices.check(mode, port), installed: privacyServices.installed(mode), port };
    }
    case 'vpn:proton:status': return protonVpnStatus();
    case 'vpn:proton:open': return openProtonVpn();
    case 'vpn:proton:account': return addTab('https://protonvpn.com/free-vpn', false, 'normal');
    case 'vpn:proton:verify': return addTab('https://protonvpn.com/what-is-my-ip-address', false, 'normal');
    case 'connection:select': {
      const mode = ['normal','tor','i2p'].includes(payload) ? payload : 'normal';
      if (mode !== 'normal') {
        const port = connectionPort(mode);
        await privacyServices.start(mode, port);
      }
      applyConnectionMode(mode);
      if (mode === 'normal') await privacyServices.stopAll();
      else await privacyServices.stopOther(mode);
      break;
    }
    case 'home:image:select': {
      const result = await dialog.showOpenDialog(win, { title: 'Escolher imagem para a Home', properties: ['openFile'], filters: [{ name: 'Imagens', extensions: ['png','jpg','jpeg','webp','gif'] }] });
      if (result.canceled || !result.filePaths[0]) return null;
      const imagePath = result.filePaths[0];
      const stat = fs.statSync(imagePath);
      if (stat.size > 3 * 1024 * 1024) throw new Error('A imagem deve ter até 3 MB.');
      const extension = path.extname(imagePath).toLowerCase();
      const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' }[extension];
      if (!mime) throw new Error('Formato de imagem não suportado.');
      return `data:${mime};base64,${fs.readFileSync(imagePath).toString('base64')}`;
    }
    case 'appearance:wallpaper:select': {
      const result = await dialog.showOpenDialog(win, { title: 'Escolher papel de parede', properties: ['openFile'], filters: [{ name: 'Imagem segura', extensions: ['png','jpg','jpeg','webp'] }] });
      if (result.canceled || !result.filePaths[0]) return null;
      const file = result.filePaths[0], extension = path.extname(file).toLowerCase(), stat = fs.statSync(file);
      if (stat.size > 3 * 1024 * 1024) throw new Error('O papel de parede deve ter até 3 MB.');
      const mime = ({ '.png':'png', '.jpg':'jpeg', '.jpeg':'jpeg', '.webp':'webp' })[extension];
      return { dataUrl: `data:image/${mime};base64,${fs.readFileSync(file).toString('base64')}` };
    }
    case 'appearance:wallpaper-video:select': {
      const result = await dialog.showOpenDialog(win, { title: 'Escolher vídeo para o fundo', properties: ['openFile'], filters: [{ name: 'Vídeos', extensions: ['mp4','webm','ogv'] }] });
      if (result.canceled || !result.filePaths[0]) return null;
      const file = result.filePaths[0], extension = path.extname(file).toLowerCase(), stat = fs.statSync(file);
      if (stat.size > 250 * 1024 * 1024) throw new Error('O vídeo deve ter até 250 MB.');
      if (!['.mp4','.webm','.ogv'].includes(extension)) throw new Error('Formato não suportado. Use MP4, WebM ou OGV.');
      const directory = wallpaperDirectory();
      await fs.promises.mkdir(directory, { recursive: true });
      const target = path.join(directory, `${randomUUID()}${extension}`);
      await fs.promises.copyFile(file, target, fs.constants.COPYFILE_EXCL);
      return { path: target, name: path.basename(file).slice(0,160) };
    }
    case 'appearance:music:select': {
      const result = await dialog.showOpenDialog(win, { title: 'Escolher música de fundo', properties: ['openFile'], filters: [{ name: 'Áudio', extensions: ['mp3','wav','ogg','webm'] }] });
      if (result.canceled || !result.filePaths[0]) return null;
      const file = result.filePaths[0], extension = path.extname(file).toLowerCase(), stat = fs.statSync(file);
      if (stat.size > 10 * 1024 * 1024) throw new Error('A faixa deve ter até 10 MB.');
      const mime = ({ '.mp3':'mpeg', '.wav':'wav', '.ogg':'ogg', '.webm':'webm' })[extension];
      return { dataUrl: `data:audio/${mime};base64,${fs.readFileSync(file).toString('base64')}`, name: path.basename(file).slice(0,120) };
    }
    case 'profile:photo:select': {
      const result = await dialog.showOpenDialog(win, { title: 'Escolher foto do perfil', properties: ['openFile'], filters: [{ name: 'Imagens', extensions: ['png','jpg','jpeg','webp'] }] });
      if (result.canceled || !result.filePaths[0]) return null;
      const imagePath = result.filePaths[0], stat = fs.statSync(imagePath);
      if (stat.size > 2 * 1024 * 1024) throw new Error('A foto deve ter até 2 MB.');
      const extension = path.extname(imagePath).toLowerCase();
      const mime = { '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp' }[extension];
      if (!mime) throw new Error('Formato de imagem não suportado.');
      return `data:${mime};base64,${fs.readFileSync(imagePath).toString('base64')}`;
    }
    case 'home:note': {
      if (tab?.private) break;
      if (typeof payload?.id !== 'string' || typeof payload.text !== 'string' || !store.settings.home.widgets.some(w => w.id === payload.id && w.type === 'notes')) throw new Error('Widget de notas inválido.');
      store.homeData.notes[payload.id] = payload.text.slice(0,20000); persist(); break;
    }
    case 'home:tasks': {
      if (tab?.private) break;
      const widgetId = typeof payload?.widgetId === 'string' ? payload.widgetId : '';
      if (!store.settings.home.widgets.some(widget => widget.id === widgetId && widget.type === 'tasks')) throw new Error('Widget de tarefas inválido.');
      const tasks = store.homeData.tasksById[widgetId] ||= [];
      if (payload.action === 'add') {
        const title = typeof payload.title === 'string' ? payload.title.trim().slice(0,180) : '';
        if (!title) break;
        if (tasks.length >= 50) throw new Error('Este widget já tem 50 tarefas.');
        tasks.push({ id: randomUUID(), title, done: false });
      } else if (payload.action === 'toggle' && typeof payload.id === 'string') {
        const task = tasks.find(item => item.id === payload.id); if (task) task.done = !task.done;
      } else if (payload.action === 'remove' && typeof payload.id === 'string') {
        store.homeData.tasksById[widgetId] = tasks.filter(item => item.id !== payload.id);
      }
      persist(); emit(); break;
    }
    case 'home:focus': {
      if (tab?.private) break;
      const widgetId = typeof payload?.widgetId === 'string' ? payload.widgetId : null;
      if (widgetId && !store.settings.home.widgets.some(widget => widget.id === widgetId && widget.type === 'focus')) throw new Error('Widget de foco inválido.');
      let focus = store.homeData.focus;
      if (widgetId) {
        focus = store.homeData.focusById[widgetId];
        if (!focus) {
          const minutes = store.settings.home.widgets.find(widget => widget.id === widgetId).focusMinutes || 25;
          focus = store.homeData.focusById[widgetId] = { endsAt: null, remaining: minutes * 60, duration: minutes * 60 };
        }
      }
      if (payload?.action === 'start') {
        if (focus.endsAt && focus.endsAt > Date.now()) break;
        if (!focus.remaining) focus.remaining = focus.duration;
        focus.endsAt = Date.now() + focus.remaining * 1000;
      }
      if (payload?.action === 'pause') { if (focus.endsAt) focus.remaining = Math.max(0,Math.ceil((focus.endsAt-Date.now())/1000)); focus.endsAt = null; }
      if (payload?.action === 'reset') { focus.endsAt = null; focus.remaining = focus.duration; }
      if (payload?.action === 'duration' && Number.isFinite(payload.minutes)) { focus.duration = Math.round(Math.max(1,Math.min(120,payload.minutes))) * 60; focus.remaining = focus.duration; focus.endsAt = null; }
      persist(); emit(); break;
    }
    case 'bookmark:toggle': {
      if (!tab || !/^https?:/.test(tab.url)) break;
      const existing = store.bookmarks.findIndex(b => b.url === tab.url);
      if (existing >= 0) store.bookmarks.splice(existing, 1);
      else store.bookmarks.push({ id: randomUUID(), title: tab.title, url: tab.url, date: Date.now() });
      persist(); emit(); break;
    }
    case 'bookmark:add': { const url = resolveAddress(payload?.url, store.settings.searchEngine, store.settings.customSearchUrl); if (!/^https?:/.test(url)) throw new Error('Informe um endereço de site.'); store.bookmarks.push({ id: randomUUID(), title: String(payload?.title || new URL(url).hostname).slice(0,200), url, date: Date.now() }); persist(); emit(); break; }
    case 'bookmark:remove': store.bookmarks = store.bookmarks.filter(b => b.id !== payload); persist(); emit(); break;
    case 'history:clear': store.history = []; persist(); emit(); break;
    case 'history:remove': store.history = store.history.filter(h => h.id !== payload); persist(); emit(); break;
    case 'download:directory:select': {
      const result = await dialog.showOpenDialog(win, { title: 'Escolher pasta de downloads', defaultPath: store.settings.downloadDirectory || app.getPath('downloads'), properties: ['openDirectory','createDirectory'] });
      if (!result.canceled && result.filePaths[0]) { store.settings.downloadDirectory = result.filePaths[0]; persist(); emit(); }
      break;
    }
    case 'download:directory:clear': store.settings.downloadDirectory = ''; persist(); emit(); break;
    case 'download:directory:open': await shell.openPath(store.settings.downloadDirectory || app.getPath('downloads')); break;
    case 'data:clear': {
      const result = await dialog.showMessageBox(win, { type: 'question', message: 'Apagar cookies e cache? Você será desconectado dos sites.', buttons: ['Cancelar','Apagar dados'], defaultId: 0, cancelId: 0 });
      if (result.response === 1) await clearSiteData(); break;
    }
    case 'zoom': if (wc) { wc.setZoomFactor(Math.max(0.25,Math.min(3, Number(payload) || 1))); update(tab); } break;
    case 'find': if (wc) { if (payload?.text) wc.findInPage(String(payload.text), { forward: payload.forward !== false }); else wc.stopFindInPage('clearSelection'); } break;
    case 'print': wc?.print({}); break;
    case 'save': await savePage(tab); break;
    case 'devtools': wc?.openDevTools({ mode: 'detach' }); break;
    case 'download:action': {
      const record = store.downloads.find(d => d.id === payload?.id); if (!record) break;
      const item = downloadItems.get(record.id);
      if (payload.action === 'pause' && item) { item.pause(); record.state = 'paused'; emit(); }
      if (payload.action === 'resume' && item) { item.resume(); record.state = 'progressing'; emit(); }
      if (payload.action === 'cancel') item?.cancel();
      if (payload.action === 'show' && record.path && record.state === 'completed') shell.showItemInFolder(record.path);
      if (payload.action === 'remove' && !item) { store.downloads = store.downloads.filter(d => d.id !== record.id); persist(); emit(); }
      break;
    }
    case 'mod:apply': { const mod = [...builtInMods, ...store.mods].find(m => m.id === payload); if (mod) { const personal = { connectionMode: store.settings.connectionMode, torSocksPort: store.settings.torSocksPort, i2pHttpPort: store.settings.i2pHttpPort, restoreSession: store.settings.restoreSession, startupMode: store.settings.startupMode, startupPages: store.settings.startupPages, showHomeFirst: store.settings.showHomeFirst, openLinksInNewTab: store.settings.openLinksInNewTab, showSearchSuggestions: store.settings.showSearchSuggestions, showBookmarksBar: store.settings.showBookmarksBar, suggestBookmarks: store.settings.suggestBookmarks, suggestHistory: store.settings.suggestHistory, clearDataOnExit: store.settings.clearDataOnExit, clearHistoryOnExit: store.settings.clearHistoryOnExit, confirmCloseWithMultipleTabs: store.settings.confirmCloseWithMultipleTabs, sendDoNotTrack: store.settings.sendDoNotTrack, blockAds: store.settings.blockAds, blockTrackers: store.settings.blockTrackers, blockThirdPartyCookies: store.settings.blockThirdPartyCookies, blockPopups: store.settings.blockPopups, popupExceptions: store.settings.popupExceptions, trackingExceptions: store.settings.trackingExceptions, passwordAutofillEnabled: store.settings.passwordAutofillEnabled, preferredLanguages: store.settings.preferredLanguages, spellCheckEnabled: store.settings.spellCheckEnabled, spellCheckLanguages: store.settings.spellCheckLanguages, translationEnabled: store.settings.translationEnabled, hardwareAcceleration: store.settings.hardwareAcceleration, webrtcPolicy: store.settings.webrtcPolicy, interfaceTextScale: store.settings.interfaceTextScale, defaultZoom: store.settings.defaultZoom, downloadDirectory: store.settings.downloadDirectory, startWithWindows: store.settings.startWithWindows, searchEngine: store.settings.searchEngine, customSearchUrl: store.settings.customSearchUrl, backgroundMusicEnabled: false, customCss: store.settings.customCss, shortcuts: store.settings.shortcuts, routeRules: store.settings.routeRules, containers: store.settings.containers, webPanels: store.settings.webPanels, panelWidth: store.settings.panelWidth, blockCookieBanners: store.settings.blockCookieBanners, modSoundsEnabled: store.settings.modSoundsEnabled, modSoundsVolume: store.settings.modSoundsVolume, modMusicEnabled: store.settings.modMusicEnabled, modMusicVolume: store.settings.modMusicVolume, modPageEffects: store.settings.modPageEffects }; store.settings = { ...sanitizeSettings(mod.settings, store.settings), ...personal }; store.settings.activeMod = mod.id; persist(); emit(); } break; }
    case 'mod:import': {
      const result = await dialog.showOpenDialog(win, { title: 'Importar mod do Cypher', properties: ['openFile'], filters: [{ name: 'Mod Cypher', extensions: ['json'] }] });
      if (result.canceled) break;
      if (fs.statSync(result.filePaths[0]).size > 20 * 1024 * 1024) throw new Error('O mod deve ter até 20 MB.');
      const mod = validateMod(JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8'))); store.mods.push(mod); persist(); emit(); break;
    }
    case 'mod:export': {
      const result = await dialog.showSaveDialog(win, { title: 'Exportar seu mod', defaultPath: 'meu-cypher.json', filters: [{ name: 'Mod Cypher', extensions: ['json'] }] });
      if (!result.canceled) fs.writeFileSync(result.filePath, JSON.stringify({ schemaVersion: 1, name: 'Meu Cypher', author: 'Você', description: 'Um Cypher do meu jeito.', settings: { ...store.settings, profilePhoto:'', downloadDirectory:'' } },null,2)); break;
    }
    case 'mod:remove': store.mods = store.mods.filter(m => m.id !== payload); persist(); emit(); break;
    case 'window:minimize': win.minimize(); break;
    case 'window:maximize': win.isMaximized() ? win.unmaximize() : win.maximize(); emit(); break;
    case 'window:close': win.close(); break;
    case 'window:fullscreen': win.setFullScreen(!win.isFullScreen()); break;
    default: throw new Error('Comando desconhecido.');
  }
}
function installMenu() {
  const run = (action, payload) => () => { void command(action, payload).catch(error => { console.error(error); if (win && !win.isDestroyed()) win.webContents.send('cypher:shortcut', `error:${error.message}`); }); };
  const key = action => store?.settings?.shortcuts?.[action] || shortcutActions[action];
  const cycle = step => () => {
    const visible = tabs.filter(item => item.private || item.connectionMode !== 'normal' || item.workspaceId === store.activeWorkspaceId);
    const index = visible.findIndex(item => item.id === activeId);
    if (visible.length) selectTab(visible[(index + step + visible.length) % visible.length].id);
  };
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Cypher', submenu: [
      { label: 'Nova aba', accelerator: key('tab:new'), click: run('tab:new') },
      { label: 'Nova aba privada', accelerator: key('tab:private'), click: run('tab:new', { private: true }) },
      { label: 'Fechar aba', accelerator: key('tab:close'), click: () => closeTab(activeId) },
      { label: 'Reabrir aba', accelerator: key('tab:restore'), click: run('tab:restore') },
      { label: 'Próxima aba', accelerator: key('tab:next'), click: cycle(1) },
      { label: 'Aba anterior', accelerator: key('tab:previous'), click: cycle(-1) },
      { label: 'Pesquisar abas e comandos', accelerator: key('palette'), click: () => shortcut('palette') },
      { label: 'Editar interface', accelerator: key('inspector'), click: () => shortcut('inspector') },
      ...Array.from({ length: 9 }, (_, index) => ({ label: index === 8 ? 'Última aba' : `Aba ${index + 1}`, accelerator: `CmdOrCtrl+${index + 1}`, click: () => {
        const visible = tabs.filter(item => item.private || item.connectionMode !== 'normal' || item.workspaceId === store.activeWorkspaceId);
        const ordered = [...visible.filter(item => item.pinned), ...visible.filter(item => !item.pinned)];
        const target = index === 8 ? ordered[ordered.length - 1] : ordered[index];
        if (target) selectTab(target.id);
      } })),
      { type: 'separator' }, { role: 'quit', label: 'Sair' },
    ] },
    { label: 'Navegação', submenu: [
      { label: 'Endereço', accelerator: key('address'), click: () => shortcut('address') },
      { label: 'Voltar', accelerator: 'Alt+Left', click: run('back') },
      { label: 'Avançar', accelerator: 'Alt+Right', click: run('forward') },
      { label: 'Recarregar', accelerator: key('reload'), click: run('reload') },
      { label: 'Recarregar página', accelerator: 'F5', click: run('reload') },
      { label: 'Localizar', accelerator: key('find'), click: () => shortcut('find') },
      { label: 'Favoritar', accelerator: key('bookmark'), click: run('bookmark:toggle') },
      { label: 'Histórico', accelerator: key('history'), click: run('navigate', 'cypher://history') },
      { label: 'Downloads', accelerator: key('downloads'), click: run('navigate', 'cypher://downloads') },
      { label: 'Modo leitura', accelerator: key('reader'), click: run('page:reader') },
      { label: 'Capturar tela', accelerator: key('capture'), click: () => shortcut('capture') },
      { label: 'Dividir tela', accelerator: key('split'), click: run('split:toggle') },
      { label: 'Imprimir', accelerator: key('print'), click: run('print') },
      { label: 'Salvar página', accelerator: key('save'), click: run('save') },
    ] },
    { label: 'Exibir', submenu: [
      { label: 'Tela cheia', accelerator: key('fullscreen'), click: run('window:fullscreen') },
      { label: 'Ampliar', accelerator: key('zoom:in'), click: () => command('zoom', (active()?.zoom || 1) + 0.1) },
      { label: 'Reduzir', accelerator: key('zoom:out'), click: () => command('zoom', (active()?.zoom || 1) - 0.1) },
      { label: 'Zoom original', accelerator: key('zoom:reset'), click: run('zoom', 1) },
      { label: 'Ferramentas de desenvolvedor', accelerator: key('devtools'), click: run('devtools') },
    ] },
    { label: 'Editar', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
  ]));
}
app.whenReady().then(async () => {
  if (!hasInstanceLock) return;
  protocol.handle('cypher-mod', async request => {
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Not allowed', { status: 405 });
    try {
      const url = new URL(request.url);
      const id = decodeURIComponent(url.hostname);
      const record = modRecord(id) || (builtinMods.has(id) ? { id, source: 'builtin' } : null);
      const root = modRoot(record);
      if (!root) return new Response('Not found', { status: 404 });
      const relative = url.pathname.slice(1).split('/').map(decodeURIComponent).join('/');
      const kind = modPackage.kindOf(relative);
      if (!kind || kind === 'css') return new Response('Not found', { status: 404 });
      const file = path.resolve(root, ...relative.split('/'));
      if (!file.startsWith(path.resolve(root) + path.sep)) return new Response('Not found', { status: 404 });
      const response = await net.fetch(pathToFileURL(file).href, { headers: request.headers });
      const headers = new Headers(response.headers);
      headers.set('X-Content-Type-Options', 'nosniff');
      if (relative.toLowerCase().endsWith('.svg')) { headers.set('Content-Type', 'image/svg+xml'); headers.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'"); }
      return new Response(response.body, { status: response.status, headers });
    } catch { return new Response('Not found', { status: 404 }); }
  });
  protocol.handle('cypher-wallpaper', request => {
    const url = new URL(request.url);
    if (!['GET','HEAD'].includes(request.method) || url.hostname !== 'wallpaper' || url.pathname !== '/current') return new Response('Not found', { status: 404 });
    const file = safeWallpaperFile(store?.settings.wallpaperVideoPath);
    if (!file) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).href, { headers: request.headers });
  });
  protocol.registerSource('cypher-ui', { routes: [{ match: { host: 'app' }, source: { type: 'directory', root: path.resolve(__dirname, '../dist'), index: 'index.html', headers: { 'X-Content-Type-Options': 'nosniff' } } }] });
  loadTrackerEngine();
  loadProfileRegistry();
  loadBuiltinMods();
  loadStore();
  applyNativeTheme();
  importInstallerConsent();
  errorReporter = createErrorReporter({ directory: app.getPath('userData'), version: app.getVersion(), enabled: () => store?.settings.sendErrorReports === true,
    endpoint: String(updateConfig().errorReportEndpoint || ''), fetchImpl: (url, init) => net.fetch(url, init) });
  app.on('child-process-gone', (_event, details) => { if (!['clean-exit','killed'].includes(details.reason)) errorReporter.record('process-crash', new Error(`Processo ${details.type} encerrado: ${details.reason}`), { detail: `código ${details.exitCode}` }); });
  app.on('render-process-gone', (_event, _contents, details) => { if (!['clean-exit','killed'].includes(details.reason)) errorReporter.record('page-crash', new Error(`Página encerrada: ${details.reason}`), { detail: `código ${details.exitCode}` }); });
  registerProtonIpcBridge();
  await loadBuiltInProtonVpn();
  mediaTimer = setInterval(() => {
    for (const tab of tabs) if (tab.mediaPlaying || tab.audible) refreshMediaInfo(tab, tab.mediaPlaying);
  }, 1500);
  setInterval(suspendIdleTabs, 60_000);
  await loadStoredExtensions();
  updater = createUpdater({ app, publish: () => { layout(); emit(); }, scheduleQuit: () => setTimeout(() => app.quit(), 1300), getChannel: () => store?.settings.updateChannel || 'stable' });
  prepareOnboarding();
  if (process.platform === 'win32' && store.settings.startWithWindows) {
    try { app.setLoginItemSettings({ openAtLogin: true, path: process.execPath, args: app.isPackaged ? [] : [app.getAppPath()] }); }
    catch (error) { console.error('Não foi possível aplicar a inicialização com o Windows:', error.message); }
  }
  win = new BrowserWindow({ width: 1440, height: 940, minWidth: 960, minHeight: 650, frame: false, backgroundColor: '#090c0b', show: false, icon: path.join(__dirname,'../build/icon.png'),
    webPreferences: { preload: path.join(__dirname,'preload.cjs'), minimumFontSize: 11, nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, allowRunningInsecureContent: false } });
  const devURL = process.env.CYPHER_DEV_URL;
  const trustedURL = devURL || 'cypher-ui://app/index.html';
  rendererUrl = trustedURL + (devURL ? '/' : '');
  // Barra de endereço, busca da Home e demais campos da interface: menu do botão direito com copiar e colar.
  win.webContents.on('context-menu', (_event, params) => {
    const items = editMenuItems(params);
    if (items.length) Menu.buildFromTemplate(items).popup({ window: win });
  });
  ipcMain.on('cypher:login-captured', (event, payload) => {
    const tab = tabs.find(entry => entry.view?.webContents === event.sender);
    if (!tab || event.senderFrame !== event.sender.mainFrame || typeof payload?.password !== 'string' || !payload.password || payload.password.length > 4096) return;
    const username = typeof payload.username === 'string' ? payload.username.trim().slice(0,256) : '';
    try { loginCaptured(tab, normalizePasswordOrigin(event.senderFrame.url), username, payload.password); }
    catch (error) { console.warn('Não foi possível preparar o pedido de senha:', error.message); }
  });
  app.on('certificate-error', (event, contents, url, _error, _certificate, callback) => {
    const tab = tabs.find(entry => entry.view?.webContents === contents);
    if (tab && tab.connectionMode === 'normal' && certificateExceptions.has(hostOf(url))) { event.preventDefault(); callback(true); return; }
    callback(false);
  });
  ipcMain.handle('cypher:command', (event, action, payload) => {
    if (event.sender === win.webContents) {
      if (event.senderFrame !== win.webContents.mainFrame || event.senderFrame.url !== rendererUrl) throw new Error('Origem não autorizada.');
      return command(action, payload);
    }
    if (playerWindow && !playerWindow.isDestroyed() && event.sender === playerWindow.webContents) {
      const playerActions = new Set(['state','media:background:set','media:control','media:select','media:window:close','media:window:show-tab']);
      if (event.senderFrame !== playerWindow.webContents.mainFrame || event.senderFrame.url !== `${rendererUrl}#mini-player` || !playerActions.has(action)) throw new Error('Ação indisponível no miniplayer.');
      return command(action, payload);
    }
    throw new Error('Origem não autorizada.');
  });
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.on('resize', layout);
  win.on('maximize', emit); win.on('unmaximize', emit);
  win.on('move', positionMediaPlayerWindow); win.on('resize', positionMediaPlayerWindow);
  win.on('close', event => {
    if (!quitting && !allowWindowClose && store.settings.confirmCloseWithMultipleTabs && tabs.length > 1) {
      event.preventDefault();
      if (closePromptOpen) return;
      closePromptOpen = true;
      void dialog.showMessageBox(win, { type: 'question', title: 'Fechar o Cypher?', message: `Você tem ${tabs.length} abas abertas. Quer fechar o navegador mesmo assim?`, buttons: ['Continuar navegando','Fechar navegador'], defaultId: 0, cancelId: 0 }).then(result => {
        closePromptOpen = false;
        if (result.response === 1 && win && !win.isDestroyed()) { allowWindowClose = true; win.close(); }
      }).catch(error => { closePromptOpen = false; console.error('Não foi possível confirmar o fechamento:', error.message); });
      return;
    }
    closing = true; flush();
    for (const tab of [...tabs]) if (tab.view && !tab.view.webContents.isDestroyed()) tab.view.webContents.close();
  });
  installMenu();
  nativeTheme.on('updated', () => emit());
  const homeFirstId = addTab('cypher://newtab', false, store.settings.connectionMode);
  const startupMode = store.settings.startupMode;
  if (startupMode === 'restore') {
    for (const savedTab of store.savedTabs.slice(0,50)) {
      try { const id = addTab(savedTab.url, false, store.settings.connectionMode, true, undefined, { containerId: savedTab.containerId }); const restored = tabs.find(t => t.id === id); if (restored) { restored.pinned = !!savedTab.pinned; restored.group = savedTab.group || ''; restored.workspaceId = savedTab.workspaceId || store.activeWorkspaceId; } } catch {}
    }
  } else if (startupMode === 'specific') {
    for (const url of store.settings.startupPages.slice(0,10)) { try { addTab(url, false, store.settings.connectionMode); } catch {} }
  }
  for (const url of pendingExternalUrls.splice(0,10)) { try { addTab(url, false, store.settings.connectionMode); } catch {} }
  if (homeFirstId) selectTab(homeFirstId);
  await win.loadURL(rendererUrl);
  win.show();
  for (const packageFile of pendingCypherPackages.splice(0,10)) void installExternalCypherPackage(packageFile);
  profileSyncReady = true;
  if (store.profileSync.endpoint) setTimeout(() => void syncProfile().catch(error => console.warn('Sincronização inicial do perfil:', error.message)), 1800);
  profileSyncInterval = setInterval(() => { if (store?.profileSync?.endpoint) void syncProfile().catch(error => console.warn('Sincronização periódica do perfil:', error.message)); }, 5 * 60 * 1000);
  void updater.start();
});
app.on('window-all-closed', () => app.quit());
// Atualização pronta e o usuário fechou o Cypher: instala em silêncio, sem reabrir.
app.on('will-quit', () => { try { updater?.installOnQuit(); } catch (error) { console.error('Não foi possível instalar a atualização ao fechar:', error.message); } });
app.on('before-quit', event => {
  if (mediaTimer) { clearInterval(mediaTimer); mediaTimer = null; }
  if (profileSyncInterval) { clearInterval(profileSyncInterval); profileSyncInterval = null; }
  clearTimeout(profileSyncTimer);
  if (!exitCleanupStarted && (store?.settings.clearDataOnExit || store?.settings.clearHistoryOnExit)) {
    event.preventDefault();
    exitCleanupStarted = true;
    void (async () => {
      try {
        if (store.settings.clearDataOnExit) await clearSiteData();
        if (store.settings.clearHistoryOnExit) store.history = [];
      } catch (error) { console.error('Não foi possível concluir a limpeza ao sair:', error.message); }
      quitting = true; closing = true; flush(); app.quit();
    })();
    return;
  }
  if (!privacyShutdownComplete && !privacyShutdownStarted) {
    event.preventDefault();
    privacyShutdownStarted = true;
    void privacyServices.stopAll().finally(() => {
      privacyShutdownComplete = true;
      quitting = true; closing = true; flush(); app.quit();
    });
    return;
  }
  quitting = true; closing = true; flush();
});
