import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Archive, ArrowLeft, ArrowUpRight, ExternalLink, Loader2, RotateCw, Search, Trash2, X, Zap } from 'lucide-react';
import type { ArchivedTab, LinkPreviewState, QuickState } from './types';

type Act = (action: string, payload?: unknown) => Promise<any>;
const host = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

/** Prévia de link: moldura da interface; a página em si é uma vista nativa posicionada no corpo. */
export function LinkPreview({ preview, act }: { preview: LinkPreviewState; act: Act }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = bodyRef.current;
    if (!element) return;
    const sync = () => { const rect = element.getBoundingClientRect(); void act('preview:bounds', { x: rect.x, y: rect.y, width: rect.width, height: rect.height }); };
    sync();
    const observer = new ResizeObserver(sync); observer.observe(element);
    window.addEventListener('resize', sync);
    return () => { observer.disconnect(); window.removeEventListener('resize', sync); };
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') void act('preview:close'); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return <>
    <div className="preview-backdrop" onClick={() => void act('preview:close')}/>
    <section className="link-preview" role="dialog" aria-label={`Prévia de ${host(preview.url)}`}>
      <header>
        <span className="link-preview-mark">{preview.loading ? <Loader2 size={15} className="spinning"/> : host(preview.url).slice(0, 1).toUpperCase()}</span>
        <div className="link-preview-title"><strong>{preview.title || host(preview.url)}</strong><small>{preview.url}</small></div>
        <button type="button" className="sec-btn sec-btn-primary" onClick={() => void act('preview:promote')}><ArrowUpRight size={15}/> Abrir em nova aba</button>
        <button type="button" className="pw-bar-close" aria-label="Fechar prévia" title="Fechar prévia · Esc" onClick={() => void act('preview:close')}><X size={16}/></button>
      </header>
      <div className="link-preview-body" ref={bodyRef}><span className="link-preview-loading">Carregando prévia…</span></div>
    </section>
  </>;
}

/** Interface da janela rápida (rota #quick): barra de endereço compacta e ações. */
export function QuickWindow() {
  const [state, setState] = useState<QuickState | null>(null);
  const [address, setAddress] = useState('');
  const [editing, setEditing] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const off = window.cypher.onState((next: any) => { if (next?.quick) { setState(next.quick); if (!editing) setAddress(next.quick.url); } });
    void window.cypher.invoke('quick:state');
    inputRef.current?.focus();
    return off;
  }, [editing]);
  useEffect(() => { if (state?.url && !editing) setAddress(state.url); }, [state?.url]);
  const light = state?.appearance === 'light';
  const style = { '--accent': state?.accent || '#ff5436', '--surface': state?.surface || '#151310', '--base': state?.background || '#0a0908' } as CSSProperties;
  const go = async () => { if (!address.trim()) return; setEditing(false); inputRef.current?.blur(); await window.cypher.invoke('quick:navigate', address.trim()).catch(() => {}); };
  return <div className="quick-window" data-appearance={light ? 'light' : 'dark'} data-skin={state?.skin || 'recorte'} style={style}>
    <header className="quick-bar">
      <span className="quick-mark" title="Janela rápida do Cypher"><Zap size={15}/></span>
      <button type="button" className="quick-icon" aria-label="Voltar" disabled={!state?.canGoBack} onClick={() => void window.cypher.invoke('quick:back')}><ArrowLeft size={16}/></button>
      <form className="quick-address" onSubmit={event => { event.preventDefault(); void go(); }}>
        {state?.loading ? <Loader2 size={14} className="spinning"/> : <Search size={14}/>}
        <input ref={inputRef} aria-label="Pesquise ou digite um endereço" placeholder="Pesquise ou digite um endereço" value={address} onFocus={event => { setEditing(true); event.currentTarget.select(); }} onBlur={() => setEditing(false)} onChange={event => setAddress(event.target.value)} spellCheck={false}/>
      </form>
      <button type="button" className="quick-icon" aria-label="Recarregar" disabled={!state?.url} onClick={() => void window.cypher.invoke('quick:reload')}><RotateCw size={15}/></button>
      <button type="button" className="quick-icon" aria-label="Abrir no Cypher" title="Abrir como aba no Cypher" disabled={!state?.url} onClick={() => void window.cypher.invoke('quick:promote')}><ExternalLink size={15}/></button>
      <button type="button" className="quick-icon quick-close" aria-label="Fechar janela rápida" title="Fechar · Esc" onClick={() => void window.cypher.invoke('quick:close')}><X size={16}/></button>
    </header>
    {!state?.url && <div className="quick-empty"><Zap size={28}/><strong>Janela rápida</strong><p>Uma consulta sem bagunçar as abas. Digite acima; <kbd>Ctrl Alt N</kbd> abre de qualquer lugar.</p></div>}
  </div>;
}

/** Abas arquivadas automaticamente (página Espaços e pesquisa). */
export function ArchivedSection({ archived, hours, act, onConfigure }: { archived: ArchivedTab[]; hours: number; act: Act; onConfigure: () => void }) {
  return <section className="productivity-section archived-section">
    <header className="productivity-section-heading"><div className="productivity-section-icon"><Archive size={19}/></div><div><span className="eyebrow">ARQUIVAMENTO AUTOMÁTICO</span><h2>Abas arquivadas</h2><p>{hours ? `Abas sem uso por ${hours >= 24 ? `${hours / 24} ${hours === 24 ? 'dia' : 'dias'}` : `${hours} horas`} saem da barra e ficam aqui. Fixadas e com som nunca são arquivadas.` : 'O arquivamento automático está desligado.'} <button type="button" className="sc-inline-link" onClick={onConfigure}>Configurar</button></p></div>
      {archived.length > 0 && <button type="button" className="button secondary" onClick={() => void act('archive:clear')}><Trash2 size={15}/> Limpar arquivo</button>}</header>
    {archived.length ? <div className="session-list">{archived.slice(0, 60).map(item => <article className="session-card" key={item.id}>
      <div><strong>{item.title}</strong><small>{host(item.url)} · arquivada {new Date(item.archivedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</small></div>
      <button type="button" className="button secondary" onClick={() => void act('archive:restore', item.id)}>Reabrir</button>
      <button type="button" className="icon-button" aria-label={`Remover ${item.title} do arquivo`} title="Remover do arquivo" onClick={() => void act('archive:remove', item.id)}><Trash2 size={15}/></button>
    </article>)}</div> : <p className="muted-text session-empty">Nenhuma aba arquivada.</p>}
  </section>;
}
