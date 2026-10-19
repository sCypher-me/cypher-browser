// Gera electron/preload.bundle.cjs (preload da interface + botões das extensões).
// Roda no "npm run build"; sem o arquivo, o Cypher usa o preload.cjs simples (sem os botões).
const path = require('node:path');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
esbuild.build({
  entryPoints: [path.join(root, 'electron', 'ui-preload-entry.cjs')],
  outfile: path.join(root, 'electron', 'preload.bundle.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  external: ['electron'],
  legalComments: 'inline',
  logLevel: 'warning',
}).then(() => console.log('preload.bundle.cjs gerado.')).catch(() => process.exit(1));
