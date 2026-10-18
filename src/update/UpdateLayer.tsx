import { useEffect, useState } from 'react';
import { ArrowRight, RefreshCw, ShieldAlert, X } from 'lucide-react';
import type { UpdateNote, UpdateStatus } from '../types';

type Command = (action: string, payload?: unknown) => Promise<unknown>;

export function Mark({ size = 22, color = 'currentColor' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true"><path d="M3 18 12 6h21v5H15l-5 7 5 7h18v5H12z" fill={color}/></svg>;
}

const tagLabel: Record<UpdateNote['kind'], string> = { new: 'Novo', improved: 'Melhor', fixed: 'Corrige' };

function Ticker({ notes }: { notes: UpdateNote[] }) {
  const items = notes.length ? notes.slice(0, 8) : [{ kind: 'improved', title: 'Melhorias e correções para o seu navegador', body: '', highlight: false, illustration: '' } as UpdateNote];
  const row = items.map((note, index) => <span key={index}><b className={`upd-tag upd-tag-${note.kind}`}>{tagLabel[note.kind]}</b>{note.title}</span>);
  return <div className="upd-ticker"><span className="upd-kicker">Nesta versão</span><div className="upd-marquee"><div>{row}{row}</div></div></div>;
}

function Backdrop({ number }: { number: string }) {
  return <><div className="upd-orb upd-orb-a"/><div className="upd-orb upd-orb-b"/>{number && <div className="upd-ghost">{number}</div>}<div className="upd-wedge"><Mark size={34} color="#09080a"/></div><div className="upd-edge"/><div className="upd-sweep"/><div className="upd-grain"/><div className="upd-vignette"/></>;
}

/** A1: tela cheia enquanto a atualização baixa (a pedido) ou é instalada. */
export function InstallScreen({ update }: { update: UpdateStatus }) {
  const downloading = update.state === 'downloading';
  const version = update.version || update.currentVersion;
  const stepIndex = downloading ? 0 : update.state === 'restarting' ? 3 : 2;
  const percent = downloading ? update.progress : update.state === 'restarting' ? 100 : 96;
  const steps = ['Baixado', 'Assinatura', 'Instalando', 'Reabrir'];
  const ghost = version.split('.').pop()?.replace(/-.*/, '') || '';
  return <div className="upd-screen" role="dialog" aria-modal="true" aria-label={`Atualizando o Cypher para ${version}`}>
    <Backdrop number={ghost}/>
    <div className="upd-body">
      <div className="upd-head upd-in1"><span className="upd-pulse"/><span className="upd-kicker">Atualização em andamento</span><span className="upd-kicker upd-muted">· canal {update.channel === 'preview' ? 'Preview' : 'oficial'}</span></div>
      <div className="upd-version upd-in2"><strong>{version}</strong><span><small>{update.currentVersion}</small><em>→ nova</em></span></div>
      <i className="upd-underline upd-in3"/>
      <div className="upd-status upd-in4"><span className="upd-stage">{downloading ? 'Baixando a atualização' : update.state === 'restarting' ? 'Reabrindo o Cypher' : 'Preparando a instalação'}</span><span className="upd-detail">{update.message}</span><span className="upd-percent">{percent}<i>%</i></span></div>
      <div className="upd-track upd-in4"><div className="upd-fill" style={{ width: `${Math.max(4, percent)}%` }}/></div>
      <ol className="upd-steps upd-in5">{steps.map((step, index) => <li key={step} className={index < stepIndex ? 'is-done' : index === stepIndex ? 'is-now' : ''}><b>{index < stepIndex ? '✓' : index + 1}</b>{index === 0 && downloading ? 'Baixando' : step}</li>)}</ol>
      <div className="upd-in5"><Ticker notes={(update.notes || []).filter(note => note.kind !== 'fixed')}/></div>
      <p className="upd-safe upd-in5">Seus favoritos, senhas e abas estão a salvo. O Cypher reabre sozinho onde você parou.</p>
    </div>
  </div>;
}

/** Versão fora de circulação: só o botão de atualizar continua disponível. */
export function BlockScreen({ update, command, onInstall }: { update: UpdateStatus; command: Command; onInstall: () => void }) {
  const busy = update.state === 'downloading' || update.state === 'installing' || update.state === 'restarting';
  return <div className="upd-screen upd-blocked" role="alertdialog" aria-modal="true" aria-labelledby="upd-block-title">
    <Backdrop number=""/>
    <div className="upd-body">
      <div className="upd-head upd-in1"><ShieldAlert size={16}/><span className="upd-kicker">Versão fora de circulação</span></div>
      <h1 id="upd-block-title" className="upd-title upd-in2">Atualize para<br/><span>continuar.</span></h1>
      <p className="upd-lead upd-in3">O Cypher {update.currentVersion} saiu de circulação. Para sua segurança, só as duas versões mais recentes navegam{update.minimumVersion ? ` (a partir da ${update.minimumVersion})` : ''}. Seus dados ficam intactos.</p>
      {update.state === 'downloading' && <><div className="upd-status upd-in4"><span className="upd-stage">Baixando {update.version}</span><span className="upd-percent">{update.progress}<i>%</i></span></div><div className="upd-track"><div className="upd-fill" style={{ width: `${Math.max(4, update.progress)}%` }}/></div></>}
      {update.state === 'error' && <p className="upd-error upd-in4">{update.message}</p>}
      <div className="upd-actions upd-in5">
        <button type="button" className="upd-btn" disabled={busy} onClick={onInstall}>{busy ? 'Atualizando…' : `Atualizar agora${update.version ? ` para ${update.version}` : ''}`} <ArrowRight size={18}/></button>
        {update.state === 'error' && <button type="button" className="upd-ghost-btn" onClick={() => void command('update:check')}><RefreshCw size={14}/> Verificar de novo</button>}
      </div>
    </div>
  </div>;
}

/** Aviso único quando a versão nova termina de baixar. */
export function ReadyNotice({ update, onInstall }: { update: UpdateStatus; onInstall: () => void }) {
  const key = `cypher-update-notice-${update.version}`;
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(key) === '1'; } catch { return false; } });
  useEffect(() => { try { setHidden(localStorage.getItem(key) === '1'); } catch {} }, [key]);
  if (hidden || update.state !== 'ready') return null;
  const hide = () => { setHidden(true); try { localStorage.setItem(key, '1'); } catch {} };
  const highlight = (update.notes || []).find(note => note.highlight) || (update.notes || [])[0];
  return <aside className="upd-notice" role="status" aria-live="polite">
    <div className="upd-notice-mark"><Mark size={20} color="#09080a"/></div>
    <div className="upd-notice-copy"><span className="upd-kicker">Pronto para instalar</span><strong>Cypher {update.version}</strong>{highlight && <small>{highlight.title}{(update.notes?.length || 0) > 1 ? ` e mais ${(update.notes?.length || 1) - 1}` : ''}</small>}</div>
    <div className="upd-notice-actions"><button type="button" className="upd-btn upd-btn-sm" onClick={onInstall}>Reiniciar agora</button><button type="button" className="upd-ghost-btn" onClick={hide}>Ao fechar</button></div>
    <button type="button" className="upd-notice-close" aria-label="Fechar aviso" onClick={hide}><X size={14}/></button>
  </aside>;
}

/** Selo discreto na barra enquanto houver atualização pronta. */
export function UpdateChip({ update, onInstall }: { update: UpdateStatus; onInstall: () => void }) {
  if (update.state !== 'ready') return null;
  return <button type="button" className="upd-chip" onClick={onInstall} title={`Reiniciar e atualizar para ${update.version}`}><span className="upd-pulse"/>Atualizar</button>;
}
