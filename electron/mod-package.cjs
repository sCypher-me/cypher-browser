const fs = require('node:fs/promises');
const nodeFs = require('node:fs');
const path = require('node:path');
const { createHash, createPublicKey, verify: verifySignature } = require('node:crypto');
const unzipper = require('unzipper');

const MAX_PACKAGE_BYTES = 60 * 1024 * 1024;
const MAX_UNPACKED_BYTES = 120 * 1024 * 1024;
const MAX_ENTRIES = 400;
const MANIFEST = 'cypher-mod.json';
const allowedFiles = {
  image: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'],
  video: ['.mp4', '.webm'],
  audio: ['.mp3', '.ogg', '.wav', '.m4a'],
  css: ['.css'],
  font: ['.woff2', '.woff', '.ttf', '.otf'],
};
const allowedExtensions = new Set([...Object.values(allowedFiles).flat(), '.json', '.txt', '.md']);
const soundKeys = ['click', 'hover', 'tabOpen', 'tabClose', 'typing', 'navigate'];
const shaderPresets = ['none', 'crt', 'sepia', 'neon', 'noir', 'warm', 'cool', 'vignette', 'dream'];

function kindOf(file) { const ext = path.extname(file).toLowerCase(); return Object.keys(allowedFiles).find(kind => allowedFiles[kind].includes(ext)) || ''; }

function safeRelativePath(value) {
  const normalized = String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
  if (!normalized || normalized.length > 200 || normalized.includes('\0') || normalized.includes(':') || normalized.startsWith('/')) throw new Error('O mod contém um caminho de arquivo inválido.');
  const parts = normalized.split('/');
  for (const part of parts) {
    const deviceName = part.split('.')[0].toUpperCase();
    if (!part || part === '.' || part === '..' || /[<>"|?*]/.test(part) || /[. ]$/.test(part) || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(deviceName)) throw new Error('O mod contém um caminho de arquivo inválido.');
  }
  return normalized;
}

function sanitizeCss(value) {
  if (typeof value !== 'string') return '';
  return value.slice(0, 200000)
    .replace(/<\/?style/gi, '')
    .replace(/@import[^;]*;?/gi, '')
    .replace(/url\(\s*(['"]?)(?!data:(?:image\/(?:png|jpeg|webp|gif|svg\+xml)|font\/woff2?)[;,])[^)]*\)/gi, 'none')
    .replace(/expression\s*\(|-moz-binding|behavior\s*:/gi, '');
}

const hexColor = value => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value);
const semver = value => typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value);
const fileRef = (value, kind, files) => {
  if (value === undefined || value === null || value === '') return '';
  const relative = safeRelativePath(value);
  if (kindOf(relative) !== kind) throw new Error(`O arquivo ${relative} não é do tipo esperado (${kind}).`);
  if (files && !files.has(relative.toLowerCase())) throw new Error(`O arquivo ${relative} citado no manifesto não está no pacote.`);
  return relative;
};

/** Validates a cypher-mod.json manifest. `files` (lowercased relative paths) checks that referenced files exist. */
function validateModManifest(input, files) {
  if (!input || input.format !== 'cypher-mod' || input.formatVersion !== 1) throw new Error('Este não é um mod Cypher (format "cypher-mod", formatVersion 1).');
  if (typeof input.id !== 'string' || input.id.length > 128 || !/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/.test(input.id)) throw new Error('O ID do mod deve usar o formato reverso de domínio, por exemplo com.exemplo.meu-mod.');
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 64) throw new Error('O mod precisa de um nome de até 64 caracteres.');
  if (!semver(input.version)) throw new Error('A versão do mod precisa ser semântica, como 1.0.0.');
  const manifest = {
    format: 'cypher-mod', formatVersion: 1, id: input.id, name: input.name.trim(), version: input.version,
    author: String(input.author || 'Comunidade').trim().slice(0, 64) || 'Comunidade',
    description: String(input.description || '').slice(0, 400),
    minCypherVersion: semver(input.minCypherVersion) ? input.minCypherVersion : '',
    preview: fileRef(input.preview, 'image', files),
    tags: Array.isArray(input.tags) ? input.tags.filter(tag => typeof tag === 'string').slice(0, 6).map(tag => tag.trim().slice(0, 24)).filter(Boolean) : [],
    components: {},
  };
  const components = input.components && typeof input.components === 'object' ? input.components : {};
  const theme = components.theme;
  if (theme && typeof theme === 'object') {
    const value = {};
    for (const key of ['accent', 'surface', 'background']) if (hexColor(theme[key])) value[key] = theme[key].toLowerCase();
    if (['recorte', 'classic'].includes(theme.skin)) value.skin = theme.skin;
    if (['dark', 'light'].includes(theme.appearanceMode)) value.appearanceMode = theme.appearanceMode;
    if (theme.tokens && typeof theme.tokens === 'object') {
      const tokens = {};
      if (Number.isFinite(theme.tokens.cut)) tokens.cut = Math.round(Math.max(0, Math.min(28, theme.tokens.cut)));
      if (Number.isFinite(theme.tokens.density)) tokens.density = Math.max(0.85, Math.min(1.25, theme.tokens.density));
      if (Number.isFinite(theme.tokens.barHeight)) tokens.barHeight = Math.round(Math.max(40, Math.min(72, theme.tokens.barHeight)));
      if (Number.isFinite(theme.tokens.borderWidth)) tokens.borderWidth = Math.round(Math.max(0, Math.min(3, theme.tokens.borderWidth)));
      if (Object.keys(tokens).length) value.tokens = tokens;
    }
    if (Object.keys(value).length) manifest.components.theme = value;
  }
  const wallpaper = components.wallpaper;
  if (wallpaper && typeof wallpaper === 'object' && wallpaper.file) {
    const kind = kindOf(String(wallpaper.file));
    if (!['image', 'video'].includes(kind)) throw new Error('O papel de parede precisa ser uma imagem ou um vídeo MP4/WebM.');
    manifest.components.wallpaper = { file: fileRef(wallpaper.file, kind, files), type: kind, dim: Number.isFinite(wallpaper.dim) ? Math.max(0, Math.min(0.9, wallpaper.dim)) : 0.35 };
  }
  const sounds = components.sounds;
  if (sounds && typeof sounds === 'object') {
    const value = { volume: Number.isFinite(sounds.volume) ? Math.max(0, Math.min(1, sounds.volume)) : 0.6 };
    for (const key of soundKeys) { const file = fileRef(sounds[key], 'audio', files); if (file) value[key] = file; }
    if (Object.keys(value).length > 1) manifest.components.sounds = value;
  }
  const music = components.music;
  if (music && typeof music === 'object') {
    const base = fileRef(music.base, 'audio', files), active = fileRef(music.active, 'audio', files);
    if (base) manifest.components.music = { base, active, volume: Number.isFinite(music.volume) ? Math.max(0, Math.min(1, music.volume)) : 0.45 };
  }
  if (Array.isArray(components.pageStyles)) {
    const styles = components.pageStyles.slice(0, 40).flatMap(entry => {
      if (!entry || !Array.isArray(entry.matches)) return [];
      const matches = entry.matches.filter(host => typeof host === 'string' && /^(?:\*\.)?[a-z\d-]+(?:\.[a-z\d-]+)+$/i.test(host)).slice(0, 20).map(host => host.toLowerCase());
      const css = fileRef(entry.css, 'css', files);
      return matches.length && css ? [{ matches, css }] : [];
    });
    if (styles.length) manifest.components.pageStyles = styles;
  }
  const shader = components.shader;
  if (shader && typeof shader === 'object' && shaderPresets.includes(shader.preset) && shader.preset !== 'none') {
    manifest.components.shader = { preset: shader.preset, intensity: Number.isFinite(shader.intensity) ? Math.max(0.1, Math.min(1, shader.intensity)) : 0.6 };
  }
  if (Array.isArray(components.fonts)) {
    const fonts = components.fonts.slice(0, 4).flatMap(entry => {
      if (!entry || !['display', 'body'].includes(entry.use)) return [];
      const file = fileRef(entry.file, 'font', files);
      return file ? [{ file, use: entry.use, family: String(entry.family || 'Mod Font').replace(/[^\w\s-]/g, '').slice(0, 40) || 'Mod Font' }] : [];
    });
    if (fonts.length) manifest.components.fonts = fonts;
  }
  const interfaceCss = fileRef(components.interfaceCss, 'css', files);
  if (interfaceCss) manifest.components.interfaceCss = interfaceCss;
  if (!Object.keys(manifest.components).length) throw new Error('O mod não tem nenhum componente válido (tema, papel de parede, sons, música, estilos, filtro ou fontes).');
  return manifest;
}

async function listFiles(root, base = root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const output = [];
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) output.push(...await listFiles(full, base));
    else if (entry.isFile()) output.push(path.relative(base, full).replace(/\\/g, '/'));
  }
  return output;
}

/** Extracts a .cyphermod into a new folder and returns the validated manifest. The folder must not exist. */
async function extractModPackage(packageFile, destination) {
  const source = path.resolve(packageFile), root = path.resolve(destination);
  const stat = await fs.stat(source);
  if (!stat.isFile() || stat.size > MAX_PACKAGE_BYTES) throw new Error('O mod deve ser um arquivo de até 60 MB.');
  const archive = await unzipper.Open.file(source);
  if (!archive.files.length || archive.files.length > MAX_ENTRIES) throw new Error('O mod tem uma quantidade de arquivos fora do limite permitido.');
  let expanded = 0;
  const seen = new Set();
  await fs.mkdir(root, { recursive: false });
  try {
    for (const entry of archive.files) {
      if (entry.type === 'Directory') continue;
      if (entry.type !== 'File') throw new Error('O mod contém um tipo de arquivo não permitido.');
      const relative = safeRelativePath(entry.path);
      if (!allowedExtensions.has(path.extname(relative).toLowerCase())) throw new Error(`O tipo de arquivo de ${relative} não é permitido em mods.`);
      const key = relative.toLowerCase();
      if (seen.has(key)) throw new Error('O mod contém nomes de arquivo duplicados.');
      seen.add(key);
      const size = entry.uncompressedSize ?? entry.vars?.uncompressedSize;
      if (!Number.isFinite(size) || size < 0 || expanded + size > MAX_UNPACKED_BYTES) throw new Error('O mod ultrapassa o limite de 120 MB descompactado.');
      const output = path.resolve(root, ...relative.split('/'));
      if (!output.startsWith(root + path.sep)) throw new Error('O mod tenta gravar fora da pasta de instalação.');
      await fs.mkdir(path.dirname(output), { recursive: true });
      const buffer = await entry.buffer();
      if (buffer.length !== size) throw new Error('Um arquivo do mod não corresponde ao tamanho declarado.');
      await fs.writeFile(output, buffer, { flag: 'wx' });
      expanded += size;
    }
    return await readModFolder(root);
  } catch (error) {
    await fs.rm(root, { recursive: true, force: true });
    throw error;
  }
}

/** Reads and validates an unpacked mod folder. */
async function readModFolder(root) {
  const manifestPath = path.join(root, MANIFEST);
  const stat = await fs.stat(manifestPath).catch(() => null);
  if (!stat?.isFile() || stat.size > 64 * 1024) throw new Error('cypher-mod.json ausente ou maior que 64 KB.');
  let parsed;
  try { parsed = JSON.parse((await fs.readFile(manifestPath, 'utf8')).replace(/^﻿/, '')); } catch { throw new Error('O cypher-mod.json do mod está inválido.'); }
  const files = new Set((await listFiles(root)).map(file => file.toLowerCase()));
  return validateModManifest(parsed, files);
}

/** Reads the CSS files a manifest references, sanitized. */
async function readModCss(root, manifest) {
  const read = async file => sanitizeCss(await fs.readFile(path.join(root, ...file.split('/')), 'utf8'));
  return {
    pageStyles: await Promise.all((manifest.components.pageStyles || []).map(async entry => ({ matches: entry.matches, css: await read(entry.css) }))),
    interfaceCss: manifest.components.interfaceCss ? await read(manifest.components.interfaceCss) : '',
  };
}

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(buffer) { let crc = 0xffffffff; for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }

/** Writes an uncompressed ZIP (store method) from [{ name, data }]. */
function writeZip(entries) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuffer = Buffer.from(safeRelativePath(name), 'utf8'), crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 10); local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26); local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8); central.writeUInt16LE(0, 10);
    central.writeUInt32LE(0, 12); central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuffer, data); centrals.push(central, nameBuffer);
    offset += local.length + nameBuffer.length + data.length;
  }
  const centralBuffer = Buffer.concat(centrals), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuffer, end]);
}

/** Packs a mod folder into a .cyphermod buffer after validating it. */
async function packModFolder(root) {
  await readModFolder(root);
  const files = (await listFiles(root)).filter(file => allowedExtensions.has(path.extname(file).toLowerCase())).sort();
  return writeZip(await Promise.all(files.map(async name => ({ name, data: await fs.readFile(path.join(root, ...name.split('/'))) }))));
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

/** Verifies an Ed25519-signed JSON document (same scheme as the update manifest). */
function verifySignedJson(document, publicKeyPem) {
  if (!publicKeyPem) throw new Error('Este Cypher não tem uma chave de assinatura configurada para o catálogo.');
  if (!document || document.signatureAlgorithm !== 'Ed25519' || typeof document.signature !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(document.signature)) throw new Error('O catálogo de mods não está assinado.');
  const { signature, ...signed } = document;
  const key = createPublicKey(publicKeyPem);
  if (!verifySignature(null, Buffer.from(canonicalJson(signed), 'utf8'), key, Buffer.from(signature, 'base64'))) throw new Error('A assinatura do catálogo de mods é inválida.');
  return signed;
}

const sha512 = buffer => createHash('sha512').update(buffer).digest('base64');

module.exports = { validateModManifest, extractModPackage, readModFolder, readModCss, writeZip, packModFolder, verifySignedJson, sanitizeCss, sha512, kindOf, shaderPresets, soundKeys, MANIFEST, allowedFiles };
