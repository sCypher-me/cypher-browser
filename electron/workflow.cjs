// Arquivamento automático de abas e recortes da web para a fila de pesquisa.

const MAX_ARCHIVED = 200;

/**
 * Abas paradas há mais de `hours` horas. Ficam de fora a aba atual, fixadas, privadas,
 * Tor/I2P, as que tocam algo e as páginas internas.
 */
function tabsToArchive(tabs, { hours, now = Date.now(), activeId }) {
  if (!hours || hours <= 0) return [];
  const cutoff = now - hours * 3_600_000;
  return tabs.filter(tab => tab.id !== activeId && !tab.pinned && !tab.private && tab.connectionMode === 'normal' && !tab.audible && !tab.mediaPlaying
    && /^https?:\/\//i.test(tab.url) && (tab.lastActiveAt || now) < cutoff).map(tab => tab.id);
}

function sanitizeArchive(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, MAX_ARCHIVED).flatMap(item => {
    if (!item || typeof item.id !== 'string' || typeof item.url !== 'string' || !/^https?:\/\//i.test(item.url) || item.url.length > 4096) return [];
    return [{ id: item.id.slice(0, 80), url: item.url, title: String(item.title || item.url).slice(0, 180), archivedAt: Number.isFinite(item.archivedAt) ? item.archivedAt : Date.now(), workspaceId: String(item.workspaceId || '').slice(0, 80) }];
  });
}

/** Põe abas no arquivo (mais recentes primeiro); o mesmo endereço não aparece duas vezes. */
function archiveTabs(list, entries) {
  const urls = new Set(entries.map(entry => entry.url));
  return [...entries, ...list.filter(item => !urls.has(item.url))].slice(0, MAX_ARCHIVED);
}

/** Acrescenta um trecho citado às notas de uma página, sem passar do limite. */
function appendClip(note, text, max = 5000) {
  const clean = String(text || '').replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!clean) throw new Error('Selecione um trecho da página para recortar.');
  const quote = clean.split('\n').map(line => `> ${line}`).join('\n');
  const next = note ? `${note.trimEnd()}\n\n${quote}` : quote;
  if (next.length > max) throw new Error('As notas desta página já estão cheias. Apague algo antes de recortar mais.');
  return next;
}

module.exports = { tabsToArchive, sanitizeArchive, archiveTabs, appendClip };
