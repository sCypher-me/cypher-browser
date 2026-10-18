// Importação de favoritos e histórico de outros navegadores instalados no Windows.
// Os bancos SQLite ficam travados enquanto o navegador está aberto: copiamos para uma pasta
// temporária e lemos a cópia, sem nunca escrever no perfil de origem.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CHROMIUM_BROWSERS = [
  { id: 'chrome', name: 'Google Chrome', root: ['LOCALAPPDATA', 'Google', 'Chrome', 'User Data'] },
  { id: 'edge', name: 'Microsoft Edge', root: ['LOCALAPPDATA', 'Microsoft', 'Edge', 'User Data'] },
  { id: 'brave', name: 'Brave', root: ['LOCALAPPDATA', 'BraveSoftware', 'Brave-Browser', 'User Data'] },
  { id: 'vivaldi', name: 'Vivaldi', root: ['LOCALAPPDATA', 'Vivaldi', 'User Data'] },
  { id: 'opera', name: 'Opera', root: ['APPDATA', 'Opera Software', 'Opera Stable'], single: true },
];
const HISTORY_LIMIT = 1000;
const BOOKMARK_LIMIT = 5000;
// Chromium conta microssegundos desde 1601-01-01; o Firefox, microssegundos desde 1970.
// Os valores passam de 2^53: o SQL divide por 1000 antes de chegarem ao JavaScript.
const WEBKIT_EPOCH_OFFSET_MS = 11644473600000;

function exists(file) { try { fs.accessSync(file); return true; } catch { return false; } }
function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }

function webkitToMs(value) {
  const micro = Number(value);
  if (!Number.isFinite(micro) || micro <= 0) return 0;
  const ms = Math.round(micro / 1000 - WEBKIT_EPOCH_OFFSET_MS);
  return ms > 0 ? ms : 0;
}

/** Só endereços http(s) de tamanho razoável entram no Cypher. */
function cleanLink(url, title, date) {
  if (typeof url !== 'string' || url.length > 2048 || !/^https?:\/\//i.test(url)) return null;
  try { new URL(url); } catch { return null; }
  const text = String(title || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  return { url, title: text || new URL(url).hostname, date: Number.isFinite(date) && date > 0 ? date : Date.now() };
}

function chromiumProfiles(root, single) {
  if (single) return exists(path.join(root, 'Bookmarks')) || exists(path.join(root, 'History')) ? [{ id: '', name: 'Perfil principal', dir: root }] : [];
  const state = readJson(path.join(root, 'Local State'));
  const cache = state?.profile?.info_cache && typeof state.profile.info_cache === 'object' ? state.profile.info_cache : {};
  const names = new Set(['Default', ...Object.keys(cache)]);
  try { for (const entry of fs.readdirSync(root)) if (/^Profile \d+$/.test(entry)) names.add(entry); } catch {}
  const profiles = [];
  for (const id of names) {
    const dir = path.join(root, id);
    if (!exists(path.join(dir, 'Bookmarks')) && !exists(path.join(dir, 'History'))) continue;
    const label = typeof cache[id]?.name === 'string' && cache[id].name.trim() ? cache[id].name.trim() : id === 'Default' ? 'Perfil principal' : id;
    profiles.push({ id, name: label.slice(0, 80), dir });
  }
  return profiles;
}

function parseProfilesIni(text) {
  const sections = [];
  let current = null;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    const header = /^\[(.+)\]$/.exec(line);
    if (header) { current = { section: header[1] }; sections.push(current); continue; }
    const pair = /^([^=]+)=(.*)$/.exec(line);
    if (pair && current) current[pair[1].trim()] = pair[2].trim();
  }
  return sections.filter(item => /^Profile\d+$/.test(item.section) && item.Path);
}

function firefoxProfiles(appData) {
  const base = path.join(appData, 'Mozilla', 'Firefox');
  let ini = '';
  try { ini = fs.readFileSync(path.join(base, 'profiles.ini'), 'utf8'); } catch { return []; }
  return parseProfilesIni(ini).flatMap(item => {
    const dir = item.IsRelative === '0' ? item.Path : path.join(base, ...item.Path.split('/'));
    if (!exists(path.join(dir, 'places.sqlite'))) return [];
    return [{ id: item.Path, name: String(item.Name || 'Perfil').slice(0, 80), dir }];
  });
}

/** Navegadores com algum perfil legível neste computador. `env` permite apontar para pastas de teste. */
function detectBrowsers(env = process.env) {
  const found = [];
  for (const browser of CHROMIUM_BROWSERS) {
    const base = env[browser.root[0]];
    if (!base) continue;
    const profiles = chromiumProfiles(path.join(base, ...browser.root.slice(1)), browser.single);
    if (profiles.length) found.push({ id: browser.id, name: browser.name, kind: 'chromium', profiles });
  }
  if (env.APPDATA) {
    const profiles = firefoxProfiles(env.APPDATA);
    if (profiles.length) found.push({ id: 'firefox', name: 'Mozilla Firefox', kind: 'firefox', profiles });
  }
  return found;
}

/** Achata a árvore de favoritos do Chromium (barra, outros e celular). */
function parseChromiumBookmarks(data) {
  const results = [];
  const walk = (node, folder) => {
    if (!node || typeof node !== 'object' || results.length >= BOOKMARK_LIMIT) return;
    if (node.type === 'url') {
      const link = cleanLink(node.url, node.name, webkitToMs(node.date_added));
      if (link) results.push({ ...link, folder });
      return;
    }
    if (Array.isArray(node.children)) for (const child of node.children) walk(child, node.type === 'folder' && node.name ? node.name : folder);
  };
  const roots = data?.roots && typeof data.roots === 'object' ? data.roots : {};
  for (const key of ['bookmark_bar', 'other', 'synced']) walk(roots[key], '');
  return results;
}

/** Copia o banco (e o diário WAL, se houver) e abre a cópia só para leitura. */
function withSqliteCopy(file, read) {
  const { DatabaseSync } = require('node:sqlite');
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'cypher-import-'));
  const copy = path.join(folder, 'data.sqlite');
  try {
    try { fs.copyFileSync(file, copy); }
    catch (error) { throw new Error(error?.code === 'EBUSY' || error?.code === 'EPERM' ? 'O navegador de origem está travando os dados. Feche-o e tente de novo.' : `Não foi possível ler ${path.basename(file)}.`); }
    for (const suffix of ['-wal', '-journal']) if (exists(file + suffix)) { try { fs.copyFileSync(file + suffix, copy + suffix); } catch {} }
    const db = new DatabaseSync(copy, { readOnly: true });
    try { return read(db); } finally { db.close(); }
  } finally { fs.rmSync(folder, { recursive: true, force: true }); }
}

function readChromiumHistory(file, limit = HISTORY_LIMIT) {
  return withSqliteCopy(file, db => db.prepare('SELECT url, title, last_visit_time / 1000 AS visited FROM urls WHERE hidden = 0 AND last_visit_time > 0 ORDER BY last_visit_time DESC LIMIT ?').all(limit))
    .map(row => cleanLink(row.url, row.title, webkitToMs(Number(row.visited) * 1000))).filter(Boolean);
}

function readFirefoxPlaces(file, { bookmarks, history }, limit = HISTORY_LIMIT) {
  return withSqliteCopy(file, db => ({
    bookmarks: bookmarks ? db.prepare(`SELECT b.title AS title, p.url AS url, b.dateAdded / 1000 AS added, f.title AS folder
      FROM moz_bookmarks b JOIN moz_places p ON p.id = b.fk LEFT JOIN moz_bookmarks f ON f.id = b.parent
      WHERE b.type = 1 ORDER BY b.dateAdded ASC LIMIT ?`).all(BOOKMARK_LIMIT)
      .map(row => { const link = cleanLink(row.url, row.title, Number(row.added)); return link && { ...link, folder: ['menu', 'toolbar', 'unfiled', 'mobile'].includes(row.folder) ? '' : String(row.folder || '').slice(0, 80) }; }).filter(Boolean) : [],
    history: history ? db.prepare('SELECT url, title, last_visit_date / 1000 AS visited FROM moz_places WHERE hidden = 0 AND last_visit_date IS NOT NULL ORDER BY last_visit_date DESC LIMIT ?').all(limit)
      .map(row => cleanLink(row.url, row.title, Number(row.visited))).filter(Boolean) : [],
  }));
}

/** Lê o que foi pedido de um perfil já detectado. */
function readProfile(browser, profile, wanted = { bookmarks: true, history: true }) {
  if (browser.kind === 'firefox') return readFirefoxPlaces(path.join(profile.dir, 'places.sqlite'), wanted);
  const result = { bookmarks: [], history: [] };
  if (wanted.bookmarks && exists(path.join(profile.dir, 'Bookmarks'))) result.bookmarks = parseChromiumBookmarks(readJson(path.join(profile.dir, 'Bookmarks')));
  if (wanted.history && exists(path.join(profile.dir, 'History'))) result.history = readChromiumHistory(path.join(profile.dir, 'History'));
  return result;
}

/**
 * Junta o que veio de fora com o que o Cypher já tem. Favoritos repetidos (mesmo endereço) são
 * ignorados; o histórico é reordenado do mais recente para o mais antigo e limitado.
 */
function mergeImport(current, incoming, makeId) {
  const known = new Set(current.bookmarks.map(item => item.url));
  const bookmarks = [...current.bookmarks];
  let addedBookmarks = 0;
  for (const item of incoming.bookmarks || []) {
    if (known.has(item.url) || bookmarks.length >= BOOKMARK_LIMIT) continue;
    known.add(item.url);
    bookmarks.push({ id: makeId(), title: item.title, url: item.url, date: item.date, ...(item.folder ? { folder: item.folder } : {}) });
    addedBookmarks++;
  }
  const visited = new Set(current.history.map(item => item.url));
  const fresh = (incoming.history || []).filter(item => !visited.has(item.url) && (visited.add(item.url), true));
  const history = [...current.history, ...fresh.map(item => ({ id: makeId(), url: item.url, title: item.title, date: item.date }))]
    .sort((a, b) => b.date - a.date).slice(0, HISTORY_LIMIT);
  const previous = new Set(current.history.map(item => item.id));
  return { bookmarks, history, addedBookmarks, addedHistory: history.filter(item => !previous.has(item.id)).length };
}

module.exports = { detectBrowsers, parseChromiumBookmarks, parseProfilesIni, readProfile, readChromiumHistory, readFirefoxPlaces, mergeImport, webkitToMs };
