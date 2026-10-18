const test = require('node:test');
const assert = require('node:assert/strict');
const { parseChangelog, notesBetween } = require('../scripts/changelog.cjs');

const sample = `# Cypher — novidades

## [Unreleased]

## [0.7.37-beta.1] - 2026-10-20
- [Novo★] Teste antecipado: algo novo {preview}

## [0.7.36] - 2026-10-18
- [Novo★] Canal Preview: receba versões antes de todo mundo. {preview}
- [Melhorado★] Atualiza em segundo plano: baixa sozinho e avisa. {atualizacao}
- [Corrigido] Colar após atualizar: reaberto como pelo atalho.
- [Novo] Bloqueio de versões antigas: só as duas últimas.
- Item sem prefixo e sem dois-pontos

## [0.7.35] - 2026-10-18
- Botões "Copiar" dos sites: voltaram a copiar.
`;

test('parseChangelog lê versões, tipos, destaques e ilustrações', () => {
  const list = parseChangelog(sample);
  assert.deepEqual(list.map(entry => entry.version), ['0.7.37-beta.1', '0.7.36', '0.7.35']);
  const v36 = list[1];
  assert.equal(v36.date, '2026-10-18');
  assert.deepEqual(v36.items[0], { kind: 'new', title: 'Canal Preview', body: 'Receba versões antes de todo mundo.', highlight: true, illustration: 'preview' });
  assert.equal(v36.items[1].kind, 'improved');
  assert.equal(v36.items[1].illustration, 'atualizacao');
  assert.deepEqual(v36.items[2], { kind: 'fixed', title: 'Colar após atualizar', body: 'Reaberto como pelo atalho.', highlight: false, illustration: '' });
  assert.deepEqual(v36.items[4], { kind: 'improved', title: 'Item sem prefixo e sem dois-pontos', body: '', highlight: false, illustration: '' });
  assert.equal(list[2].items[0].title, 'Botões "Copiar" dos sites');
});

test('notesBetween junta as versões puladas, da mais nova para a mais antiga, sem Preview no canal oficial', () => {
  const list = parseChangelog(sample);
  assert.deepEqual(notesBetween(list, '0.7.34', '0.7.36').map(entry => entry.version), ['0.7.36', '0.7.35']);
  assert.deepEqual(notesBetween(list, '0.7.35', '0.7.36').map(entry => entry.version), ['0.7.36']);
  assert.deepEqual(notesBetween(list, '0.7.36', '0.7.37-beta.1').map(entry => entry.version), ['0.7.37-beta.1']);
  assert.deepEqual(notesBetween(list, '0.7.36', '0.7.36'), []);
});
