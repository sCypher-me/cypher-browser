// Proteção contra sites perigosos (Google Safe Browsing v4, API de atualização).
// As listas de prefixos de hash ficam no computador; o endereço visitado nunca sai daqui.
// Só quando um prefixo local coincide o Cypher pergunta ao Google pelos hashes completos
// daquele prefixo (4 bytes), como o Chrome faz.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');

const THREAT_TYPES = ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'];
const PLATFORMS = ['ANY_PLATFORM', 'ALL_PLATFORMS', 'WINDOWS'];
const DEFAULT_LISTS = [
  { threatType: 'MALWARE', platformType: 'ANY_PLATFORM', threatEntryType: 'URL' },
  { threatType: 'SOCIAL_ENGINEERING', platformType: 'ANY_PLATFORM', threatEntryType: 'URL' },
  { threatType: 'UNWANTED_SOFTWARE', platformType: 'ANY_PLATFORM', threatEntryType: 'URL' },
];

// ---- Canonicalização (developers.google.com/safe-browsing/v4/urls-hashing) ----
const toBytes = text => Buffer.from(text, 'utf8').toString('latin1');
function unescapeAll(value) {
  let previous;
  do { previous = value; value = value.replace(/%([\da-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))); } while (value !== previous);
  return value;
}
function escapeBytes(value) {
  let out = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    out += code <= 32 || code >= 127 || char === '#' || char === '%' ? `%${code.toString(16).toUpperCase().padStart(2, '0')}` : char;
  }
  return out;
}
function canonicalHost(raw) {
  let host = raw.replace(/^[^@]*@/, '').replace(/:\d*$/, '').replace(/\.+/g, '.').replace(/^\.|\.$/g, '').toLowerCase();
  if (/^(0x[\da-f]*|\d+)(\.(0x[\da-f]*|\d+)){0,3}$/i.test(host)) { try { host = new URL(`http://${host}/`).hostname; } catch {} }
  return host;
}
function canonicalPath(raw) {
  const segments = [];
  const parts = raw.split('/');
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    if (part === '..') { segments.pop(); continue; }
    if (part === '.' || part === '') continue;
    segments.push(part);
  }
  const trailing = raw.endsWith('/') || raw.endsWith('/.') || raw.endsWith('/..') || !segments.length;
  return `/${segments.join('/')}${trailing && segments.length ? '/' : ''}`;
}
/** Endereço na forma canônica do Safe Browsing (sem fragmento, porta e usuário). */
function canonicalize(input) {
  let url = toBytes(String(input || '')).trim().replace(/[\t\r\n]/g, '');
  url = url.replace(/#.*$/s, '');
  url = unescapeAll(url);
  let scheme = 'http';
  const withScheme = /^([a-z][a-z\d+.-]*):\/\/(.*)$/is.exec(url);
  let rest = url;
  if (withScheme) { scheme = withScheme[1].toLowerCase(); rest = withScheme[2]; }
  const authorityEnd = rest.search(/[/?]/);
  const authority = authorityEnd < 0 ? rest : rest.slice(0, authorityEnd);
  const remainder = authorityEnd < 0 ? '' : rest.slice(authorityEnd);
  const queryAt = remainder.indexOf('?');
  const rawPath = queryAt < 0 ? remainder : remainder.slice(0, queryAt);
  const query = queryAt < 0 ? '' : remainder.slice(queryAt);
  return `${scheme}://${escapeBytes(canonicalHost(authority))}${escapeBytes(canonicalPath(rawPath))}${escapeBytes(query)}`;
}

/** Combinações host × caminho que o Safe Browsing verifica para um endereço. */
function expressions(input) {
  const canonical = canonicalize(input);
  const match = /^[a-z][a-z\d+.-]*:\/\/([^/]*)(\/[^?]*)(\?.*)?$/i.exec(canonical);
  if (!match) return [];
  const [, host, pathOnly, query = ''] = match;
  const hosts = [host];
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const parts = host.split('.');
    for (let start = Math.max(1, parts.length - 5); start <= parts.length - 2; start++) hosts.push(parts.slice(start).join('.'));
  }
  const paths = [pathOnly + query];
  if (query) paths.push(pathOnly);
  // Raiz e até três pastas acumuladas ("/", "/1/", "/1/2/", "/1/2/3/").
  const pieces = pathOnly.split('/').filter(Boolean);
  const folders = pathOnly.endsWith('/') ? pieces : pieces.slice(0, -1);
  let prefix = '/';
  for (let index = 0; index < 4; index++) {
    if (!paths.includes(prefix)) paths.push(prefix);
    if (index >= folders.length) break;
    prefix += `${folders[index]}/`;
  }
  const result = [];
  for (const h of hosts) for (const p of paths) if (!result.includes(h + p)) result.push(h + p);
  return result;
}
function fullHash(expression) { return createHash('sha256').update(Buffer.from(expression, 'latin1')).digest(); }

// ---- Banco local de prefixos ----
function listKey(list) { return `${list.threatType}/${list.platformType}/${list.threatEntryType}`; }
function seconds(duration) { const value = Number.parseFloat(String(duration || '').replace(/s$/, '')); return Number.isFinite(value) ? value : 0; }

/** Aplica uma resposta de atualização a uma lista ordenada de prefixos (strings latin1). */
function applyUpdate(current, response) {
  let prefixes = response.responseType === 'FULL_UPDATE' ? [] : [...current];
  if (response.responseType !== 'FULL_UPDATE') {
    const removals = new Set();
    for (const removal of response.removals || []) for (const index of removal.rawIndices?.indices || []) removals.add(index);
    if (removals.size) prefixes = prefixes.filter((_, index) => !removals.has(index));
  }
  for (const addition of response.additions || []) {
    if (addition.compressionType && addition.compressionType !== 'RAW') throw new Error('Compressão não suportada.');
    const size = addition.rawHashes?.prefixSize;
    const data = Buffer.from(addition.rawHashes?.rawHashes || '', 'base64');
    if (!size || data.length % size) throw new Error('Prefixos inválidos.');
    for (let offset = 0; offset < data.length; offset += size) prefixes.push(data.subarray(offset, offset + size).toString('latin1'));
  }
  prefixes.sort();
  const expected = response.checksum?.sha256;
  if (expected) {
    const digest = createHash('sha256').update(Buffer.from(prefixes.join(''), 'latin1')).digest('base64');
    if (digest !== expected) throw new Error('Soma de verificação da lista não confere.');
  }
  return prefixes;
}

function createSafeBrowsing({ key, directory, fetchImpl, now = () => Date.now(), clientVersion = '0', endpoint = 'https://safebrowsing.googleapis.com/v4', log = () => {} }) {
  const lists = new Map(); // chave -> { list, state, prefixes: string[], set: Set, sizes: Set }
  const positive = new Map(); // hash completo (latin1) -> { threatType, expires }
  const negative = new Map(); // prefixo (latin1) -> expira em
  let timer = null, nextUpdateAt = 0, lastUpdate = 0, lastError = '', updating = false, stopped = false;
  const file = path.join(directory, 'safe-browsing.json');
  const client = { clientId: 'cypher-browser', clientVersion };

  function index(entry) { entry.set = new Set(entry.prefixes); entry.sizes = new Set(entry.prefixes.map(prefix => prefix.length)); return entry; }
  function load() {
    try {
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const item of saved.lists || []) {
        if (!item?.list || typeof item.data !== 'string' || !Array.isArray(item.sizes)) continue;
        const data = Buffer.from(item.data, 'base64').toString('latin1');
        const prefixes = [];
        let offset = 0;
        for (const [size, count] of item.sizes) { for (let i = 0; i < count; i++, offset += size) prefixes.push(data.slice(offset, offset + size)); }
        prefixes.sort();
        lists.set(listKey(item.list), index({ list: item.list, state: String(item.state || ''), prefixes }));
      }
      lastUpdate = Number(saved.lastUpdate) || 0;
      nextUpdateAt = Number(saved.nextUpdateAt) || 0;
    } catch {}
  }
  function save() {
    try {
      fs.mkdirSync(directory, { recursive: true });
      const out = [...lists.values()].map(entry => {
        const bySize = new Map();
        for (const prefix of entry.prefixes) { if (!bySize.has(prefix.length)) bySize.set(prefix.length, []); bySize.get(prefix.length).push(prefix); }
        const sizes = [...bySize].map(([size, items]) => [size, items.length]);
        return { list: entry.list, state: entry.state, sizes, data: Buffer.from([...bySize.values()].flat().join(''), 'latin1').toString('base64') };
      });
      fs.writeFileSync(`${file}.tmp`, JSON.stringify({ lastUpdate, nextUpdateAt, lists: out }));
      fs.renameSync(`${file}.tmp`, file);
    } catch (error) { log(`Não foi possível salvar as listas do Safe Browsing: ${error.message}`); }
  }
  async function call(method, route, body) {
    const response = await fetchImpl(`${endpoint}/${route}?key=${encodeURIComponent(key)}`, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    if (!response.ok) throw new Error(`Safe Browsing respondeu ${response.status}.`);
    return response.json();
  }
  async function chooseLists() {
    try {
      const data = await call('GET', 'threatLists');
      const chosen = (data.threatLists || []).filter(item => item.threatEntryType === 'URL' && THREAT_TYPES.includes(item.threatType) && PLATFORMS.includes(item.platformType));
      if (chosen.length) return chosen;
    } catch (error) { log(error.message); }
    return DEFAULT_LISTS;
  }
  async function update() {
    if (updating || !key) return;
    updating = true;
    try {
      const wanted = lists.size ? [...lists.values()].map(entry => entry.list) : await chooseLists();
      const data = await call('POST', 'threatListUpdates:fetch', { client, listUpdateRequests: wanted.map(list => ({ ...list, state: lists.get(listKey(list))?.state || '', constraints: { supportedCompressions: ['RAW'] } })) });
      for (const response of data.listUpdateResponses || []) {
        const keyName = listKey(response);
        const previous = lists.get(keyName);
        try {
          const prefixes = applyUpdate(previous?.prefixes || [], response);
          lists.set(keyName, index({ list: { threatType: response.threatType, platformType: response.platformType, threatEntryType: response.threatEntryType }, state: response.newClientState || '', prefixes }));
        } catch (error) {
          // Lista corrompida: recomeça do zero na próxima atualização.
          lists.set(keyName, index({ list: { threatType: response.threatType, platformType: response.platformType, threatEntryType: response.threatEntryType }, state: '', prefixes: [] }));
          log(`${keyName}: ${error.message}`);
        }
      }
      lastUpdate = now(); lastError = '';
      nextUpdateAt = now() + Math.max(seconds(data.minimumWaitDuration), 30 * 60) * 1000;
      save();
    } catch (error) {
      lastError = error.message;
      nextUpdateAt = now() + 15 * 60 * 1000;
      log(error.message);
    } finally { updating = false; }
  }
  function schedule() {
    if (stopped) return;
    clearTimeout(timer);
    timer = setTimeout(async () => { await update(); schedule(); }, Math.max(10_000, nextUpdateAt - now()));
    timer.unref?.();
  }

  /** Ameaça do endereço ou null. Sem coincidência local, responde sem rede. */
  async function check(url) {
    if (!key || !lists.size || !/^https?:/i.test(String(url))) return null;
    const hashes = expressions(url).map(fullHash);
    const hits = new Map(); // prefixo -> hashes completos que o têm
    for (const hash of hashes) {
      const full = hash.toString('latin1');
      const cached = positive.get(full);
      if (cached && cached.expires > now()) return { threatType: cached.threatType };
      for (const entry of lists.values()) for (const size of entry.sizes) {
        const prefix = full.slice(0, size);
        if (entry.set.has(prefix) && !((negative.get(prefix) || 0) > now())) { if (!hits.has(prefix)) hits.set(prefix, new Set()); hits.get(prefix).add(full); }
      }
    }
    if (!hits.size) return null;
    const data = await call('POST', 'fullHashes:find', {
      client,
      clientStates: [...lists.values()].map(entry => entry.state),
      threatInfo: { threatTypes: [...new Set([...lists.values()].map(entry => entry.list.threatType))], platformTypes: [...new Set([...lists.values()].map(entry => entry.list.platformType))], threatEntryTypes: ['URL'], threatEntries: [...hits.keys()].map(prefix => ({ hash: Buffer.from(prefix, 'latin1').toString('base64') })) },
    });
    const negativeUntil = now() + seconds(data.negativeCacheDuration || '300s') * 1000;
    for (const prefix of hits.keys()) negative.set(prefix, negativeUntil);
    let found = null;
    for (const match of data.matches || []) {
      const full = Buffer.from(match.threat?.hash || '', 'base64').toString('latin1');
      positive.set(full, { threatType: match.threatType, expires: now() + seconds(match.cacheDuration || '300s') * 1000 });
      if (!found && [...hits.values()].some(set => set.has(full))) found = { threatType: match.threatType };
    }
    if (found) for (const prefix of hits.keys()) negative.delete(prefix);
    return found;
  }

  return {
    get available() { return !!key; },
    start() { if (!key) return; stopped = false; load(); if (!nextUpdateAt || nextUpdateAt <= now()) nextUpdateAt = now() + 5_000; schedule(); },
    stop() { stopped = true; clearTimeout(timer); },
    update, check,
    status() { return { available: !!key, ready: [...lists.values()].some(entry => entry.prefixes.length), lists: lists.size, prefixes: [...lists.values()].reduce((total, entry) => total + entry.prefixes.length, 0), lastUpdate, error: lastError }; },
  };
}

module.exports = { canonicalize, expressions, fullHash, applyUpdate, createSafeBrowsing };
