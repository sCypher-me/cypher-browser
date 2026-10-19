const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { siteKey, sanitizeSiteSettings, updateSite, settingsFor, scriptBlockHeaders } = require('../electron/site-settings.cjs');
const { taskRows, cpuOffenders, tabsToSuspend, bandwidthConditions } = require('../electron/resource-control.cjs');
const { sanitizeSessions, saveSession, createRunMarker } = require('../electron/sessions.cjs');

test('site settings keep only non-default values per host', () => {
  assert.equal(siteKey('https://www.Exemplo.com/a'), 'exemplo.com');
  assert.equal(siteKey('cypher://settings'), '');
  let all = updateSite({}, 'www.exemplo.com', { javascript: false, zoom: 1.25, images: true, bogus: 1 });
  assert.deepEqual(all, { 'exemplo.com': { javascript: false, zoom: 1.25 } });
  assert.deepEqual(settingsFor(all, 'https://exemplo.com/x'), { javascript: false, zoom: 1.25 });
  all = updateSite(all, 'exemplo.com', { javascript: null, zoom: 1 });
  assert.deepEqual(all, {}, 'back to defaults removes the site');
  assert.deepEqual(sanitizeSiteSettings({ 'a.com': { limit: true, zoom: 9 }, 'bad host!': { limit: true }, 'b.com': {} }), { 'a.com': { limit: true, zoom: 3 } });
  assert.throws(() => updateSite({}, '', { limit: true }), /inválido/);
});

test('script blocking adds a CSP without dropping the site policy', () => {
  assert.deepEqual(scriptBlockHeaders({ 'content-security-policy': ["default-src 'self'"] })['content-security-policy'], ["default-src 'self'", "script-src 'none'"]);
  assert.deepEqual(scriptBlockHeaders({})['Content-Security-Policy'], ["script-src 'none'"]);
});

const metrics = [
  { pid: 10, type: 'Browser', cpu: { percentCPUUsage: 2 }, memory: { workingSetSize: 200 * 1024 } },
  { pid: 20, type: 'Tab', cpu: { percentCPUUsage: 40 }, memory: { workingSetSize: 500 * 1024 } },
  { pid: 30, type: 'Tab', cpu: { percentCPUUsage: 1 }, memory: { workingSetSize: 300 * 1024 } },
  { pid: 40, type: 'GPU', cpu: { percentCPUUsage: 5 }, memory: { workingSetSize: 100 * 1024 } },
];

test('task rows join process metrics to tabs', () => {
  const rows = taskRows({ metrics, browserPid: 10, network: new Map([['a', 2048]]), tabs: [{ id: 'a', title: 'A', url: 'https://a', pid: 20 }, { id: 'b', title: 'B', url: 'https://b', pid: 30, active: true }, { id: 'c', title: 'C', url: 'https://c', suspended: true }] });
  assert.deepEqual(rows.filter(row => row.kind === 'tab').map(row => [row.id, row.cpu, row.memory, row.network]), [['a', 40, 500, 2], ['b', 1, 300, 0], ['c', 0, 0, 0]]);
  assert.deepEqual(rows.filter(row => row.kind === 'process').map(row => row.title), ['Gráficos (GPU)', 'Cypher (navegador)']);
  assert.equal(taskRows({ metrics, browserPid: 10, cores: 4, tabs: [{ id: 'a', pid: 20 }] })[0].cpu, 160, 'percent of one core');
});

test('CPU limiter needs consecutive samples and ignores the active tab', () => {
  const history = new Map();
  const rows = [{ id: 'a', kind: 'tab', cpu: 40 }, { id: 'b', kind: 'tab', cpu: 90, active: true }];
  assert.deepEqual(cpuOffenders(rows, { threshold: 25, history }), []);
  assert.deepEqual(cpuOffenders(rows, { threshold: 25, history }), []);
  assert.deepEqual(cpuOffenders(rows, { threshold: 25, history }), ['a']);
  assert.deepEqual(cpuOffenders([{ id: 'a', kind: 'tab', cpu: 3 }], { threshold: 25, history }), []);
  assert.equal(history.get('a'), 0);
});

test('memory limiter suspends least recently used background tabs first', () => {
  const rows = [{ id: 'a', kind: 'tab', memory: 600 }, { id: 'b', kind: 'tab', memory: 500 }, { id: 'c', kind: 'tab', memory: 400, active: true }, { id: 'd', kind: 'tab', memory: 300 }];
  const lastActive = new Map([['a', 300], ['b', 100], ['d', 200]]);
  assert.deepEqual(tabsToSuspend(rows, { limitMb: 1200, lastActive }), ['b', 'd']);
  assert.deepEqual(tabsToSuspend(rows, { limitMb: 5000, lastActive }), []);
  assert.deepEqual(tabsToSuspend(rows, { limitMb: 1200, lastActive, protectedIds: new Set(['b']) }), ['d', 'a']);
  assert.deepEqual(bandwidthConditions(8), { latency: 0, downloadThroughput: 1_000_000, uploadThroughput: 500_000 });
  assert.equal(bandwidthConditions(0), null);
});

test('named sessions validate tabs and replace sessions with the same name', () => {
  let sessions = saveSession([], { id: '1', name: ' Trabalho ', tabs: [{ url: 'https://a.com', title: 'A' }, { url: 'cypher://newtab' }], now: 5 });
  assert.deepEqual(sessions, [{ id: '1', name: 'Trabalho', created: 5, tabs: [{ url: 'https://a.com', title: 'A', pinned: false, group: '' }] }]);
  sessions = saveSession(sessions, { id: '2', name: 'trabalho', tabs: [{ url: 'https://b.com' }], now: 6 });
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].id, '2');
  assert.throws(() => saveSession([], { id: '3', name: 'x', tabs: [{ url: 'cypher://newtab' }] }), /abas/);
  assert.throws(() => saveSession([], { id: '3', name: ' ', tabs: [] }), /nome/);
  assert.deepEqual(sanitizeSessions([{ id: 'x', name: 'Vazia', tabs: [] }, null]), []);
});

test('run marker reports a crash only when the previous run did not finish', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cypher-run-'));
  const marker = createRunMarker(directory);
  assert.equal(marker.previousCrashed().crashed, false);
  marker.start(123);
  assert.deepEqual(createRunMarker(directory).previousCrashed(), { crashed: true, startedAt: 123 });
  marker.finish();
  assert.equal(marker.previousCrashed().crashed, false);
});
