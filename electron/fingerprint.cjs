// Proteção contra impressão digital ("farbling", como no Brave): cada site recebe pequenas
// variações estáveis em canvas, áudio e WebGL. Dentro de um site o resultado não muda (nada
// quebra); entre sites e entre execuções do Cypher ele muda, e os rastreadores perdem a âncora.
const { createHmac } = require('node:crypto');

// Sufixos de dois níveis comuns, para que "a.exemplo.com.br" e "b.exemplo.com.br" contem como o mesmo site.
const SECOND_LEVEL = new Set(['com', 'net', 'org', 'gov', 'edu', 'co', 'ac', 'mil', 'nom', 'art', 'blog', 'app', 'dev']);

/** Site (domínio registrável aproximado) de um host. IPs e nomes de uma parte ficam como estão. */
function siteForSeed(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!host || /^[\d.]+$/.test(host) || host.includes(':')) return host;
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  const take = parts[parts.length - 1].length === 2 && SECOND_LEVEL.has(parts[parts.length - 2]) ? 3 : 2;
  return parts.slice(-take).join('.');
}

/** Semente de 32 bits em hexadecimal para um site nesta execução. */
function fingerprintSeed(secret, hostname) {
  return createHmac('sha256', secret).update(siteForSeed(hostname)).digest('hex').slice(0, 8);
}

module.exports = { siteForSeed, fingerprintSeed };
