const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { extractCypherPackage, safeEntryPath, validateMetadata } = require('../electron/cypher-package.cjs');

const manifest = { manifest_version:3, name:'Exemplo', version:'1.0.0' };
const metadata = { format:'cypher-extension', formatVersion:1, id:'com.exemplo.ferramenta', name:'Exemplo Cypher', version:'1.0.0', author:'Equipe', description:'Pacote de teste.' };

test('accepts safe relative files and directories in a package', () => {
  assert.deepEqual(safeEntryPath({ path:'icons/mark.svg', type:'File' }), { normalized:'icons/mark.svg', parts:['icons','mark.svg'] });
  assert.deepEqual(safeEntryPath({ path:'assets/', type:'Directory' }), { normalized:'assets', parts:['assets'] });
});

test('rejects package paths that can escape or collide with Windows devices', () => {
  for (const path of ['../outside.js','folder/../../outside.js','C:/outside.js','/rooted.js','folder\\..\\outside.js','assets/NUL.txt','folder/name.']) {
    assert.throws(() => safeEntryPath({ path, type:'File' }), /caminho de arquivo inválido/);
  }
});

test('accepts the Cypher v1 metadata schema with a matching Chromium manifest', () => {
  assert.equal(validateMetadata(metadata, manifest).id, 'com.exemplo.ferramenta');
});

test('rejects mismatched versions, IDs without reverse-domain format, and unsupported schema versions', () => {
  assert.throws(() => validateMetadata({ ...metadata, version:'2.0.0' }, manifest), /semântica/);
  assert.throws(() => validateMetadata({ ...metadata, id:'utility' }, manifest), /formato reverso de domínio/);
  assert.throws(() => validateMetadata({ ...metadata, formatVersion:2 }, manifest), /pacote Cypher Extension v1/);
});

test('extracts a packaged .cypherext example and keeps its manifest in the package root', async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(),'cypher-package-test-'));
  try {
    const archive = path.resolve(__dirname,'../examples/hello-cypher-extension.cypherext');
    const extracted = await extractCypherPackage(archive,path.join(temporary,'extension'));
    assert.equal(extracted.metadata.id,'com.cypher.examples.hello');
    assert.equal(extracted.manifest.name,'Olá, Cypher');
    assert.ok((await fs.stat(path.join(extracted.path,'popup.js'))).isFile());
  } finally { await fs.rm(temporary,{ recursive:true,force:true }); }
});
