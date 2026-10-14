import { useCallback, useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowUpRight, Circle, LoaderCircle, Power, RefreshCw, Settings2, ShieldCheck, Wifi } from 'lucide-react';

type VpnProfile = {
  name: string;
  serverAddress: string;
  tunnelType: string;
  connectionStatus: string;
  allUserConnection: boolean;
};
type VpnState = { supported: boolean; profiles: VpnProfile[] };

const statusLabel = (status: string) => {
  const value = status.toLowerCase();
  if (value === 'connected') return 'Conectada';
  if (value === 'connecting') return 'Conectando';
  if (value === 'disconnecting') return 'Desconectando';
  return 'Desconectada';
};

export default function WindowsVpnSettings() {
  const [vpn, setVpn] = useState<VpnState>({ supported: true, profiles: [] });
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const result = await window.cypher.invoke('vpn:list') as VpnState;
      setVpn(result);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(true), 7000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function configure() {
    setError('');
    try { await window.cypher.invoke('vpn:settings'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  }

  async function toggle(profile: VpnProfile) {
    const key = `${profile.allUserConnection ? 'shared' : 'user'}:${profile.name}`;
    const connected = profile.connectionStatus.toLowerCase() === 'connected';
    setPending(key);
    setNotice('');
    setError('');
    try {
      await window.cypher.invoke(connected ? 'vpn:disconnect' : 'vpn:connect', { name: profile.name, allUserConnection: profile.allUserConnection });
      setNotice(connected ? `Pedido de desconexão enviado para ${profile.name}.` : `O Windows abriu a conexão ${profile.name}. Conclua a autenticação na janela do sistema.`);
      if (connected) window.setTimeout(() => void refresh(true), 900);
      else window.setTimeout(() => void refresh(true), 1800);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPending(null);
    }
  }

  const connectedCount = vpn.profiles.filter(profile => profile.connectionStatus.toLowerCase() === 'connected').length;

  return <section className="settings-card windows-vpn-card">
    <div className="vpn-card-heading">
      <div className="vpn-title-mark"><ShieldCheck size={20}/></div>
      <div className="vpn-title-copy"><span className="eyebrow">CONEXÃO DO SISTEMA</span><h2>VPN nativa do Windows</h2><p>Conecte os perfis já configurados no Windows usando o cliente e a autenticação do próprio sistema.</p></div>
      <div className={`vpn-summary ${connectedCount ? 'is-connected' : ''}`}><i/>{connectedCount ? `${connectedCount} ativa${connectedCount > 1 ? 's' : ''}` : 'Desconectada'}</div>
    </div>

    <div className="vpn-toolbar">
      <span><Wifi size={14}/> O roteamento segue as regras do perfil VPN no Windows.</span>
      <div><button className="button secondary" onClick={() => void refresh()} disabled={loading}><RefreshCw size={14} className={loading ? 'vpn-spin' : ''}/> Atualizar</button><button className="button secondary" onClick={() => void configure()}><Settings2 size={14}/> Configurar no Windows <ArrowUpRight size={13}/></button></div>
    </div>

    {error && <div className="vpn-message vpn-error"><Circle size={13}/><span>{error}</span></div>}
    {notice && !error && <div className="vpn-message"><Circle size={13}/><span>{notice}</span></div>}

    {loading && !vpn.profiles.length ? <div className="vpn-empty"><LoaderCircle size={21} className="vpn-spin"/><span>Verificando perfis do Windows…</span></div>
      : vpn.profiles.length ? <div className="vpn-profile-list">{vpn.profiles.map(profile => {
        const key = `${profile.allUserConnection ? 'shared' : 'user'}:${profile.name}`;
        const status = profile.connectionStatus.toLowerCase();
        const connected = status === 'connected';
        const busy = pending === key || status === 'connecting' || status === 'disconnecting';
        return <article className={`vpn-profile ${connected ? 'profile-connected' : ''}`} key={key}>
          <div className="vpn-profile-icon">{connected ? <Wifi size={17}/> : <ShieldCheck size={17}/>}</div>
          <div className="vpn-profile-details"><strong>{profile.name}</strong><span>{profile.serverAddress || 'Servidor configurado pelo Windows'}</span></div>
          <span className="vpn-profile-type">{profile.tunnelType || 'VPN'} · {profile.allUserConnection ? 'Compartilhada' : 'Pessoal'}</span>
          <span className={`vpn-profile-status ${connected ? 'connected' : busy ? 'connecting' : ''}`}><i/>{statusLabel(status)}</span>
          <button className={`button ${connected ? 'secondary' : 'primary'} vpn-action`} onClick={() => void toggle(profile)} disabled={busy || (!!pending && pending !== key)}>
          {busy ? <LoaderCircle size={14} className="vpn-spin"/> : connected ? <Power size={14}/> : <ArrowDownToLine size={14}/>}{busy ? 'Aguarde' : connected ? 'Desconectar' : 'Conectar'}
          </button>
        </article>;
      })}</div>
      : <div className="vpn-empty"><div className="vpn-empty-icon"><ShieldCheck size={22}/></div><strong>Nenhum perfil VPN encontrado</strong><span>Adicione um perfil ou instale o aplicativo do seu provedor nas configurações do Windows. Depois, atualize esta lista.</span><button className="button primary" onClick={() => void configure()}><Settings2 size={14}/> Abrir configurações de VPN</button></div>}

    <div className="vpn-footnote"><ShieldCheck size={14}/><p>O Cypher não fornece servidores VPN nem armazena senhas. A disponibilidade e o alcance do túnel dependem do perfil, do provedor e das regras de roteamento configuradas no Windows.</p></div>
  </section>;
}
