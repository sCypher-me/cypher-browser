// Modo HTTPS e classificação dos erros de carregamento das abas.
// "upgrade": tenta HTTPS primeiro e volta para HTTP em silêncio se o site não tiver HTTPS.
// "strict": tenta HTTPS e, se falhar, mostra um aviso antes de abrir a versão sem criptografia.
const net = require('node:net');

const PRIVATE_SUFFIXES = ['.local', '.lan', '.home', '.internal', '.localhost', '.test', '.example', '.invalid', '.onion', '.i2p', '.arpa', '.corp', '.intranet'];

/** Endereços que não fazem sentido trocar por HTTPS: rede local, IPs e nomes sem domínio. */
function isUpgradeExempt(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || net.isIP(host)) return true;
  if (!host.includes('.')) return true;
  return PRIVATE_SUFFIXES.some(suffix => host.endsWith(suffix));
}

// Códigos de rede do Chromium (net/base/net_error_list.h).
const CERTIFICATE_ERRORS = new Set([-200, -201, -202, -203, -204, -205, -206, -207, -208, -210, -211, -212, -213, -214, -215, -216, -217, -218, -219]);
const SSL_ERRORS = new Set([-107, -110, -113, -117, -123, -125, -126, -129, -141, -148, -150, -159, -172]);
const KINDS = {
  dns: new Set([-105, -137]),
  offline: new Set([-106]),
  refused: new Set([-102, -109, -104, -108]),
  timeout: new Set([-7, -118]),
  network: new Set([-100, -101, -21, -15, -324, -130, -111, -120, -352]),
  blocked: new Set([-20, -27, -301]),
};
// Falhas que indicam "este site não fala HTTPS" depois de uma troca automática.
const HTTPS_UNAVAILABLE = new Set([...CERTIFICATE_ERRORS, ...SSL_ERRORS, -100, -101, -102, -104, -109, -118, -7, -324]);

const NAMES = { '-105': 'ERR_NAME_NOT_RESOLVED', '-137': 'ERR_NAME_RESOLUTION_FAILED', '-106': 'ERR_INTERNET_DISCONNECTED', '-102': 'ERR_CONNECTION_REFUSED', '-109': 'ERR_ADDRESS_UNREACHABLE', '-118': 'ERR_CONNECTION_TIMED_OUT', '-7': 'ERR_TIMED_OUT', '-101': 'ERR_CONNECTION_RESET', '-100': 'ERR_CONNECTION_CLOSED', '-21': 'ERR_NETWORK_CHANGED', '-20': 'ERR_BLOCKED_BY_CLIENT', '-200': 'ERR_CERT_COMMON_NAME_INVALID', '-201': 'ERR_CERT_DATE_INVALID', '-202': 'ERR_CERT_AUTHORITY_INVALID', '-203': 'ERR_CERT_CONTAINS_ERRORS', '-206': 'ERR_CERT_REVOKED', '-207': 'ERR_CERT_INVALID', '-107': 'ERR_SSL_PROTOCOL_ERROR', '-113': 'ERR_SSL_VERSION_OR_CIPHER_MISMATCH', '-324': 'ERR_EMPTY_RESPONSE' };

/** Tipo de tela de erro para um código de falha do Chromium. */
function classifyLoadError(code) {
  if (CERTIFICATE_ERRORS.has(code)) return 'certificate';
  if (SSL_ERRORS.has(code)) return 'ssl';
  for (const [kind, codes] of Object.entries(KINDS)) if (codes.has(code)) return kind;
  return 'generic';
}
function errorName(code) { return NAMES[String(code)] || `ERR_${Math.abs(Number(code) || 0)}`; }

function hostOf(url) { try { return new URL(url).hostname.toLowerCase(); } catch { return ''; } }

/** Estado da sessão: quais hosts foram trocados para HTTPS e quais a pessoa liberou em HTTP. */
function createHttpsUpgrader({ now = () => Date.now() } = {}) {
  const upgraded = new Map(); // host -> endereço HTTP original
  const allowedHttp = new Set();
  const attempts = new Map(); // host -> horários das trocas recentes (protege de laços https -> http)
  return {
    /** Endereço HTTPS para um pedido principal em HTTP, ou null para deixar como está. */
    rewrite(url, mode) {
      if (mode === 'off' || !/^http:\/\//i.test(url)) return null;
      let parsed;
      try { parsed = new URL(url); } catch { return null; }
      const host = parsed.hostname.toLowerCase();
      if (allowedHttp.has(host) || isUpgradeExempt(host) || parsed.port) return null;
      const recent = (attempts.get(host) || []).filter(time => now() - time < 10_000);
      if (recent.length >= 3) { allowedHttp.add(host); upgraded.delete(host); return null; }
      attempts.set(host, [...recent, now()]);
      upgraded.set(host, url);
      parsed.protocol = 'https:';
      return parsed.href;
    },
    /** Depois de uma falha: devolve o endereço HTTP original quando a falha veio da troca. */
    failed(url, code) {
      const host = hostOf(url);
      if (!/^https:/i.test(url) || !upgraded.has(host) || !HTTPS_UNAVAILABLE.has(code)) return null;
      const httpUrl = upgraded.get(host);
      upgraded.delete(host);
      return httpUrl;
    },
    succeeded(url) { const host = hostOf(url); if (/^https:/i.test(url)) { upgraded.delete(host); attempts.delete(host); } },
    allowHttp(host) { if (host) { allowedHttp.add(String(host).toLowerCase()); upgraded.delete(String(host).toLowerCase()); } },
    isAllowed(host) { return allowedHttp.has(String(host || '').toLowerCase()); },
  };
}

module.exports = { isUpgradeExempt, classifyLoadError, errorName, createHttpsUpgrader };
