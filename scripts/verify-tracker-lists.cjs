// Confere se as listas compiladas abrem com a versão instalada do @ghostery/adblocker.
// Uma atualização da biblioteca muda o formato serializado e invalida os .bin antigos.
const fs = require('node:fs');
const path = require('node:path');
const { FiltersEngine } = require('@ghostery/adblocker');

const resources = path.resolve(__dirname, '..', 'electron', 'resources');

function verifyTrackerLists(directory = resources) {
  const problems = [];
  for (const name of ['easyprivacy', 'easylist']) {
    try { FiltersEngine.deserialize(fs.readFileSync(path.join(directory, `${name}.bin`))); }
    catch (error) { problems.push(`${name}.bin: ${error.message}`); }
  }
  return problems;
}

if (require.main === module) {
  const problems = verifyTrackerLists();
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  console.log('Listas de bloqueio compatíveis com o motor atual.');
}

module.exports = { verifyTrackerLists };
