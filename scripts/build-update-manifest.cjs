'use strict';
// Gera os manifestos de uma publicação:
//   latest.json  → formato v1, só para versões oficiais (clientes até 0.7.35 só entendem este)
//   stable.json / preview.json → formato v2, com canal, versão mínima e notas estruturadas
// Uso: node scripts/build-update-manifest.cjs <versão> <pasta-release> <pasta-saída> [tags oficiais publicadas, separadas por vírgula]
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { parseChangelog } = require('../electron/changelog.cjs');
const { compareVersions, isPreview, parseVersion } = require('../electron/versions.cjs');

/** Versão mínima aceita = a segunda maior versão oficial publicada (contando a nova, se for oficial). */
function minimumVersionFor(version, publishedStableTags) {
  const stable = new Set(publishedStableTags.map(tag => tag.replace(/^v/, '')).filter(value => parseVersion(value) && !isPreview(value)));
  if (!isPreview(version)) stable.add(version);
  const sorted = [...stable].sort((a, b) => compareVersions(b, a));
  return sorted[1] || sorted[0] || '';
}

/** Texto simples das novidades, sem a marcação do CHANGELOG, para o formato antigo. */
function plainReleaseNotes(items, version) {
  const text = items.map(item => `- ${item.title}${item.body ? `: ${item.body}` : ''}`).join('\n');
  return (text || `Cypher ${version} — versão mais recente do navegador.`).slice(0, 3000);
}

function sha512(file) { return createHash('sha512').update(fs.readFileSync(file)).digest('base64'); }

function buildManifests({ version, releaseDirectory, changelog, publishedStableTags, publishedAt = new Date().toISOString() }) {
  if (!parseVersion(version)) throw new Error(`Versão inválida: ${version}`);
  const assetName = `Cypher-${version}-Windows.exe`, installerAssetName = `Cypher-${version}-Setup.exe`;
  for (const name of [assetName, installerAssetName]) if (!fs.existsSync(path.join(releaseDirectory, name))) throw new Error(`Artefato não encontrado: ${name}`);
  const entry = parseChangelog(changelog).find(item => item.version === version);
  if (!entry || !entry.items.length) throw new Error(`O CHANGELOG não tem notas para a versão ${version}.`);
  const notes = entry.items.slice(0, 60);
  const releaseNotes = plainReleaseNotes(notes, version);
  const common = { version, tag: `v${version}`, assetName, sha512: sha512(path.join(releaseDirectory, assetName)), installerAssetName, installerSha512: sha512(path.join(releaseDirectory, installerAssetName)), releaseNotes };
  const channel = isPreview(version) ? 'preview' : 'stable';
  const manifests = { [`${channel}.json`]: { schemaVersion: 2, ...common, channel, minimumVersion: minimumVersionFor(version, publishedStableTags), publishedAt, notes } };
  if (channel === 'stable') manifests['latest.json'] = { schemaVersion: 1, ...common };
  return manifests;
}

module.exports = { buildManifests, minimumVersionFor, plainReleaseNotes };

if (require.main === module) {
  const [version, releaseDirectory = 'release', outputDirectory = 'artifacts', tags = ''] = process.argv.slice(2);
  const manifests = buildManifests({ version, releaseDirectory, changelog: fs.readFileSync('CHANGELOG.md', 'utf8'), publishedStableTags: tags.split(',').filter(Boolean) });
  fs.mkdirSync(outputDirectory, { recursive: true });
  for (const [name, manifest] of Object.entries(manifests)) {
    fs.writeFileSync(path.join(outputDirectory, name), JSON.stringify(manifest));
    console.log(`${name}: ${manifest.version}${manifest.minimumVersion ? ` · mínima ${manifest.minimumVersion}` : ''}`);
  }
}
