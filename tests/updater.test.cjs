const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createUpdater, cleanEnvironment } = require('../electron/updater.cjs');

const content = Buffer.from('instalador falso');
const sha = createHash('sha512').update(content).digest('base64');
const manifest = (version, extra = {}) => ({ schemaVersion: 2, version, tag: `v${version}`, assetName: `Cypher-${version}-Windows.exe`, sha512: sha, installerAssetName: `Cypher-${version}-Setup.exe`, installerSha512: sha, channel: version.includes('beta') ? 'preview' : 'stable', minimumVersion: '', notes: [{ kind: 'new', title: `Novidade ${version}`, body: '', highlight: true, illustration: 'preview' }], releaseNotes: '', ...extra });
const notFound = () => Object.assign(new Error('HTTP 404'), { statusCode: 404 });

function setup({ version = '0.7.35', channel = 'stable', files = {}, failAll = false, platform = 'win32' } = {}) {
  const opened = [];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cypher-updater-'));
  const spawned = [];
  const requested = [];
  let currentChannel = channel;
  const updater = createUpdater({
    app: { getVersion: () => version, getPath: () => dir, isPackaged: true },
    publish: () => {}, scheduleQuit: () => {}, getChannel: () => currentChannel,
    io: {
      isPackaged: true, platform, config: { repository: 'dono/cypher' }, signingKey: null, initialDelay: 60_000, openExternal: async url => { opened.push(url); },
      requestBuffer: async url => {
        requested.push(url);
        if (failAll) throw new Error('sem internet');
        const name = url.split('/').pop();
        if (!(name in files)) throw notFound();
        return Buffer.from(JSON.stringify(files[name]));
      },
      downloadFile: async (_url, destination, expected, onProgress) => { onProgress(content.length, content.length); fs.writeFileSync(destination, content); assert.equal(expected, sha); return { sha512: sha }; },
      spawn: (file, args, options) => { spawned.push({ file, args, options }); return { unref() {} }; },
    },
  });
  return { updater, dir, spawned, requested, opened, setChannel: value => { currentChannel = value; } };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 30));

test('sem stable.json usa latest.json, baixa em segundo plano e fica pronto', async () => {
  const { updater, dir, requested } = setup({ files: { 'latest.json': manifest('0.7.36', { schemaVersion: 1 }) } });
  fs.mkdirSync(path.join(dir, 'updates'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'updates', 'Cypher-0.7.5-Setup.exe'), 'velho');
  await updater.check(); await settle();
  assert.ok(requested.some(url => url.endsWith('/update-channels/stable.json')));
  assert.ok(requested.some(url => url.endsWith('/releases/latest/download/latest.json')));
  const state = updater.getState();
  assert.equal(state.state, 'ready');
  assert.equal(state.version, '0.7.36');
  assert.deepEqual(fs.readdirSync(path.join(dir, 'updates')).sort(), ['Cypher-0.7.36-Setup.exe', 'ready.json']);
});

test('Preview escolhe a versão mais alta entre os canais; canal oficial ignora o Preview', async () => {
  const files = { 'stable.json': manifest('0.7.36', { minimumVersion: '0.7.35' }), 'preview.json': manifest('0.7.37-beta.1', { minimumVersion: '0.7.35' }) };
  const preview = setup({ channel: 'preview', files });
  await preview.updater.check(); await settle();
  assert.equal(preview.updater.getState().version, '0.7.37-beta.1');
  const stable = setup({ files });
  await stable.updater.check(); await settle();
  assert.equal(stable.updater.getState().version, '0.7.36');
});

test('quem sai do Preview numa beta mais nova não é rebaixado', async () => {
  const { updater } = setup({ version: '0.7.37-beta.1', files: { 'stable.json': manifest('0.7.36', { minimumVersion: '0.7.35' }) } });
  await updater.check(); await settle();
  assert.equal(updater.getState().state, 'up-to-date');
});

test('bloqueia abaixo da versão mínima; sem internet nunca bloqueia', async () => {
  const old = setup({ version: '0.7.34', files: { 'stable.json': manifest('0.7.36', { minimumVersion: '0.7.35' }) } });
  await old.updater.check(); await settle();
  assert.equal(old.updater.getState().blocked, true);
  const offline = setup({ version: '0.7.20', failAll: true });
  await offline.updater.check();
  assert.equal(offline.updater.getState().blocked, false);
  assert.equal(offline.updater.getState().state, 'error');
});

test('instalar agora reabre com a janela de progresso; ao fechar instala sem reabrir e só uma vez', async () => {
  const now = setup({ files: { 'stable.json': manifest('0.7.36') } });
  await now.updater.check(); await settle();
  await now.updater.installNow();
  assert.equal(now.spawned.length, 1);
  assert.ok(now.spawned[0].args.includes('--progress-ui') && now.spawned[0].args.includes('--force-run'));
  assert.ok(!Object.keys(now.spawned[0].options.env).some(key => /^(ELECTRON_|CHROME_)/.test(key)));
  assert.equal(now.updater.installOnQuit(), false, 'não roda o instalador duas vezes');

  const quit = setup({ files: { 'stable.json': manifest('0.7.36') } });
  await quit.updater.check(); await settle();
  assert.equal(quit.updater.installOnQuit(), true);
  assert.deepEqual(quit.spawned[0].args.filter(arg => !arg.startsWith('--wait-for-process')), ['/S']);
});

test('atualização pronta sobrevive a reiniciar o Cypher, conferindo o arquivo', async () => {
  const first = setup({ files: { 'stable.json': manifest('0.7.36') } });
  await first.updater.check(); await settle();
  const again = createUpdater({ app: { getVersion: () => '0.7.35', getPath: () => first.dir, isPackaged: true }, publish: () => {}, scheduleQuit: () => {}, io: { isPackaged: true, platform: 'win32', config: { repository: 'dono/cypher' }, signingKey: null, initialDelay: 60_000, requestBuffer: async () => { throw notFound(); } } });
  await again.start();
  assert.equal(again.getState().state, 'ready');
  fs.writeFileSync(path.join(first.dir, 'updates', 'Cypher-0.7.36-Setup.exe'), 'adulterado');
  const tampered = createUpdater({ app: { getVersion: () => '0.7.35', getPath: () => first.dir, isPackaged: true }, publish: () => {}, scheduleQuit: () => {}, io: { isPackaged: true, platform: 'win32', config: { repository: 'dono/cypher' }, signingKey: null, initialDelay: 60_000, requestBuffer: async () => { throw notFound(); } } });
  await tampered.start();
  assert.notEqual(tampered.getState().state, 'ready');
});

test('cleanEnvironment remove as variáveis internas do Electron e do Chromium', () => {
  const env = cleanEnvironment({ PATH: 'x', USERPROFILE: 'y', CHROME_CRASHPAD_PIPE_NAME: 'p', ELECTRON_RUN_AS_NODE: '1', NODE_OPTIONS: 'z', npm_config_x: 'n' });
  assert.deepEqual(Object.keys(env).sort(), ['PATH', 'USERPROFILE']);
  assert.equal(env.CHROME_CRASHPAD_PIPE_NAME, undefined);
});

test('no Linux avisa a versão nova e abre a página de download, sem baixar nem instalar', async () => {
  const { updater, dir, spawned, opened } = setup({ platform: 'linux', files: { 'stable.json': manifest('0.7.36', { minimumVersion: '0.7.34' }) } });
  await updater.check(); await settle();
  const state = updater.getState();
  assert.equal(state.state, 'available');
  assert.equal(state.version, '0.7.36');
  assert.equal(state.downloadUrl, 'https://github.com/dono/cypher/releases/tag/v0.7.36');
  assert.equal(fs.existsSync(path.join(dir, 'updates')), false);
  await updater.installNow();
  assert.deepEqual(opened, ['https://github.com/dono/cypher/releases/tag/v0.7.36']);
  assert.deepEqual(spawned, []);
  assert.equal(updater.installOnQuit(), false);
});
