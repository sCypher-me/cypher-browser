'use strict';
// Atualizações do Cypher: canais oficial e Preview, download em segundo plano, bloqueio de versões
// antigas e instalação agora ou ao fechar. A validação dos manifestos fica em update-manifest.cjs.
const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const { spawn } = require('node:child_process');
const { createHash, createPublicKey } = require('node:crypto');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { parseManifest } = require('./update-manifest.cjs');
const { compareVersions, isBlocked } = require('./versions.cjs');

const MAX_MANIFEST_BYTES = 256 * 1024;
const MAX_UPDATE_BYTES = 2 * 1024 * 1024 * 1024;
const UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;
const READY_FILE = 'ready.json';

function readConfig() {
  try {
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'update-config.json'), 'utf8'));
    const repository = typeof config.repository === 'string' ? config.repository.trim() : '';
    return { repository: /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) ? repository : '', updateSigningPublicKey: typeof config.updateSigningPublicKey === 'string' ? config.updateSigningPublicKey.trim() : '' };
  } catch { return { repository: '', updateSigningPublicKey: '' }; }
}

function loadSigningKey(value) {
  if (!value) return null;
  try {
    const key = createPublicKey(value);
    if (key.asymmetricKeyType !== 'ed25519') throw new Error('A chave de atualização precisa usar Ed25519.');
    return key;
  } catch (error) {
    // Mantém o atualizador vivo para uma build corrigida, mas recusa todo manifesto remoto.
    return { invalid: true, message: `A chave pública de atualização do Cypher é inválida: ${error.message}` };
  }
}

/** Ambiente para o instalador: sem as variáveis internas do Electron/Chromium/Node do processo que está saindo. */
function cleanEnvironment(env = process.env) {
  return Object.fromEntries(Object.entries(env).filter(([key]) => !/^(ELECTRON_|CHROME_|NODE_|NODE$|NPM_|ORIGINAL_XDG_|GOOGLE_API_KEY)/i.test(key)));
}

function powerShellString(value) { return `'${String(value).replaceAll("'", "''")}'`; }

function requestBuffer(value, maxBytes = MAX_MANIFEST_BYTES, redirects = 0) {
  const url = new URL(value);
  if (url.protocol !== 'https:') return Promise.reject(new Error('O canal de atualizações precisa usar HTTPS.'));
  if (redirects > 6) return Promise.reject(new Error('O servidor de atualizações redirecionou muitas vezes.'));
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'User-Agent': 'Cypher-Updater', Accept: 'application/json', 'Cache-Control': 'no-cache' } }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        const location = response.headers.location; response.resume();
        if (!location) return reject(new Error('O servidor retornou um redirecionamento sem destino.'));
        const next = new URL(location, url);
        if (next.protocol !== 'https:') return reject(new Error('O canal de atualizações tentou sair do HTTPS.'));
        requestBuffer(next.href, maxBytes, redirects + 1).then(resolve, reject); return;
      }
      if (response.statusCode !== 200) { response.resume(); const error = new Error(`O servidor de atualizações respondeu HTTP ${response.statusCode}.`); error.statusCode = response.statusCode; reject(error); return; }
      const chunks = []; let received = 0;
      response.on('data', chunk => { received += chunk.length; if (received > maxBytes) { request.destroy(new Error('O arquivo de atualização excede o tamanho permitido.')); return; } chunks.push(chunk); });
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });
    request.setTimeout(20000, () => request.destroy(new Error('Tempo esgotado ao consultar atualizações.')));
    request.on('error', reject);
  });
}

function downloadFile(value, destination, expectedSha512, onProgress, redirects = 0) {
  const url = new URL(value);
  if (url.protocol !== 'https:') return Promise.reject(new Error('O download da atualização precisa usar HTTPS.'));
  if (redirects > 6) return Promise.reject(new Error('O download redirecionou muitas vezes.'));
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'User-Agent': 'Cypher-Updater', 'Cache-Control': 'no-cache' } }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        const location = response.headers.location; response.resume();
        if (!location) return reject(new Error('O download retornou um redirecionamento sem destino.'));
        const next = new URL(location, url);
        if (next.protocol !== 'https:') return reject(new Error('O download tentou sair do HTTPS.'));
        downloadFile(next.href, destination, expectedSha512, onProgress, redirects + 1).then(resolve, reject); return;
      }
      if (response.statusCode !== 200) { response.resume(); reject(new Error(`O download respondeu HTTP ${response.statusCode}.`)); return; }
      const total = Number(response.headers['content-length']) || 0;
      if (total > MAX_UPDATE_BYTES) { response.resume(); reject(new Error('O arquivo de atualização excede 2 GB.')); return; }
      let received = 0; const hash = createHash('sha512');
      const meter = new Transform({ transform(chunk, _encoding, callback) {
        received += chunk.length;
        if (received > MAX_UPDATE_BYTES) return callback(new Error('O arquivo de atualização excede 2 GB.'));
        hash.update(chunk); onProgress(total, received); callback(null, chunk);
      } });
      pipeline(response, meter, fs.createWriteStream(destination, { flags: 'w' })).then(() => {
        const actual = hash.digest('base64');
        if (actual !== expectedSha512) { reject(new Error('A verificação SHA-512 da atualização falhou.')); return; }
        resolve({ received, sha512: actual });
      }, reject);
    });
    request.setTimeout(60000, () => request.destroy(new Error('Tempo esgotado durante o download.')));
    request.on('error', reject);
  });
}

function fileSha512(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha512');
    fs.createReadStream(file).on('data', chunk => hash.update(chunk)).on('end', () => resolve(hash.digest('base64'))).on('error', reject);
  });
}

/**
 * @param {object} options
 * @param {() => 'stable'|'preview'} options.getChannel canal escolhido em Configurações
 * @param {object} [options.io] substitui rede, processos e ambiente nos testes
 */
function createUpdater({ app, publish, scheduleQuit, getChannel = () => 'stable', io = {} }) {
  const fetchBuffer = io.requestBuffer || requestBuffer;
  const download = io.downloadFile || downloadFile;
  const spawnProcess = io.spawn || spawn;
  const openExternal = io.openExternal || (url => require('electron').shell.openExternal(url));
  const isPackaged = io.isPackaged ?? app.isPackaged;
  const platform = io.platform || process.platform;
  const currentVersion = app.getVersion();
  const config = io.config || readConfig();
  const repository = config.repository;
  const signingKey = io.signingKey !== undefined ? io.signingKey : loadSigningKey(config.updateSigningPublicKey);
  const updateDirectory = path.join(app.getPath('userData'), 'updates');

  let checking = null, downloading = null, installLaunched = false, interval;
  let target = null; // manifesto da versão escolhida para instalar
  let ready = null; // { manifest, file }
  const state = {
    state: repository ? 'idle' : 'unconfigured', currentVersion, version: '', progress: 0, message: '',
    releaseNotes: '', notes: [], repository, channel: getChannel(), minimumVersion: '', blocked: false, lastChecked: 0,
  };
  const setState = patch => { Object.assign(state, patch); publish({ ...state }); };
  const getState = () => ({ ...state, notes: [...state.notes] });

  function support() {
    // Linux: o Cypher avisa e abre a página de download; o pacote (AppImage/.deb) é trocado pela pessoa.
    if (isPackaged && platform === 'linux') return { supported: true, mode: 'manual' };
    if (!isPackaged || platform !== 'win32') return { supported: false, message: 'As atualizações automáticas funcionam no Cypher instalado no Windows.' };
    const portable = process.env.PORTABLE_EXECUTABLE_FILE;
    if (portable && fs.existsSync(portable)) return { supported: true, mode: 'portable' };
    return { supported: true, mode: 'installer' };
  }
  const assetFor = (manifest, mode) => mode === 'portable' ? { name: manifest.assetName, sha512: manifest.sha512 } : { name: manifest.installerAssetName, sha512: manifest.installerSha512 };

  async function fetchManifest(file) {
    const base = `https://github.com/${repository}/releases/download/update-channels/`;
    try { return parseManifest(await fetchBuffer(base + file), signingKey); }
    catch (error) {
      // Antes da primeira publicação com canais, o oficial continua em latest.json.
      if (file === 'stable.json' && error.statusCode === 404) return parseManifest(await fetchBuffer(`https://github.com/${repository}/releases/latest/download/latest.json`), signingKey);
      if (file === 'preview.json' && error.statusCode === 404) return null;
      throw error;
    }
  }

  /** Remove instaladores antigos; mantém só o arquivo da atualização pronta. */
  function cleanup() {
    try {
      const keep = new Set([READY_FILE, ready && path.basename(ready.file)].filter(Boolean));
      for (const name of fs.readdirSync(updateDirectory)) if (!keep.has(name)) fs.rmSync(path.join(updateDirectory, name), { force: true, recursive: true });
    } catch {}
  }

  async function restoreReady() {
    try {
      const saved = JSON.parse(fs.readFileSync(path.join(updateDirectory, READY_FILE), 'utf8'));
      const manifest = saved?.manifest, file = path.join(updateDirectory, path.basename(String(saved?.file || '')));
      const mode = support().mode;
      if (!manifest || !mode || compareVersions(manifest.version, currentVersion) <= 0) throw new Error('obsoleto');
      if (await fileSha512(file) !== assetFor(manifest, mode).sha512) throw new Error('arquivo alterado');
      ready = { manifest, file }; target = manifest;
      setState({ state: 'ready', version: manifest.version, progress: 100, releaseNotes: manifest.releaseNotes, notes: manifest.notes, message: `A versão ${manifest.version} está pronta para instalar.` });
    } catch { ready = null; try { fs.rmSync(path.join(updateDirectory, READY_FILE), { force: true }); } catch {} }
  }

  async function check() {
    if (checking) return checking;
    if (!repository) { setState({ state: 'unconfigured', message: 'O repositório público de atualizações ainda não foi configurado.' }); return getState(); }
    const supported = support();
    if (!supported.supported) { setState({ state: 'unsupported', message: supported.message }); return getState(); }
    checking = (async () => {
      const channel = getChannel();
      const idle = !['downloading', 'ready', 'installing', 'restarting'].includes(state.state);
      if (idle) setState({ state: 'checking', channel, message: 'Procurando uma versão nova…' });
      try {
        const stable = await fetchManifest('stable.json');
        const preview = channel === 'preview' ? await fetchManifest('preview.json').catch(() => null) : null;
        const candidates = [stable, preview].filter(Boolean).filter(manifest => compareVersions(manifest.version, currentVersion) > 0);
        const best = candidates.sort((a, b) => compareVersions(b.version, a.version))[0] || null;
        const blocked = isBlocked(currentVersion, stable.minimumVersion);
        setState({ channel, minimumVersion: stable.minimumVersion, blocked, lastChecked: Date.now() });
        if (!best) {
          target = null;
          if (idle) setState({ state: 'up-to-date', version: currentVersion, notes: [], releaseNotes: '', message: channel === 'preview' ? 'Você está na versão mais recente, incluindo o Preview.' : 'Você já está usando a versão mais recente.' });
        } else if (supported.mode === 'manual') {
          target = best;
          setState({ state: 'available', version: best.version, notes: best.notes, releaseNotes: best.releaseNotes, downloadUrl: `https://github.com/${repository}/releases/tag/${best.tag}`, message: `A versão ${best.version} está disponível. Baixe o pacote novo para atualizar.` });
        } else if (!ready || ready.manifest.version !== best.version) {
          target = best;
          void startDownload().catch(() => {});
        }
      } catch (error) {
        // Falha ao verificar nunca bloqueia o navegador.
        if (idle) setState({ state: 'error', message: error.message });
      } finally { checking = null; }
      return getState();
    })();
    return checking;
  }

  function startDownload() {
    if (downloading) return downloading;
    if (!target) return Promise.reject(new Error('Não há atualização para baixar.'));
    const supported = support();
    if (!supported.supported) return Promise.reject(new Error(supported.message));
    const manifest = target;
    downloading = (async () => {
      const asset = assetFor(manifest, supported.mode);
      fs.mkdirSync(updateDirectory, { recursive: true });
      const file = path.join(updateDirectory, asset.name);
      const partial = `${file}.partial`;
      const assetUrl = new URL(encodeURIComponent(asset.name), `https://github.com/${repository}/releases/download/${manifest.tag}/`).href;
      try {
        setState({ state: 'downloading', version: manifest.version, progress: 0, releaseNotes: manifest.releaseNotes, notes: manifest.notes, message: `Baixando a versão ${manifest.version} em segundo plano…` });
        await download(assetUrl, partial, asset.sha512, (total, received) => {
          const progress = total > 0 ? Math.min(99, Math.floor(received / total * 100)) : 0;
          if (progress !== state.progress) setState({ progress });
        });
        fs.rmSync(file, { force: true }); fs.renameSync(partial, file);
        ready = { manifest, file };
        fs.writeFileSync(path.join(updateDirectory, READY_FILE), JSON.stringify({ manifest, file: path.basename(file) }));
        cleanup();
        setState({ state: 'ready', progress: 100, message: `A versão ${manifest.version} está pronta para instalar.` });
      } catch (error) {
        try { fs.rmSync(partial, { force: true }); } catch {}
        setState({ state: 'error', progress: 0, message: `Não foi possível baixar a atualização: ${error.message}` });
        throw error;
      } finally { downloading = null; }
      return getState();
    })();
    return downloading;
  }

  function launchInstaller({ relaunch }) {
    const mode = support().mode;
    const { manifest, file } = ready;
    if (mode === 'installer') {
      const titles = Buffer.from(manifest.notes.filter(note => note.kind !== 'fixed').slice(0, 6).map(note => note.title.replace(/\s+/g, ' ')).join('\n'), 'utf8').toString('base64url');
      const args = ['/S', `--wait-for-process=${process.pid}`, ...(relaunch ? ['--updated', '--force-run', '--progress-ui', `--update-version=${manifest.version}`, `--update-titles=${titles}`] : [])];
      // Não herdar a pasta nem as variáveis internas do Electron que está saindo.
      const child = spawnProcess(file, args, { cwd: updateDirectory, detached: true, stdio: 'ignore', windowsHide: true, env: cleanEnvironment() });
      child.unref?.();
      return child;
    }
    const portable = path.resolve(process.env.PORTABLE_EXECUTABLE_FILE);
    const marker = path.join(app.getPath('userData'), 'update-pending.json');
    const backup = `${portable}.cypher-backup`, staged = `${portable}.cypher-new`;
    const psPath = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const start = relaunch ? 'Start-Process -FilePath $target' : '';
    const script = [
      `$source = ${powerShellString(file)}`, `$target = ${powerShellString(portable)}`, `$staged = ${powerShellString(staged)}`,
      `$backup = ${powerShellString(backup)}`, `$marker = ${powerShellString(marker)}`, `$parentId = ${process.pid}`, `$version = ${powerShellString(manifest.version)}`,
      'Wait-Process -Id $parentId -ErrorAction SilentlyContinue',
      'try {',
      '  Copy-Item -LiteralPath $source -Destination $staged -Force',
      '  if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $backup -Force }',
      '  Move-Item -LiteralPath $target -Destination $backup -Force',
      '  Move-Item -LiteralPath $staged -Destination $target -Force',
      '  @{ target=$target; backup=$backup; version=$version } | ConvertTo-Json -Compress | Set-Content -LiteralPath $marker -Encoding UTF8',
      `  ${start}`,
      '} catch {',
      '  if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue; Move-Item -LiteralPath $backup -Destination $target -Force }',
      '  Remove-Item -LiteralPath $staged -Force -ErrorAction SilentlyContinue',
      '  Remove-Item -LiteralPath $marker -Force -ErrorAction SilentlyContinue',
      '}',
    ].join('\n');
    const child = spawnProcess(psPath, ['-NoLogo', '-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { detached: true, stdio: 'ignore', windowsHide: true, env: cleanEnvironment() });
    child.unref?.();
    return child;
  }

  /** "Reiniciar e atualizar": baixa se faltar, mostra a instalação e fecha o Cypher. */
  async function installNow() {
    if (installLaunched) return getState();
    if (support().mode === 'manual') {
      if (!target) await check();
      if (!state.downloadUrl) throw new Error('Não há uma versão nova para baixar.');
      await openExternal(state.downloadUrl);
      return getState();
    }
    if (!ready) {
      if (!target) await check();
      if (!target) throw new Error('Não há uma atualização para instalar.');
      await startDownload();
    }
    setState({ state: 'installing', progress: 100, message: 'Preparando a instalação…' });
    installLaunched = true;
    try { launchInstaller({ relaunch: true }); }
    catch (error) { installLaunched = false; setState({ state: 'error', message: error.message }); throw error; }
    try { fs.rmSync(path.join(updateDirectory, READY_FILE), { force: true }); } catch {}
    setState({ state: 'restarting', message: 'O Cypher vai reabrir na versão nova.' });
    scheduleQuit();
    return getState();
  }

  /** Ao fechar com uma atualização pronta: instala em silêncio, sem reabrir. */
  function installOnQuit() {
    if (installLaunched || !ready || !support().supported || support().mode === 'manual') return false;
    installLaunched = true;
    try { launchInstaller({ relaunch: false }); fs.rmSync(path.join(updateDirectory, READY_FILE), { force: true }); return true; }
    catch { installLaunched = false; return false; }
  }

  function setChannel(channel) {
    if (!['stable', 'preview'].includes(channel) || channel === state.channel) return getState();
    setState({ channel });
    void check();
    return getState();
  }

  function acknowledgeStartup() {
    try {
      const marker = path.join(app.getPath('userData'), 'update-pending.json');
      const pending = JSON.parse(fs.readFileSync(marker, 'utf8').replace(/^\uFEFF/, ''));
      const portable = process.env.PORTABLE_EXECUTABLE_FILE && path.resolve(process.env.PORTABLE_EXECUTABLE_FILE);
      if (portable && pending.version === currentVersion && pending.target === portable && pending.backup === `${portable}.cypher-backup`) {
        fs.rmSync(pending.backup, { force: true }); fs.rmSync(marker, { force: true });
      }
    } catch {}
  }

  async function start() {
    acknowledgeStartup();
    await restoreReady();
    cleanup();
    if (interval) clearInterval(interval);
    interval = setInterval(() => { void check(); }, UPDATE_INTERVAL_MS);
    interval.unref?.();
    const initial = setTimeout(() => { void check(); }, io.initialDelay ?? 8000);
    initial.unref?.();
  }

  // Compatibilidade com a interface antiga.
  const downloadAndInstall = installNow;
  const dismiss = () => getState();
  const finishAnimation = () => getState();

  return { check, startDownload, installNow, installOnQuit, setChannel, cleanup, getState, start, acknowledgeStartup, downloadAndInstall, dismiss, finishAnimation };
}

module.exports = { createUpdater, cleanEnvironment };
