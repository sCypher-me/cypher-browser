// Configurações por site: zoom lembrado, JavaScript, imagens e limite de recursos.
// A chave é o host sem "www.", para que exemplo.com e www.exemplo.com compartilhem a escolha.

const FIELDS = { javascript: 'boolean', images: 'boolean', limit: 'boolean', fingerprint: 'boolean', zoom: 'number' };

function siteKey(url) {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '';
    return parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch { return ''; }
}

/** Mantém só valores conhecidos e diferentes do padrão; um site sem ajustes sai da lista. */
function cleanEntry(entry) {
  const out = {};
  if (!entry || typeof entry !== 'object') return out;
  if (entry.javascript === false) out.javascript = false;
  if (entry.images === false) out.images = false;
  if (entry.limit === true) out.limit = true;
  if (entry.fingerprint === false) out.fingerprint = false;
  if (Number.isFinite(entry.zoom) && Math.abs(entry.zoom - 1) > 0.001) out.zoom = Math.round(Math.max(0.25, Math.min(3, entry.zoom)) * 100) / 100;
  return out;
}

function sanitizeSiteSettings(input) {
  const out = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  for (const [host, entry] of Object.entries(input).slice(0, 1000)) {
    if (typeof host !== 'string' || host.length > 253 || !/^[a-z\d.-]+$/i.test(host)) continue;
    const clean = cleanEntry(entry);
    if (Object.keys(clean).length) out[host.toLowerCase()] = clean;
  }
  return out;
}

/** Aplica uma mudança parcial; `null` em um campo volta ao padrão. */
function updateSite(all, host, patch) {
  const key = String(host || '').toLowerCase().replace(/^www\./, '');
  if (!key || !/^[a-z\d.-]+$/.test(key)) throw new Error('Site inválido.');
  const merged = { ...(all[key] || {}) };
  for (const [field, value] of Object.entries(patch || {})) {
    if (!(field in FIELDS)) continue;
    if (value === null) delete merged[field];
    else if (typeof value === FIELDS[field]) merged[field] = value;
  }
  const clean = cleanEntry(merged);
  const next = { ...all };
  if (Object.keys(clean).length) next[key] = clean; else delete next[key];
  return next;
}

function settingsFor(all, url) { return all[siteKey(url)] || {}; }

/** Cabeçalho que desliga scripts num documento sem quebrar a política que o site já tinha. */
function scriptBlockHeaders(headers) {
  const out = { ...headers };
  const key = Object.keys(out).find(name => name.toLowerCase() === 'content-security-policy') || 'Content-Security-Policy';
  const current = Array.isArray(out[key]) ? out[key] : out[key] ? [out[key]] : [];
  out[key] = [...current, "script-src 'none'"];
  return out;
}

module.exports = { siteKey, sanitizeSiteSettings, updateSite, settingsFor, scriptBlockHeaders };
