const { test } = require('node:test');
const assert = require('node:assert/strict');
const { defaults, resolveAddress, sanitizeSettings, validateMod } = require('../electron/domain.cjs');
test('address resolution preserves HTTP, HTTPS, localhost and search queries', () => {
  assert.equal(resolveAddress('example.com/path'), 'https://example.com/path');
  assert.equal(resolveAddress('localhost:8080/test'), 'http://localhost:8080/test');
  assert.equal(resolveAddress('https://example.com/?q=olá'), 'https://example.com/?q=ol%C3%A1');
  assert.equal(resolveAddress('duas palavras'), 'https://duckduckgo.com/?q=duas%20palavras');
  assert.equal(resolveAddress('teste', 'google'), 'https://www.google.com/search?q=teste');
  assert.equal(resolveAddress(''), 'cypher://newtab');
  assert.equal(resolveAddress('cypher://settings'), 'cypher://settings');
});
test('address input cannot load executable or local schemes', () => {
  for (const url of ['javascript:alert(1)', 'file:///C:/Windows/system.ini', 'data:text/html,test', 'vbscript:1', 'cypher://unknown']) assert.throws(() => resolveAddress(url));
});
test('mods cannot inject CSS or bypass the settings whitelist', () => {
  const mod = validateMod({ schemaVersion: 1, name: 'Test', settings: { accent: 'red; background:url(file:///secret)', radius: 999, sidebarWidth: -1, tabPosition: 'top', nodeIntegration: true, motion: false, arbitrary: 'payload' } });
  assert.equal(mod.settings.accent, defaults.accent);
  assert.equal(mod.settings.radius, 24);
  assert.equal(mod.settings.sidebarWidth, 210);
  assert.equal(mod.settings.tabPosition, 'top');
  assert.equal(mod.settings.motion, false);
  assert.equal(mod.settings.nodeIntegration, undefined);
  assert.equal(mod.settings.arbitrary, undefined);
  assert.throws(() => validateMod({ name: 'Without schema' }));
  assert.throws(() => validateMod({ schemaVersion: 1, name: '' }));
});
test('settings patches retain independent preferences', () => {
  const existing = { ...defaults, searchEngine: 'bing', sidebarWidth: 300 };
  const result = sanitizeSettings({ accent: '#AABBCC', tabPosition: 'top' }, existing);
  assert.equal(result.accent, '#AABBCC');
  assert.equal(result.sidebarWidth, 300);
  assert.equal(result.searchEngine, 'bing');
});
