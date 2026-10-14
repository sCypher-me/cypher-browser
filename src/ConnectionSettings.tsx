import { useEffect, useState } from 'react';
import { AlertCircle, Check, Circle, Globe2, Radio, Router, Shield } from 'lucide-react';
import type { ConnectionMode, Settings } from './types';

type Props = {
  settings: Pick<Settings, 'connectionMode' | 'torSocksPort' | 'i2pHttpPort'>;
  onSettings: (patch: Partial<Settings>) => void;
  onConnection: (mode: Settings['connectionMode']) => void;
};
type Health = { available: boolean; port: number | null };
const modes: { id: ConnectionMode; name: string; subtitle: string; detail: string; icon: typeof Globe2 }[] = [
  { id: 'normal', name: 'Normal', subtitle: 'Conexão do sistema', detail: 'Usa a conexão e as configurações de proxy do Windows.', icon: Globe2 },
  { id: 'tor', name: 'Tor', subtitle: 'Proxy SOCKS5 local', detail: 'Encaminha o tráfego pelo serviço Tor em execução neste computador.', icon: Shield },
  { id: 'i2p', name: 'I2P', subtitle: 'Proxy HTTP local', detail: 'Acessa a rede I2P pelo roteador local. A web externa depende de um outproxy.', icon: Router },
];

export default function ConnectionSettings({ settings, onSettings, onConnection }: Props) {
  const [health, setHealth] = useState<Partial<Record<ConnectionMode, Health>>>({});
  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const results = await Promise.all((['normal', 'tor', 'i2p'] as ConnectionMode[]).map(async mode => {
        try { return [mode, await window.cypher.invoke('connection:check', mode)] as const; }
        catch { return [mode, { mode, available: false, port: null }] as const; }
      }));
      if (mounted) setHealth(Object.fromEntries(results));
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 8000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, [settings.torSocksPort, settings.i2pHttpPort]);

  return <section className="settings-card connection-settings">
    <div className="connection-heading"><div><h2><Radio size={18}/> Rotas de conexão</h2><p>Escolha o padrão para novas abas. Você também pode mudar a rota na barra do navegador.</p></div><span className="connection-native"><Circle size={7}/> PROXY LOCAL</span></div>
    <div className="connection-options">
      {modes.map(({ id, name, subtitle, detail, icon: Icon }) => {
        const selected = settings.connectionMode === id;
        const status = health[id];
        return <button key={id} className={`connection-option ${selected ? 'chosen' : ''}`} aria-pressed={selected} onClick={() => onConnection(selected && id !== 'normal' ? 'normal' : id)}>
          <span className="connection-option-icon"><Icon size={18}/></span><span className="connection-option-copy"><strong>{name}</strong><small>{subtitle}</small><span>{detail}</span></span>
          <span className={`connection-health ${status ? status.available ? 'available' : 'unavailable' : 'checking'}`}>
            {selected && <Check size={13}/>}<i/>{status ? status.available ? id === 'normal' ? 'Pronta' : `Ativo · ${status.port}` : id === 'normal' ? 'Padrão' : 'Serviço local ausente' : 'Verificando'}
          </span>
        </button>;
      })}
    </div>
    <div className="connection-ports">
      <label><span><strong>Porta SOCKS do Tor</strong><small>Usual: 9050 · Tor Browser: 9150</small></span><input type="number" min="1" max="65535" aria-label="Porta SOCKS do Tor" value={settings.torSocksPort} onChange={event => { const value = Number(event.target.value); if (value >= 1 && value <= 65535) onSettings({ torSocksPort: value }); }}/></label>
      <label><span><strong>Proxy HTTP do I2P</strong><small>Porta local usual: 4444</small></span><input type="number" min="1" max="65535" aria-label="Porta HTTP do I2P" value={settings.i2pHttpPort} onChange={event => { const value = Number(event.target.value); if (value >= 1 && value <= 65535) onSettings({ i2pHttpPort: value }); }}/></label>
    </div>
    <div className="connection-note"><AlertCircle size={15}/><p>Tor e I2P só são ativados após o Cypher confirmar o proxy local; falhas não passam para a conexão normal. A mudança se aplica a todas as abas abertas e pesquisas. Esta versão ainda exige que os serviços Tor/I2P estejam instalados e iniciados no computador. Abas dessas redes não entram no histórico nem são restauradas ao fechar.</p></div>
  </section>;
}
