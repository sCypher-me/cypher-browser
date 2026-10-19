const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { canonicalize, expressions, fullHash, applyUpdate, createSafeBrowsing } = require('../electron/safe-browsing.cjs');

test('canonicalization matches the Safe Browsing examples', () => {
  const cases = {
    'http://host/%25%32%35': 'http://host/%25',
    'http://host/%25%32%35%25%32%35': 'http://host/%25%25',
    'http://host/%2525252525252525': 'http://host/%25',
    'http://host/asdf%25%32%35asd': 'http://host/asdf%25asd',
    'http://host/%%%25%32%35asd%%': 'http://host/%25%25%25asd%25%25',
    'http://www.google.com/': 'http://www.google.com/',
    'http://%31%36%38%2e%31%38%38%2e%39%39%2e%32%36/%2E%73%65%63%75%72%65/%77%77%77%2E%65%62%61%79%2E%63%6F%6D/': 'http://168.188.99.26/.secure/www.ebay.com/',
    'http://195.127.0.11/uploads/%20%20%20%20/.verify/.eBaysecure=updateuserdataxplimnbqmn-xplmvalidateinfoswqpcmlx=hgplmcx/': 'http://195.127.0.11/uploads/%20%20%20%20/.verify/.eBaysecure=updateuserdataxplimnbqmn-xplmvalidateinfoswqpcmlx=hgplmcx/',
    'http://host%23.com/%257Ea%2521b%2540c%2523d%2524e%25f%255E00%252611%252A22%252833%252944_55%252B': 'http://host%23.com/~a!b@c%23d$e%25f^00&11*22(33)44_55+',
    'http://3279880203/blah': 'http://195.127.0.11/blah',
    'http://www.google.com/blah/..': 'http://www.google.com/',
    'www.google.com/': 'http://www.google.com/',
    'www.google.com': 'http://www.google.com/',
    'http://www.evil.com/blah#frag': 'http://www.evil.com/blah',
    'http://www.GOOgle.com/': 'http://www.google.com/',
    'http://www.google.com.../': 'http://www.google.com/',
    'http://www.google.com/foo\tbar\rbaz\n2': 'http://www.google.com/foobarbaz2',
    'http://www.google.com/q?': 'http://www.google.com/q?',
    'http://www.google.com/q?r?': 'http://www.google.com/q?r?',
    'http://www.google.com/q?r?s': 'http://www.google.com/q?r?s',
    'http://evil.com/foo#bar#baz': 'http://evil.com/foo',
    'http://evil.com/foo;': 'http://evil.com/foo;',
    'http://evil.com/foo?bar;': 'http://evil.com/foo?bar;',
    'http://notrailingslash.com': 'http://notrailingslash.com/',
    'http://www.gotaport.com:1234/': 'http://www.gotaport.com/',
    '  http://www.google.com/  ': 'http://www.google.com/',
    'http:// leadingspace.com/': 'http://%20leadingspace.com/',
    'http://%20leadingspace.com/': 'http://%20leadingspace.com/',
    '%20leadingspace.com/': 'http://%20leadingspace.com/',
    'https://www.securesite.com/': 'https://www.securesite.com/',
    'http://host.com/ab%23cd': 'http://host.com/ab%23cd',
    'http://host.com//twoslashes?more//slashes': 'http://host.com/twoslashes?more//slashes',
  };
  for (const [input, expected] of Object.entries(cases)) assert.equal(canonicalize(input), expected, input);
});

test('expressions follow the host and path combinations of the spec', () => {
  assert.deepEqual(expressions('http://a.b.c/1/2.html?param=1').sort(), ['a.b.c/1/2.html?param=1', 'a.b.c/1/2.html', 'a.b.c/', 'a.b.c/1/', 'b.c/1/2.html?param=1', 'b.c/1/2.html', 'b.c/', 'b.c/1/'].sort());
  const deep = expressions('http://a.b.c.d.e.f.g/1.html');
  assert.deepEqual([...new Set(deep.map(item => item.split('/')[0]))], ['a.b.c.d.e.f.g', 'c.d.e.f.g', 'd.e.f.g', 'e.f.g', 'f.g']);
  assert.deepEqual(expressions('http://1.2.3.4/1/').sort(), ['1.2.3.4/', '1.2.3.4/1/'].sort());
  assert.deepEqual(expressions('http://a.b/x/y/z/w/v.html').filter(item => item.endsWith('/')), ['a.b/', 'a.b/x/', 'a.b/x/y/', 'a.b/x/y/z/']);
});

const prefixOf = expression => fullHash(expression).subarray(0, 4);
const checksum = prefixes => createHash('sha256').update(Buffer.concat([...prefixes].sort(Buffer.compare))).digest('base64');

test('updates apply additions, removals and verify the checksum', () => {
  const a = Buffer.from('aaaa'), b = Buffer.from('bbbb'), c = Buffer.from('cccc');
  const full = applyUpdate([], { responseType: 'FULL_UPDATE', additions: [{ compressionType: 'RAW', rawHashes: { prefixSize: 4, rawHashes: Buffer.concat([c, a, b]).toString('base64') } }], checksum: { sha256: checksum([a, b, c]) } });
  assert.deepEqual(full, ['aaaa', 'bbbb', 'cccc']);
  const partial = applyUpdate(full, { responseType: 'PARTIAL_UPDATE', removals: [{ rawIndices: { indices: [1] } }], additions: [], checksum: { sha256: checksum([a, c]) } });
  assert.deepEqual(partial, ['aaaa', 'cccc']);
  assert.throws(() => applyUpdate(full, { responseType: 'PARTIAL_UPDATE', removals: [], checksum: { sha256: checksum([a]) } }), /verificação/);
});

test('lookups stay local without a prefix hit and confirm full hashes on a hit', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cypher-sb-'));
  const bad = prefixOf('perigo.example/');
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push(url.split('?')[0].split('/v4/')[1]);
    if (url.includes('threatLists?')) return { ok: true, json: async () => ({ threatLists: [{ threatType: 'SOCIAL_ENGINEERING', platformType: 'ANY_PLATFORM', threatEntryType: 'URL' }, { threatType: 'MALWARE', platformType: 'ANDROID', threatEntryType: 'URL' }] }) };
    if (url.includes('threatListUpdates:fetch')) {
      const body = JSON.parse(options.body);
      assert.equal(body.listUpdateRequests.length, 1);
      return { ok: true, json: async () => ({ minimumWaitDuration: '600s', listUpdateResponses: [{ threatType: 'SOCIAL_ENGINEERING', platformType: 'ANY_PLATFORM', threatEntryType: 'URL', responseType: 'FULL_UPDATE', newClientState: 'estado-1', additions: [{ compressionType: 'RAW', rawHashes: { prefixSize: 4, rawHashes: bad.toString('base64') } }], checksum: { sha256: checksum([bad]) } }] }) };
    }
    if (url.includes('fullHashes:find')) {
      const body = JSON.parse(options.body);
      assert.deepEqual(body.threatInfo.threatEntries, [{ hash: bad.toString('base64') }], 'only the 4-byte prefix leaves the computer');
      return { ok: true, json: async () => ({ matches: [{ threatType: 'SOCIAL_ENGINEERING', platformType: 'ANY_PLATFORM', threatEntryType: 'URL', threat: { hash: fullHash('perigo.example/').toString('base64') }, cacheDuration: '300s' }], negativeCacheDuration: '300s' }) };
    }
    throw new Error('inesperado ' + url);
  };
  const service = createSafeBrowsing({ key: 'k', directory, fetchImpl });
  assert.equal(await service.check('https://perigo.example/'), null, 'no lists yet');
  await service.update();
  assert.equal(service.status().prefixes, 1);
  assert.equal(await service.check('https://seguro.example/'), null);
  assert.equal(calls.filter(call => call === 'fullHashes:find').length, 0);
  assert.deepEqual(await service.check('https://perigo.example/login?x=1'), { threatType: 'SOCIAL_ENGINEERING' });
  assert.deepEqual(await service.check('https://perigo.example/'), { threatType: 'SOCIAL_ENGINEERING' }, 'cached');
  assert.equal(calls.filter(call => call === 'fullHashes:find').length, 1);
  // A lista salva volta depois de reiniciar.
  const again = createSafeBrowsing({ key: 'k', directory, fetchImpl });
  again.start(); again.stop();
  assert.equal(again.status().prefixes, 1);
  assert.equal(createSafeBrowsing({ key: '', directory, fetchImpl }).available, false);
});
