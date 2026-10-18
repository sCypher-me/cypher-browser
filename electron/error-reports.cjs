'use strict';
// Relatórios de erro opcionais. Nada é registrado sem o consentimento do usuário,
// e todo texto passa por scrub() antes de ser guardado ou enviado.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');

const MAX_REPORTS = 50;
const KINDS = new Set(['main', 'promise', 'renderer', 'page-crash', 'process-crash', 'interface']);

function scrub(value, limit = 4000) {
  let text = String(value ?? '');
  text = text
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '<email>')
    .replace(/\b(?:https?|wss?|ftp|file|cypher|cypher-ui|cypher-mod|chrome-extension|blob|data):[^\s'"`<>)\]]*/gi, '<endereço>')
    .replace(/\b(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|br|io|dev|app|gov|edu|me|tv|co|info|onion|i2p)\b(?::\d+)?(?:\/[^\s'"`<>)]*)?/gi, '<endereço>')
    .replace(/[A-Z]:\\Users\\[^\\/\s'"`]+/gi, 'C:\\Users\\<usuário>')
    .replace(/\/(?:Users|home)\/[^/\s'"`]+/g, '/<usuário>')
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '<ip>')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '<token>');
  const user = (() => { try { return os.userInfo().username; } catch { return ''; } })();
  if (user && user.length >= 3) text = text.split(user).join('<usuário>');
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function signatureOf(kind, message, stack) {
  const frames = String(stack || '').split('\n').slice(0, 4).map(line => line.replace(/:\d+:\d+\)?$/, '')).join('|');
  return createHash('sha256').update(`${kind}|${message}|${frames}`).digest('hex').slice(0, 16);
}

function createErrorReporter({ directory, version, enabled, endpoint = '', fetchImpl = null, now = () => Date.now() }) {
  const file = path.join(directory, 'error-reports.json');
  let reports = [];
  try {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (Array.isArray(saved)) reports = saved.filter(item => item && typeof item.id === 'string').slice(-MAX_REPORTS);
  } catch {}
  const save = () => {
    try { fs.mkdirSync(directory, { recursive: true }); fs.writeFileSync(file, JSON.stringify(reports, null, 2)); } catch {}
  };
  const sendable = /^https:\/\//i.test(endpoint) && typeof fetchImpl === 'function';

  function record(kind, error, extra = {}) {
    if (!enabled() || !KINDS.has(kind)) return null;
    const message = scrub(error?.message ?? error, 600) || 'Erro sem mensagem';
    const stack = scrub(error?.stack || '', 4000);
    const detail = scrub(extra.detail || '', 600);
    const signature = signatureOf(kind, message, stack);
    const existing = reports.find(item => item.signature === signature);
    if (existing) {
      existing.count += 1; existing.lastSeen = now();
      save(); return existing;
    }
    const report = {
      id: randomUUID(), signature, kind, message, stack, detail, count: 1,
      firstSeen: now(), lastSeen: now(), version, platform: `${process.platform} ${os.release()}`, arch: process.arch,
      electron: process.versions.electron || '', sent: false,
    };
    reports.push(report);
    if (reports.length > MAX_REPORTS) reports = reports.slice(-MAX_REPORTS);
    save();
    if (sendable) void send(report);
    return report;
  }

  async function send(report) {
    try {
      const { id, sent, ...body } = report;
      const response = await fetchImpl(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (response.ok) { report.sent = true; save(); }
    } catch {}
  }

  return {
    record,
    list: () => reports.slice().reverse(),
    clear: () => { reports = []; save(); },
    canSend: sendable,
    issueUrl(repository, id) {
      const report = reports.find(item => item.id === id);
      if (!report || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository || '')) return '';
      const body = [
        `**Versão:** ${report.version} · ${report.platform} (${report.arch}) · Electron ${report.electron}`,
        `**Tipo:** ${report.kind} · ocorreu ${report.count}x`,
        '', '```', report.message, report.stack.slice(0, 2500), '```', '',
        '_Relatório gerado pelo Cypher. Endereços, nomes de usuário e e-mails foram removidos._',
      ].join('\n');
      return `https://github.com/${repository}/issues/new?title=${encodeURIComponent(`[Erro] ${report.message.slice(0, 80)}`)}&body=${encodeURIComponent(body)}`;
    },
  };
}

module.exports = { createErrorReporter, scrub };
