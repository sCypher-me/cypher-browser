const { test } = require('node:test');
const assert = require('node:assert/strict');
const { defaults, resolveAddress, sanitizeSettings, validateMod, sanitizeCss, validateSkinPackage } = require('../electron/domain.cjs');

test('bangs route searches to the chosen site and ignore unknown bangs', () => {
  assert.equal(resolveAddress('!yt lofi beats'), 'https://www.youtube.com/results?search_query=lofi%20beats');
  assert.equal(resolveAddress('!GH cypher'), 'https://github.com/search?q=cypher');
  assert.equal(resolveAddress('!zz algo'), 'https://duckduckgo.com/?q=!zz%20algo');
});

test('custom CSS cannot load remote resources or break out of the style tag', () => {
  const css = sanitizeCss('@import url(https://x/y.css); a{background:url(https://tracker/p.png)} </style><script> b{background:url(data:image/png;base64,AA)}');
  assert.ok(!/@import|https:|<\/style/i.test(css));
  assert.ok(css.includes('url(data:image/png;base64,AA)'));
});

test('design tokens are clamped and toolbar order keeps every item once', () => {
  const settings = sanitizeSettings({ tokens: { cut: 99, density: 3, barHeight: 10, displayFont: 'comic' }, toolbarOrder: ['menu','menu','address','nope'], toolbarHidden: ['address','media'] });
  assert.equal(settings.tokens.cut, 28);
  assert.equal(settings.tokens.density, 1.25);
  assert.equal(settings.tokens.barHeight, 40);
  assert.equal(settings.tokens.displayFont, defaults.tokens.displayFont);
  assert.deepEqual(settings.toolbarOrder, ['menu','address','navigation','routes','skin','media','customize']);
  assert.deepEqual(settings.toolbarHidden, ['media']);
});

test('shortcuts, route rules, containers and panels are validated', () => {
  const settings = sanitizeSettings({
    shortcuts: { palette: 'CmdOrCtrl+K', find: 'rm -rf', unknown: 'Ctrl+X' },
    routeRules: [{ host: 'Example.com', mode: 'tor' }, { host: 'example.com', mode: 'i2p' }, { host: 'bad host', mode: 'tor' }, { host: 'a.com', mode: 'normal' }],
    containers: [{ id: 'trabalho', name: ' Trabalho ', color: '#123456' }, { id: '../x', name: 'Bad' }],
    webPanels: [{ id: 'chat', url: 'https://web.whatsapp.com/' }, { id: 'bad', url: 'javascript:alert(1)' }],
  });
  assert.deepEqual(settings.shortcuts, { palette: 'CmdOrCtrl+K' });
  assert.deepEqual(settings.routeRules, [{ host: 'example.com', mode: 'tor' }]);
  assert.deepEqual(settings.containers, [{ id: 'trabalho', name: 'Trabalho', color: '#123456' }]);
  assert.equal(settings.webPanels.length, 1);
});

test('mods cannot carry custom CSS, shortcuts or routing rules', () => {
  const mod = validateMod({ schemaVersion: 1, name: 'Test', settings: { customCss: 'a{color:red}', shortcuts: { palette: 'CmdOrCtrl+K' }, routeRules: [{ host: 'a.com', mode: 'tor' }] } });
  assert.equal(mod.settings.customCss, '');
  assert.deepEqual(mod.settings.shortcuts, {});
  assert.deepEqual(mod.settings.routeRules, []);
});

test('skin packages require the cypher-skin type and sanitize their CSS', () => {
  const skin = validateSkinPackage({ schemaVersion: 1, type: 'cypher-skin', name: 'Neon', css: 'a{background:url(https://x/y)}', tokens: { cut: 4 } });
  assert.match(skin.id, /^skin-[a-f\d-]{36}$/);
  assert.equal(skin.css, 'a{background:none}');
  assert.equal(skin.tokens.cut, 4);
  assert.throws(() => validateSkinPackage({ schemaVersion: 1, name: 'No type', css: '' }));
});
