const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildManifests, minimumVersionFor } = require('../scripts/build-update-manifest.cjs');
const { parseManifest } = require('../electron/update-manifest.cjs');

test('versão mínima é a segunda maior oficial publicada', () => {
  assert.equal(minimumVersionFor('0.7.36', ['v0.7.35', 'v0.7.34', 'v0.7.9']), '0.7.35');
  assert.equal(minimumVersionFor('0.7.37-beta.1', ['v0.7.36', 'v0.7.35']), '0.7.35');
  assert.equal(minimumVersionFor('0.7.36', []), '0.7.36');
  assert.equal(minimumVersionFor('0.7.36', ['v0.7.36', 'v0.7.35', 'v0.7.36-beta.2', 'mods-catalog']), '0.7.35');
});

test('publicação oficial gera latest.json v1 e stable.json v2 que o app aceita', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cypher-release-'));
  fs.writeFileSync(path.join(dir, 'Cypher-0.7.36-Windows.exe'), 'portatil');
  fs.writeFileSync(path.join(dir, 'Cypher-0.7.36-Setup.exe'), 'instalador');
  const changelog = '## [0.7.36] - 2026-10-18\n- [Novo★] Canal Preview: antes de todos. {preview}\n- [Corrigido] Colar: funciona.\n';
  const manifests = buildManifests({ version: '0.7.36', releaseDirectory: dir, changelog, publishedStableTags: ['v0.7.35', 'v0.7.34'] });
  assert.deepEqual(Object.keys(manifests).sort(), ['latest.json', 'stable.json']);
  assert.equal(manifests['latest.json'].schemaVersion, 1);
  assert.equal(manifests['latest.json'].notes, undefined);
  assert.equal(manifests['latest.json'].releaseNotes, '- Canal Preview: Antes de todos.\n- Colar: Funciona.');
  const stable = parseManifest(Buffer.from(JSON.stringify(manifests['stable.json'])), null);
  assert.equal(stable.minimumVersion, '0.7.35');
  assert.equal(stable.notes[0].illustration, 'preview');
  assert.equal(parseManifest(Buffer.from(JSON.stringify(manifests['latest.json'])), null).version, '0.7.36');
});

test('publicação Preview gera só preview.json e exige notas no CHANGELOG', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cypher-release-'));
  fs.writeFileSync(path.join(dir, 'Cypher-0.7.37-beta.1-Windows.exe'), 'p');
  fs.writeFileSync(path.join(dir, 'Cypher-0.7.37-beta.1-Setup.exe'), 'i');
  const manifests = buildManifests({ version: '0.7.37-beta.1', releaseDirectory: dir, changelog: '## [0.7.37-beta.1] - 2026-10-20\n- [Novo] Teste: algo\n', publishedStableTags: ['v0.7.36', 'v0.7.35'] });
  assert.deepEqual(Object.keys(manifests), ['preview.json']);
  assert.equal(manifests['preview.json'].channel, 'preview');
  assert.throws(() => buildManifests({ version: '0.7.37-beta.1', releaseDirectory: dir, changelog: '## [0.7.36]\n- x\n', publishedStableTags: [] }), /CHANGELOG/);
});
