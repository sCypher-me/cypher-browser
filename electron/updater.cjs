const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');

const MAX_MANIFEST_BYTES = 256 * 1024;
const MAX_UPDATE_BYTES = 2 * 1024 * 1024 * 1024;
const UPDATE_INTERVAL_MS = 6 * 60 * 60 * 1000;

function readConfig() {
  try {
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'update-config.json'), 'utf8'));
    const repository = typeof config.repository === 'string' ? config.repository.trim() : '';
    return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) ? repository : '';
  } catch { return ''; }
}

function validVersion(value) { return typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value); }
function compareVersions(left, right) {
  const a = left.split('.').map(Number), b = right.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  return 0;
}
function powerShellString(value) { return `'${String(value).replaceAll("'", "''")}'`; }

function requestBuffer(value, maxBytes = MAX_MANIFEST_BYTES, redirects = 0) {
  const url = new URL(value);
  if (url.protocol !== 'https:') return Promise.reject(new Error('O canal de atualizações precisa usar HTTPS.'));
  if (redirects > 6) return Promise.reject(new Error('O servidor de atualizações redirecionou muitas vezes.'));
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'User-Agent': 'Cypher-Updater', 'Accept': 'application/json', 'Cache-Control': 'no-cache' } }, response => {
      if ([301,302,303,307,308].includes(response.statusCode)) {
        const location = response.headers.location;
        response.resume();
        if (!location) return reject(new Error('O servidor retornou um redirecionamento sem destino.'));
        const next = new URL(location, url);
        if (next.protocol !== 'https:') return reject(new Error('O canal de atualizações tentou sair do HTTPS.'));
        requestBuffer(next.href, maxBytes, redirects + 1).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) { response.resume(); const error = new Error(`O servidor de atualizações respondeu HTTP ${response.statusCode}.`); error.statusCode = response.statusCode; reject(error); return; }
      const chunks = []; let received = 0;
      response.on('data', chunk => {
        received += chunk.length;
        if (received > maxBytes) { request.destroy(new Error('O arquivo de atualização excede o tamanho permitido.')); return; }
        chunks.push(chunk);
      });
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });
    request.setTimeout(20000, () => request.destroy(new Error('Tempo esgotado ao consultar atualizações.')));
    request.on('error', reject);
  });
}

function downloadFile(value, destination, expectedSize, onProgress, redirects = 0) {
  const url = new URL(value);
  if (url.protocol !== 'https:') return Promise.reject(new Error('O download da atualização precisa usar HTTPS.'));
  if (redirects > 6) return Promise.reject(new Error('O download redirecionou muitas vezes.'));
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'User-Agent': 'Cypher-Updater', 'Cache-Control': 'no-cache' } }, response => {
      if ([301,302,303,307,308].includes(response.statusCode)) {
        const location = response.headers.location;
        response.resume();
        if (!location) return reject(new Error('O download retornou um redirecionamento sem destino.'));
        const next = new URL(location, url);
        if (next.protocol !== 'https:') return reject(new Error('O download tentou sair do HTTPS.'));
        downloadFile(next.href, destination, expectedSize, onProgress, redirects + 1).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) { response.resume(); reject(new Error(`O download respondeu HTTP ${response.statusCode}.`)); return; }
      const contentLength = Number(response.headers['content-length']);
      if (Number.isFinite(contentLength) && contentLength > MAX_UPDATE_BYTES) { response.resume(); reject(new Error('O arquivo de atualização excede 2 GB.')); return; }
      let received = 0; const hash = createHash('sha512');
      const meter = new Transform({ transform(chunk, _encoding, callback) {
        received += chunk.length;
        if (received > MAX_UPDATE_BYTES) return callback(new Error('O arquivo de atualização excede 2 GB.'));
        hash.update(chunk);
        onProgress(contentLength || expectedSize || 0, received);
        callback(null, chunk);
      } });
      pipeline(response, meter, fs.createWriteStream(destination, { flags: 'w' })).then(() => {
        const actual = hash.digest('base64');
        if (actual !== expectedSize) { reject(new Error('A verificação SHA-512 da atualização falhou.')); return; }
        resolve({ received, sha512: actual });
      }, reject);
    });
    request.setTimeout(60000, () => request.destroy(new Error('Tempo esgotado durante o download.')));
    request.on('error', reject);
  });
}

function createUpdater({ app, publish, scheduleQuit }) {
  const currentVersion = app.getVersion();
  const repository = readConfig();
  const startupArg = process.argv.find(value => value.startsWith('--cypher-update-complete='));
  const completedVersion = startupArg?.slice('--cypher-update-complete='.length) || (process.argv.includes('--updated') ? currentVersion : '');
  let availableManifest = null;
  let dismissedVersion = '';
  let checking = null;
  let installPromise = null;
  let interval;
  const state = {
    state: completedVersion ? 'complete' : repository ? 'idle' : 'unconfigured',
    currentVersion, version: completedVersion || '', progress: 0, message: '', releaseNotes: '', repository,
  };

  function setState(patch) { Object.assign(state, patch); publish({ ...state }); }
  function getState() { return { ...state }; }
  function supported() {
    if (!app.isPackaged || process.platform !== 'win32') return { supported: false, message: 'As atualizações automáticas são ativadas na versão portátil do Windows.' };
    const executable = process.env.PORTABLE_EXECUTABLE_FILE;
    if (executable && fs.existsSync(executable)) return { supported: true, mode: 'portable' };
    return { supported: true, mode: 'installer' };
  }
  function parseManifest(raw) {
    let manifest;
    try { manifest = JSON.parse(raw.toString('utf8').replace(/^\uFEFF/, '')); } catch { throw new Error('O manifesto de atualização está inválido.'); }
    const validSha512 = value => {
      if (typeof value !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(value)) return false;
      const bytes = Buffer.from(value, 'base64');
      return bytes.length === 64 && bytes.toString('base64') === value;
    };
    if (!manifest || manifest.schemaVersion !== 1 || !validVersion(manifest.version) || manifest.tag !== `v${manifest.version}` || manifest.assetName !== `Cypher-${manifest.version}-Windows.exe` || !validSha512(manifest.sha512) || manifest.installerAssetName !== `Cypher-${manifest.version}-Setup.exe` || !validSha512(manifest.installerSha512)) throw new Error('O manifesto de atualização não passou na validação.');
    manifest.releaseNotes = typeof manifest.releaseNotes === 'string' ? manifest.releaseNotes.slice(0, 3000) : '';
    return manifest;
  }
  async function check() {
    if (checking) return checking;
    if (!repository) { setState({ state: 'unconfigured', message: 'O repositório público de atualizações ainda não foi configurado.' }); return getState(); }
    const support = supported();
    if (!support.supported) { setState({ state: 'unsupported', message: support.message }); return getState(); }
    checking = (async () => {
      setState({ state: 'checking', message: 'Procurando uma versão nova…', progress: 0 });
      try {
        const manifestUrl = `https://github.com/${repository}/releases/latest/download/latest.json`;
        const manifest = parseManifest(await requestBuffer(manifestUrl));
        if (compareVersions(manifest.version, currentVersion) <= 0) {
          availableManifest = null;
          setState({ state: 'up-to-date', version: currentVersion, message: 'Você já está usando a versão mais recente.' });
        } else {
          availableManifest = manifest;
          setState({ state: dismissedVersion === manifest.version ? 'dismissed' : 'available', version: manifest.version, message: `A versão ${manifest.version} está pronta para instalar.`, releaseNotes: manifest.releaseNotes, progress: 0 });
        }
      } catch (error) {
        const message = error.statusCode === 404 ? 'Ainda não há uma versão publicada no GitHub Releases.' : error.message;
        setState({ state: error.statusCode === 404 ? 'up-to-date' : 'error', message });
      } finally { checking = null; }
      return getState();
    })();
    return checking;
  }
  async function downloadAndInstall() {
    if (installPromise) return installPromise;
    if (!availableManifest) throw new Error('Não há uma atualização pronta para instalar.');
    const support = supported();
    if (!support.supported) throw new Error(support.message);
    installPromise = (async () => {
      const manifest = availableManifest;
      const assetName = support.mode === 'portable' ? manifest.assetName : manifest.installerAssetName;
      const assetSha512 = support.mode === 'portable' ? manifest.sha512 : manifest.installerSha512;
      const updateDirectory = path.join(app.getPath('userData'), 'updates');
      fs.mkdirSync(updateDirectory, { recursive: true });
      const downloaded = path.join(updateDirectory, assetName);
      const repositoryRoot = `https://github.com/${repository}/releases/download/${manifest.tag}/`;
      const assetUrl = new URL(encodeURIComponent(assetName), repositoryRoot).href;
      try {
        setState({ state: 'downloading', version: manifest.version, progress: 0, message: 'Baixando e verificando a atualização…' });
        const result = await downloadFile(assetUrl, downloaded, assetSha512, (total, received) => {
          const progress = total > 0 ? Math.min(99, Math.round(received / total * 100)) : 0;
          if (progress !== state.progress) setState({ state: 'downloading', version: manifest.version, progress, message: 'Baixando e verificando a atualização…' });
        });
        if (result.sha512 !== assetSha512) throw new Error('A verificação SHA-512 da atualização falhou.');
        if (support.mode === 'installer') {
          const child = spawn(downloaded, ['/S', '--updated', '--force-run'], { detached: true, stdio: 'ignore', windowsHide: true });
          await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
          child.unref();
          setState({ state: 'restarting', version: manifest.version, progress: 100, message: 'O Cypher está instalando a atualização e reiniciará em seguida…' });
          scheduleQuit();
          return getState();
        }
        const target = path.resolve(process.env.PORTABLE_EXECUTABLE_FILE);
        const marker = path.join(app.getPath('userData'), 'update-pending.json');
        const backup = `${target}.cypher-backup`;
        const staged = `${target}.cypher-new`;
        const psPath = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
        if (!fs.existsSync(target) || !fs.existsSync(psPath)) throw new Error('Não foi possível preparar a troca segura do executável no Windows.');
        const script = [
          `$source = ${powerShellString(downloaded)}`,
          `$target = ${powerShellString(target)}`,
          `$staged = ${powerShellString(staged)}`,
          `$backup = ${powerShellString(backup)}`,
          `$marker = ${powerShellString(marker)}`,
          `$parentId = ${process.pid}`,
          `$version = ${powerShellString(manifest.version)}`,
          'Wait-Process -Id $parentId -ErrorAction SilentlyContinue',
          'try {',
          '  Copy-Item -LiteralPath $source -Destination $staged -Force',
          '  if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $backup -Force }',
          '  Move-Item -LiteralPath $target -Destination $backup -Force',
          '  Move-Item -LiteralPath $staged -Destination $target -Force',
          '  @{ target=$target; backup=$backup; version=$version } | ConvertTo-Json -Compress | Set-Content -LiteralPath $marker -Encoding UTF8',
          '  Start-Process -FilePath $target -ArgumentList @("--cypher-update-complete=$version")',
          '  for ($i=0; $i -lt 90; $i++) { Start-Sleep -Seconds 1; if (-not (Test-Path -LiteralPath $marker)) { Remove-Item -LiteralPath $backup -Force -ErrorAction SilentlyContinue; Remove-Item -LiteralPath $source -Force -ErrorAction SilentlyContinue; exit 0 } }',
          '  if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Force }',
          '  if (Test-Path -LiteralPath $backup) { Move-Item -LiteralPath $backup -Destination $target -Force }',
          '  Remove-Item -LiteralPath $marker -Force -ErrorAction SilentlyContinue',
          '  Start-Process -FilePath $target',
          '} catch {',
          '  if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue; Move-Item -LiteralPath $backup -Destination $target -Force }',
          '  Remove-Item -LiteralPath $staged -Force -ErrorAction SilentlyContinue',
          '  Remove-Item -LiteralPath $marker -Force -ErrorAction SilentlyContinue',
          '  Start-Process -FilePath $target -ErrorAction SilentlyContinue',
          '}',
        ].join('\n');
        const child = spawn(psPath, ['-NoLogo','-NoProfile','-NonInteractive','-WindowStyle','Hidden','-ExecutionPolicy','Bypass','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')], { detached: true, stdio: 'ignore', windowsHide: true });
        await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
        child.unref();
        setState({ state: 'restarting', version: manifest.version, progress: 100, message: 'O Cypher está reiniciando para aplicar a atualização…' });
        scheduleQuit();
      } catch (error) {
        try { fs.rmSync(downloaded, { force: true }); } catch {}
        setState({ state: 'error', version: manifest.version, progress: 0, message: error.message });
        installPromise = null;
        throw error;
      }
      return getState();
    })();
    return installPromise;
  }
  function dismiss() {
    if (availableManifest) dismissedVersion = availableManifest.version;
    setState({ state: 'dismissed', message: 'A atualização ficará disponível nas configurações.' });
    return getState();
  }
  function acknowledgeStartup() {
    if (!completedVersion) return;
    try {
      const marker = path.join(app.getPath('userData'), 'update-pending.json');
      const pending = JSON.parse(fs.readFileSync(marker, 'utf8').replace(/^\uFEFF/, ''));
      const target = process.env.PORTABLE_EXECUTABLE_FILE && path.resolve(process.env.PORTABLE_EXECUTABLE_FILE);
      if (target && pending.version === completedVersion && pending.target === target && pending.backup === `${target}.cypher-backup`) {
        fs.rmSync(pending.backup, { force: true });
        fs.rmSync(marker, { force: true });
      }
    } catch {}
  }
  function finishAnimation() {
    setState({ state: 'up-to-date', version: currentVersion, message: 'Atualização instalada com sucesso.' });
    return getState();
  }
  function start() {
    if (completedVersion) return;
    if (interval) clearInterval(interval);
    interval = setInterval(() => { void check(); }, UPDATE_INTERVAL_MS);
    interval.unref?.();
    const initialCheck = setTimeout(() => { void check(); }, 8000);
    initialCheck.unref?.();
  }

  return { check, downloadAndInstall, dismiss, acknowledgeStartup, finishAnimation, getState, start };
}

module.exports = { createUpdater };
