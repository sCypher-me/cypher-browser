import { useMemo } from 'react';
import { ArrowRight, ArrowUpRight, Ban, Check, Clock3, ExternalLink, Globe2, ShieldCheck, Trash2, X } from 'lucide-react';
import type { PopupProtectionStatus, PopupRequest, Settings, Tab } from './types';

type Props = {
  settings: Settings;
  status: PopupProtectionStatus;
  tab?: Tab;
  onSettings: (patch: Partial<Settings>) => void;
  onClose: () => void;
  onAction: (id: string, action: 'dismiss' | 'open-background' | 'open-current' | 'allow-site') => void;
  onClear: () => void;
  onConfigure: () => void;
};

function safeHost(url?: string) {
  try {
    const parsed = new URL(url || '');
    return ['http:','https:'].includes(parsed.protocol) ? parsed.hostname.toLowerCase() : '';
  } catch { return ''; }
}

export default function PopupProtectionPanel({ settings, status, tab, onSettings, onClose, onAction, onClear, onConfigure }: Props) {
  const host = useMemo(() => safeHost(tab?.url), [tab?.url]);
  const canRememberSite = !!host && !tab?.private && tab?.connectionMode === 'normal';
  const excepted = !!host && settings.popupExceptions.includes(host);
  return <section className="popup-popover" aria-label="Bloqueador de pop-ups">
    <header>
      <span className="popup-popover-icon"><Ban size={17}/></span>
      <div><strong>Bloqueador de pop-ups</strong><small>{settings.blockPopups ? 'Bloqueio ativo nesta sessão' : 'Bloqueio desativado'}</small></div>
      <button type="button" aria-label="Fechar bloqueador de pop-ups" onClick={onClose}><X size={16}/></button>
    </header>
    <div className="popup-summary">
      <div><strong>{status.blockedCount.toLocaleString('pt-BR')}</strong><span>bloqueados nesta sessão</span></div>
      <div><strong>{status.pending.length.toLocaleString('pt-BR')}</strong><span>aguardando decisão</span></div>
    </div>
    <div className="popup-controls">
      <label><span><strong>Bloquear pop-ups e pop-unders</strong><small>Impede janelas e abas abertas sem sua ação</small></span><button type="button" role="switch" aria-label="Bloquear pop-ups" aria-checked={settings.blockPopups} className={`tracker-mini-switch ${settings.blockPopups ? 'on' : ''}`} onClick={() => onSettings({ blockPopups: !settings.blockPopups })}><i/></button></label>
      {canRememberSite && <label><span><strong>Permitir pop-ups neste site</strong><small>{host}{!settings.blockPopups ? ' · a exceção vale quando o bloqueio global estiver ativo' : ''}</small></span><button type="button" role="switch" aria-label={`Permitir pop-ups em ${host}`} aria-checked={excepted} className={`tracker-mini-switch ${excepted ? 'on' : ''}`} onClick={() => onSettings({ popupExceptions: excepted ? settings.popupExceptions.filter(item => item !== host) : [...settings.popupExceptions, host] })}><i/></button></label>}
      {host && !canRememberSite && <div className="popup-private-note">Em navegação privada, Tor ou I2P, as exceções não são salvas. Você ainda pode abrir cada pop-up manualmente.</div>}
    </div>
    <div className="popup-queue-heading"><strong>Pop-ups bloqueados</strong>{status.pending.length > 0 && <span>{status.pending.length}</span>}</div>
    {status.pending.length ? <div className="popup-queue">
      {status.pending.slice(0, 8).map((request: PopupRequest) => <article className="popup-request" key={request.id}>
        <div className="popup-request-info"><span className="popup-request-origin"><Globe2 size={13}/>{request.openerHost || request.openerTitle || 'Site sem identificação'}{request.private && <i>Privada</i>}</span><small title={request.canOpen ? request.url : undefined}>{request.formPost ? 'Formulário bloqueado. Permita o site e envie novamente para evitar reenviar dados.' : request.canOpen ? request.url : 'Esta janela não pode ser reaberta como um link comum'}</small>{request.count > 1 && <em>{request.count} tentativas</em>}</div>
        <div className="popup-request-actions">
          <button type="button" className="popup-action-primary" disabled={!request.canOpen} onClick={() => onAction(request.id, 'open-background')}><ExternalLink size={13}/>Abrir em nova aba</button>
          <button type="button" className="popup-action-subtle" disabled={!request.canOpen} onClick={() => onAction(request.id, 'open-current')}>Substituir a aba</button>
          {request.openerHost && !request.private && request.connectionMode === 'normal' ? <button type="button" className="popup-action-subtle" onClick={() => onAction(request.id, 'allow-site')}><Check size={13}/>{request.formPost ? 'Permitir próxima tentativa' : 'Permitir sempre'}</button> : <button type="button" className="popup-action-subtle" onClick={() => onAction(request.id, 'dismiss')}>Ignorar</button>}
          <button type="button" className="popup-action-dismiss" aria-label="Ignorar pop-up" title="Ignorar" onClick={() => onAction(request.id, 'dismiss')}><X size={14}/></button>
        </div>
      </article>)}
      {status.pending.length > 8 && <p className="popup-queue-more">Mais {status.pending.length - 8} solicitações aguardam decisão.</p>}
    </div> : <div className="popup-empty"><span><ShieldCheck size={17}/></span><div><strong>Nenhum pop-up bloqueado</strong><small>As solicitações bloqueadas aparecem aqui para você decidir.</small></div></div>}
    <footer><span><Clock3 size={13}/>A contagem reinicia ao fechar o Cypher</span><div>{status.pending.length > 0 && <button type="button" onClick={onClear}><Trash2 size={13}/>Limpar fila</button>}<button type="button" onClick={onConfigure}>Configurações <ArrowRight size={13}/></button></div></footer>
    {canRememberSite && excepted && <p className="popup-exception-note"><Check size={13}/> Pop-ups permitidos em {host} <button type="button" onClick={() => onSettings({ popupExceptions: settings.popupExceptions.filter(item => item !== host) })} aria-label={`Remover exceção de ${host}`}><ArrowUpRight size={12}/></button></p>}
  </section>;
}
