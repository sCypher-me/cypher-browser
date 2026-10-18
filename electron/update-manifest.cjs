'use strict';
// Validação dos manifestos de atualização (v1 antigo e v2 com canais) e da assinatura Ed25519.
const { verify: verifySignature } = require('node:crypto');
const { parseVersion, compareVersions, isPreview } = require('./versions.cjs');

const NOTE_KINDS = new Set(['new', 'improved', 'fixed']);
const ILLUSTRATIONS = new Set(['preview', 'atualizacao', 'privacidade', 'configuracoes', 'abas', 'mods', 'instalador', 'generico']);

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

const validSha512 = value => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(value)) return false;
  const bytes = Buffer.from(value, 'base64');
  return bytes.length === 64 && bytes.toString('base64') === value;
};

function cleanNotes(notes) {
  if (!Array.isArray(notes)) return [];
  return notes.slice(0, 60).flatMap(note => {
    if (!note || !NOTE_KINDS.has(note.kind) || typeof note.title !== 'string' || !note.title.trim()) return [];
    return [{ kind: note.kind, title: note.title.slice(0, 120), body: typeof note.body === 'string' ? note.body.slice(0, 600) : '', highlight: note.highlight === true, illustration: ILLUSTRATIONS.has(note.illustration) ? note.illustration : '' }];
  });
}

/** `publicKey`: KeyObject Ed25519, `null` quando a build não tem chave, ou `{ invalid, message }`. */
function parseManifest(raw, publicKey) {
  let manifest;
  try { manifest = JSON.parse(raw.toString('utf8').replace(/^﻿/, '')); } catch { throw new Error('O manifesto de atualização está inválido.'); }
  const version = manifest?.version;
  if (!manifest || ![1, 2].includes(manifest.schemaVersion) || !parseVersion(version) || manifest.tag !== `v${version}`
    || manifest.assetName !== `Cypher-${version}-Windows.exe` || !validSha512(manifest.sha512)
    || manifest.installerAssetName !== `Cypher-${version}-Setup.exe` || !validSha512(manifest.installerSha512)) {
    throw new Error('O manifesto de atualização não passou na validação.');
  }
  if (publicKey?.invalid) throw new Error(publicKey.message);
  if (publicKey) {
    if (manifest.signatureAlgorithm !== 'Ed25519' || typeof manifest.signature !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(manifest.signature)) throw new Error('O manifesto não tem uma assinatura Ed25519 válida. A instalação foi bloqueada.');
    const signature = Buffer.from(manifest.signature, 'base64');
    if (signature.length !== 64 || signature.toString('base64') !== manifest.signature) throw new Error('A assinatura do manifesto de atualização está malformada.');
    const { signature: _signature, ...signedManifest } = manifest;
    let valid = false;
    try { valid = verifySignature(null, Buffer.from(canonicalJson(signedManifest), 'utf8'), publicKey, signature); } catch { valid = false; }
    if (!valid) throw new Error('A assinatura do manifesto não confere com a chave oficial do Cypher. A instalação foi bloqueada.');
  } else if (manifest.signature || manifest.signatureAlgorithm) {
    throw new Error('Este Cypher recebeu um manifesto assinado, mas não tem a chave pública correspondente. Atualize o navegador por um instalador oficial.');
  }

  const channel = manifest.schemaVersion === 1 ? 'stable' : manifest.channel;
  if (!['stable', 'preview'].includes(channel)) throw new Error('O manifesto indica um canal de atualização desconhecido.');
  if (channel === 'stable' && isPreview(version)) throw new Error('Uma versão Preview foi publicada no canal oficial. A instalação foi bloqueada.');
  let minimumVersion = '';
  if (manifest.schemaVersion === 2 && manifest.minimumVersion) {
    if (!parseVersion(manifest.minimumVersion) || isPreview(manifest.minimumVersion)) throw new Error('A versão mínima do manifesto é inválida.');
    if (compareVersions(manifest.minimumVersion, version) > 0) throw new Error('A versão mínima do manifesto é maior que a própria versão publicada.');
    minimumVersion = manifest.minimumVersion;
  }
  return {
    version, tag: manifest.tag, channel, minimumVersion,
    assetName: manifest.assetName, sha512: manifest.sha512, installerAssetName: manifest.installerAssetName, installerSha512: manifest.installerSha512,
    publishedAt: typeof manifest.publishedAt === 'string' ? manifest.publishedAt.slice(0, 40) : '',
    releaseNotes: typeof manifest.releaseNotes === 'string' ? manifest.releaseNotes.slice(0, 3000) : '',
    notes: cleanNotes(manifest.notes),
  };
}

module.exports = { parseManifest, canonicalJson, cleanNotes };
