const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePasswordOrigin, parseCsv, passwordsFromCsv, sha1Hex, pwnedCountForHash } = require('../electron/password-tools.cjs');

test('origin accepts HTTPS and local HTTP only', () => {
  assert.equal(normalizePasswordOrigin('https://conta.exemplo.com/entrar?x=1'), 'https://conta.exemplo.com');
  assert.equal(normalizePasswordOrigin('http://localhost:3000/login'), 'http://localhost:3000');
  assert.equal(normalizePasswordOrigin('http://exemplo.com'), '');
  assert.equal(normalizePasswordOrigin('https://user:pw@exemplo.com'), '');
  assert.equal(normalizePasswordOrigin('android://abc@com.app'), '');
});

test('CSV parser handles quotes, commas, line breaks and BOM', () => {
  assert.deepEqual(parseCsv('﻿a,b\r\n"x, y","linha\nquebrada"\n"aspas ""duplas""",\n\n'), [['a', 'b'], ['x, y', 'linha\nquebrada'], ['aspas "duplas"', '']]);
});

test('reads Chrome, Firefox and Bitwarden exports', () => {
  const chrome = passwordsFromCsv('name,url,username,password,note\nExemplo,https://exemplo.com/login,ana@exemplo.com,"s3nh@,forte",\nSem senha,https://a.com,ana,,\nHTTP,http://inseguro.com,ana,x,\n');
  assert.deepEqual(chrome.entries, [{ origin: 'https://exemplo.com', username: 'ana@exemplo.com', password: 's3nh@,forte' }]);
  assert.equal(chrome.skipped, 2);
  const firefox = passwordsFromCsv('"url","username","password","httpRealm","formActionOrigin","guid","timeCreated"\n"https://mozilla.org","bia","pw1",,"https://mozilla.org","{1}","1"\n"https://mozilla.org","bia","pw1",,"","{2}","2"\n');
  assert.equal(firefox.entries.length, 1);
  assert.equal(firefox.skipped, 1);
  const bitwarden = passwordsFromCsv('folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp\n,,login,GitHub,,,0,github.com,dev,pw2,\n');
  assert.deepEqual(bitwarden.entries, [{ origin: 'https://github.com', username: 'dev', password: 'pw2' }]);
  assert.match(passwordsFromCsv('a,b\n1,2').error, /colunas/);
  assert.match(passwordsFromCsv('').error, /vazio/);
});

test('leak check sends only the 5-char prefix and matches the suffix locally', async () => {
  const hash = sha1Hex('password');
  assert.equal(hash, '5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8');
  const calls = [];
  const fetchImpl = async (url, options) => { calls.push([url, options.headers['Add-Padding']]); return { ok: true, text: async () => '0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n1E4C9B93F3F0682250B6CF8331B7EE68FD8:3861493\r\nFFFF:0' }; };
  const cache = new Map();
  assert.equal(await pwnedCountForHash(hash, fetchImpl, cache), 3861493);
  assert.equal(await pwnedCountForHash(sha1Hex('outra coisa'), async () => ({ ok: true, text: async () => '' }), new Map()), 0);
  assert.equal(await pwnedCountForHash(hash, fetchImpl, cache), 3861493);
  assert.deepEqual(calls, [['https://api.pwnedpasswords.com/range/5BAA6', 'true']]);
  await assert.rejects(pwnedCountForHash(hash, async () => ({ ok: false, status: 503 }), new Map()), /503/);
});
