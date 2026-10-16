const crypto = require('node:crypto');
const nodeFs = require('node:fs');
const fs = require('node:fs/promises');
const path = require('node:path');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const unzipper = require('unzipper');

const MAX_CRX_BYTES = 50 * 1024 * 1024;
const MAX_UNPACKED_BYTES = 100 * 1024 * 1024;
const MAX_ENTRIES = 10000;
const EC_PUBLIC_KEY_PREFIX = Buffer.from('3059301306072a8648ce3d020106082a8648ce3d03010703420004', 'hex');

function readVarint(buffer, cursor) {
  let value = 0n, shift = 0n;
  for (let index = cursor; index < buffer.length && index < cursor + 10; index++) {
    const byte = buffer[index];
    value |= BigInt(byte & 0x7f) << shift;
    if (!(byte & 0x80)) return { value: Number(value), next: index + 1 };
    shift += 7n;
  }
  throw new Error('O pacote CRX contém um cabeçalho inválido.');
}

function parseProto(buffer) {
  const result = [];
  for (let cursor = 0; cursor < buffer.length;) {
    const tag = readVarint(buffer, cursor); cursor = tag.next;
    const field = Math.floor(tag.value / 8), wire = tag.value & 7;
    if (!field) throw new Error('O pacote CRX contém um cabeçalho inválido.');
    if (wire === 2) {
      const size = readVarint(buffer, cursor); cursor = size.next;
      if (size.value < 0 || size.value > buffer.length - cursor) throw new Error('O pacote CRX contém um campo truncado.');
      result.push({ field, wire, value: buffer.subarray(cursor, cursor + size.value) }); cursor += size.value;
    } else if (wire === 0) {
      const value = readVarint(buffer, cursor); cursor = value.next; result.push({ field, wire, value: value.value });
    } else if (wire === 1) {
      if (cursor + 8 > buffer.length) throw new Error('O pacote CRX contém um campo truncado.');
      cursor += 8;
    } else if (wire === 5) {
      if (cursor + 4 > buffer.length) throw new Error('O pacote CRX contém um campo truncado.');
      cursor += 4;
    } else throw new Error('O pacote CRX usa um formato não suportado.');
  }
  return result;
}

function chromeIdFromKey(key) {
  const digest = crypto.createHash('sha256').update(key).digest().subarray(0, 16);
  return [...digest].map(byte => String.fromCharCode(97 + (byte >> 4), 97 + (byte & 15))).join('');
}

function verifyCrx(buffer, expectedId) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16 || buffer.length > MAX_CRX_BYTES || buffer.toString('ascii', 0, 4) !== 'Cr24') throw new Error('O download não é um pacote de extensão Chrome válido.');
  const version = buffer.readUInt32LE(4);
  if (version !== 3) throw new Error('O Cypher só instala pacotes de extensão CRX3 assinados pela Chrome Web Store.');
  const headerLength = buffer.readUInt32LE(8);
  if (!headerLength || headerLength > 1024 * 1024 || 12 + headerLength >= buffer.length) throw new Error('O pacote CRX tem um cabeçalho inválido.');
  const headerStart = 12, archiveStart = headerStart + headerLength;
  const headerBytes = buffer.subarray(headerStart, archiveStart), archive = buffer.subarray(archiveStart);
  const fields = parseProto(headerBytes);
  const signed = fields.find(field => field.field === 10000 && field.wire === 2)?.value;
  if (!signed) throw new Error('O pacote CRX não contém dados de assinatura.');
  const signedData = parseProto(signed).find(field => field.field === 1 && field.wire === 2)?.value;
  if (!signedData || signedData.length !== 16) throw new Error('O pacote CRX não identifica a extensão assinada.');
  const extensionId = [...signedData].map(byte => String.fromCharCode(97 + (byte >> 4), 97 + (byte & 15))).join('');
  if (extensionId !== expectedId) throw new Error('A assinatura do pacote não corresponde ao identificador da extensão solicitada.');
  const signatureInput = Buffer.concat([Buffer.from('CRX3 SignedData\0','utf8'), Buffer.from([signed.length & 255, (signed.length >>> 8) & 255, (signed.length >>> 16) & 255, (signed.length >>> 24) & 255]), signed, archive]);
  let verifiedDeveloperSignature = false;
  for (const fieldNumber of [2, 3]) for (const proofField of fields.filter(field => field.field === fieldNumber && field.wire === 2)) {
    try {
      const proof = parseProto(proofField.value);
      const publicKey = proof.find(field => field.field === 1 && field.wire === 2)?.value;
      const signature = proof.find(field => field.field === 2 && field.wire === 2)?.value;
      if (!publicKey || !signature || chromeIdFromKey(publicKey) !== expectedId) continue;
      let key;
      try { key = crypto.createPublicKey({ key:publicKey, format:'der', type:'spki' }); }
      catch {
        if (fieldNumber !== 3 || publicKey.length !== 65 || publicKey[0] !== 4) continue;
        key = crypto.createPublicKey({ key:Buffer.concat([EC_PUBLIC_KEY_PREFIX,publicKey]), format:'der', type:'spki' });
      }
      const options = fieldNumber === 2 ? { key, padding:crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength:32 } : key;
      if (crypto.verify('sha256', signatureInput, options, signature)) verifiedDeveloperSignature = true;
    } catch {}
  }
  if (!verifiedDeveloperSignature) throw new Error('Não foi possível validar a assinatura oficial da extensão. O pacote foi rejeitado.');
  return { archive, extensionId };
}

async function unpackCrx(buffer, expectedId, destination) {
  const { archive, extensionId } = verifyCrx(buffer, expectedId);
  const directory = await unzipper.Open.buffer(archive);
  if (!directory.files.length || directory.files.length > MAX_ENTRIES) throw new Error('A extensão tem uma quantidade de arquivos fora do limite permitido.');
  const root = path.resolve(destination);
  await fs.mkdir(root, { recursive:true });
  let expandedBytes = 0;
  for (const entry of directory.files) {
    const rawName = entry.path.replace(/\\/g, '/');
    if (!rawName || rawName.includes(':') || rawName.includes('\0') || rawName.startsWith('/') || /^[a-z]:/i.test(rawName) || rawName.split('/').some(part => part === '..' || part === '.')) throw new Error('O pacote contém um caminho de arquivo inválido.');
    if (!['File','Directory'].includes(entry.type)) throw new Error('O pacote contém um tipo de arquivo não permitido.');
    const output = path.resolve(root, rawName);
    if (!output.startsWith(root + path.sep) && output !== root) throw new Error('O pacote tenta gravar fora da pasta da extensão.');
    if (entry.type === 'Directory') { await fs.mkdir(output, { recursive:true }); continue; }
    const declaredSize = entry.uncompressedSize ?? entry.vars?.uncompressedSize;
    if (!Number.isFinite(declaredSize) || declaredSize < 0 || declaredSize > MAX_UNPACKED_BYTES) throw new Error('A extensão contém um arquivo grande demais.');
    await fs.mkdir(path.dirname(output), { recursive:true });
    let fileBytes = 0;
    const limiter = new Transform({ transform(chunk, _encoding, callback) {
      fileBytes += chunk.length; expandedBytes += chunk.length;
      if (fileBytes > MAX_UNPACKED_BYTES || expandedBytes > MAX_UNPACKED_BYTES) callback(new Error('A extensão ultrapassa o limite de 100 MB descompactada.'));
      else callback(null, chunk);
    } });
    await pipeline(entry.stream(), limiter, nodeFs.createWriteStream(output, { flags:'wx' }));
  }
  return { extensionId, path:root };
}

module.exports = { MAX_CRX_BYTES, unpackCrx, verifyCrx };
