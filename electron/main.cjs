const { app, BrowserWindow, WebContentsView, ipcMain, session, Menu, dialog, shell, clipboard, nativeTheme, protocol } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const { defaults, resolveAddress, sanitizeSettings, validateMod } = require('./domain.cjs');
const { createUpdater } = require('./updater.cjs');
const { MAX_CRX_BYTES, unpackCrx } = require('./crx.cjs');
const { createPrivacyServices } = require('./privacy-services.cjs');
const { FiltersEngine, Request } = require('@ghostery/adblocker');

const execFileAsync = promisify(execFile);
const privacyServices = createPrivacyServices({ app });

app.setName('Cypher');
nativeTheme.themeSource = 'dark';
protocol.registerSchemesAsPrivileged([{ scheme: 'cypher-ui', privileges: { standard: true, secure: true } }]);
let win, store, storePath, activeId, saveTimer, updater, closing = false, closePromptOpen = false, allowWindowClose = false, quitting = false, exitCleanupStarted = false, privacyShutdownStarted = false, privacyShutdownComplete = false;
let hardwareAccelerationAtLaunch = true;
let trackerEngine = null;
let trackerList = { available: false, name: 'EasyPrivacy', source: 'https://easylist.to/easylist/easyprivacy.txt', lastModified: '', networkRuleCount: 0, blockedRequests: 0 };
let trackerCountTimer = null;
try {
  const bootstrap = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'cypher.json'), 'utf8'));
  if (bootstrap.settings?.hardwareAcceleration === false) { app.disableHardwareAcceleration(); hardwareAccelerationAtLaunch = false; }
} catch {}
const pendingExternalUrls = process.argv.filter(value => /^https?:\/\//i.test(value)).slice(0,10);
const hasInstanceLock = app.requestSingleInstanceLock();
if (!hasInstanceLock) app.quit();
else app.on('second-instance', (_event, commandLine) => {
  const urls = commandLine.filter(value => /^https?:\/\//i.test(value)).slice(0,10);
  if (win && !win.isDestroyed()) { win.show(); win.focus(); for (const url of urls) { try { addTab(url, false, 'normal'); } catch {} } }
  else pendingExternalUrls.push(...urls);
});
let viewport = { x: 248, y: 106, width: 900, height: 650 }, obscured = false;
const tabs = [], closedTabs = [], downloadItems = new Map(), reservedDownloadPaths = new Set(), configuredSessions = new Set(), privateSessions = new Set();
const proxyReady = new WeakMap();
const sitePermissionTypes = new Set(['media','geolocation','notifications','fullscreen','clipboard-sanitized-write']);
let privatePartition = `cypher-private-${randomUUID()}`;
const builtInMods = [
  { id: 'cypher-original', name: 'Cypher Original', author: 'Cypher', description: 'Grafite profundo. Verde elétrico. Seu ponto de partida.', settings: { ...defaults } },
  { id: 'ultraviolet', name: 'Ultraviolet', author: 'Cypher', description: 'Uma frequência diferente. Roxo, sombras e órbitas.', settings: { ...defaults, accent: '#b5a0ff', surface: '#15121d', background: '#0b0910' } },
  { id: 'ember', name: 'Ember', author: 'Cypher', description: 'Tons de carvão e um brilho que não se apaga.', settings: { ...defaults, accent: '#ff9b6a', surface: '#1b1412', background: '#100b09', wallpaper: 'grid' } },
  { id: 'arctic', name: 'Arctic Signal', author: 'Cypher', description: 'Azul glacial, linhas precisas e silêncio visual.', settings: { ...defaults, accent: '#78d9ee', surface: '#10191e', background: '#080e12', radius: 6, font: 'mono', wallpaper: 'grid' } },
];
function loadStore() {
  storePath = path.join(app.getPath('userData'), 'cypher.json');
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(storePath, 'utf8')); } catch (error) {
    if (error.code !== 'ENOENT') { try { fs.copyFileSync(storePath, storePath + '.backup'); } catch {} }
  }
  const notes = {};
  if (saved.homeData?.notes && typeof saved.homeData.notes === 'object') for (const [id,value] of Object.entries(saved.homeData.notes)) {
    if (typeof value === 'string' && id !== '__proto__') notes[id] = value.slice(0,20000);
  }
  store = { settings: sanitizeSettings(saved.settings), bookmarks: [], history: [], downloads: [], extensions: [], sitePermissions: [], mods: [], savedTabs: Array.isArray(saved.savedTabs) ? saved.savedTabs : [],
    homeData: { notes, focus: { endsAt: null, remaining: 1500, duration: 1500 }, focusById: {}, tasksById: {} } };
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
  if (Array.isArray(saved.extensions)) store.extensions = saved.extensions.slice(0,100).flatMap(extension => {
    if (!extension || typeof extension.id !== 'string' || typeof extension.path !== 'string' || extension.path.length > 4096) return [];
    return [{ id: extension.id.slice(0,128), path: path.resolve(extension.path), name: String(extension.name || 'Extensão').slice(0,128), version: String(extension.version || '').slice(0,40), enabled: extension.enabled !== false, source: extension.source === 'chrome-web-store' ? 'chrome-web-store' : 'local', error: '' }];
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
  saveTimer = setTimeout(flush, 200);
}
function flush() {
  if (!storePath) return;
  try {
    fs.mkdirSync(path.dirname(storePath), { recursive: true });
    fs.writeFileSync(storePath + '.tmp', JSON.stringify({ ...store, savedTabs: tabs.filter(t => !t.private && t.connectionMode === 'normal').map(t => ({ url: t.url, pinned: t.pinned })), downloads: store.downloads.filter(d => !d.private && (d.connectionMode || 'normal') === 'normal') }, null, 2));
    fs.renameSync(storePath + '.tmp', storePath);
  } catch (error) { console.error('Não foi possível salvar o perfil:', error.message); }
}
function snapshot() {
  return { tabs: tabs.map(({ view, ...tab }) => tab), activeId, settings: store.settings, bookmarks: store.bookmarks,
    history: store.history, downloads: store.downloads, extensions: store.extensions.map(({ id, name, version, enabled, source, error }) => ({ id, name, version, enabled, source, error })),
    sitePermissions: store.sitePermissions, mods: [...builtInMods, ...store.mods], maximized: win?.isMaximized() || false,
    trackerProtection: trackerList,
    hardwareAccelerationPending: store.settings.hardwareAcceleration !== hardwareAccelerationAtLaunch,
    update: updater?.getState() || { state: 'unconfigured', currentVersion: app.getVersion(), version: '', progress: 0, message: '', releaseNotes: '', repository: '' },
    homeData: active()?.private ? { notes: {}, focus: { endsAt: null, remaining: 1500, duration: 1500 }, focusById: {}, tasksById: {} } : store.homeData };
}
function emit() { if (win && !win.isDestroyed()) win.webContents.send('cypher:state', snapshot()); }
function active() { return tabs.find(tab => tab.id === activeId); }
function shortcut(action) { win.webContents.send('cypher:shortcut', action); }
function layout() {
  if (!win || win.isDestroyed()) return;
  const [width, height] = win.getContentSize();
  const x = Math.min(Math.max(0, Math.round(viewport.x)), width);
  const y = Math.min(Math.max(0, Math.round(viewport.y)), height);
  const bounds = { x, y, width: Math.max(0, Math.min(Math.round(viewport.width), width - x)), height: Math.max(0, Math.min(Math.round(viewport.height), height - y)) };
  for (const tab of tabs) if (tab.view) {
    tab.view.setBounds(bounds);
    tab.view.setVisible(tab.id === activeId && !obscured && !tab.url.startsWith('cypher://') && !tab.error);
  }
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
  if (!tabs.some(tab => tab.id === id)) return;
  activeId = id;
  layout(); emit();
}
function loadTrackerEngine() {
  const resourcesPath = path.join(__dirname, 'resources');
  try {
    const metadata = JSON.parse(fs.readFileSync(path.join(resourcesPath, 'easyprivacy.json'), 'utf8'));
    const binary = fs.readFileSync(path.join(resourcesPath, 'easyprivacy.bin'));
    trackerEngine = FiltersEngine.deserialize(binary);
    trackerList = { ...trackerList, ...metadata, available: true, blockedRequests: 0 };
    console.info(`Proteção EasyPrivacy ativa: ${trackerList.networkRuleCount.toLocaleString('pt-BR')} regras de rede.`);
  } catch (error) {
    trackerEngine = null;
    trackerList = { ...trackerList, available: false, error: `A lista EasyPrivacy não foi carregada: ${error.message}` };
    console.warn(trackerList.error);
  }
}
function matchTrackerRequest(details) {
  if (!trackerEngine) return false;
  try {
    const sourceUrl = (details.resourceType === 'mainFrame' ? [details.url] : [details.frame?.top?.url, details.webContents?.mainFrame?.url, details.initiatorOrigin, details.initiator, details.referrer])
      .find(value => typeof value === 'string' && /^https?:\/\//i.test(value)) || '';
    const result = trackerEngine.match(Request.fromRawDetails({
      url: details.url,
      type: details.resourceType || 'other',
      sourceUrl,
    }));
    return result.match === true;
  } catch (error) {
    console.warn('Falha ao avaliar regra de rastreamento:', error.message);
    return false;
  }
}
function noteTrackerBlocked() {
  trackerList.blockedRequests++;
  if (trackerCountTimer) return;
  trackerCountTimer = setTimeout(() => { trackerCountTimer = null; emit(); }, 500);
}
function connectionPort(mode) { return mode === 'tor' ? store.settings.torSocksPort : mode === 'i2p' ? store.settings.i2pHttpPort : 0; }
function sessionPartition(tab) {
  const mode = tab.connectionMode || 'normal';
  if (tab.private) return `${privatePartition}-${mode}-${connectionPort(mode)}`;
  if (mode === 'normal') return 'persist:cypher';
  return `cypher-${mode}-${connectionPort(mode)}`;
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
function windowsSystemTool(name) {
  return path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', name);
}
function vpnPhonebook(allUsers) {
  return allUsers
    ? path.join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft', 'Network', 'Connections', 'Pbk', 'rasphone.pbk')
    : path.join(app.getPath('appData'), 'Microsoft', 'Network', 'Connections', 'Pbk', 'rasphone.pbk');
}
async function listWindowsVpnProfiles() {
  if (process.platform !== 'win32') return { supported: false, profiles: [] };
  const script = [
    "$ProgressPreference='SilentlyContinue'; $ErrorActionPreference='Stop'; [Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false)",
    '$items = New-Object System.Collections.Generic.List[object]',
    'foreach ($shared in @($false, $true)) {',
    '  try {',
    '    if ($shared) { $entries = @(Get-VpnConnection -AllUserConnection -ErrorAction Stop) } else { $entries = @(Get-VpnConnection -ErrorAction Stop) }',
    '    foreach ($entry in $entries) { $items.Add([pscustomobject]@{ name=[string]$entry.Name; serverAddress=[string]$entry.ServerAddress; tunnelType=[string]$entry.TunnelType; connectionStatus=[string]$entry.ConnectionStatus; allUserConnection=[bool]$shared }) }',
    '  } catch { }',
    '}',
    '$profiles = @($items.ToArray() | Sort-Object name, allUserConnection -Unique)',
    '[pscustomobject]@{ profiles=$profiles } | ConvertTo-Json -Depth 4 -Compress',
  ].join('; ');
  try {
    const { stdout } = await execFileAsync(windowsSystemTool('WindowsPowerShell\\v1.0\\powershell.exe'), ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], { windowsHide: true, timeout: 12000, maxBuffer: 1024 * 1024, encoding: 'utf8' });
    const result = JSON.parse(stdout.trim() || '{"profiles":[]}');
    return { supported: true, profiles: Array.isArray(result.profiles) ? result.profiles : result.profiles ? [result.profiles] : [] };
  } catch (error) {
    throw new Error(`O Windows não conseguiu ler os perfis de VPN: ${error.stderr?.trim() || error.message}`);
  }
}
async function openWindowsVpnProfile(profile) {
  const executable = windowsSystemTool('rasphone.exe');
  await new Promise((resolve, reject) => {
    const processHandle = spawn(executable, ['-d', profile.name], { detached: true, stdio: 'ignore', windowsHide: false });
    processHandle.once('error', reject);
    processHandle.once('spawn', () => { processHandle.unref(); resolve(); });
  });
  return { started: true };
}
async function disconnectWindowsVpnProfile(profile) {
  try {
    await execFileAsync(windowsSystemTool('rasdial.exe'), [profile.name, '/disconnect', `/phonebook:${vpnPhonebook(profile.allUserConnection)}`], { windowsHide: true, timeout: 15000, maxBuffer: 256 * 1024, encoding: 'utf8' });
    return { disconnected: true };
  } catch (error) {
    const detail = String(error.stderr || error.stdout || '').trim();
    if (error.code === 623 || /623/.test(detail)) throw new Error('O Windows não encontrou este perfil na agenda VPN. Abra as configurações de VPN e atualize a lista.');
    throw new Error(`Não foi possível desconectar a VPN: ${detail || error.message}`);
  }
}
function addTab(address = 'cypher://newtab', isPrivate = false, connectionMode = store.settings.connectionMode) {
  const url = resolveAddress(address, store.settings.searchEngine, store.settings.customSearchUrl);
  if (!['normal','tor','i2p'].includes(connectionMode)) connectionMode = store.settings.connectionMode;
  const tab = { id: randomUUID(), title: 'Nova aba', url: 'cypher://newtab', private: !!isPrivate,
    connectionMode, pinned: false, muted: false, audible: false, loading: false, canGoBack: false, canGoForward: false, zoom: 1, error: null };
  tabs.push(tab); activeId = tab.id;
  navigate(tab, url); emit();
  return tab.id;
}
function removeTab(tab) {
  const index = tabs.indexOf(tab);
  if (index < 0) return;
  tabs.splice(index, 1);
  if (!tab.private) closedTabs.push({ url: tab.url, title: tab.title, connectionMode: tab.connectionMode });
  if (closedTabs.length > 20) closedTabs.shift();
  if (activeId === tab.id) activeId = tabs[Math.min(index, tabs.length - 1)]?.id;
  if (!tabs.length && !closing) addTab();
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
function setupSession(ses) {
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
    try {
      const hostname = new URL(details.url).hostname.toLowerCase();
      const webContentsId = details.webContentsId ?? details.webContents?.id;
      const tab = tabs.find(entry => entry.view?.webContents.id === webContentsId);
      const normalNavigation = tab?.connectionMode === 'normal';
      const trackerBlocked = normalNavigation && store.settings.blockTrackers && matchTrackerRequest(details);
      if (trackerBlocked) noteTrackerBlocked();
      blocked = (store.settings.blockAds && matchesHost(hostname, advertisingHosts)) || trackerBlocked;
    } catch {}
    callback(blocked ? { cancel: true } : {});
  });
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    const requestHeaders = { ...details.requestHeaders };
    if (store.settings.sendDoNotTrack) requestHeaders.DNT = '1';
    if (store.settings.preferredLanguages.length) requestHeaders['Accept-Language'] = store.settings.preferredLanguages.map((language, index) => `${language}${index ? `;q=${Math.max(0.1,1-index*0.1).toFixed(1)}` : ''}`).join(',');
    if (store.settings.blockThirdPartyCookies && isThirdParty(details)) for (const key of Object.keys(requestHeaders)) if (key.toLowerCase() === 'cookie') delete requestHeaders[key];
    callback({ requestHeaders });
  });
  ses.webRequest.onHeadersReceived((details, callback) => {
    if (!details.responseHeaders) return callback({});
    const responseHeaders = { ...(details.responseHeaders || {}) };
    if (store.settings.blockThirdPartyCookies && isThirdParty(details)) for (const key of Object.keys(responseHeaders)) if (['set-cookie','set-cookie2'].includes(key.toLowerCase())) delete responseHeaders[key];
    callback({ responseHeaders });
  });
  ses.setPermissionCheckHandler((wc, permission, origin) => {
    const tab = tabs.find(entry => entry.view?.webContents === wc);
    if (!tab || !sitePermissionTypes.has(permission)) return false;
    const rule = !tab.private && store.sitePermissions.find(entry => entry.origin === origin && entry.permission === permission);
    return rule ? rule.allowed : grants.has(`${origin}:${permission}`);
  });
  ses.setPermissionRequestHandler(async (wc, permission, callback, details) => {
    if (!sitePermissionTypes.has(permission) || !tabs.some(t => t.view?.webContents === wc)) return callback(false);
    const tab = tabs.find(entry => entry.view?.webContents === wc);
    let origin;
    try { origin = new URL(details.requestingUrl || wc.getURL()).origin; } catch { return callback(false); }
    if (!/^https?:/.test(origin)) return callback(false);
    const savedRule = tab && !tab.private && store.sitePermissions.find(entry => entry.origin === origin && entry.permission === permission);
    if (savedRule) return callback(savedRule.allowed);
    if (grants.has(`${origin}:${permission}`)) return callback(true);
    const names = { media: 'câmera ou microfone', geolocation: 'localização', notifications: 'notificações', fullscreen: 'tela cheia', 'clipboard-sanitized-write': 'copiar para a área de transferência' };
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
  if (store.extensions.some(extension => extension.path === extensionPath)) throw new Error('Esta pasta já foi adicionada ao Cypher.');
  if (store.extensions.length >= 100) throw new Error('O limite é de 100 extensões instaladas.');
  if (options.expectedId && store.extensions.some(extension => extension.id === options.expectedId)) throw new Error('Esta extensão já está instalada. Remova a versão existente antes de instalar novamente.');
  if (!(await confirmExtensionInstall(manifest))) return { cancelled:true };
  const loaded = await session.fromPartition('persist:cypher').extensions.loadExtension(extensionPath, { allowFileAccess: false });
  if (store.extensions.some(extension => extension.id === loaded.id)) {
    throw new Error('Uma extensão com este identificador já está instalada. Remova-a antes de adicionar outra versão.');
  }
  if (options.expectedId && loaded.id !== options.expectedId) {
    session.fromPartition('persist:cypher').extensions.removeExtension(loaded.id);
    throw new Error('O identificador instalado não corresponde à assinatura e ao link da Chrome Web Store.');
  }
  const name = /^__MSG_.*__$/.test(manifest.name) ? manifest.short_name || 'Extensão' : manifest.name;
  store.extensions.unshift({ id: loaded.id, path: extensionPath, name: String(loaded.name || name).slice(0,128), version: String(loaded.version || manifest.version).slice(0,40), enabled: true, source:options.source === 'chrome-web-store' ? 'chrome-web-store' : 'local', error: '' });
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
  setupSession(ses); await prepareProxy(routeTab, ses);
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
async function loadStoredExtensions() {
  const ses = session.fromPartition('persist:cypher');
  for (const extension of store.extensions) {
    if (!extension.enabled) continue;
    try {
      const loaded = await ses.extensions.loadExtension(extension.path, { allowFileAccess: false });
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
  setupSession(ses);
  void prepareProxy(tab, ses).catch(error => { tab.error = `Não foi possível configurar ${tab.connectionMode}: ${error.message}`; layout(); emit(); });
  const view = new WebContentsView({ webPreferences: { session: ses, nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, allowRunningInsecureContent: false } });
  tab.view = view;
  win.contentView.addChildView(view);
  const wc = view.webContents;
  wc.setZoomFactor(store.settings.defaultZoom);
  wc.setWebRTCIPHandlingPolicy(tab.connectionMode === 'normal' ? store.settings.webrtcPolicy : 'disable_non_proxied_udp');
  wc.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) {
      if (store.settings.openLinksInNewTab) addTab(url, tab.private, tab.connectionMode);
      else setImmediate(() => { if (tabs.includes(tab)) navigate(tab, url); });
    }
    return { action: 'deny' };
  });
  wc.on('will-navigate', (event, url) => { if (!/^https?:\/\//.test(url)) event.preventDefault(); });
  wc.on('will-redirect', (event, url) => { if (!/^https?:\/\//.test(url)) event.preventDefault(); });
  wc.on('did-start-loading', () => { tab.loading = true; tab.error = null; update(tab); layout(); });
  wc.on('did-stop-loading', () => update(tab));
  wc.on('page-title-updated', (_event, title) => { tab.title = title; update(tab); });
  wc.on('did-navigate', (_event, url) => {
    tab.url = url; tab.error = null;
    if (!tab.private && tab.connectionMode === 'normal') {
      store.history.unshift({ id: randomUUID(), url, title: wc.getTitle() || url, date: Date.now() });
      store.history = store.history.slice(0,1000); persist();
    }
    layout(); update(tab);
  });
  wc.on('did-navigate-in-page', (_event, url, mainFrame) => { if (mainFrame) { tab.url = url; update(tab); } });
  wc.on('did-finish-load', () => {
    if (!tab.private && tab.connectionMode === 'normal') { const entry = store.history.find(h => h.url === tab.url); if (entry) { entry.title = wc.getTitle(); persist(); } }
    update(tab);
  });
  wc.on('did-fail-load', (_event, code, description, _url, mainFrame) => {
    if (!mainFrame || code === -3) return;
    tab.error = `${description} (${code})`; tab.loading = false; layout(); emit();
  });
  wc.on('render-process-gone', () => { tab.error = 'A página foi encerrada. Recarregue para continuar.'; tab.loading = false; layout(); emit(); });
  wc.on('media-started-playing', () => update(tab)); wc.on('media-paused', () => update(tab));
  wc.on('will-prevent-unload', async () => {
    const result = await dialog.showMessageBox(win, { type: 'question', message: 'Esta página pode ter alterações não salvas. Sair mesmo assim?', buttons: ['Ficar na página','Sair'], defaultId: 0, cancelId: 0 });
    if (result.response === 1) { wc.removeAllListeners('will-prevent-unload'); wc.close(); }
  });
  wc.on('enter-html-full-screen', () => { win.setFullScreen(true); shortcut('page-fullscreen'); });
  wc.on('leave-html-full-screen', () => { win.setFullScreen(false); shortcut('leave-fullscreen'); });
  wc.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'Escape') { shortcut('escape'); return; }
    if ((input.control || input.meta) && input.key.toLowerCase() === 'l') { event.preventDefault(); shortcut('address'); }
  });
  wc.on('context-menu', (_event, params) => {
    const template = [];
    if (store.settings.translationEnabled && /^https?:\/\//.test(tab.url)) template.push({ label: 'Traduzir esta página', click: () => { void command('page:translate').catch(error => console.error('Não foi possível abrir a tradução:', error.message)); } }, { type: 'separator' });
    if (/^https?:\/\//.test(params.linkURL)) template.push({ label: 'Abrir link em nova aba', click: () => addTab(params.linkURL, tab.private, tab.connectionMode) }, { label: 'Copiar endereço do link', click: () => clipboard.writeText(params.linkURL) }, { type: 'separator' });
    if (params.isEditable) template.push({ role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { type: 'separator' });
    else if (params.selectionText) template.push({ role: 'copy' }, { label: 'Pesquisar seleção', click: () => addTab(resolveAddress(params.selectionText, store.settings.searchEngine, store.settings.customSearchUrl), tab.private, tab.connectionMode) }, { type: 'separator' });
    template.push({ label: 'Voltar', enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() }, { label: 'Avançar', enabled: wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() }, { label: 'Recarregar', click: () => wc.reload() }, { type: 'separator' }, { label: 'Salvar página…', click: () => savePage(tab) }, { label: 'Imprimir…', click: () => wc.print({}) }, { label: 'Inspecionar elemento', click: () => wc.inspectElement(params.x, params.y) });
    Menu.buildFromTemplate(template).popup({ window: win });
  });
  wc.once('destroyed', () => {
    if (win && !win.isDestroyed()) win.contentView.removeChildView(view);
    if (tab.view === view) removeTab(tab);
  });
  return view;
}
function navigate(tab, input) {
  const url = resolveAddress(input, store.settings.searchEngine, store.settings.customSearchUrl);
  tab.url = url; tab.error = null;
  if (url.startsWith('cypher://')) {
    tab.loading = false; tab.title = ({ newtab: 'Nova aba', settings: 'Configurações', security: 'Segurança', profile: 'Perfil', extensions: 'Extensões', bookmarks: 'Favoritos', history: 'Histórico', downloads: 'Downloads', mods: 'Mods' })[url.slice(9)];
    tab.view?.webContents.stop(); layout(); emit(); return;
  }
  const view = tab.view || attachView(tab);
  tab.title = new URL(url).hostname; tab.loading = true;
  const ses = view.webContents.session;
  const routeReady = tab.connectionMode === 'normal'
    ? Promise.resolve()
    : privacyServices.start(tab.connectionMode, connectionPort(tab.connectionMode));
  void routeReady.then(() => proxyReady.get(ses) || Promise.resolve()).then(() => view.webContents.loadURL(url)).catch(error => {
    tab.error = `Não foi possível iniciar a conexão ${tab.connectionMode}: ${error.message}`; tab.loading = false; layout(); emit();
  });
  layout(); emit();
}
function applyConnectionMode(mode) {
  store.settings.connectionMode = mode;
  for (const tab of [...tabs]) {
    const address = tab.url;
    tab.connectionMode = mode;
    tab.error = null;
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
    ...configuredSessions,
    session.fromPartition('persist:cypher'),
    session.fromPartition(`cypher-tor-${store.settings.torSocksPort}`),
    session.fromPartition(`cypher-i2p-${store.settings.i2pHttpPort}`),
  ]);
  await Promise.all([...sessions].map(async ses => {
    await ses.clearStorageData();
    await ses.clearCache();
  }));
}
function setSettings(payload) {
  const previous = store.settings;
  store.settings = sanitizeSettings(payload, store.settings); store.settings.activeMod = '';
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
  persist(); emit();
}
async function command(action, payload) {
  const tab = active(), wc = tab?.view?.webContents;
  switch (action) {
    case 'state': return snapshot();
    case 'extension:install': {
      const result = await dialog.showOpenDialog(win, { title: 'Selecionar extensão descompactada', properties: ['openDirectory'] });
      if (result.canceled || !result.filePaths[0]) break;
      return installExtension(result.filePaths[0]);
    }
    case 'extension:install-webstore': return installChromeStoreExtension(payload);
    case 'extension:toggle': {
      const extension = store.extensions.find(entry => entry.id === payload?.id);
      if (!extension || typeof payload?.enabled !== 'boolean') break;
      const ses = session.fromPartition('persist:cypher');
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
      const ses = session.fromPartition('persist:cypher');
      if (ses.extensions.getExtension(extension.id)) ses.extensions.removeExtension(extension.id);
      store.extensions = store.extensions.filter(entry => entry.id !== extension.id);
      if (extension.source === 'chrome-web-store') {
        const root = path.resolve(app.getPath('userData'), 'extensions'), target = path.resolve(extension.path);
        if (target.startsWith(root + path.sep)) await fs.promises.rm(target, { recursive:true, force:true });
      }
      persist(); emit(); break;
    }
    case 'site-permission:remove': {
      store.sitePermissions = store.sitePermissions.filter(entry => entry.id !== payload);
      persist(); emit(); break;
    }
    case 'site-permission:clear': store.sitePermissions = []; persist(); emit(); break;
    case 'tab:new': return addTab(payload?.url, payload?.private, payload?.connectionMode);
    case 'tab:select': selectTab(payload); break;
    case 'tab:close': closeTab(payload); break;
    case 'tab:restore': { const previous = closedTabs.pop(); if (previous) addTab(previous.url, false, previous.connectionMode); break; }
    case 'tab:pin': { const target = tabs.find(t => t.id === payload); if (target) target.pinned = !target.pinned; emit(); break; }
    case 'tab:mute': { const target = tabs.find(t => t.id === payload); if (target) { target.muted = !target.muted; target.view?.webContents.setAudioMuted(target.muted); emit(); } break; }
    case 'tab:move': { const from = tabs.findIndex(t => t.id === payload?.from), to = tabs.findIndex(t => t.id === payload?.to); if (from >= 0 && to >= 0) tabs.splice(to, 0, tabs.splice(from, 1)[0]); emit(); break; }
    case 'navigate': if (tab) navigate(tab, payload); break;
    case 'back': if (wc?.navigationHistory.canGoBack()) wc.navigationHistory.goBack(); break;
    case 'forward': if (wc?.navigationHistory.canGoForward()) wc.navigationHistory.goForward(); break;
    case 'reload': if (tab) navigate(tab, tab.url); break;
    case 'stop': wc?.stop(); break;
    case 'viewport': {
      if (!payload || !['x','y','width','height'].every(k => Number.isFinite(payload[k]))) break;
      viewport = payload; obscured = !!payload.obscured; layout(); break;
    }
    case 'settings': setSettings(payload); break;
    case 'system:default-browser': {
      if (process.platform !== 'win32') throw new Error('A seleção do navegador padrão é feita nas configurações do sistema operacional.');
      await shell.openExternal('ms-settings:defaultapps');
      return { opened: true };
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
    case 'update:check': return updater.check();
    case 'update:install': return updater.downloadAndInstall();
    case 'update:dismiss': return updater.dismiss();
    case 'update:ack': return updater.finishAnimation();
    case 'connection:check': {
      const mode = payload === 'tor' || payload === 'i2p' ? payload : 'normal';
      if (mode === 'normal') return { mode, available: true, port: null };
      const port = connectionPort(mode);
      return { mode, available: await privacyServices.check(mode, port), port };
    }
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
    case 'vpn:list': return listWindowsVpnProfiles();
    case 'vpn:connect':
    case 'vpn:disconnect': {
      if (process.platform !== 'win32') throw new Error('A VPN nativa está disponível na versão Windows do Cypher.');
      const name = typeof payload?.name === 'string' ? payload.name.slice(0, 256) : '';
      if (!name) throw new Error('Selecione um perfil de VPN do Windows.');
      const allUserConnection = payload?.allUserConnection === true;
      const { profiles } = await listWindowsVpnProfiles();
      const profile = profiles.find(entry => entry.name === name && entry.allUserConnection === allUserConnection);
      if (!profile) throw new Error('Este perfil não existe mais no Windows. Atualize a lista de VPNs.');
      return action === 'vpn:connect' ? openWindowsVpnProfile(profile) : disconnectWindowsVpnProfile(profile);
    }
    case 'vpn:settings': {
      if (process.platform !== 'win32') throw new Error('A configuração de VPN nativa está disponível no Windows.');
      await shell.openExternal('ms-settings:network-vpnsettings');
      return { opened: true };
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
    case 'mod:apply': { const mod = [...builtInMods, ...store.mods].find(m => m.id === payload); if (mod) { const personal = { connectionMode: store.settings.connectionMode, torSocksPort: store.settings.torSocksPort, i2pHttpPort: store.settings.i2pHttpPort, restoreSession: store.settings.restoreSession, startupMode: store.settings.startupMode, startupPages: store.settings.startupPages, showHomeFirst: store.settings.showHomeFirst, openLinksInNewTab: store.settings.openLinksInNewTab, showSearchSuggestions: store.settings.showSearchSuggestions, showBookmarksBar: store.settings.showBookmarksBar, suggestBookmarks: store.settings.suggestBookmarks, suggestHistory: store.settings.suggestHistory, clearDataOnExit: store.settings.clearDataOnExit, clearHistoryOnExit: store.settings.clearHistoryOnExit, confirmCloseWithMultipleTabs: store.settings.confirmCloseWithMultipleTabs, sendDoNotTrack: store.settings.sendDoNotTrack, blockAds: store.settings.blockAds, blockTrackers: store.settings.blockTrackers, blockThirdPartyCookies: store.settings.blockThirdPartyCookies, preferredLanguages: store.settings.preferredLanguages, spellCheckEnabled: store.settings.spellCheckEnabled, spellCheckLanguages: store.settings.spellCheckLanguages, translationEnabled: store.settings.translationEnabled, hardwareAcceleration: store.settings.hardwareAcceleration, webrtcPolicy: store.settings.webrtcPolicy, defaultZoom: store.settings.defaultZoom, downloadDirectory: store.settings.downloadDirectory, startWithWindows: store.settings.startWithWindows, searchEngine: store.settings.searchEngine, customSearchUrl: store.settings.customSearchUrl, backgroundMusicEnabled: false }; store.settings = { ...sanitizeSettings(mod.settings, store.settings), ...personal }; store.settings.activeMod = mod.id; persist(); emit(); } break; }
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
  const run = (action, payload) => () => { void command(action, payload).catch(console.error); };
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Cypher', submenu: [
      { label: 'Nova aba', accelerator: 'CmdOrCtrl+T', click: run('tab:new') },
      { label: 'Nova aba privada', accelerator: 'CmdOrCtrl+Shift+N', click: run('tab:new', { private: true }) },
      { label: 'Fechar aba', accelerator: 'CmdOrCtrl+W', click: () => closeTab(activeId) },
      { label: 'Reabrir aba', accelerator: 'CmdOrCtrl+Shift+T', click: run('tab:restore') },
      { label: 'Próxima aba', accelerator: 'Ctrl+Tab', click: () => selectTab(tabs[(tabs.findIndex(t => t.id === activeId) + 1) % tabs.length]?.id) },
      { label: 'Aba anterior', accelerator: 'Ctrl+Shift+Tab', click: () => selectTab(tabs[(tabs.findIndex(t => t.id === activeId) - 1 + tabs.length) % tabs.length]?.id) },
      { type: 'separator' }, { role: 'quit', label: 'Sair' },
    ] },
    { label: 'Navegação', submenu: [
      { label: 'Endereço', accelerator: 'CmdOrCtrl+L', click: () => shortcut('address') },
      { label: 'Voltar', accelerator: 'Alt+Left', click: run('back') },
      { label: 'Avançar', accelerator: 'Alt+Right', click: run('forward') },
      { label: 'Recarregar', accelerator: 'CmdOrCtrl+R', click: run('reload') },
      { label: 'Recarregar página', accelerator: 'F5', click: run('reload') },
      { label: 'Localizar', accelerator: 'CmdOrCtrl+F', click: () => shortcut('find') },
      { label: 'Favoritar', accelerator: 'CmdOrCtrl+D', click: run('bookmark:toggle') },
      { label: 'Histórico', accelerator: 'CmdOrCtrl+H', click: run('tab:new', { url: 'cypher://history' }) },
      { label: 'Downloads', accelerator: 'CmdOrCtrl+J', click: run('tab:new', { url: 'cypher://downloads' }) },
      { label: 'Imprimir', accelerator: 'CmdOrCtrl+P', click: run('print') },
      { label: 'Salvar página', accelerator: 'CmdOrCtrl+S', click: run('save') },
    ] },
    { label: 'Exibir', submenu: [
      { label: 'Tela cheia', accelerator: 'F11', click: run('window:fullscreen') },
      { label: 'Ampliar', accelerator: 'CmdOrCtrl+=', click: () => command('zoom', (active()?.zoom || 1) + 0.1) },
      { label: 'Reduzir', accelerator: 'CmdOrCtrl+-', click: () => command('zoom', (active()?.zoom || 1) - 0.1) },
      { label: 'Zoom original', accelerator: 'CmdOrCtrl+0', click: run('zoom', 1) },
      { label: 'Ferramentas de desenvolvedor', accelerator: 'F12', click: run('devtools') },
    ] },
    { label: 'Editar', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
  ]));
}
app.whenReady().then(async () => {
  if (!hasInstanceLock) return;
  protocol.registerSource('cypher-ui', { routes: [{ match: { host: 'app' }, source: { type: 'directory', root: path.resolve(__dirname, '../dist'), index: 'index.html', headers: { 'X-Content-Type-Options': 'nosniff' } } }] });
  loadTrackerEngine();
  loadStore();
  await loadStoredExtensions();
  updater = createUpdater({ app, publish: () => emit(), scheduleQuit: () => setTimeout(() => app.quit(), 1300) });
  if (process.platform === 'win32' && store.settings.startWithWindows) {
    try { app.setLoginItemSettings({ openAtLogin: true, path: process.execPath, args: app.isPackaged ? [] : [app.getAppPath()] }); }
    catch (error) { console.error('Não foi possível aplicar a inicialização com o Windows:', error.message); }
  }
  win = new BrowserWindow({ width: 1440, height: 940, minWidth: 960, minHeight: 650, frame: false, backgroundColor: '#090c0b', show: false, icon: path.join(__dirname,'../build/icon.png'),
    webPreferences: { preload: path.join(__dirname,'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, allowRunningInsecureContent: false } });
  const devURL = process.env.CYPHER_DEV_URL;
  const trustedURL = devURL || 'cypher-ui://app/index.html';
  ipcMain.handle('cypher:command', (event, action, payload) => {
    if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame || event.senderFrame.url !== trustedURL + (devURL ? '/' : '')) throw new Error('Origem não autorizada.');
    return command(action, payload);
  });
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.on('resize', layout);
  win.on('maximize', emit); win.on('unmaximize', emit);
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
  const homeFirstId = addTab('cypher://newtab', false, store.settings.connectionMode);
  const startupMode = store.settings.startupMode;
  if (startupMode === 'restore') {
    for (const savedTab of store.savedTabs.slice(0,50)) {
      try { const id = addTab(savedTab.url, false, store.settings.connectionMode); tabs.find(t => t.id === id).pinned = !!savedTab.pinned; } catch {}
    }
  } else if (startupMode === 'specific') {
    for (const url of store.settings.startupPages.slice(0,10)) { try { addTab(url, false, store.settings.connectionMode); } catch {} }
  }
  for (const url of pendingExternalUrls.splice(0,10)) { try { addTab(url, false, store.settings.connectionMode); } catch {} }
  if (homeFirstId) selectTab(homeFirstId);
  await win.loadURL(trustedURL);
  win.show();
  updater.acknowledgeStartup();
  updater.start();
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', event => {
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
