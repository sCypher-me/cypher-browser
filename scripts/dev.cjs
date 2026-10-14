const { spawn } = require('node:child_process');
const { createServer } = require('vite');
(async () => {
  const server = await createServer();
  await server.listen();
  const env = { ...process.env, CYPHER_DEV_URL: 'http://127.0.0.1:5173' };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(require('electron'), ['.'], { stdio: 'inherit', env });
  child.on('exit', async code => { await server.close(); process.exit(code || 0); });
  process.on('SIGINT', () => child.kill());
})().catch(error => { console.error(error); process.exit(1); });
