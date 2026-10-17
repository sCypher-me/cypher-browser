const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { FiltersEngine } = require('@ghostery/adblocker');

const [privacyPath, adsPath] = process.argv.slice(2);
if (!privacyPath) throw new Error('Informe o caminho da lista EasyPrivacy baixada.');

function compileList(input, { title, name, file, source, minimumRules }) {
  const text = fs.readFileSync(input, 'utf8').replace(/^\uFEFF/, '');
  if (!/^\s*\[Adblock Plus (?:1\.\d+|2\.0)\]/.test(text) || !new RegExp(`^! Title: ${title}$`, 'm').test(text) || text.length < 100_000) {
    throw new Error(`A lista recebida não é uma ${name} completa.`);
  }
  const engine = FiltersEngine.parse(text, {
    loadCosmeticFilters: false,
    loadGenericCosmeticsFilters: false,
    loadExtendedSelectors: false,
    loadCSPFilters: false,
    enableHtmlFiltering: false,
  });
  const networkRuleCount = engine.getFilters().networkFilters.length;
  if (networkRuleCount < minimumRules) throw new Error(`${name} tem poucas regras de rede: ${networkRuleCount}.`);
  const outputDirectory = path.resolve(__dirname, '../electron/resources');
  fs.mkdirSync(outputDirectory, { recursive: true });
  const temporary = path.join(outputDirectory, `${file}.bin.tmp`);
  fs.writeFileSync(temporary, Buffer.from(engine.serialize()));
  fs.renameSync(temporary, path.join(outputDirectory, `${file}.bin`));
  const metadata = {
    name,
    source,
    license: 'GPL-3.0-or-later OR CC-BY-SA-3.0-or-later',
    attribution: 'EasyList authors (https://easylist.to/)',
    lastModified: text.match(/^! Last modified: (.+)$/m)?.[1] || '',
    fetchedAt: new Date().toISOString(),
    networkRuleCount,
    sourceSha256: crypto.createHash('sha256').update(text).digest('hex'),
  };
  fs.writeFileSync(path.join(outputDirectory, `${file}.json`), `${JSON.stringify(metadata, null, 2)}\n`);
  console.log(`${name} compilada: ${networkRuleCount.toLocaleString('pt-BR')} regras de rede; lista ${metadata.lastModified || 'sem data'}.`);
}

compileList(privacyPath, { title:'EasyPrivacy', name:'EasyPrivacy', file:'easyprivacy', source:'https://easylist.to/easylist/easyprivacy.txt', minimumRules:10_000 });
if (adsPath) compileList(adsPath, { title:'EasyList', name:'EasyList', file:'easylist', source:'https://easylist.to/easylist/easylist.txt', minimumRules:10_000 });
