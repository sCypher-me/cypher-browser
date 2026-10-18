// Ferramentas do cofre de senhas que não dependem do Electron: origem aceita, leitura de CSV
// exportado por outros navegadores e consulta de vazamentos por k-anonimato (Have I Been Pwned).
const { createHash } = require('node:crypto');

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Origem que o cofre aceita: HTTPS, ou HTTP só em localhost. Devolve '' quando não serve. */
function normalizePasswordOrigin(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.protocol === 'http:' && !LOCAL_HOSTS.has(url.hostname))) return '';
    return url.origin;
  } catch { return ''; }
}

/** CSV no formato RFC 4180: aspas, aspas duplicadas, quebras de linha dentro de campos e BOM. */
function parseCsv(text) {
  const source = String(text || '').replace(/^﻿/, '');
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { field += '"'; index++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field === '') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index++;
      row.push(field); field = '';
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
    } else field += char;
  }
  row.push(field);
  if (row.some(value => value !== '')) rows.push(row);
  return rows;
}

// Cabeçalhos usados por Chrome, Edge, Brave, Opera, Vivaldi, Firefox, Safari, Bitwarden e 1Password.
const COLUMNS = {
  url: ['url', 'login_uri', 'website', 'web site', 'origin', 'address', 'uri', 'login url', 'site'],
  username: ['username', 'login_username', 'user', 'login', 'email', 'user name', 'e-mail', 'usuario', 'usuário'],
  password: ['password', 'login_password', 'pass', 'senha'],
};

/** Lê logins de um CSV exportado. Linhas sem site válido, usuário ou senha entram em `skipped`. */
function passwordsFromCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) return { entries: [], skipped: 0, error: 'O arquivo está vazio.' };
  const header = rows[0].map(value => value.trim().toLowerCase());
  const column = key => header.findIndex(name => COLUMNS[key].includes(name));
  const urlAt = column('url'), userAt = column('username'), passAt = column('password');
  if (urlAt < 0 || passAt < 0) return { entries: [], skipped: rows.length - 1, error: 'Não reconhecemos as colunas deste CSV. Exporte as senhas pelo próprio navegador ou gerenciador.' };
  const entries = [], seen = new Set();
  let skipped = 0;
  for (const row of rows.slice(1)) {
    let address = String(row[urlAt] || '').trim();
    if (address && !/^[a-z][a-z\d+.-]*:\/\//i.test(address)) address = `https://${address}`;
    const origin = normalizePasswordOrigin(address);
    const username = String(userAt >= 0 ? row[userAt] || '' : '').trim().slice(0, 256);
    const password = String(row[passAt] || '');
    if (!origin || !username || !password || password.length > 4096) { skipped++; continue; }
    const key = `${origin}\n${username}`;
    if (seen.has(key)) { skipped++; continue; }
    seen.add(key);
    entries.push({ origin, username, password });
  }
  return { entries, skipped, error: '' };
}

function sha1Hex(value) { return createHash('sha1').update(String(value), 'utf8').digest('hex').toUpperCase(); }

/**
 * Quantas vezes o hash apareceu em vazamentos. Só os 5 primeiros caracteres do SHA-1 saem do
 * computador (k-anonimato); a comparação do restante é feita aqui. `fetchImpl` segue a API do fetch.
 */
async function pwnedCountForHash(hash, fetchImpl, cache = new Map()) {
  const upper = String(hash).toUpperCase();
  if (!/^[\dA-F]{40}$/.test(upper)) throw new Error('Hash inválido.');
  const prefix = upper.slice(0, 5), suffix = upper.slice(5);
  let body = cache.get(prefix);
  if (body === undefined) {
    const response = await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, { headers: { 'Add-Padding': 'true', 'User-Agent': 'Cypher-Browser' } });
    if (!response.ok) throw new Error(`O serviço de vazamentos respondeu ${response.status}.`);
    body = await response.text();
    cache.set(prefix, body);
  }
  for (const line of body.split(/\r?\n/)) {
    const [candidate, count] = line.trim().split(':');
    if (candidate === suffix) return Number.parseInt(count, 10) || 0;
  }
  return 0;
}

module.exports = { normalizePasswordOrigin, parseCsv, passwordsFromCsv, sha1Hex, pwnedCountForHash };
