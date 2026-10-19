import { useEffect, useRef, useState } from 'react';
import { Activity, Fingerprint, Gauge, History, ImageOff, Layers3, Minus, Plus, RotateCcw, Save, ScrollText, ShieldCheck, Trash2, X, Zap } from 'lucide-react';
import type { SavedSession, SiteSetting, TaskRow } from './types';

type Act = (action: string, payload?: unknown) => Promise<any>;

const mb = (value: number) => value >= 1024 ? `${(value / 1024).toFixed(1).replace('.', ',')} GB` : `${value} MB`;
const kbps = (value: number) => value <= 0 ? '—' : value >= 1024 ? `${(value / 1024).toFixed(1).replace('.', ',')} MB/s` : `${value} KB/s`;
function siteOf(url: string) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } }

/** Gerenciador de tarefas (Shift Esc): CPU, memória e rede de cada aba e processo. */
export function TaskManager({ act, onClose }: { act: Act; onClose: () => void }) {
  const [rows, setRows] = useState<TaskRow[]>([]);
  const [selected, setSelected] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => { const data = await act('tasks:list'); if (alive && Array.isArray(data)) setRows(data); };
    void load();
    const timer = setInterval(load, 1500);
    closeRef.current?.focus();
    return () => { alive = false; clearInterval(timer); };
  }, []);
  const tabsRows = rows.filter(row => row.kind === 'tab');
  const total = rows.reduce((sum, row) => ({ cpu: sum.cpu + row.cpu, memory: sum.memory + row.memory }), { cpu: 0, memory: 0 });
  const chosen = rows.find(row => row.id === selected && row.kind === 'tab');
  return <>
    <div className="menu-backdrop" onClick={onClose}/>
    <section className="task-manager" role="dialog" aria-label="Gerenciador de tarefas" onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
      <header><span className="task-mark"><Activity size={16}/></span><div><span className="eyebrow">CYPHER / DESEMPENHO</span><h2>Gerenciador de tarefas</h2></div><button ref={closeRef} type="button" className="pw-bar-close" aria-label="Fechar gerenciador" onClick={onClose}><X size={16}/></button></header>
      <div className="task-summary"><span><strong>{tabsRows.length}</strong> abas</span><span><strong>{total.cpu.toFixed(0)}%</strong> CPU</span><span><strong>{mb(total.memory)}</strong> memória</span></div>
      <div className="task-table" role="table" aria-label="Processos do Cypher">
        <div className="task-row task-head" role="row"><span role="columnheader">Tarefa</span><span role="columnheader">CPU</span><span role="columnheader">Memória</span><span role="columnheader">Rede</span></div>
        <div className="task-body">
          {rows.map(row => <button type="button" role="row" key={row.id} className={`task-row is-${row.kind} ${selected === row.id ? 'is-selected' : ''}`} onClick={() => setSelected(row.id)} onDoubleClick={() => { if (row.kind === 'tab') { void act('tab:select', row.id); onClose(); } }}>
            <span role="cell" className="task-name"><i className={row.kind === 'tab' ? 'task-dot is-tab' : 'task-dot'}/>{row.title}{row.active && <em>ativa</em>}{row.suspended && <em>suspensa</em>}{row.limited && <em className="is-limited">limitada</em>}</span>
            <span role="cell" className={row.cpu >= 25 ? 'task-hot' : ''}>{row.suspended ? '—' : `${row.cpu.toFixed(1).replace('.', ',')}%`}</span>
            <span role="cell">{row.suspended ? '—' : mb(row.memory)}</span>
            <span role="cell">{row.kind === 'tab' ? kbps(row.network) : '—'}</span>
          </button>)}
        </div>
      </div>
      <footer><small>Duplo clique abre a aba. Encerrar fecha só o processo da página; a aba continua na lista.</small><button type="button" className="sec-btn sec-btn-primary" disabled={!chosen || chosen.suspended} onClick={() => chosen && void act('tasks:end', chosen.id)}>Encerrar processo</button></footer>
    </section>
  </>;
}

/** Painel do site atual: aberto pelo cadeado da barra de endereço. */
export function SitePanel({ url, zoom, setting, act, onClose, onPermissions }: { url: string; zoom: number; setting: SiteSetting; act: Act; onClose: () => void; onPermissions: () => void }) {
  const host = siteOf(url);
  const secure = url.startsWith('https:');
  const set = (patch: Record<string, unknown>) => void act('site:settings:set', { url, patch });
  const toggles: [keyof SiteSetting, string, string, typeof Zap, boolean][] = [
    ['javascript', 'JavaScript', 'Desligar deixa o site mais leve, mas muitos param de funcionar', ScrollText, setting.javascript !== false],
    ['images', 'Imagens', 'Esconde todas as imagens deste site', ImageOff, setting.images !== false],
    ['limit', 'Limitar recursos', 'Deixa o site 4× mais lento na CPU, mesmo em primeiro plano', Gauge, setting.limit === true],
    ['fingerprint', 'Proteção de impressão digital', 'Desligue só se o site quebrar (alguns editores e jogos)', Fingerprint, setting.fingerprint !== false],
  ];
  return <>
    <div className="menu-backdrop" onClick={onClose}/>
    <section className="site-panel browser-menu" role="dialog" aria-label={`Configurações de ${host}`} onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
      <span className="eyebrow">ESTE SITE</span>
      <div className="site-panel-head"><span className={`site-panel-lock ${secure ? 'is-secure' : ''}`}><ShieldCheck size={16}/></span><div><strong>{host}</strong><small>{secure ? 'Conexão segura (HTTPS)' : 'Conexão sem criptografia'}</small></div></div>
      {toggles.map(([field, title, detail, Icon, on]) => <button type="button" role="switch" aria-checked={on} key={field} className="site-panel-toggle" onClick={() => set({ [field]: field === 'limit' ? (on ? null : true) : (on ? false : null) })}>
        <Icon size={16}/><span><strong>{title}</strong><small>{detail}</small></span><i className={`site-switch ${on ? 'is-on' : ''}`}/>
      </button>)}
      <div className="site-panel-zoom"><span>Zoom deste site</span><button type="button" aria-label="Diminuir zoom" onClick={() => void act('zoom', Math.round((zoom - 0.1) * 100) / 100)}><Minus size={14}/></button><output>{Math.round(zoom * 100)}%</output><button type="button" aria-label="Aumentar zoom" onClick={() => void act('zoom', Math.round((zoom + 0.1) * 100) / 100)}><Plus size={14}/></button><button type="button" aria-label="Zoom padrão" title="Zoom padrão" onClick={() => void act('zoom', 1)}><RotateCcw size={14}/></button></div>
      <div className="menu-separator"/>
      <button type="button" className="site-panel-link" onClick={onPermissions}>Permissões e dados do site</button>
    </section>
  </>;
}

/** Faixa acima da página depois de um fechamento inesperado. */
export function RecoveryBar({ count, act }: { count: number; act: Act }) {
  return <div className="pw-bar recovery-bar" role="alert">
    <span className="pw-bar-mark"><History size={16}/></span>
    <div className="pw-bar-copy"><strong>O Cypher fechou de forma inesperada.</strong><small>{count === 1 ? 'Uma aba estava aberta.' : `${count} abas estavam abertas.`} Quer reabrir de onde parou?</small></div>
    <div className="pw-bar-actions">
      <button type="button" className="sec-btn sec-btn-primary" onClick={() => void act('recovery:restore')}>Restaurar abas</button>
      <button type="button" className="pw-bar-close" aria-label="Dispensar" title="Dispensar" onClick={() => void act('recovery:dismiss')}><X size={15}/></button>
    </div>
  </div>;
}

/** Sessões nomeadas: guardar as abas do espaço atual e reabrir depois. */
export function SessionsSection({ sessions, act }: { sessions: SavedSession[]; act: Act }) {
  const [name, setName] = useState('');
  return <section className="productivity-section sessions-section">
    <header className="productivity-section-heading"><div className="productivity-section-icon"><Layers3 size={19}/></div><div><span className="eyebrow">SESSÕES NOMEADAS</span><h2>Sessões salvas</h2><p>Guarde as abas abertas deste espaço com um nome e reabra tudo quando precisar.</p></div></header>
    <form className="session-form" onSubmit={async event => { event.preventDefault(); if (!name.trim()) return; if (await act('session:save', { name })) setName(''); }}>
      <input className="sc-input" aria-label="Nome da sessão" placeholder="Ex.: Pesquisa do TCC, Viagem, Trabalho" value={name} maxLength={60} onChange={event => setName(event.target.value)}/>
      <button type="submit" className="button primary" disabled={!name.trim()}><Save size={15}/> Salvar abas atuais</button>
    </form>
    {sessions.length ? <div className="session-list">{sessions.map(session => <article className="session-card" key={session.id}>
      <div><strong>{session.name}</strong><small>{session.count} {session.count === 1 ? 'aba' : 'abas'} · {new Date(session.created).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}{session.hosts.length ? ` · ${session.hosts.join(', ')}` : ''}</small></div>
      <button type="button" className="button secondary" onClick={() => void act('session:open', { id: session.id })}>Abrir</button>
      <button type="button" className="icon-button" aria-label={`Apagar ${session.name}`} title="Apagar sessão" onClick={() => void act('session:delete', session.id)}><Trash2 size={15}/></button>
    </article>)}</div> : <p className="muted-text session-empty">Nenhuma sessão salva ainda.</p>}
  </section>;
}
