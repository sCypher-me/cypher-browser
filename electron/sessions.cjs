// Sessões nomeadas (conjuntos de abas salvos para reabrir depois) e recuperação depois de
// o Cypher fechar sem querer.
const fs = require('node:fs');
const path = require('node:path');

const MAX_SESSIONS = 50, MAX_TABS = 100;

function cleanTab(item) {
  if (!item || typeof item.url !== 'string' || item.url.length > 4096 || !/^https?:\/\//i.test(item.url)) return null;
  return { url: item.url, title: String(item.title || item.url).slice(0, 180), pinned: item.pinned === true, group: String(item.group || '').slice(0, 50) };
}

function sanitizeSessions(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, MAX_SESSIONS).flatMap(item => {
    if (!item || typeof item.id !== 'string' || typeof item.name !== 'string') return [];
    const tabs = Array.isArray(item.tabs) ? item.tabs.map(cleanTab).filter(Boolean).slice(0, MAX_TABS) : [];
    if (!tabs.length) return [];
    return [{ id: item.id.slice(0, 80), name: item.name.trim().slice(0, 60) || 'Sessão', created: Number.isFinite(item.created) ? item.created : Date.now(), tabs }];
  });
}

/** Nova sessão no topo da lista; um nome repetido substitui a sessão antiga. */
function saveSession(sessions, { id, name, tabs, now = Date.now() }) {
  const title = String(name || '').trim().slice(0, 60);
  if (!title) throw new Error('Dê um nome à sessão.');
  const clean = (tabs || []).map(cleanTab).filter(Boolean).slice(0, MAX_TABS);
  if (!clean.length) throw new Error('Não há abas de sites para guardar nesta sessão.');
  const rest = sessions.filter(item => item.name.toLowerCase() !== title.toLowerCase());
  return [{ id, name: title, created: now, tabs: clean }, ...rest].slice(0, MAX_SESSIONS);
}

/**
 * Marca de execução: existe enquanto o Cypher está aberto. Se ela já existir ao iniciar,
 * a execução anterior terminou sem fechar direito (travamento, queda de energia, encerramento).
 */
function createRunMarker(directory) {
  const file = path.join(directory, 'cypher-running.json');
  return {
    previousCrashed() {
      try { const data = JSON.parse(fs.readFileSync(file, 'utf8')); return { crashed: true, startedAt: Number(data.startedAt) || 0 }; }
      catch (error) { return { crashed: error?.code !== 'ENOENT' && fs.existsSync(file), startedAt: 0 }; }
    },
    start(now = Date.now()) { try { fs.mkdirSync(directory, { recursive: true }); fs.writeFileSync(file, JSON.stringify({ startedAt: now, pid: process.pid })); } catch {} },
    finish() { try { fs.rmSync(file, { force: true }); } catch {} },
  };
}

module.exports = { sanitizeSessions, saveSession, createRunMarker };
