import { BarChart3 } from 'lucide-react';
import type { DailyPrivacyStats, TrackerProtectionStatus } from './types';

const empty: DailyPrivacyStats = { ads: 0, trackers: 0, requests: 0, normal: 0, tor: 0, i2p: 0 };
const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export default function PrivacyReport({ stats = {}, protection }: { stats?: Record<string, DailyPrivacyStats>; protection: TrackerProtectionStatus }) {
  const days = Array.from({ length: 7 }, (_, index) => { const date = new Date(); date.setDate(date.getDate() - (6 - index)); return { date, value: stats[dayKey(date)] || empty }; });
  const total = days.reduce((sum, day) => ({ ads: sum.ads + day.value.ads, trackers: sum.trackers + day.value.trackers, requests: sum.requests + day.value.requests, normal: sum.normal + day.value.normal, tor: sum.tor + day.value.tor, i2p: sum.i2p + day.value.i2p }), { ...empty });
  const peak = Math.max(1, ...days.map(day => day.value.requests));
  const routes = total.normal + total.tor + total.i2p;
  const topSites = Object.entries(protection.bySite || {}).sort((a, b) => b[1].blockedRequests - a[1].blockedRequests).slice(0, 5);
  return <section className="settings-card wide-card privacy-report" aria-labelledby="privacy-report-title">
    <h2 id="privacy-report-title"><BarChart3 size={18}/> Relatório de privacidade · últimos 7 dias</h2>
    <p>Contado só neste dispositivo. Nada sai do Cypher.</p>
    <div className="pr-totals">
      <div><strong>{total.requests.toLocaleString('pt-BR')}</strong><span>solicitações bloqueadas</span></div>
      <div><strong>{total.trackers.toLocaleString('pt-BR')}</strong><span>rastreadores</span></div>
      <div><strong>{total.ads.toLocaleString('pt-BR')}</strong><span>anúncios</span></div>
    </div>
    <div className="pr-chart" role="img" aria-label={`Bloqueios por dia: ${days.map(day => `${day.date.toLocaleDateString('pt-BR', { weekday: 'short' })} ${day.value.requests}`).join(', ')}`}>
      {days.map(day => <div key={dayKey(day.date)} className="pr-bar"><i style={{ height: `${Math.max(2, day.value.requests / peak * 100)}%` }}/><small>{day.date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</small></div>)}
    </div>
    <div className="pr-columns">
      <div><h3>Rotas usadas</h3>{routes ? (['normal', 'tor', 'i2p'] as const).map(mode => <div className="pr-route" key={mode}><span>{mode === 'normal' ? 'Normal' : mode.toUpperCase()}</span><span className="pr-meter"><i style={{ width: `${total[mode] / routes * 100}%` }}/></span><small>{Math.round(total[mode] / routes * 100)}%</small></div>) : <p className="cz-empty">Nenhuma navegação registrada ainda.</p>}</div>
      <div><h3>Sites que mais tentaram rastrear (sessão)</h3>{topSites.length ? <ol className="pr-sites">{topSites.map(([site, counts]) => <li key={site}><span>{site}</span><strong>{counts.blockedRequests}</strong></li>)}</ol> : <p className="cz-empty">Navegue um pouco para ver quem tenta rastrear você.</p>}</div>
    </div>
  </section>;
}
