// Packs every mod in electron/builtin-mods and catalog/mods into .cyphermod files and writes an index.json
// (to be signed with scripts/sign-update-manifest.cjs). Usage: node scripts/build-mod-catalog.cjs <output-dir>
const fs = require('node:fs');
const path = require('node:path');
const { packModFolder, readModFolder, sha512 } = require('../electron/mod-package.cjs');

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

async function main() {
  const output = path.resolve(process.argv[2] || 'artifacts/mods');
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output, { recursive: true });
  const sources = ['electron/builtin-mods', 'catalog/mods'].map(folder => path.resolve(__dirname, '..', folder)).filter(folder => fs.existsSync(folder));
  const mods = [];
  for (const source of sources) for (const entry of fs.readdirSync(source, { withFileTypes: true }).filter(item => item.isDirectory())) {
    const root = path.join(source, entry.name);
    const manifest = await readModFolder(root);
    if (mods.some(item => item.id === manifest.id)) throw new Error(`ID de mod duplicado: ${manifest.id}`);
    const buffer = await packModFolder(root);
    const file = `${manifest.id}.cyphermod`;
    fs.writeFileSync(path.join(output, file), buffer);
    let preview = '';
    if (manifest.preview) {
      const data = fs.readFileSync(path.join(root, ...manifest.preview.split('/')));
      if (data.length <= 280_000) preview = `data:${MIME[path.extname(manifest.preview).toLowerCase()]};base64,${data.toString('base64')}`;
    }
    mods.push({ id: manifest.id, name: manifest.name, version: manifest.version, author: manifest.author, description: manifest.description, tags: manifest.tags, components: Object.keys(manifest.components), preview, package: file, sha512: sha512(buffer), size: buffer.length });
    console.log(`Empacotado: ${manifest.name} (${(buffer.length / 1024).toFixed(0)} KB)`);
  }
  const index = { schemaVersion: 1, version: new Date().toISOString().slice(0, 10), generatedAt: new Date().toISOString(), mods };
  fs.writeFileSync(path.join(output, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  console.log(`Índice com ${mods.length} mods em ${output}`);
}

main().catch(error => { console.error(`Falha ao montar o catálogo: ${error.message}`); process.exitCode = 1; });
