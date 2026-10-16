const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { FiltersEngine } = require('@ghostery/adblocker');

const input = process.argv[2];
if (!input) throw new Error('Informe o caminho da lista EasyPrivacy baixada.');
const text = fs.readFileSync(input, 'utf8').replace(/^\uFEFF/, '');
if (!/^\s*\[Adblock Plus 1\.1\]/.test(text) || !/^! Title: EasyPrivacy$/m.test(text) || text.length < 100_000) {
  throw new Error('A lista está vazia, incompleta ou não é a EasyPrivacy oficial.');
}

const engine = FiltersEngine.parse(text, {
  loadCosmeticFilters: false,
  loadGenericCosmeticsFilters: false,
  loadExtendedSelectors: false,
  loadCSPFilters: false,
  enableHtmlFiltering: false,
});
const networkRuleCount = engine.getFilters().networkFilters.length;
if (networkRuleCount < 10_000) throw new Error(`A lista compilada contém regras insuficientes: ${networkRuleCount}.`);

const outputDirectory = path.resolve(__dirname, '../electron/resources');
fs.mkdirSync(outputDirectory, { recursive: true });
const binary = Buffer.from(engine.serialize());
const temporary = path.join(outputDirectory, 'easyprivacy.bin.tmp');
fs.writeFileSync(temporary, binary);
fs.renameSync(temporary, path.join(outputDirectory, 'easyprivacy.bin'));
const modified = text.match(/^! Last modified: (.+)$/m)?.[1] || '';
const fetchedAt = new Date().toISOString();
const metadata = {
  name: 'EasyPrivacy',
  source: 'https://easylist.to/easylist/easyprivacy.txt',
  license: 'GPL-3.0-or-later OR CC-BY-SA-3.0-or-later',
  attribution: 'EasyList authors (https://easylist.to/)',
  lastModified: modified,
  fetchedAt,
  networkRuleCount,
  sourceSha256: crypto.createHash('sha256').update(text).digest('hex'),
};
fs.writeFileSync(path.join(outputDirectory, 'easyprivacy.json'), `${JSON.stringify(metadata, null, 2)}\n`);
console.log(`EasyPrivacy compilada: ${networkRuleCount.toLocaleString('pt-BR')} regras de rede; lista ${modified || 'sem data'}.`);
