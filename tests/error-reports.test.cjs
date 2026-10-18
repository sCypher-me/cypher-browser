const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createErrorReporter, scrub } = require('../electron/error-reports.cjs');

test('scrub removes addresses, user folders, e-mails and tokens', () => {
  const text = scrub('Falha em https://banco.example.com/conta?id=9 ao abrir C:\\Users\\maria\\Documents\\nota.txt de maria@example.com 192.168.0.10 token abcdefghijklmnopqrstuvwxyz0123456789 meusite.com.br/pagina');
  assert.doesNotMatch(text, /banco|maria|192\.168|abcdefghij|meusite/);
  assert.match(text, /<endereço>/);
  assert.match(text, /C:\\Users\\<usuário>/);
  assert.match(text, /<email>/);
});

test('reporter records nothing without consent and deduplicates repeated errors', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cypher-reports-'));
  let enabled = false;
  const reporter = createErrorReporter({ directory, version: '0.0.0', enabled: () => enabled });
  assert.equal(reporter.record('main', new Error('boom')), null);
  assert.equal(reporter.list().length, 0);
  enabled = true;
  const error = new Error('falhou em https://exemplo.com/x');
  reporter.record('main', error);
  reporter.record('main', error);
  assert.equal(reporter.list().length, 1);
  assert.equal(reporter.list()[0].count, 2);
  assert.doesNotMatch(reporter.list()[0].message, /exemplo/);
  assert.equal(reporter.record('unknown-kind', error), null);
  const url = reporter.issueUrl('sCypher-me/cypher-browser', reporter.list()[0].id);
  assert.match(url, /^https:\/\/github\.com\/sCypher-me\/cypher-browser\/issues\/new\?/);
  assert.equal(reporter.issueUrl('não é repo', reporter.list()[0].id), '');
  const reloaded = createErrorReporter({ directory, version: '0.0.0', enabled: () => true });
  assert.equal(reloaded.list().length, 1);
  reloaded.clear();
  assert.equal(reloaded.list().length, 0);
  fs.rmSync(directory, { recursive: true, force: true });
});
