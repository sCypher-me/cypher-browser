const test = require('node:test');
const assert = require('node:assert/strict');
const { siteForSeed, fingerprintSeed } = require('../electron/fingerprint.cjs');
const { tabsToArchive, sanitizeArchive, archiveTabs, appendClip } = require('../electron/workflow.cjs');

test('fingerprint seeds are per site and per secret', () => {
  assert.equal(siteForSeed('www.exemplo.com'), 'exemplo.com');
  assert.equal(siteForSeed('a.b.exemplo.com.br'), 'exemplo.com.br');
  assert.equal(siteForSeed('127.0.0.1'), '127.0.0.1');
  assert.equal(siteForSeed('localhost'), 'localhost');
  assert.equal(fingerprintSeed('s1', 'mail.exemplo.com'), fingerprintSeed('s1', 'www.exemplo.com'));
  assert.notEqual(fingerprintSeed('s1', 'exemplo.com'), fingerprintSeed('s1', 'outro.com'));
  assert.notEqual(fingerprintSeed('s1', 'exemplo.com'), fingerprintSeed('s2', 'exemplo.com'));
  assert.match(fingerprintSeed('s1', 'exemplo.com'), /^[\da-f]{8}$/);
});

test('archiving picks only idle, ordinary tabs', () => {
  const now = 100 * 3_600_000;
  const old = now - 30 * 3_600_000;
  const base = { connectionMode: 'normal', url: 'https://a.com', lastActiveAt: old };
  const tabs = [
    { ...base, id: 'velha' },
    { ...base, id: 'ativa' },
    { ...base, id: 'fixada', pinned: true },
    { ...base, id: 'privada', private: true },
    { ...base, id: 'tor', connectionMode: 'tor' },
    { ...base, id: 'som', audible: true },
    { ...base, id: 'home', url: 'cypher://newtab' },
    { ...base, id: 'recente', lastActiveAt: now - 3_600_000 },
  ];
  assert.deepEqual(tabsToArchive(tabs, { hours: 24, now, activeId: 'ativa' }), ['velha']);
  assert.deepEqual(tabsToArchive(tabs, { hours: 0, now, activeId: 'ativa' }), []);
});

test('archive keeps newest first without duplicate addresses', () => {
  let list = archiveTabs([], [{ id: '1', url: 'https://a.com', title: 'A', archivedAt: 1 }]);
  list = archiveTabs(list, [{ id: '2', url: 'https://a.com', title: 'A de novo', archivedAt: 2 }, { id: '3', url: 'https://b.com', title: 'B', archivedAt: 2 }]);
  assert.deepEqual(list.map(item => item.id), ['2', '3']);
  assert.deepEqual(sanitizeArchive([{ id: 'x', url: 'javascript:alert(1)' }, { id: 'y', url: 'https://c.com' }]).map(item => item.id), ['y']);
});

test('clips are quoted and appended to page notes', () => {
  assert.equal(appendClip('', '  Primeira linha  \r\nsegunda  '), '> Primeira linha\n> segunda');
  assert.equal(appendClip('Minha nota', 'trecho'), 'Minha nota\n\n> trecho');
  assert.throws(() => appendClip('', '   '), /Selecione/);
  assert.throws(() => appendClip('x'.repeat(4990), 'um trecho longo demais'), /cheias/);
});
