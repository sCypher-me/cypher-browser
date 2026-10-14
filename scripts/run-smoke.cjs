const { spawn } = require('node:child_process');
const path = require('node:path');
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
env.CYPHER_TEST_PROFILE = path.resolve('.cypher-test-profile',String(Date.now()));
const child = spawn(require('electron'), ['tests/smoke.cjs'], { stdio: 'inherit', env });
child.on('exit', code => {
  if (code !== 0) process.exit(code || 1);
  const restart = spawn(require('electron'),['tests/restart.cjs'],{ stdio:'inherit',env });
  restart.on('exit', result => process.exit(result || 0));
});
