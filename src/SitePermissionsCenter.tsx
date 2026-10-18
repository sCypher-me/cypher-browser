import { Globe2, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react';
import type { SitePermission } from './types';

const permissionNames: Record<string, string> = { media: 'Câmera e microfone', geolocation: 'Localização', notifications: 'Notificações', fullscreen: 'Tela cheia', 'clipboard-sanitized-write': 'Copiar para a área de transferência', 'clipboard-read': 'Colar da área de transferência' };

export default function SitePermissionsCenter({ permissions, command }: { permissions: SitePermission[]; command: (action: string, payload?: unknown) => Promise<any> }) {
  return <section className="settings-card site-permissions-card">
    <div className="site-permissions-heading"><div><h2><ShieldCheck size={18}/> Permissões por site</h2><p>As escolhas “sempre” são salvas neste dispositivo. Remova uma regra para perguntar novamente ao site.</p></div><button className="button secondary" disabled={!permissions.length} onClick={() => void command('site-permission:clear')}><RotateCcw size={14}/> Limpar regras</button></div>
    {permissions.length ? <div className="site-permission-list">{permissions.map(rule => <article className="site-permission-row" key={rule.id}>
      <span className="site-permission-icon"><Globe2 size={16}/></span><div className="site-permission-copy"><strong>{rule.origin}</strong><small>{permissionNames[rule.permission] || rule.permission} · {new Date(rule.updated).toLocaleDateString('pt-BR')}</small></div><span className={`site-permission-decision ${rule.allowed ? 'allow' : 'block'}`}>{rule.allowed ? 'Permitido' : 'Bloqueado'}</span><button className="icon-button" title="Remover regra e perguntar novamente" aria-label={`Remover regra de ${rule.origin}`} onClick={() => void command('site-permission:remove', rule.id)}><Trash2 size={15}/></button>
    </article>)}</div> : <div className="site-permission-empty"><Globe2 size={18}/><span>Você ainda não salvou permissões para sites.</span></div>}
  </section>;
}
