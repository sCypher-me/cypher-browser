import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ShieldCheck } from 'lucide-react';
import type { UpdateIllustration, UpdateNote, UpdateOnboardingState } from '../types';
import { Mark } from './UpdateLayer';

const kindLabel: Record<UpdateNote['kind'], string> = { new: 'Novo', improved: 'Melhorado', fixed: 'Corrigido' };

/** Ilustrações desenhadas no estilo da interface, uma por tipo de novidade. */
function Illustration({ kind, version }: { kind: UpdateIllustration; version: string }) {
  if (kind === 'preview') return <div className="obd-art"><div className="obd-card obd-tilt">
    <span className="upd-kicker">Sistema · Atualização</span>
    <div className="obd-row"><div><strong>Participar do Preview</strong><small>Versões antecipadas, antes do oficial</small></div><i className="obd-switch"/></div>
    <div className="obd-versions"><div><span>Oficial</span><b>{version}</b></div><em>→</em><div className="is-hot"><span>Preview</span><b>Próxima <i className="obd-beta">β</i></b></div></div>
  </div><div className="obd-card obd-float"><span className="upd-pulse"/><div><strong>Preview disponível</strong><small>Baixando em segundo plano…</small></div></div><div className="obd-glyph">β</div></div>;
  if (kind === 'atualizacao' || kind === 'instalador') return <div className="obd-art"><div className="obd-card obd-tilt">
    <span className="upd-kicker">Atualização em andamento</span>
    <div className="obd-big">{version}</div>
    <div className="upd-track"><div className="upd-fill" style={{ width: '68%' }}/></div>
    <ol className="upd-steps"><li className="is-done"><b>✓</b>Baixado</li><li className="is-done"><b>✓</b>Assinatura</li><li className="is-now"><b>3</b>Instalando</li></ol>
  </div><div className="obd-card obd-float"><span className="upd-pulse"/><div><strong>Pronto para instalar</strong><small>Reinicie quando quiser</small></div></div></div>;
  if (kind === 'privacidade') return <div className="obd-art"><div className="obd-card obd-tilt obd-center">
    <ShieldCheck size={64}/>
    <div className="obd-stats"><div><b>1.284</b><small>bloqueios</small></div><div><b>312</b><small>rastreadores</small></div><div><b>0</b><small>vazamentos</small></div></div>
  </div></div>;
  if (kind === 'configuracoes') return <div className="obd-art"><div className="obd-card obd-tilt">
    <div className="obd-tabs"><span className="is-on">Visão geral</span><span>Aparência</span><span>Navegação</span><span>Privacidade</span></div>
    <div className="obd-grid"><i/><i/><i/><i/></div>
  </div></div>;
  if (kind === 'abas') return <div className="obd-art"><div className="obd-card obd-tilt">
    {['Pesquisa', 'Documentos', 'Música', 'Leitura'].map((name, index) => <div key={name} className={`obd-tab ${index === 0 ? 'is-on' : ''}`}><b>0{index + 1}</b>{name}</div>)}
  </div></div>;
  if (kind === 'mods') return <div className="obd-art obd-mods">{['#ff5436', '#39e0ff', '#ffb347'].map((color, index) => <div key={color} className="obd-card" style={{ ['--mod' as string]: color, transform: `translate(${index * 34}px, ${index * 30}px) rotate(${index * 3 - 4}deg)` }}><i/><span/><span/></div>)}</div>;
  return <div className="obd-art"><div className="obd-card obd-tilt obd-center"><Mark size={70} color="#ff5436"/><div className="obd-big">{version}</div></div></div>;
}

/** R1: uma capa por destaque e a página final com tudo que mudou. */
export default function Onboarding({ onboarding, onDone }: { onboarding: UpdateOnboardingState; onDone: () => void }) {
  const { highlights, groups } = useMemo(() => {
    const items = onboarding.versions.flatMap(entry => entry.items);
    const seen = new Set<string>();
    const unique = items.filter(item => { const key = `${item.kind}|${item.title}`; if (seen.has(key)) return false; seen.add(key); return true; });
    return {
      highlights: unique.filter(item => item.highlight).slice(0, 4),
      groups: (['new', 'improved', 'fixed'] as const).map(kind => ({ kind, items: unique.filter(item => item.kind === kind) })).filter(group => group.items.length),
    };
  }, [onboarding]);
  const total = highlights.length + 1;
  const [page, setPage] = useState(0);
  const last = page >= highlights.length;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') { event.preventDefault(); setPage(value => Math.min(total - 1, value + 1)); }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); setPage(value => Math.max(0, value - 1)); }
      else if (event.key === 'Escape') { event.preventDefault(); onDone(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [total, onDone]);
  const skipped = onboarding.versions.length > 1 ? ` · ${onboarding.versions.length} versões` : '';
  const pips = <div className="obd-pips">{Array.from({ length: total }, (_, index) => <i key={index} className={index === page ? 'is-on' : index < page ? 'is-done' : ''}/>)}</div>;
  const counter = <span className="obd-counter">{String(page + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>;

  return <div className="upd-screen obd-screen" role="dialog" aria-modal="true" aria-labelledby="obd-title">
    <div className="upd-orb upd-orb-a"/><div className="upd-grain"/><div className="upd-vignette"/>
    {!last ? (() => {
      const item = highlights[page];
      return <div className="obd-cover" key={page}>
        <div className="upd-ghost obd-ghost">{String(page + 1).padStart(2, '0')}</div>
        <section className="obd-copy">
          <div className="upd-head upd-in1"><Mark size={22} color="#ff5436"/><span className="upd-kicker">Cypher {onboarding.to} · o que há de novo{skipped}</span></div>
          <span className={`upd-tag upd-tag-${item.kind} upd-in2`}>{kindLabel[item.kind]}</span>
          <h1 id="obd-title" className="obd-title upd-in2">{item.title.split(' ').slice(0, -1).join(' ')} <span>{item.title.split(' ').pop()}.</span></h1>
          {item.body && <p className="obd-text upd-in3">{item.body}</p>}
          <div className="obd-nav upd-in4"><button type="button" className="upd-btn" onClick={() => setPage(page + 1)}>Próxima <ArrowRight size={18}/></button>{page > 0 && <button type="button" className="upd-ghost-btn" onClick={() => setPage(page - 1)}><ArrowLeft size={14}/> Voltar</button>}<button type="button" className="upd-ghost-btn" onClick={onDone}>Pular</button></div>
          <div className="obd-foot upd-in5">{pips}{counter}<span className="obd-keys"><kbd>←</kbd> <kbd>→</kbd> navegar · <kbd>Esc</kbd> fechar</span></div>
        </section>
        <aside className="obd-visual"><div className="obd-slash"/><Illustration kind={item.illustration || 'generico'} version={onboarding.to}/></aside>
      </div>;
    })() : <div className="obd-final" key="final">
      <div className="upd-head upd-in1"><Mark size={22} color="#ff5436"/><span className="upd-kicker">Cypher {onboarding.to} · {highlights.length ? 'e mais' : 'novidades'}{skipped}</span>{counter}</div>
      <h1 id="obd-title" className="obd-title obd-title-sm upd-in2">Tudo que <span>mudou.</span></h1>
      <div className="obd-columns upd-in3">{groups.map(group => <section key={group.kind} className={`obd-col obd-col-${group.kind}`}><span className="upd-kicker">{kindLabel[group.kind]} · {group.items.length}</span><ul>{group.items.slice(0, 9).map(item => <li key={item.title} title={item.body}>{item.title}</li>)}{group.items.length > 9 && <li className="obd-more">e mais {group.items.length - 9}</li>}</ul></section>)}</div>
      <div className="obd-nav upd-in4"><button type="button" className="upd-btn" onClick={onDone}>Começar a navegar <ArrowRight size={18}/></button>{highlights.length > 0 && <button type="button" className="upd-ghost-btn" onClick={() => setPage(page - 1)}><ArrowLeft size={14}/> Voltar</button>}<span className="obd-spacer"/>{pips}</div>
    </div>}
  </div>;
}
