const fs = require('node:fs');
const { createPrivateKey, createPublicKey, sign } = require('node:crypto');

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function normalizePem(value) {
  return String(value || '').replace(/\r/g, '').trim();
}

function main() {
  const manifestPath = process.argv[2];
  if (!manifestPath) throw new Error('Informe o caminho de artifacts/latest.json.');

  const privatePem = normalizePem(process.env.CYPHER_UPDATE_SIGNING_PRIVATE_KEY);
  const publicPem = normalizePem(process.env.CYPHER_UPDATE_SIGNING_PUBLIC_KEY);
  if (!privatePem && !publicPem) throw new Error('A assinatura Ed25519 é obrigatória; configure CYPHER_UPDATE_SIGNING_PRIVATE_KEY e CYPHER_UPDATE_SIGNING_PUBLIC_KEY.');
  if (!privatePem || !publicPem) throw new Error('As chaves privada e pública de assinatura precisam ser configuradas juntas.');

  const privateKey = createPrivateKey(privatePem);
  if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('A chave privada de atualização precisa usar Ed25519.');
  const derivedPublicPem = normalizePem(createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }));
  if (derivedPublicPem !== publicPem) throw new Error('A chave privada não corresponde à variável pública CYPHER_UPDATE_SIGNING_PUBLIC_KEY.');

  const source = fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, '');
  const manifest = JSON.parse(source);
  delete manifest.signature;
  manifest.signatureAlgorithm = 'Ed25519';
  const payload = Buffer.from(canonicalJson(manifest), 'utf8');
  manifest.signature = sign(null, payload, privateKey).toString('base64');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`, 'utf8');
  console.log(`Manifesto ${manifest.version} assinado com Ed25519.`);
}

try { main(); }
catch (error) {
  console.error(`Falha ao assinar o manifesto: ${error.message}`);
  process.exitCode = 1;
}
