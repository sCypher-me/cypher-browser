import { useMemo, useState } from 'react';
import { SessionsSection } from './ControlCenter';
import { ArchivedSection } from './FlowWindows';
import type { ArchivedTab, SavedSession } from './types';
import { BookOpen, Check, Clock3, Layers3, Plus, Search, Sparkles, Trash2, ExternalLink, CheckCircle2, Pencil } from 'lucide-react';
import type { ResearchItem, Tab, Workspace } from './types';

type SuggestedGroup = { name:string; items:Array<{ id:string; title:string; url:string }> };
type Props = { tabs:Tab[]; activeTab?:Tab; workspaces:Workspace[]; activeWorkspaceId:string; researchItems:ResearchItem[]; command:(action:string,payload?:unknown)=>Promise<any>; navigate:(url:string)=>void; sessions?:SavedSession[]; archived?:ArchivedTab[]; archiveHours?:number; onConfigureArchive?:()=>void };

export default function ProductivityCenter({ tabs, activeTab, workspaces, activeWorkspaceId, researchItems, command, navigate, sessions = [], archived = [], archiveHours = 0, onConfigureArchive = () => {} }:Props) {
  const [workspaceName,setWorkspaceName] = useState('');
  const [workspaceColor,setWorkspaceColor] = useState('#78d9ee');
  const [groups,setGroups] = useState<SuggestedGroup[]>([]);
  const [busy,setBusy] = useState(false);
  const visibleTabs = tabs.filter(tab => !tab.private && tab.connectionMode === 'normal' && tab.workspaceId === activeWorkspaceId);
  const ungroupedCount = visibleTabs.filter(tab => !tab.group).length;
  const unreadCount = researchItems.filter(item => !item.read).length;
  const groupedCount = useMemo(() => new Set(visibleTabs.map(tab => tab.group).filter(Boolean)).size,[visibleTabs]);
  const researchUrl = activeTab && /^https?:/i.test(activeTab.url) ? activeTab.url : activeTab?.lastExternalUrl || '';
  const researchTitle = activeTab && /^https?:/i.test(activeTab.url) ? activeTab.title : activeTab?.lastExternalTitle || '';
  const researchButtonLabel = activeTab && /^https?:/i.test(activeTab.url) ? 'Salvar página atual' : 'Salvar última página';

  async function createWorkspace(event:React.FormEvent) {
    event.preventDefault();
    const name = workspaceName.trim(); if (!name) return;
    setBusy(true);
    const created = await command('workspace:create',{ name, color:workspaceColor });
    if (created?.id) { setWorkspaceName(''); await command('workspace:switch',created.id); }
    setBusy(false);
  }
  async function organizeTabs() {
    setBusy(true);
    const suggestions = await command('tabs:suggest-groups');
    const valid = Array.isArray(suggestions) ? suggestions.filter(group => group.items?.length > 1) : [];
    setGroups(valid);
    setBusy(false);
  }
  async function applyGroup(group:SuggestedGroup) {
    await command('tabs:organize',group.items.map(item => ({ id:item.id, group:group.name })));
    setGroups(current => current.filter(item => item.name !== group.name));
  }
  async function addCurrentPage() {
    if (!activeTab || activeTab.private || activeTab.connectionMode !== 'normal' || !researchUrl) return;
    await command('research:add',{ url:researchUrl, title:researchTitle });
  }

  return <div className="productivity-center">
    <section className="productivity-overview">
      <div><span className="eyebrow">CYPHER / FLUXO DE TRABALHO</span><h2>Seus espaços, suas descobertas.</h2><p>Separe assuntos, guarde leituras e mantenha abas relacionadas juntas.</p></div>
      <div className="productivity-stats"><span><Layers3 size={15}/>{workspaces.length} espaços</span><span><BookOpen size={15}/>{unreadCount} leituras pendentes</span><span><Sparkles size={15}/>{groupedCount} grupos ativos</span></div>
    </section>

    <section className="productivity-section">
      <header className="productivity-section-heading"><div className="productivity-section-icon"><Layers3 size={19}/></div><div><span className="eyebrow">CONTEXTO SEPARADO</span><h2>Espaços de trabalho</h2><p>Cada espaço guarda suas próprias abas. Favoritos e histórico continuam no perfil.</p></div></header>
      <div className="workspace-cards">{workspaces.map(workspace => { const loaded = workspace.id === activeWorkspaceId && visibleTabs.some(tab => /^https?:/i.test(tab.url)); return <article className={`workspace-card ${workspace.id === activeWorkspaceId ? 'is-active' : ''}`} key={workspace.id} style={{'--workspace-color':workspace.color} as React.CSSProperties}>
        <div className="workspace-card-mark"><Layers3 size={18}/></div><div className="workspace-card-copy"><strong>{workspace.name}</strong><small>{loaded ? `${visibleTabs.length} abas abertas neste espaço` : `${workspace.tabs.length} abas salvas`}</small></div>
        {workspace.id === activeWorkspaceId && !loaded && workspace.tabs.length ? <button className="productivity-button subtle" onClick={() => void command('workspace:switch',workspace.id)}>Restaurar abas ({workspace.tabs.length})</button> : workspace.id === activeWorkspaceId ? <span className="workspace-active"><Check size={14}/> Em uso</span> : <button className="productivity-button subtle" onClick={() => void command('workspace:switch',workspace.id)}>Abrir espaço</button>}
        {workspaces.length > 1 && <button className="workspace-tool" aria-label={`Renomear ${workspace.name}`} title="Renomear espaço" onClick={() => { const name = window.prompt('Nome do espaço',workspace.name)?.trim(); if (name) void command('workspace:rename',{ id:workspace.id, name }); }}><Pencil size={14}/></button>}
        {workspaces.length > 1 && workspace.id !== activeWorkspaceId && <button className="workspace-tool" aria-label={`Remover ${workspace.name}`} title="Remover espaço" onClick={() => { if (window.confirm(`Remover o espaço “${workspace.name}”? As abas salvas serão movidas para o primeiro espaço.`)) void command('workspace:delete',workspace.id); }}><Trash2 size={14}/></button>}
      </article>; })}</div>
      <form className="workspace-create" onSubmit={event => void createWorkspace(event)}><input aria-label="Nome do novo espaço" value={workspaceName} onChange={event => setWorkspaceName(event.target.value)} placeholder="Ex.: Trabalho, Estudos, Viagem" maxLength={48}/><label className="workspace-color-picker" title="Cor do espaço"><input type="color" aria-label="Cor do espaço" value={workspaceColor} onChange={event => setWorkspaceColor(event.target.value)}/></label><button className="productivity-button primary" disabled={busy || !workspaceName.trim()}><Plus size={15}/> Criar espaço</button></form>
    </section>

    <SessionsSection sessions={sessions} act={command}/>

    <ArchivedSection archived={archived} hours={archiveHours} act={command} onConfigure={onConfigureArchive}/>

    <section className="productivity-section">
      <header className="productivity-section-heading"><div className="productivity-section-icon"><Sparkles size={19}/></div><div><span className="eyebrow">SUGESTÕES NO DISPOSITIVO</span><h2>Organizar abas</h2><p>O Cypher sugere grupos de abas normais do mesmo site usando os endereços locais. Nada é enviado para fora.</p></div><button className="productivity-button subtle" onClick={() => void organizeTabs()} disabled={busy || visibleTabs.length < 2}><Sparkles size={15}/>{busy ? 'Analisando…' : 'Sugerir grupos'}</button></header>
      {groups.length > 0 ? <div className="suggested-groups">{groups.map(group => <article className="suggested-group" key={group.name}><div><strong>{group.name}</strong><small>{group.items.length} abas relacionadas</small></div><span>{group.items.slice(0,3).map(item => item.title).join(' · ')}</span><button className="productivity-button primary" onClick={() => void applyGroup(group)}>Agrupar abas</button></article>)}</div> : <div className="productivity-empty"><Search size={18}/><span>{groupedCount ? `${groupedCount} grupo(s) já aplicados. Há ${ungroupedCount} aba(s) sem grupo.` : 'Peça sugestões para encontrar abas do mesmo site e agrupá-las com um clique.'}</span></div>}
    </section>

    <section className="productivity-section research-section">
      <header className="productivity-section-heading"><div className="productivity-section-icon"><BookOpen size={19}/></div><div><span className="eyebrow">LEITURA E ANOTAÇÕES</span><h2>Fila de pesquisa</h2><p>Salve páginas, escreva notas e marque o que já leu. O conteúdo permanece no perfil local.</p></div><button className="productivity-button primary" onClick={() => void addCurrentPage()} disabled={!activeTab || activeTab.private || activeTab.connectionMode !== 'normal' || !researchUrl}><Plus size={15}/> {researchButtonLabel}</button></header>
      {researchItems.length ? <div className="research-list">{researchItems.map(item => <article className={`research-item ${item.read ? 'is-read' : ''}`} key={item.id}>
        <div className="research-item-main"><div className="research-item-top"><button className="research-title" onClick={() => navigate(item.url)}>{item.title}</button><button className={`research-read ${item.read ? 'done' : ''}`} title={item.read ? 'Marcar como não lida' : 'Marcar como lida'} onClick={() => void command('research:update',{ id:item.id, read:!item.read })}>{item.read ? <CheckCircle2 size={16}/> : <BookOpen size={16}/>}{item.read ? 'Lida' : 'Marcar lida'}</button></div><small className="research-url">{item.url}</small><textarea aria-label={`Anotação para ${item.title}`} defaultValue={item.note} placeholder="Adicionar uma nota pessoal…" maxLength={5000} onBlur={event => { if (event.target.value !== item.note) void command('research:update',{ id:item.id, note:event.target.value }); }}/><div className="research-item-footer"><span><Clock3 size={13}/>{new Date(item.savedAt).toLocaleDateString('pt-BR')}</span><button aria-label={`Remover ${item.title} da fila`} onClick={() => void command('research:remove',item.id)}><Trash2 size={14}/> Remover</button><button aria-label={`Abrir ${item.title} em uma nova aba`} onClick={() => void command('tab:new',{ url:item.url })}><ExternalLink size={14}/> Nova aba</button></div></div>
      </article>)}</div> : <div className="productivity-empty"><BookOpen size={18}/><span>Salve uma página para começar sua próxima pesquisa.</span></div>}
    </section>
  </div>;
}
