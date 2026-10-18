const test = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync, sign } = require('node:crypto');
const { parseManifest, canonicalJson } = require('../electron/update-manifest.cjs');

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const sha = Buffer.alloc(64, 7).toString('base64');
const signed = manifest => {
  const body = { ...manifest, signatureAlgorithm: 'Ed25519' };
  return Buffer.from(JSON.stringify({ ...body, signature: sign(null, Buffer.from(canonicalJson(body)), privateKey).toString('base64') }));
};
const base = version => ({ version, tag: `v${version}`, assetName: `Cypher-${version}-Windows.exe`, sha512: sha, installerAssetName: `Cypher-${version}-Setup.exe`, installerSha512: sha, releaseNotes: 'texto' });

test('aceita o manifesto v1 antigo', () => {
  const manifest = parseManifest(signed({ schemaVersion: 1, ...base('0.7.35') }), publicKey);
  assert.equal(manifest.version, '0.7.35');
  assert.equal(manifest.channel, 'stable');
  assert.equal(manifest.minimumVersion, '');
  assert.deepEqual(manifest.notes, []);
});

test('aceita v2 com canal Preview, versão mínima e notas', () => {
  const notes = [{ kind: 'new', title: 'Canal Preview', body: 'antes de todos', highlight: true, illustration: 'preview' }];
  const manifest = parseManifest(signed({ schemaVersion: 2, ...base('0.7.37-beta.1'), channel: 'preview', minimumVersion: '0.7.35', publishedAt: '2026-10-20T00:00:00Z', notes }), publicKey);
  assert.equal(manifest.channel, 'preview');
  assert.equal(manifest.minimumVersion, '0.7.35');
  assert.deepEqual(manifest.notes, notes);
});

test('recusa assinatura errada, canal inválido e versão Preview no canal oficial', () => {
  const good = JSON.parse(signed({ schemaVersion: 2, ...base('0.7.36'), channel: 'stable', minimumVersion: '0.7.35', notes: [] }));
  assert.throws(() => parseManifest(Buffer.from(JSON.stringify({ ...good, version: '0.7.99' })), publicKey));
  assert.throws(() => parseManifest(signed({ schemaVersion: 2, ...base('0.7.36'), channel: 'nightly', minimumVersion: '0.7.35', notes: [] }), publicKey));
  assert.throws(() => parseManifest(signed({ schemaVersion: 2, ...base('0.7.37-beta.1'), channel: 'stable', minimumVersion: '0.7.35', notes: [] }), publicKey));
  assert.throws(() => parseManifest(signed({ schemaVersion: 2, ...base('0.7.36'), channel: 'stable', minimumVersion: '0.7.37', notes: [] }), publicKey), /mínima/);
});

test('limpa notas malformadas em vez de confiar nelas', () => {
  const manifest = parseManifest(signed({ schemaVersion: 2, ...base('0.7.36'), channel: 'stable', minimumVersion: '0.7.35', notes: [{ kind: 'x', title: 5 }, { kind: 'fixed', title: 'Ok', body: 'b', highlight: 'sim', illustration: '../x' }] }), publicKey);
  assert.deepEqual(manifest.notes, [{ kind: 'fixed', title: 'Ok', body: 'b', highlight: false, illustration: '' }]);
});
