'use strict';
// Reexporta o leitor do app e gera dist/changelog.json na build.
const { parseChangelog, notesBetween, ILLUSTRATIONS } = require('../electron/changelog.cjs');
module.exports = { parseChangelog, notesBetween, ILLUSTRATIONS };

if (require.main === module) {
  // Uso na build: node scripts/changelog.cjs CHANGELOG.md dist/changelog.json
  const fs = require('node:fs');
  const [source = 'CHANGELOG.md', target = 'dist/changelog.json'] = process.argv.slice(2);
  const entries = parseChangelog(fs.readFileSync(source, 'utf8')).slice(0, 40);
  fs.writeFileSync(target, JSON.stringify(entries));
  console.log(`changelog.json: ${entries.length} versões.`);
}
