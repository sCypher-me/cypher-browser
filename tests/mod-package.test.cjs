const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { generateKeyPairSync, sign } = require('node:crypto');
const { validateModManifest, writeZip, packModFolder, extractModPackage, verifySignedJson, sanitizeCss } = require('../electron/mod-package.cjs');

const base = { format: 'cypher-mod', formatVersion: 1, id: 'com.teste.mod', name: 'Teste', version: '1.0.0' };
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cypher-mod-test-'));

test('manifests need a valid id, version and at least one component', () => {
  assert.throws(() => validateModManifest({ ...base, components: {} }), /nenhum componente/);
  assert.throws(() => validateModManifest({ ...base, id: 'sem-ponto', components: { shader: { preset: 'crt' } } }), /formato reverso/);
  assert.throws(() => validateModManifest({ ...base, version: '1', components: { shader: { preset: 'crt' } } }), /semântica/);
  const manifest = validateModManifest({ ...base, components: { theme: { accent: '#AABBCC', surface: 'red' }, shader: { preset: 'crt', intensity: 5 }, unknown: true } });
  assert.deepEqual(manifest.components.theme, { accent: '#aabbcc' });
  assert.equal(manifest.components.shader.intensity, 1);
  assert.equal(manifest.components.unknown, undefined);
});

test('manifests reject traversal, wrong file types and missing files', () => {
  assert.throws(() => validateModManifest({ ...base, components: { wallpaper: { file: '../segredo.png' } } }, new Set()), /inválido/);
  assert.throws(() => validateModManifest({ ...base, components: { sounds: { click: 'sons/clique.exe' } } }, new Set(['sons/clique.exe'])), /tipo esperado/);
  assert.throws(() => validateModManifest({ ...base, components: { music: { base: 'music/base.ogg' } } }, new Set()), /não está no pacote/);
});

test('packages round-trip through the zip writer and extractor', async () => {
  const source = temp();
  fs.mkdirSync(path.join(source, 'pages'));
  fs.writeFileSync(path.join(source, 'pages', 'site.css'), 'body{color:red}');
  fs.writeFileSync(path.join(source, 'cypher-mod.json'), JSON.stringify({ ...base, components: { pageStyles: [{ matches: ['example.com'], css: 'pages/site.css' }] } }));
  const packageFile = path.join(temp(), 'teste.cyphermod');
  fs.writeFileSync(packageFile, await packModFolder(source));
  const manifest = await extractModPackage(packageFile, path.join(temp(), 'instalado'));
  assert.equal(manifest.id, 'com.teste.mod');
  assert.deepEqual(manifest.components.pageStyles, [{ matches: ['example.com'], css: 'pages/site.css' }]);
});

test('extraction refuses executable files and cleans up', async () => {
  const packageFile = path.join(temp(), 'ruim.cyphermod');
  fs.writeFileSync(packageFile, writeZip([{ name: 'cypher-mod.json', data: Buffer.from(JSON.stringify({ ...base, components: { shader: { preset: 'crt' } } })) }, { name: 'payload.exe', data: Buffer.from('MZ') }]));
  const target = path.join(temp(), 'destino');
  await assert.rejects(() => extractModPackage(packageFile, target), /não é permitido/);
  assert.equal(fs.existsSync(target), false);
});

test('page CSS cannot load remote resources', () => {
  assert.equal(sanitizeCss('@import url(https://x.y/a.css); a{background:url(https://x.y/p.png)}'), ' a{background:none}');
});

test('signed catalogs verify with the matching key only', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}` : JSON.stringify(value);
  const index = { schemaVersion: 1, mods: [{ id: 'com.a.b' }], signatureAlgorithm: 'Ed25519' };
  const signed = { ...index, signature: sign(null, Buffer.from(canonical(index)), privateKey).toString('base64') };
  const pem = publicKey.export({ type: 'spki', format: 'pem' });
  assert.equal(verifySignedJson(signed, pem).mods[0].id, 'com.a.b');
  assert.throws(() => verifySignedJson({ ...signed, mods: [{ id: 'com.evil.mod' }] }, pem), /inválida/);
  assert.throws(() => verifySignedJson(index, pem), /não está assinado/);
});
