const test = require('node:test');
const assert = require('node:assert/strict');
const { isUpgradeExempt, classifyLoadError, errorName, createHttpsUpgrader } = require('../electron/https-mode.cjs');

test('local network, IPs and single-label hosts are never upgraded', () => {
  for (const host of ['localhost', '192.168.0.1', '10.0.0.5', '[::1]', 'roteador', 'nas.local', 'app.test', 'abc.onion', 'site.i2p']) assert.equal(isUpgradeExempt(host), true, host);
  for (const host of ['exemplo.com', 'www.gov.br']) assert.equal(isUpgradeExempt(host), false, host);
});

test('load errors map to friendly screens', () => {
  assert.equal(classifyLoadError(-202), 'certificate');
  assert.equal(classifyLoadError(-201), 'certificate');
  assert.equal(classifyLoadError(-107), 'ssl');
  assert.equal(classifyLoadError(-105), 'dns');
  assert.equal(classifyLoadError(-106), 'offline');
  assert.equal(classifyLoadError(-102), 'refused');
  assert.equal(classifyLoadError(-118), 'timeout');
  assert.equal(classifyLoadError(-20), 'blocked');
  assert.equal(classifyLoadError(-999), 'generic');
  assert.equal(errorName(-202), 'ERR_CERT_AUTHORITY_INVALID');
  assert.equal(errorName(-999), 'ERR_999');
});

test('upgrader rewrites http, remembers the original and falls back on HTTPS failures', () => {
  const upgrader = createHttpsUpgrader();
  assert.equal(upgrader.rewrite('http://exemplo.com/a?b=1', 'upgrade'), 'https://exemplo.com/a?b=1');
  assert.equal(upgrader.rewrite('http://exemplo.com/', 'off'), null);
  assert.equal(upgrader.rewrite('https://exemplo.com/', 'upgrade'), null);
  assert.equal(upgrader.rewrite('http://192.168.0.1/', 'upgrade'), null);
  assert.equal(upgrader.rewrite('http://exemplo.com:8080/', 'upgrade'), null);
  assert.equal(upgrader.failed('https://exemplo.com/a?b=1', -105), null, 'DNS failure is not about HTTPS');
  assert.equal(upgrader.failed('https://exemplo.com/a?b=1', -202), 'http://exemplo.com/a?b=1');
  assert.equal(upgrader.failed('https://exemplo.com/a?b=1', -202), null, 'only once');
  upgrader.allowHttp('exemplo.com');
  assert.equal(upgrader.rewrite('http://exemplo.com/', 'strict'), null);
  assert.equal(upgrader.isAllowed('EXEMPLO.com'), true);
});

test('upgrader stops after a redirect loop back to http', () => {
  let clock = 0;
  const upgrader = createHttpsUpgrader({ now: () => clock });
  for (let index = 0; index < 3; index++) { assert.ok(upgrader.rewrite('http://laco.com/', 'upgrade')); clock += 100; }
  assert.equal(upgrader.rewrite('http://laco.com/', 'upgrade'), null);
  assert.equal(upgrader.isAllowed('laco.com'), true);
  const fresh = createHttpsUpgrader({ now: () => clock });
  fresh.rewrite('http://ok.com/', 'upgrade');
  fresh.succeeded('https://ok.com/');
  assert.equal(fresh.failed('https://ok.com/', -202), null);
});
