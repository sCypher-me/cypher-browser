const fs = require('node:fs/promises');
const nodeFs = require('node:fs');
const path = require('node:path');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const unzipper = require('unzipper');

const MAX_PACKAGE_BYTES = 50 * 1024 * 1024;
const MAX_UNPACKED_BYTES = 100 * 1024 * 1024;
const MAX_ENTRIES = 10000;
const MAX_METADATA_BYTES = 64 * 1024;

function safeEntryPath(entry) {
  const normalized = String(entry.path || '').replace(/\\/g, '/').replace(/\/$/, '');
  if (!normalized || normalized.includes('\0') || normalized.includes(':') || normalized.startsWith('/') || /^\/\//.test(normalized)) {
    throw new Error('O pacote contém um caminho de arquivo inválido.');
  }
  const parts = normalized.split('/');
  for (const part of parts) {
    const deviceName = part.split('.')[0].toUpperCase();
    if (!part || part === '.' || part === '..' || /[<>"|?*]/.test(part) || /[. ]$/.test(part) || /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(deviceName)) {
      throw new Error('O pacote contém um caminho de arquivo inválido.');
    }
  }
  return { normalized, parts };
}

function validateMetadata(metadata, manifest) {
  if (!metadata || metadata.format !== 'cypher-extension' || metadata.formatVersion !== 1) throw new Error('Este não é um pacote Cypher Extension v1.');
  if (typeof metadata.id !== 'string' || metadata.id.length > 128 || !/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(metadata.id) || !metadata.id.includes('.')) throw new Error('O ID deve ser único e usar o formato reverso de domínio, por exemplo com.exemplo.ferramenta.');
  if (typeof metadata.name !== 'string' || !metadata.name.trim() || metadata.name.length > 128) throw new Error('O pacote precisa de um nome de 1 a 128 caracteres.');
  if (typeof metadata.author !== 'string' || !metadata.author.trim() || metadata.author.length > 128) throw new Error('O pacote precisa identificar o autor em até 128 caracteres.');
  if (typeof metadata.description !== 'string' || metadata.description.length > 512) throw new Error('A descrição do pacote deve ter até 512 caracteres.');
  if (typeof metadata.version !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(metadata.version) || metadata.version !== manifest.version) throw new Error('A versão do pacote deve ser semântica e igual à versão em manifest.json.');
  if (metadata.minCypherVersion !== undefined && (typeof metadata.minCypherVersion !== 'string' || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(metadata.minCypherVersion))) throw new Error('minCypherVersion precisa usar uma versão semântica.');
  if (!manifest || ![2,3].includes(manifest.manifest_version) || typeof manifest.name !== 'string' || typeof manifest.version !== 'string') throw new Error('O pacote precisa conter um manifest.json válido para Chromium.');
  return metadata;
}

async function extractCypherPackage(packageFile, destination) {
  const source = path.resolve(packageFile), root = path.resolve(destination);
  const stat = await fs.stat(source);
  if (!stat.isFile() || stat.size > MAX_PACKAGE_BYTES) throw new Error('O pacote Cypher deve ser um arquivo de até 50 MB.');
  const archive = await unzipper.Open.file(source);
  if (!archive.files.length || archive.files.length > MAX_ENTRIES) throw new Error('O pacote tem uma quantidade de arquivos fora do limite permitido.');
  const seen = new Set();
  let expandedBytes = 0;
  try {
    await fs.mkdir(root, { recursive: false });
    for (const entry of archive.files) {
      const { normalized, parts } = safeEntryPath(entry);
      const collisionKey = normalized.toLocaleLowerCase('en-US');
      if (seen.has(collisionKey)) throw new Error('O pacote contém nomes de arquivo duplicados.');
      seen.add(collisionKey);
      if (!['File','Directory'].includes(entry.type)) throw new Error('O pacote contém um tipo de arquivo não permitido.');
      const output = path.resolve(root, ...parts);
      if (!output.startsWith(root + path.sep)) throw new Error('O pacote tenta gravar fora da pasta de instalação.');
      if (entry.type === 'Directory') { await fs.mkdir(output, { recursive:true }); continue; }
      const declaredSize = entry.uncompressedSize ?? entry.vars?.uncompressedSize;
      if (!Number.isFinite(declaredSize) || declaredSize < 0 || declaredSize > MAX_UNPACKED_BYTES || expandedBytes + declaredSize > MAX_UNPACKED_BYTES) throw new Error('O pacote ultrapassa o limite de 100 MB descompactado.');
      await fs.mkdir(path.dirname(output), { recursive:true });
      let fileBytes = 0;
      const limiter = new Transform({ transform(chunk, _encoding, callback) {
        fileBytes += chunk.length;
        if (fileBytes > declaredSize || expandedBytes + fileBytes > MAX_UNPACKED_BYTES) callback(new Error('O conteúdo real do pacote ultrapassa os limites permitidos.'));
        else callback(null, chunk);
      } });
      await pipeline(entry.stream(), limiter, nodeFs.createWriteStream(output, { flags:'wx' }));
      if (fileBytes !== declaredSize) throw new Error('Um arquivo do pacote não corresponde ao tamanho declarado.');
      expandedBytes += fileBytes;
    }
    const metadataPath = path.join(root, 'cypher-extension.json');
    const manifestPath = path.join(root, 'manifest.json');
    const [metadataStats, manifestStats] = await Promise.all([fs.stat(metadataPath), fs.stat(manifestPath)]);
    if (!metadataStats.isFile() || metadataStats.size > MAX_METADATA_BYTES) throw new Error('cypher-extension.json ausente ou maior que 64 KB.');
    if (!manifestStats.isFile() || manifestStats.size > 512 * 1024) throw new Error('manifest.json ausente ou maior que 512 KB.');
    const [metadata, manifest] = await Promise.all([fs.readFile(metadataPath, 'utf8'), fs.readFile(manifestPath, 'utf8')]);
    let parsedMetadata, parsedManifest;
    try { parsedMetadata = JSON.parse(metadata); parsedManifest = JSON.parse(manifest); }
    catch { throw new Error('Os arquivos JSON do pacote estão inválidos.'); }
    return { metadata:validateMetadata(parsedMetadata, parsedManifest), manifest:parsedManifest, path:root };
  } catch (error) {
    await fs.rm(root, { recursive:true, force:true }).catch(() => {});
    throw error;
  }
}

module.exports = { MAX_ENTRIES, MAX_PACKAGE_BYTES, MAX_UNPACKED_BYTES, extractCypherPackage, safeEntryPath, validateMetadata };
