const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

function canConnect(port, handshake) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    let settled = false;
    const finish = available => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(available);
    };
    socket.setTimeout(1600, () => finish(false));
    socket.once('connect', () => {
      if (!handshake) return finish(true);
      socket.write(Buffer.from([5, 1, 0]));
    });
    socket.once('data', data => finish(data.length >= 2 && data[0] === 5 && data[1] === 0));
    socket.once('error', () => finish(false));
  });
}

function firstFile(root, filename) {
  if (!fs.existsSync(root)) return null;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === filename.toLowerCase()) return fullPath;
    if (entry.isDirectory()) {
      const found = firstFile(fullPath, filename);
      if (found) return found;
    }
  }
  return null;
}

function createPrivacyServices({ app, spawnProcess = spawn, logger = console } = {}) {
  const managed = new Map();
  const startPromises = new Map();
  const executablePaths = new Map();

  function runtimeRoot() {
    return app.isPackaged
      ? path.join(process.resourcesPath, 'privacy-runtime')
      : path.resolve(__dirname, '../vendor/privacy-runtime');
  }

  function check(mode, port) {
    if (mode === 'tor') return canConnect(port, true);
    const child = managed.get(mode);
    if (!child || child.exitCode !== null || child.signalCode) return Promise.resolve(false);
    return canConnect(port, false);
  }

  function executable(mode) {
    if (executablePaths.has(mode)) return executablePaths.get(mode);
    const root = path.join(runtimeRoot(), mode === 'tor' ? 'tor' : 'i2pd');
    const found = firstFile(root, mode === 'tor' ? 'tor.exe' : 'i2pd.exe');
    executablePaths.set(mode, found);
    return found;
  }

  async function waitForProxy(mode, port, child, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (child.__cypherSpawnError) throw new Error(`O serviço não conseguiu iniciar: ${child.__cypherSpawnError.message}`);
      if (child.exitCode !== null || child.signalCode) {
        throw new Error(`${mode === 'tor' ? 'Tor' : 'I2P'} encerrou durante a inicialização${child.exitCode == null ? '' : ` (código ${child.exitCode})`}.`);
      }
      if (await check(mode, port)) return;
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    throw new Error(`${mode === 'tor' ? 'Tor' : 'I2P'} não abriu o proxy local na porta ${port} dentro do tempo esperado.`);
  }

  async function start(mode, port) {
    if (!['tor', 'i2p'].includes(mode)) throw new Error('Rede privada desconhecida.');
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('A porta configurada para a rede privada é inválida.');

    const pending = startPromises.get(mode);
    if (pending) return pending;

    const operation = (async () => {
      const active = managed.get(mode);
      if (active && active.exitCode === null && !active.signalCode) {
        await waitForProxy(mode, port, active, mode === 'tor' ? 12000 : 12000);
        return { started: true };
      }

      if (mode === 'tor' && await check(mode, port)) {
        throw new Error(`A porta ${port} já está ocupada por outro proxy Tor. Feche o serviço externo ou escolha outra porta; o Cypher precisa iniciar seu próprio cliente para aplicar o isolamento de circuitos.`);
      }
      if (mode === 'i2p' && await canConnect(port, false)) {
        throw new Error(`A porta ${port} já está ocupada por outro programa. Feche o serviço que a está usando ou escolha outra porta nas configurações.`);
      }

      const program = executable(mode);
      if (!program) {
        const bundle = mode === 'tor' ? 'Tor Expert Bundle' : 'i2pd';
        throw new Error(`Os arquivos do ${bundle} não estão instalados com esta cópia do Cypher. Reinstale a versão oficial mais recente.`);
      }

      let args;
      let cwd = path.dirname(program);
      if (mode === 'tor') {
        const bundleRoot = path.dirname(program);
        const dataDirectory = path.join(app.getPath('userData'), 'tor-data');
        await fs.promises.mkdir(dataDirectory, { recursive: true });
        args = [
          '--ClientOnly', '1',
          '--SocksPort', `127.0.0.1:${port} IsolateDestAddr IsolateDestPort IsolateSOCKSAuth`,
          '--SocksPolicy', 'accept 127.0.0.1',
          '--DataDirectory', dataDirectory,
          '--CookieAuthentication', '0',
          '--ControlPort', '0',
          '--RunAsDaemon', '0',
          '--Log', 'notice stdout',
        ];
        const geoip = firstFile(bundleRoot, 'geoip');
        const geoip6 = firstFile(bundleRoot, 'geoip6');
        if (geoip) args.push('--GeoIPFile', geoip);
        if (geoip6) args.push('--GeoIPv6File', geoip6);
      } else {
        const dataDirectory = path.join(app.getPath('userData'), 'i2p-data');
        await fs.promises.mkdir(dataDirectory, { recursive: true });
        const configPath = path.join(dataDirectory, 'i2pd.conf');
        const config = [
          'log = stdout',
          'loglevel = warn',
          'daemon = false',
          'notransit = true',
          'ipv4 = true',
          'ipv6 = false',
          '[http]',
          'enabled = false',
          '[httpproxy]',
          'enabled = true',
          'address = 127.0.0.1',
          `port = ${port}`,
          '[socksproxy]',
          'enabled = false',
          '[upnp]',
          'enabled = false',
          '',
        ].join('\n');
        await fs.promises.writeFile(configPath, config, 'utf8');
        // i2pd declares --daemon as a boolean switch. Passing --daemon=false
        // is parsed as an invalid argument on Windows and prevents startup.
        // The default (daemon disabled) keeps the router in the foreground so
        // Electron can supervise its lifecycle.
        args = [`--conf=${configPath}`, `--datadir=${dataDirectory}`];
        const certificates = path.join(cwd, 'contrib', 'certificates');
        if (fs.existsSync(certificates)) args.push(`--certsdir=${certificates}`);
      }

      const child = spawnProcess(program, args, { cwd, detached: false, stdio: 'ignore', windowsHide: true });
      managed.set(mode, child);
      child.once('error', error => {
        child.__cypherSpawnError = error;
        logger.error?.(`${mode} não iniciou:`, error.message);
      });
      child.once('exit', (code, signal) => {
        if (managed.get(mode) === child) managed.delete(mode);
        logger.info?.(`${mode} encerrou (código ${code ?? 'n/a'}, sinal ${signal ?? 'n/a'}).`);
      });

      try {
        await waitForProxy(mode, port, child, mode === 'tor' ? 45000 : 30000);
        return { started: true };
      } catch (error) {
        try { child.kill(); } catch {}
        throw error;
      }
    })();

    startPromises.set(mode, operation);
    try { return await operation; }
    finally { if (startPromises.get(mode) === operation) startPromises.delete(mode); }
  }

  async function stop(mode) {
    const child = managed.get(mode);
    if (!child) return;
    if (child.exitCode !== null || child.signalCode) { managed.delete(mode); return; }
    try { child.kill(); } catch (error) { logger.warn?.(`Não foi possível encerrar ${mode}:`, error.message); }
    await Promise.race([
      new Promise(resolve => child.once('exit', resolve)),
      new Promise(resolve => setTimeout(resolve, 2500)),
    ]);
    if (child.exitCode !== null || child.signalCode) managed.delete(mode);
  }

  async function stopOther(mode) {
    await Promise.all(['tor', 'i2p'].filter(candidate => candidate !== mode).map(stop));
  }

  async function stopAll() {
    await Promise.all(['tor', 'i2p'].map(stop));
  }

  return { start, stop, stopOther, stopAll, check, installed: mode => !!executable(mode) };
}

module.exports = { createPrivacyServices };
