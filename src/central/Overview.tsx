import { ArrowRight, Eraser, LockKeyhole, Palette, RefreshCw, Shield, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import type { DailyPrivacyStats } from '../types';
import type { SectionProps } from './types';

const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const routeLabel = { normal: 'Normal', tor: 'Tor', i2p: 'I2P' } as const;

function weekTotals(stats: Record<string, DailyPrivacyStats> = {}) {
  const total = { requests: 0, trackers: 0, ads: 0 };
  for (let offset = 0; offset < 7; offset++) {
    const date = new Date(); date.setDate(date.getDate() - offset);
    const day = stats[dayKey(date)];
    if (day) { total.requests += day.requests; total.trackers += day.trackers; total.ads += day.ads; }
  }
  return total;
}

/** O estado do navegador num olhar, com atalhos para cada seção. */
export default function Overview({ settings: s, privacyStats, trackerProtection, update, profiles, profileId, connectionMode, command, onSettings, goSection }: SectionProps) {
  const week = weekTotals(privacyStats);
  const profileName = profiles.find(profile => profile.id === profileId)?.name || 'Pessoal';
  const protections = [s.blockAds, s.blockTrackers && trackerProtection.available, s.blockPopups, s.blockCookieBanners].filter(Boolean).length;
  const installable = update.state === 'ready';

  return <>
    <button type="button" className="sc-panel sc-tile" onClick={() => goSection('privacy')} data-toc="Proteção">
      <span className="sc-eyebrow"><ShieldCheck size={12}/> PROTEÇÃO · 7 DIAS</span>
      <div className="sc-stats"><div><b>{week.requests.toLocaleString('pt-BR')}</b><small>bloqueios</small></div><div><b>{week.trackers.toLocaleString('pt-BR')}</b><small>rastreadores</small></div><div><b>{week.ads.toLocaleString('pt-BR')}</b><small>anúncios</small></div></div>
      <span className="sc-tile-foot">{protections} de 4 proteções ativas <ArrowRight size={13}/></span>
    </button>

    <button type="button" className="sc-panel sc-tile" onClick={() => goSection('privacy', 'connection-routes')} data-toc="Rota">
      <span className="sc-eyebrow"><Shield size={12}/> ROTA PADRÃO</span>
      <div className="sc-tile-big">{routeLabel[connectionMode] || 'Normal'}</div>
      <span className="sc-tile-foot">{s.routeRules.length ? `${s.routeRules.length} regra(s) por site` : 'Novas abas usam esta rota'} <ArrowRight size={13}/></span>
    </button>

    <button type="button" className="sc-panel sc-tile" onClick={() => goSection('profile')} data-toc="Perfil">
      <span className="sc-eyebrow"><UserRound size={12}/> PERFIL</span>
      <div className="sc-tile-profile"><span className="sc-identity-photo small">{s.profilePhoto ? <img src={s.profilePhoto} alt=""/> : <UserRound size={20}/>}</span><div className="sc-tile-big">{profileName}</div></div>
      <span className="sc-tile-foot">{profiles.length} perfil(is) neste dispositivo <ArrowRight size={13}/></span>
    </button>

    <button type="button" className={`sc-panel sc-tile ${installable ? 'sc-tile-alert' : ''}`} onClick={() => goSection('system', 'updates-status')} data-toc="Versão">
      <span className="sc-eyebrow"><RefreshCw size={12}/> VERSÃO</span>
      <div className="sc-tile-big">{update.currentVersion}</div>
      <span className="sc-tile-foot">{installable ? `Atualização ${update.version} pronta` : update.state === 'up-to-date' ? 'Em dia' : 'Atualizações automáticas'} <ArrowRight size={13}/></span>
    </button>

    <section className="sc-panel sc-wide" id="overview-actions" data-toc="Ações rápidas">
      <span className="sc-eyebrow">AÇÕES RÁPIDAS</span>
      <div className="sc-quick">
        <button type="button" onClick={() => onSettings({ skin: s.skin === 'recorte' ? 'classic' : 'recorte' })}><Palette size={16}/><span><strong>Trocar pele</strong><small>Agora: {s.skin === 'recorte' ? 'Recorte' : 'Clássico'}</small></span></button>
        <button type="button" onClick={() => void command('tab:new', { private: true })}><LockKeyhole size={16}/><span><strong>Aba privada</strong><small>Sem histórico</small></span></button>
        <button type="button" onClick={() => void command('data:clear')}><Eraser size={16}/><span><strong>Limpar dados</strong><small>Cookies e cache</small></span></button>
        <button type="button" onClick={() => void command('update:check')}><RefreshCw size={16}/><span><strong>Verificar atualização</strong><small>GitHub Releases</small></span></button>
        <button type="button" onClick={() => goSection('appearance', 'mods-manage')}><Sparkles size={16}/><span><strong>Mods e temas</strong><small>Mude a frequência</small></span></button>
      </div>
    </section>
  </>;
}
