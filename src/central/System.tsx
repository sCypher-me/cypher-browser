import { Accessibility, ArrowRight, ExternalLink, Gauge, Globe2, MonitorCog, RefreshCw, Sparkles } from 'lucide-react';
import type { Settings } from '../types';
import { Panel, Row, Switch } from '../settings-ui';
import type { SectionProps } from './types';

export default function System({ settings: s, onSettings, command, update, hardwareAccelerationPending }: SectionProps) {
  const busy = ['checking', 'downloading', 'restarting'].includes(update.state);
  const installable = ['available', 'dismissed'].includes(update.state);
  return <>
    <Panel id="updates-status" eyebrow="ATUALIZAÇÃO" title={`Cypher ${update.currentVersion}`} detail={update.message || (update.repository ? 'Verifica sozinho ao iniciar e a cada 6 horas.' : 'Canal de atualizações não configurado nesta compilação.')} icon={RefreshCw} wide>
      <div className="sc-update-summary">
        <span className={`sc-update-indicator ${update.state === 'up-to-date' ? 'ready' : installable ? 'available' : ''}`}><Sparkles size={16}/></span>
        <div><strong>{installable ? `Nova versão ${update.version}` : update.state === 'complete' ? `Versão ${update.version} instalada` : update.state === 'up-to-date' ? 'Você está na versão mais recente' : 'Atualizações automáticas'}</strong><small>{update.repository ? `GitHub Releases · ${update.repository}` : 'Sem canal'} · pacote conferido por assinatura e SHA-512</small></div>
        <button className="sc-button sc-button-primary" disabled={busy} onClick={() => void command(installable ? 'update:install' : 'update:check')}>{installable ? 'Instalar agora' : update.state === 'checking' ? 'Verificando…' : update.state === 'downloading' ? `${update.progress}%` : update.state === 'restarting' ? 'Reiniciando…' : update.state === 'error' ? 'Tentar de novo' : 'Verificar'} <ArrowRight size={13}/></button>
      </div>
      {update.state === 'downloading' && <div className="sc-update-progress"><span><i style={{ width: `${update.progress}%` }}/></span></div>}
      {update.releaseNotes && installable && <div className="sc-release-notes"><span className="sc-eyebrow">NOVIDADES</span><p>{update.releaseNotes}</p></div>}
    </Panel>

    <Panel id="system-startup" eyebrow="WINDOWS" title="Integração com o Windows" icon={MonitorCog}>
      <Row id="system-default-browser" title="Navegador padrão" detail="O Windows pede sua confirmação"><button className="sc-button sc-button-primary" onClick={() => void command('system:default-browser')}>Definir <ExternalLink size={13}/></button></Row>
      <Row title="Iniciar com o Windows"><Switch label="Iniciar com o Windows" checked={s.startWithWindows} onChange={() => onSettings({ startWithWindows: !s.startWithWindows })}/></Row>
      <Row id="system-close-confirm" title="Confirmar ao fechar várias abas"><Switch label="Confirmar ao fechar várias abas" checked={s.confirmCloseWithMultipleTabs} onChange={() => onSettings({ confirmCloseWithMultipleTabs: !s.confirmCloseWithMultipleTabs })}/></Row>
      <Row title="Proxy do computador"><button className="sc-button sc-button-subtle" onClick={() => void command('system:proxy')}>Abrir <ExternalLink size={13}/></button></Row>
      <Row title="DNS seguro (DoH)" detail="Configurado na rede do Windows"><button className="sc-button sc-button-subtle" onClick={() => void command('system:dns-settings')}>Abrir <ExternalLink size={13}/></button></Row>
    </Panel>

    <Panel id="tabs-memory-saver" eyebrow="DESEMPENHO" title="Memória e gráficos" icon={Gauge}>
      <Row title="Suspender abas inativas" detail="Recarrega ao voltar; preserva formulários, mídia, privadas, Tor e I2P"><Switch label="Economia de memória" checked={s.memorySaverEnabled} onChange={() => onSettings({ memorySaverEnabled: !s.memorySaverEnabled })}/></Row>
      {s.memorySaverEnabled && <Row title="Tempo até suspender"><select className="sc-select" value={s.memorySaverMinutes} onChange={event => onSettings({ memorySaverMinutes: +event.target.value })}><option value={5}>5 minutos</option><option value={10}>10 minutos</option><option value={20}>20 minutos</option><option value={30}>30 minutos</option><option value={60}>1 hora</option><option value={120}>2 horas</option></select></Row>}
      <Row id="system-hardware" title="Aceleração gráfica" detail={hardwareAccelerationPending ? 'Será aplicada após reiniciar' : 'Usa a GPU para páginas e interface'}><Switch label="Aceleração gráfica" checked={s.hardwareAcceleration} onChange={() => onSettings({ hardwareAcceleration: !s.hardwareAcceleration })}/></Row>
      {hardwareAccelerationPending && <Row title="Aplicar agora" detail="O Cypher fecha e abre de novo"><button className="sc-button sc-button-primary" onClick={() => void command('system:restart')}>Reiniciar <RefreshCw size={13}/></button></Row>}
    </Panel>

    <Panel id="accessibility-zoom" eyebrow="LEITURA" title="Acessibilidade" icon={Accessibility}>
      <Row id="accessibility-text-scale" title="Texto da interface" detail={`${Math.round(s.interfaceTextScale * 100)}%`}><input className="sc-range" aria-label="Tamanho do texto da interface" type="range" min="1" max="1.4" step="0.05" value={s.interfaceTextScale} onChange={event => onSettings({ interfaceTextScale: +event.target.value })}/></Row>
      <Row title="Zoom inicial das páginas" detail={`${Math.round(s.defaultZoom * 100)}%`}><input className="sc-range" aria-label="Zoom inicial das páginas" type="range" min="0.75" max="1.5" step="0.05" value={s.defaultZoom} onChange={event => onSettings({ defaultZoom: +event.target.value })}/></Row>
      <Row id="accessibility-motion" title="Reduzir animações"><Switch label="Reduzir animações" checked={!s.motion} onChange={() => onSettings({ motion: !s.motion })}/></Row>
    </Panel>

    <Panel id="system-webrtc" eyebrow="REDE" title="Endereços WebRTC" detail="Vale para novas conexões. Tor e I2P sempre bloqueiam UDP fora do proxy." icon={Globe2}>
      <div className="sc-radio-list">{[
        ['default', 'Qualquer interface adequada', 'Pode expor endereços públicos e locais'],
        ['default_public_and_private_interfaces', 'Interfaces públicas e privadas', 'Conforme a rede'],
        ['default_public_interface_only', 'Somente interfaces públicas', 'Esconde endereços locais'],
        ['disable_non_proxied_udp', 'Desabilitar UDP sem proxy', 'Reduz vazamento de IP; pode afetar chamadas'],
      ].map(([policy, label, detail]) => <label className="sc-radio-option" key={policy}><input type="radio" name="webrtc-policy" checked={s.webrtcPolicy === policy} onChange={() => onSettings({ webrtcPolicy: policy as Settings['webrtcPolicy'] })}/><span><strong>{label}</strong><small>{detail}</small></span></label>)}</div>
    </Panel>

  </>;
}
