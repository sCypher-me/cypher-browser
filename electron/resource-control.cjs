// Gerenciador de tarefas e limitadores (CPU, memória e banda).
// Recebe medições já coletadas; decide o que mostrar e em quem agir, sem tocar no Electron.

/** Junta as métricas dos processos às abas (pelo PID do renderizador). */
// O Electron divide a CPU por todos os núcleos; aqui ela vira "% de um núcleo", como no Chrome.
function taskRows({ metrics, tabs, network = new Map(), browserPid, cores = 1 }) {
  const byPid = new Map(metrics.map(item => [item.pid, item]));
  const rows = [];
  const usedPids = new Set();
  for (const tab of tabs) {
    const metric = byPid.get(tab.pid);
    if (metric) usedPids.add(metric.pid);
    rows.push({
      id: tab.id, kind: 'tab', title: tab.title || tab.url, url: tab.url, pid: tab.pid || 0,
      cpu: metric ? round((metric.cpu?.percentCPUUsage || 0) * cores) : 0,
      memory: metric ? Math.round((metric.memory?.workingSetSize || 0) / 1024) : 0,
      network: Math.round((network.get(tab.id) || 0) / 1024),
      suspended: !!tab.suspended, limited: !!tab.limited, active: !!tab.active,
    });
  }
  // Processos que não são abas: navegador, GPU, utilitários e a interface do Cypher.
  const names = { Browser: 'Cypher (navegador)', GPU: 'Gráficos (GPU)', Utility: 'Serviço', Tab: 'Interface e painéis', Zygote: 'Serviço', 'Pepper Plugin': 'Plug-in' };
  for (const metric of metrics) {
    if (usedPids.has(metric.pid)) continue;
    rows.push({ id: `pid-${metric.pid}`, kind: 'process', title: metric.pid === browserPid ? 'Cypher (navegador)' : (metric.name || names[metric.type] || metric.type || 'Processo'), url: '', pid: metric.pid,
      cpu: round((metric.cpu?.percentCPUUsage || 0) * cores), memory: Math.round((metric.memory?.workingSetSize || 0) / 1024), network: 0, suspended: false, limited: false, active: false });
  }
  return rows.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'tab' ? -1 : 1) || b.cpu - a.cpu || b.memory - a.memory);
}
function round(value) { return Math.round(value * 10) / 10; }

/**
 * Abas em segundo plano que passaram do limite de CPU por várias medições seguidas.
 * `history` guarda quantas medições cada aba está acima; é atualizado aqui.
 */
function cpuOffenders(rows, { threshold, history, samples = 3 }) {
  const offenders = [];
  for (const row of rows) {
    if (row.kind !== 'tab') continue;
    const over = !row.active && row.cpu >= threshold;
    const count = over ? (history.get(row.id) || 0) + 1 : 0;
    history.set(row.id, count);
    if (count >= samples) offenders.push(row.id);
  }
  return offenders;
}

/** Abas para suspender (menos usadas primeiro) até a memória das abas caber no limite. */
function tabsToSuspend(rows, { limitMb, lastActive = new Map(), protectedIds = new Set() }) {
  const tabRows = rows.filter(row => row.kind === 'tab' && !row.suspended);
  let total = tabRows.reduce((sum, row) => sum + row.memory, 0);
  if (!limitMb || total <= limitMb) return [];
  const candidates = tabRows.filter(row => !row.active && !protectedIds.has(row.id)).sort((a, b) => (lastActive.get(a.id) || 0) - (lastActive.get(b.id) || 0));
  const chosen = [];
  for (const row of candidates) {
    if (total <= limitMb) break;
    chosen.push(row.id);
    total -= row.memory;
  }
  return chosen;
}

/** Condições de rede do Chromium para um limite em Mbit/s (0 = sem limite). */
function bandwidthConditions(mbps) {
  if (!Number.isFinite(mbps) || mbps <= 0) return null;
  const bytesPerSecond = Math.round((mbps * 1_000_000) / 8);
  return { latency: 0, downloadThroughput: bytesPerSecond, uploadThroughput: Math.round(bytesPerSecond / 2) };
}

module.exports = { taskRows, cpuOffenders, tabsToSuspend, bandwidthConditions };
