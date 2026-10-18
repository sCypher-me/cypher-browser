const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { detectBrowsers, parseChromiumBookmarks, parseProfilesIni, readProfile, mergeImport, webkitToMs } = require('../electron/importers.cjs');

const WEBKIT = ms => String((ms + 11644473600000) * 1000);
let counter = 0;
const makeId = () => `id-${++counter}`;

function fakeHome() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cypher-import-test-'));
  const local = path.join(root, 'Local'), roaming = path.join(root, 'Roaming');
  const chrome = path.join(local, 'Google', 'Chrome', 'User Data');
  fs.mkdirSync(path.join(chrome, 'Default'), { recursive: true });
  fs.mkdirSync(path.join(chrome, 'Profile 2'), { recursive: true });
  fs.mkdirSync(path.join(chrome, 'Profile 9'), { recursive: true }); // sem dados: não aparece
  fs.writeFileSync(path.join(chrome, 'Local State'), JSON.stringify({ profile: { info_cache: { Default: { name: 'Pessoa' }, 'Profile 2': { name: 'Trabalho' } } } }));
  fs.writeFileSync(path.join(chrome, 'Default', 'Bookmarks'), JSON.stringify({ roots: {
    bookmark_bar: { type: 'folder', name: 'Barra', children: [
      { type: 'url', name: 'Exemplo', url: 'https://exemplo.com/', date_added: WEBKIT(Date.UTC(2024, 0, 1)) },
      { type: 'folder', name: 'Leitura', children: [{ type: 'url', name: 'Artigo', url: 'https://blog.exemplo.com/a' }, { type: 'url', name: 'Arquivo', url: 'file:///C:/segredo.txt' }] },
    ] },
    other: { type: 'folder', children: [{ type: 'url', name: '', url: 'https://outro.exemplo.org/' }] },
  } }));
  const history = new DatabaseSync(path.join(chrome, 'Default', 'History'));
  history.exec('CREATE TABLE urls (id INTEGER PRIMARY KEY, url TEXT, title TEXT, last_visit_time INTEGER, hidden INTEGER DEFAULT 0)');
  const insert = history.prepare('INSERT INTO urls (url, title, last_visit_time, hidden) VALUES (?, ?, ?, ?)');
  insert.run('https://visitado.com/', 'Visitado', Number(WEBKIT(Date.UTC(2025, 5, 1))), 0);
  insert.run('https://antigo.com/', 'Antigo', Number(WEBKIT(Date.UTC(2020, 5, 1))), 0);
  insert.run('https://oculto.com/', 'Oculto', Number(WEBKIT(Date.UTC(2025, 5, 2))), 1);
  insert.run('chrome://settings/', 'Config', Number(WEBKIT(Date.UTC(2025, 5, 3))), 0);
  history.close();
  fs.writeFileSync(path.join(chrome, 'Profile 2', 'Bookmarks'), JSON.stringify({ roots: {} }));

  const firefox = path.join(roaming, 'Mozilla', 'Firefox');
  const profileDir = path.join(firefox, 'Profiles', 'abc.default-release');
  fs.mkdirSync(profileDir, { recursive: true });
  fs.writeFileSync(path.join(firefox, 'profiles.ini'), '[General]\nStartWithLastProfile=1\n\n[Profile0]\nName=default-release\nIsRelative=1\nPath=Profiles/abc.default-release\n\n[Profile1]\nName=vazio\nIsRelative=1\nPath=Profiles/nao-existe\n');
  const places = new DatabaseSync(path.join(profileDir, 'places.sqlite'));
  places.exec(`CREATE TABLE moz_places (id INTEGER PRIMARY KEY, url TEXT, title TEXT, last_visit_date INTEGER, hidden INTEGER DEFAULT 0);
    CREATE TABLE moz_bookmarks (id INTEGER PRIMARY KEY, type INTEGER, fk INTEGER, parent INTEGER, title TEXT, dateAdded INTEGER);
    INSERT INTO moz_places VALUES (1, 'https://mozilla.org/', 'Mozilla', ${Date.UTC(2025, 1, 1) * 1000}, 0), (2, 'https://favorito.net/', 'Fav', NULL, 0);
    INSERT INTO moz_bookmarks VALUES (1, 2, NULL, 0, 'toolbar', 0), (2, 2, NULL, 1, 'Projetos', 0), (3, 1, 2, 1, 'Favorito', ${Date.UTC(2023, 1, 1) * 1000}), (4, 1, 1, 2, 'Mozilla', ${Date.UTC(2023, 2, 1) * 1000});`);
  places.close();
  return { LOCALAPPDATA: local, APPDATA: roaming };
}

test('detects Chromium profiles by name and Firefox profiles from profiles.ini', () => {
  const browsers = detectBrowsers(fakeHome());
  assert.deepEqual(browsers.map(item => item.id), ['chrome', 'firefox']);
  assert.deepEqual(browsers[0].profiles.map(item => item.name).sort(), ['Pessoa', 'Trabalho']);
  assert.deepEqual(browsers[1].profiles.map(item => item.name), ['default-release']);
  assert.deepEqual(detectBrowsers({}), []);
});

test('reads Chromium bookmarks and history without file or hidden entries', () => {
  const browsers = detectBrowsers(fakeHome());
  const chrome = browsers.find(item => item.id === 'chrome');
  const data = readProfile(chrome, chrome.profiles.find(item => item.name === 'Pessoa'));
  assert.deepEqual(data.bookmarks.map(item => [item.url, item.folder]), [['https://exemplo.com/', 'Barra'], ['https://blog.exemplo.com/a', 'Leitura'], ['https://outro.exemplo.org/', '']]);
  assert.equal(data.bookmarks[0].date, Date.UTC(2024, 0, 1));
  assert.equal(data.bookmarks[2].title, 'outro.exemplo.org');
  assert.deepEqual(data.history.map(item => item.url), ['https://visitado.com/', 'https://antigo.com/']);
  assert.equal(data.history[0].date, Date.UTC(2025, 5, 1));
});

test('reads Firefox places with folders and visit dates', () => {
  const firefox = detectBrowsers(fakeHome()).find(item => item.id === 'firefox');
  const data = readProfile(firefox, firefox.profiles[0]);
  assert.deepEqual(data.bookmarks.map(item => [item.url, item.folder]), [['https://favorito.net/', ''], ['https://mozilla.org/', 'Projetos']]);
  assert.deepEqual(data.history.map(item => [item.url, item.date]), [['https://mozilla.org/', Date.UTC(2025, 1, 1)]]);
});

test('merge skips known bookmarks and keeps history newest first', () => {
  const current = { bookmarks: [{ id: 'a', title: 'Já tenho', url: 'https://exemplo.com/', date: 1 }], history: [{ id: 'h', url: 'https://visitado.com/', title: 'x', date: 5 }] };
  const merged = mergeImport(current, {
    bookmarks: [{ url: 'https://exemplo.com/', title: 'Repetido', date: 2 }, { url: 'https://novo.com/', title: 'Novo', date: 3, folder: 'Pasta' }],
    history: [{ url: 'https://visitado.com/', title: 'x', date: 9 }, { url: 'https://recente.com/', title: 'r', date: 10 }, { url: 'https://velho.com/', title: 'v', date: 1 }],
  }, makeId);
  assert.equal(merged.addedBookmarks, 1);
  assert.deepEqual(merged.bookmarks.map(item => item.url), ['https://exemplo.com/', 'https://novo.com/']);
  assert.equal(merged.bookmarks[1].folder, 'Pasta');
  assert.deepEqual(merged.history.map(item => item.url), ['https://recente.com/', 'https://visitado.com/', 'https://velho.com/']);
  assert.equal(merged.addedHistory, 2);
});

test('helpers parse ini sections and WebKit timestamps', () => {
  assert.deepEqual(parseProfilesIni('[Profile0]\nName=a\nPath=x\n[Install1]\nDefault=x').map(item => item.Name), ['a']);
  assert.equal(webkitToMs(WEBKIT(1000)), 1000);
  assert.equal(webkitToMs('0'), 0);
  assert.deepEqual(parseChromiumBookmarks(null), []);
});
