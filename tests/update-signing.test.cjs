const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { generateKeyPairSync, verify } = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const signer = path.resolve(__dirname, '../scripts/sign-update-manifest.cjs');
const canonicalJson = value => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};

test('release signing refuses to publish a manifest without Ed25519 keys', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'cypher-signing-'));
  try {
    const manifestPath = path.join(directory, 'latest.json');
    await fs.writeFile(manifestPath, JSON.stringify({ version:'1.2.3' }));
    const result = spawnSync(process.execPath, [signer, manifestPath], {
      encoding:'utf8',
      env:{ ...process.env, CYPHER_UPDATE_SIGNING_PRIVATE_KEY:'', CYPHER_UPDATE_SIGNING_PUBLIC_KEY:'' },
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /assinatura Ed25519 é obrigatória/i);
  } finally {
    await fs.rm(directory, { recursive:true, force:true });
  }
});

test('release signing creates a verifiable Ed25519 signature for the manifest', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'cypher-signing-'));
  try {
    const manifestPath = path.join(directory, 'latest.json');
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const publicPem = publicKey.export({ type:'spki', format:'pem' });
    const privatePem = privateKey.export({ type:'pkcs8', format:'pem' });
    const manifest = { schemaVersion:1, version:'1.2.3', tag:'v1.2.3', assetName:'Cypher-1.2.3-Windows.exe' };
    await fs.writeFile(manifestPath, JSON.stringify(manifest));
    const result = spawnSync(process.execPath, [signer, manifestPath], {
      encoding:'utf8',
      env:{ ...process.env, CYPHER_UPDATE_SIGNING_PRIVATE_KEY:privatePem, CYPHER_UPDATE_SIGNING_PUBLIC_KEY:publicPem },
    });
    assert.equal(result.status, 0, result.stderr);
    const signedManifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    assert.equal(signedManifest.signatureAlgorithm, 'Ed25519');
    const { signature, ...payload } = signedManifest;
    assert.equal(typeof signature, 'string');
    assert.equal(verify(null, Buffer.from(canonicalJson(payload)), publicKey, Buffer.from(signature, 'base64')), true);
  } finally {
    await fs.rm(directory, { recursive:true, force:true });
  }
});
