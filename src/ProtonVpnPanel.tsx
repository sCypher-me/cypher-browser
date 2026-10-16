import { useEffect, useState } from 'react';
import { ArrowUpRight, Circle, ExternalLink, LoaderCircle, RefreshCw, ShieldCheck, UserRound, Wifi } from 'lucide-react';

type ProtonStatus = { bundled:boolean; available:boolean; active:boolean; connecting:boolean; server:string; version:string };
const emptyStatus: ProtonStatus = { bundled:true, available:false, active:false, connecting:false, server:'', version:'1.3.6' };

export default function ProtonVpnPanel() {
  const [status, setStatus] = useState<ProtonStatus>(emptyStatus);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const refresh = async () => {
    try { setStatus(await window.cypher.invoke('vpn:proton:status') as ProtonStatus); }
    catch { setNotice('Não foi possível consultar o painel Proton integrado.'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3000);
    return () => window.clearInterval(timer);
  }, []);

  const openPanel = async () => {
    setBusy(true); setNotice('');
    try { await window.cypher.invoke('vpn:proton:open'); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Não foi possível abrir o painel Proton.'); }
    finally { setBusy(false); void refresh(); }
  };

  const createAccount = async () => {
    try { await window.cypher.invoke('vpn:proton:account'); }
    catch { setNotice('Não foi possível abrir o cadastro gratuito da Proton.'); }
  };

  const verifyIp = async () => {
    try { await window.cypher.invoke('vpn:proton:verify'); }
    catch { setNotice('Não foi possível abrir a verificação de IP.'); }
  };

  const state = !status.available
    ? { label:'Painel embutido indisponível', detail:'Atualize ou reinstale o Cypher para restaurar o componente VPN integrado.', active:false }
    : status.connecting
      ? { label:'Conectando à Proton', detail:'O Cypher está bloqueando a navegação direta enquanto prepara o túnel.', active:false }
      : status.active
        ? { label:'Proxy Proton aplicado', detail:`As abas normais do Cypher estão configuradas para passar pelo servidor ${status.server || 'Proton'}.`, active:true }
        : { label:'Desconectada', detail:'O painel e as dependências estão prontos. Entre na sua conta grátis Proton para conectar.', active:false };

  return <section className="connection-proton-card" aria-labelledby="proton-vpn-heading">
    <div className="connection-proton-heading">
      <span className="connection-proton-mark"><ShieldCheck size={21}/></span>
      <div className="connection-proton-copy">
        <span className="eyebrow">VPN INTEGRADA · PLANO GRÁTIS</span>
        <h3 id="proton-vpn-heading">Proton VPN <span>Incluída no Cypher</span></h3>
        <p>O painel e o cliente de navegação Proton já vêm com o navegador. Não é preciso instalar outro aplicativo ou extensão.</p>
      </div>
      <span className={`connection-proton-state ${state.active ? 'active' : ''}`}><Circle size={7}/>{loading ? 'Verificando' : state.label}</span>
    </div>

    <div className="connection-proton-main">
      <div className="connection-proton-status">
        <span className={`connection-proton-status-icon ${state.active ? 'active' : ''}`}>{state.active ? <Wifi size={18}/> : <ShieldCheck size={18}/>}</span>
        <span><strong>{loading ? 'Preparando VPN do navegador…' : state.label}</strong><small>{loading ? 'Verificando a integração incluída na instalação.' : state.detail}</small></span>
      </div>
      <div className="connection-proton-actions">
        <button className="button primary" onClick={() => void openPanel()} disabled={busy || !status.available}>
          {busy ? <LoaderCircle size={15} className="spinning"/> : <ExternalLink size={15}/>}
          {busy ? 'Abrindo…' : status.active ? 'Abrir controle da VPN' : 'Abrir Proton VPN'}
          <ArrowUpRight size={13}/>
        </button>
        <button className="button secondary" onClick={() => void (status.active ? verifyIp() : createAccount())}>
          {status.active ? <Wifi size={14}/> : <UserRound size={14}/>}
          {status.active ? 'Verificar conexão' : 'Criar conta grátis'}
        </button>
        <button className="icon-button connection-proton-refresh" title="Atualizar estado da VPN" aria-label="Atualizar estado da VPN" onClick={() => { setLoading(true); void refresh(); }} disabled={loading}><RefreshCw size={15} className={loading ? 'spinning' : ''}/></button>
      </div>
    </div>

    {notice && <p className="connection-proton-notice" role="status">{notice}</p>}
    <div className="connection-proton-footnote"><ShieldCheck size={14}/><p>Uma conta Proton gratuita é necessária para autenticar e conectar. A VPN protege a navegação normal dentro do Cypher; ela não altera a conexão do Windows nem cobre outros aplicativos. O modo Tor/I2P continua usando a rede selecionada.</p></div>
  </section>;
}
