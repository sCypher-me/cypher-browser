'use strict';
// Lê o CHANGELOG.md em notas estruturadas para o onboarding e para o manifesto de atualização.
// Formato de cada item: "- [Novo★] Título: descrição {ilustração}". Prefixo e ilustração são opcionais.
const { compareVersions, isPreview, parseVersion } = require('./versions.cjs');

const KINDS = { novo: 'new', melhorado: 'improved', corrigido: 'fixed' };
const ILLUSTRATIONS = new Set(['preview', 'atualizacao', 'privacidade', 'configuracoes', 'abas', 'mods', 'instalador', 'generico']);

function parseItem(line) {
  let text = line.replace(/^\s*-\s+/, '').trim();
  let kind = 'improved', highlight = false, illustration = '';
  const prefix = /^\[(Novo|Melhorado|Corrigido)(★)?\]\s*/i.exec(text);
  if (prefix) { kind = KINDS[prefix[1].toLowerCase()]; highlight = !!prefix[2]; text = text.slice(prefix[0].length); }
  const art = /\s*\{([a-z]+)\}\s*$/.exec(text);
  if (art && ILLUSTRATIONS.has(art[1])) { illustration = art[1]; text = text.slice(0, art.index).trim(); }
  const colon = text.indexOf(': ');
  const title = (colon > 0 ? text.slice(0, colon) : text).trim();
  const rawBody = colon > 0 ? text.slice(colon + 2).trim() : '';
  const body = rawBody ? rawBody[0].toLocaleUpperCase('pt-BR') + rawBody.slice(1) : '';
  return { kind, title, body, highlight, illustration };
}

function parseChangelog(markdown) {
  const entries = [];
  let current = null;
  for (const line of String(markdown || '').replace(/\r/g, '').split('\n')) {
    const heading = /^## \[([^\]]+)\](?:\s*-\s*(\d{4}-\d{2}-\d{2}))?/.exec(line);
    if (heading) {
      current = parseVersion(heading[1]) ? { version: heading[1], date: heading[2] || '', items: [] } : null;
      if (current) entries.push(current);
      continue;
    }
    if (current && /^\s*-\s+\S/.test(line)) current.items.push(parseItem(line));
  }
  return entries;
}

/** Versões depois de `from` até `to`, da mais nova para a mais antiga. Para quem vai a uma oficial, ignora Previews. */
function notesBetween(entries, from, to) {
  const skipPreview = !isPreview(to);
  return entries
    .filter(entry => compareVersions(entry.version, from) > 0 && compareVersions(entry.version, to) <= 0 && !(skipPreview && isPreview(entry.version)))
    .sort((a, b) => compareVersions(b.version, a.version));
}

module.exports = { parseChangelog, notesBetween, ILLUSTRATIONS };

