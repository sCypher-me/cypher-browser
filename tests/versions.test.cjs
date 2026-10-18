const test = require('node:test');
const assert = require('node:assert/strict');
const { parseVersion, compareVersions, baseVersion, isBlocked } = require('../electron/versions.cjs');

test('parseVersion aceita oficial e Preview e recusa o resto', () => {
  assert.deepEqual(parseVersion('0.7.36'), { major: 0, minor: 7, patch: 36, pre: null });
  assert.deepEqual(parseVersion('0.7.37-beta.2'), { major: 0, minor: 7, patch: 37, pre: 2 });
  for (const bad of ['0.7', '0.7.36-rc.1', 'v0.7.36', '0.7.36-beta', '', null, '01.2.3x']) assert.equal(parseVersion(bad), null, String(bad));
});

test('compareVersions segue semver com beta antes da oficial', () => {
  assert.equal(compareVersions('0.7.36', '0.7.35'), 1);
  assert.equal(compareVersions('0.7.37-beta.1', '0.7.36'), 1);
  assert.equal(compareVersions('0.7.37-beta.1', '0.7.37'), -1);
  assert.equal(compareVersions('0.7.37-beta.2', '0.7.37-beta.10'), -1);
  assert.equal(compareVersions('0.7.37', '0.7.37'), 0);
  assert.equal(compareVersions('0.10.0', '0.9.9'), 1);
});

test('isBlocked usa a versão-base do Preview e só bloqueia abaixo do mínimo', () => {
  assert.equal(baseVersion('0.7.37-beta.3'), '0.7.37');
  assert.equal(isBlocked('0.7.34', '0.7.35'), true);
  assert.equal(isBlocked('0.7.35', '0.7.35'), false);
  assert.equal(isBlocked('0.7.35-beta.1', '0.7.35'), false);
  assert.equal(isBlocked('0.7.30-beta.4', '0.7.35'), true);
  assert.equal(isBlocked('0.7.36', ''), false);
  assert.equal(isBlocked('0.7.36', 'lixo'), false);
});
