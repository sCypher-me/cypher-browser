import { Accessibility, ArrowRight, ExternalLink, Gauge, Globe2, MonitorCog, RefreshCw, Sparkles } from 'lucide-react';
import type { Settings } from '../types';
import { Panel, Row, Switch } from '../settings-ui';
import type { SectionProps } from './types';

export default function System({ settings: s, onSettings, command, update, hardwareAccelerationPending, drm }: SectionProps) {
  const ready = update.state === 'ready';
  const busy = ['checking', 'downloading', 'installing', 'restarting'].includes(update.state);
  const preview = (s.updateChannel || update.channel) === 'preview';
  const onBeta = /-beta\.\d+$/.test(update.currentVersion);
  const headline = ready ? `Versão ${update.version} pronta para instalar`
    : update.state === 'downloading' ? `Baixando a versão ${update.version} em segundo plano`
    : update.state === 'up-to-date' ? 'Você está na versão mais recente'
    : update.state === 'checking' ? 'Procurando uma versão nova…'
    : update.state === 'error' ? 'Não foi possível verificar agora'
    : 'Atualizações automáticas';
  const kindLabel = { new: 'Novo', improved: 'Melhor', fixed: 'Corrige' } as const;
  return <>
    <Panel id="updates-status" eyebrow={preview ? 'ATUALIZAÇÃO · CANAL PREVIEW' : 'ATUALIZAÇÃO · CANAL OFICIAL'} title={`Cypher ${update.currentVersion}`} detail={update.repository ? 'Baixa sozinho em segundo plano e instala quando você reiniciar ou fechar o Cypher.' : 'Canal de atualizações não configurado nesta compilação.'} icon={RefreshCw} wide>
      <div className="sc-update-summary">
        <span className={`sc-update-indicator ${update.state === 'up-to-date' ? 'ready' : ready ? 'available' : ''}`}><Sparkles size={16}/></span>
        <div><strong>{headline}</strong><small>{update.state === 'error' ? update.message : `GitHub Releases · assinatura Ed25519 e SHA-512${update.lastChecked ? ` · verificado às ${new Date(update.lastChecked).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''}`}</small></div>
        {ready
          ? <button className="sc-button sc-button-primary" onClick={() => void command('update:install')}>Reiniciar e atualizar <ArrowRight size={13}/></button>
          : <button className="sc-button sc-button-subtle" disabled={busy} onClick={() => void command('update:check')}>{update.state === 'checking' ? 'Verificando…' : update.state === 'downloading' ? `${update.progress}%` : 'Verificar agora'}</button>}
      </div>
      {update.state === 'downloading' && <div className="sc-update-progress"><span><i style={{ width: `${update.progress}%` }}/></span></div>}
      {ready && <div className="sc-info-strip"><Sparkles size={15}/><span>Se preferir, só feche o Cypher quando terminar: a atualização é instalada ao fechar e a versão nova abre na próxima vez.</span></div>}
      {(ready || update.state === 'downloading') && (update.notes?.length || 0) > 0 && <div className="sc-release-notes"><span className="sc-eyebrow">NOVIDADES DA {update.version}</span><ul className="sc-update-notes">{update.notes!.slice(0, 8).map(note => <li key={note.title}><b className={`upd-tag upd-tag-${note.kind}`}>{kindLabel[note.kind]}</b>{note.title}</li>)}</ul></div>}
      <Row id="updates-preview" title="Participar do Preview" detail={preview
        ? (onBeta ? 'Você recebe versões antecipadas. Ao sair, fica nesta versão até a oficial chegar nela.' : 'Você recebe versões antecipadas, antes do canal oficial.')
        : 'Receba as próximas versões antes de todo mundo e ajude a encontrar problemas.'}>
        <Switch label="Participar do Preview" checked={preview} onChange={() => onSettings({ updateChannel: preview ? 'stable' : 'preview' })}/>
      </Row>
    </Panel>

    <Panel id="system-startup" eyebrow="WINDOWS" title="Integração com o Windows" icon={MonitorCog}>
      <Row id="system-default-browser" title="Navegador padrão" detail="O Windows pede sua confirmação"><button className="sc-button sc-button-primary" onClick={() => void command('system:default-browser')}>Definir <ExternalLink size={13}/></button></Row>
      <Row title="Iniciar com o Windows"><Switch label="Iniciar com o Windows" checked={s.startWithWindows} onChange={() => onSettings({ startWithWindows: !s.startWithWindows })}/></Row>
      <Row id="system-close-confirm" title="Confirmar ao fechar várias abas"><Switch label="Confirmar ao fechar várias abas" checked={s.confirmCloseWithMultipleTabs} onChange={() => onSettings({ confirmCloseWithMultipleTabs: !s.confirmCloseWithMultipleTabs })}/></Row>
      <Row title="Proxy do computador"><button className="sc-button sc-button-subtle" onClick={() => void command('system:proxy')}>Abrir <ExternalLink size={13}/></button></Row>
      <Row title="DNS seguro (DoH)" detail="Configurado na rede do Windows"><button className="sc-button sc-button-subtle" onClick={() => void command('system:dns-settings')}>Abrir <ExternalLink size={13}/></button></Row>
    </Panel>

    <Panel id="system-limiters" eyebrow="LIMITADORES" title="CPU, memória e rede" detail="Seguram o Cypher quando ele está pesando no computador. Veja o consumo de cada aba no Gerenciador de tarefas (Shift Esc)." icon={Gauge}>
      <Row id="system-limit-cpu" title="Limitar CPU de abas em segundo plano" detail={`Abas acima de ${s.cpuLimitPercent}% por alguns segundos ficam 4× mais lentas; voltam ao normal quando você as abre`}><Switch label="Limitar CPU" checked={s.limitCpu} onChange={() => onSettings({ limitCpu: !s.limitCpu })}/></Row>
      {s.limitCpu && <Row title="Limite de CPU por aba"><select className="sc-select" aria-label="Limite de CPU por aba" value={s.cpuLimitPercent} onChange={event => onSettings({ cpuLimitPercent: +event.target.value })}><option value={10}>10%</option><option value={25}>25%</option><option value={50}>50%</option></select></Row>}
      <Row id="system-limit-memory" title="Limitar memória das abas" detail="Suspende as abas menos usadas quando a soma passa do limite; fixadas e com som ficam de fora"><Switch label="Limitar memória" checked={s.limitMemory} onChange={() => onSettings({ limitMemory: !s.limitMemory })}/></Row>
      {s.limitMemory && <Row title="Memória máxima das abas"><select className="sc-select" aria-label="Memória máxima das abas" value={s.memoryLimitMb} onChange={event => onSettings({ memoryLimitMb: +event.target.value })}>{[1024, 2048, 4096, 8192].map(value => <option key={value} value={value}>{value / 1024} GB</option>)}</select></Row>}
      <Row id="system-limit-network" title="Limitar banda" detail="Reserva a conexão para outros programas e jogos. Vale para cada aba normal"><Switch label="Limitar banda" checked={s.limitBandwidth} onChange={() => onSettings({ limitBandwidth: !s.limitBandwidth })}/></Row>
      {s.limitBandwidth && <Row title="Download máximo por aba"><select className="sc-select" aria-label="Velocidade máxima de download" value={s.bandwidthMbps} onChange={event => onSettings({ bandwidthMbps: +event.target.value })}>{[2, 5, 10, 25, 50, 100].map(value => <option key={value} value={value}>{value} Mbit/s</option>)}</select></Row>}
    </Panel>

    <Panel id="tabs-memory-saver" eyebrow="DESEMPENHO" title="Memória e gráficos" icon={Gauge}>
      <Row title="Suspender abas inativas" detail="Recarrega ao voltar; preserva formulários, mídia, privadas, Tor e I2P"><Switch label="Economia de memória" checked={s.memorySaverEnabled} onChange={() => onSettings({ memorySaverEnabled: !s.memorySaverEnabled })}/></Row>
      {s.memorySaverEnabled && <Row title="Tempo até suspender"><select className="sc-select" aria-label="Tempo até suspender abas" value={s.memorySaverMinutes} onChange={event => onSettings({ memorySaverMinutes: +event.target.value })}><option value={5}>5 minutos</option><option value={10}>10 minutos</option><option value={20}>20 minutos</option><option value={30}>30 minutos</option><option value={60}>1 hora</option><option value={120}>2 horas</option></select></Row>}
      <Row id="system-drm" title="Conteúdo protegido (Widevine)" detail={drm?.available ? (drm.ready ? 'Ativo: Netflix, Disney+, Spotify e outros' : drm.error ? `Indisponível: ${drm.error}` : 'Preparando o módulo do Google…') : 'Esta compilação ainda não inclui o módulo de DRM'}><span className={`sc-status-pill ${drm?.ready ? 'is-on' : ''}`}>{drm?.ready ? 'Ativo' : 'Inativo'}</span></Row>
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
