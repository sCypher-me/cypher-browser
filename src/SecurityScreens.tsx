import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowLeft, Ban, Biohazard, CircleAlert, Frown, KeyRound, LockKeyholeOpen, RotateCw, Search, SearchX, ServerOff, ShieldAlert, TimerOff, Unplug, Waypoints, WifiOff, X } from 'lucide-react';
import type { PasswordPrompt, Tab, TabErrorKind } from './types';

type Act = (action: string, payload?: unknown) => Promise<unknown>;

const CERTIFICATE_REASONS: Record<number, string> = {
  [-200]: 'pertence a outro endereço',
  [-201]: 'está vencido ou ainda não começou a valer',
  [-202]: 'não foi emitido por uma autoridade confiável',
  [-203]: 'tem erros',
  [-206]: 'foi revogado por quem o emitiu',
  [-207]: 'é inválido',
};

interface ScreenCopy { eyebrow: string; title: ReactNode; body: ReactNode; icon: typeof CircleAlert; danger?: boolean; tips?: string[] }

const THREATS: Record<string, { title: string; body: (site: ReactNode) => ReactNode }> = {
  SOCIAL_ENGINEERING: { title: 'Site enganoso à frente.', body: site => <>{site} pode tentar fazer você instalar programas perigosos ou entregar senhas, cartões e dados pessoais.</> },
  MALWARE: { title: 'Este site pode infectar o computador.', body: site => <>{site} pode instalar programas que roubam ou apagam informações do seu computador.</> },
  UNWANTED_SOFTWARE: { title: 'Este site oferece programas indesejados.', body: site => <>{site} pode tentar instalar programas que mudam o navegador ou exibem anúncios sem pedir.</> },
  POTENTIALLY_HARMFUL_APPLICATION: { title: 'Este site distribui aplicativos nocivos.', body: site => <>Os aplicativos oferecidos por {site} podem ser perigosos.</> },
};

function copyFor(kind: TabErrorKind, host: string, code: number, fallback: string, threat = ''): ScreenCopy {
  const site = <strong>{host || 'este site'}</strong>;
  switch (kind) {
    case 'dangerous': { const known = THREATS[threat] || { title: 'Site perigoso à frente.', body: (where: ReactNode) => <>O Google Safe Browsing marcou {where} como perigoso.</> }; return { eyebrow: 'SITE PERIGOSO', icon: Biohazard, danger: true, title: known.title, body: known.body(site) }; }
    case 'certificate': return { eyebrow: 'CONEXÃO NÃO PRIVADA', icon: ShieldAlert, danger: true, title: 'Esta conexão não é segura.', body: <>Alguém pode estar tentando se passar por {site} para roubar senhas, mensagens ou cartões. O certificado de segurança do site {CERTIFICATE_REASONS[code] || 'não pôde ser verificado'}.</> };
    case 'https': return { eyebrow: 'SEM HTTPS', icon: LockKeyholeOpen, danger: true, title: 'Este site não oferece conexão segura.', body: <>O modo somente HTTPS tentou abrir {site} com criptografia, mas o site não respondeu assim. Se continuar, o que você enviar poderá ser visto por outras pessoas na rede.</> };
    case 'ssl': return { eyebrow: 'FALHA NA CRIPTOGRAFIA', icon: ShieldAlert, danger: true, title: 'Não deu para criar uma conexão segura.', body: <>{site} usa uma configuração de segurança antiga ou incompatível. Não há como abrir a página com proteção.</>, tips: ['Confira se a data e a hora do Windows estão certas.', 'Se for um site da sua empresa, avise o suporte.'] };
    case 'dns': return { eyebrow: 'ENDEREÇO NÃO ENCONTRADO', icon: SearchX, title: <>Não encontramos {host || 'esse site'}.</>, body: 'O endereço pode estar escrito errado ou o site saiu do ar.', tips: ['Confira a grafia do endereço.', 'Teste outra rede ou desligue a VPN.'] };
    case 'offline': return { eyebrow: 'SEM INTERNET', icon: WifiOff, title: 'Você está sem internet.', body: 'Assim que a conexão voltar, a página recarrega sozinha.', tips: ['Confira o Wi-Fi ou o cabo de rede.', 'Reinicie o roteador se nada abrir.'] };
    case 'refused': return { eyebrow: 'SEM RESPOSTA', icon: ServerOff, title: <>{host || 'O site'} recusou a conexão.</>, body: 'O servidor está fora do ar ou bloqueando o acesso.', tips: ['Tente de novo em alguns minutos.', 'Se usa proxy ou firewall, confira se ele libera este site.'] };
    case 'timeout': return { eyebrow: 'TEMPO ESGOTADO', icon: TimerOff, title: <>{host || 'O site'} demorou demais.</>, body: 'A página não respondeu a tempo. Pode ser lentidão do site ou da sua rede.' };
    case 'network': return { eyebrow: 'CONEXÃO INTERROMPIDA', icon: Unplug, title: 'A conexão caiu no meio do caminho.', body: 'A rede mudou ou o site encerrou a conexão antes de terminar.' };
    case 'blocked': return { eyebrow: 'BLOQUEADO PELO CYPHER', icon: Ban, title: 'Esta página foi bloqueada.', body: <>{site} está nas listas de anúncios ou rastreadores que o Cypher barra.</> };
    case 'crashed': return { eyebrow: 'PÁGINA ENCERRADA', icon: Frown, title: 'A página parou de funcionar.', body: 'Ela travou ou usou memória demais. As outras abas continuam abertas.' };
    case 'route': return { eyebrow: 'ROTA DE CONEXÃO', icon: Waypoints, title: 'Esta rota não abre aqui.', body: fallback };
    default: return { eyebrow: 'FALHA AO CARREGAR', icon: CircleAlert, title: 'Não chegamos a esse lugar.', body: 'Confira o endereço e sua conexão, depois tente novamente.' };
  }
}

export function ErrorScreen({ tab, act, onSettings, trackingExceptions }: { tab: Tab; act: Act; onSettings: (patch: { trackingExceptions: string[] }) => void; trackingExceptions: string[] }) {
  const info = tab.errorInfo;
  const kind: TabErrorKind = info?.kind || 'generic';
  const host = info?.host || '';
  const copy = copyFor(kind, host, info?.code || 0, tab.error || '', info?.threat);
  const Icon = copy.icon;
  const primary = useRef<HTMLButtonElement>(null);
  useEffect(() => { primary.current?.focus({ preventScroll: true }); }, [tab.id, kind]);
  useEffect(() => {
    if (kind !== 'offline') return;
    const online = () => void act('reload');
    window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, [kind, tab.id]);
  const back = () => void act('security:back', { tabId: tab.id });
  const retry = () => void act('reload');
  return <div className="error-page sec-screen" data-tone={copy.danger ? 'danger' : 'neutral'} data-kind={kind} role="alert">
    <div className="sec-card">
      <span className="sec-mark"><Icon size={30}/></span>
      <span className="sec-eyebrow">{copy.eyebrow}</span>
      <h1>{copy.title}</h1>
      <p className="sec-body">{copy.body}</p>
      {copy.tips && <ul className="sec-tips">{copy.tips.map(tip => <li key={tip}>{tip}</li>)}</ul>}
      <div className="sec-actions">
        {copy.danger
          ? <button ref={primary} type="button" className="sec-btn sec-btn-primary" onClick={back}><ArrowLeft size={15}/> Voltar para a segurança</button>
          : <button ref={primary} type="button" className="sec-btn sec-btn-primary" onClick={retry}><RotateCw size={15}/> Tentar novamente</button>}
        {kind === 'dns' && host && <button type="button" className="sec-btn" onClick={() => void act('navigate', host)}><Search size={15}/> Pesquisar “{host}”</button>}
        {kind === 'blocked' && host && <button type="button" className="sec-btn" onClick={() => { onSettings({ trackingExceptions: [...new Set([...trackingExceptions, host])] }); setTimeout(retry, 120); }}>Permitir neste site</button>}
        {!copy.danger && tab.canGoBack && <button type="button" className="sec-btn" onClick={back}><ArrowLeft size={15}/> Voltar</button>}
      </div>
      <details className="sec-details">
        <summary>Detalhes técnicos</summary>
        <code>{info?.name ? `${info.name} (${info.code})` : tab.error}</code>
        {info?.url && <code className="sec-url">{info.url}</code>}
        {kind === 'certificate' && <p>Só continue se você conhece este site e sabe por que o certificado falhou (por exemplo, um equipamento da sua rede). A liberação vale até fechar o Cypher.</p>}
        {kind === 'https' && <p>A versão sem criptografia fica liberada para {host} até fechar o Cypher.</p>}
        {kind === 'dangerous' && <p>Aviso do Google Safe Browsing. O endereço não sai do computador: o Cypher compara pedaços de hash com uma lista local. Se você confia neste site, pode abri-lo até fechar o Cypher.</p>}
        {(kind === 'certificate' || kind === 'https' || kind === 'dangerous') && <button type="button" className="sec-link-danger" onClick={() => void act('security:proceed', { tabId: tab.id })}>{kind === 'certificate' ? `Continuar para ${host} (não seguro)` : kind === 'dangerous' ? `Ignorar o aviso e abrir ${host}` : `Abrir ${host} sem HTTPS`}</button>}
      </details>
    </div>
  </div>;
}

/** Barra acima da página: aparece depois do login, sem cobrir o site. */
export function PasswordPromptBar({ prompt, act, notify }: { prompt: PasswordPrompt; act: Act; notify: (message: string) => void }) {
  const [username, setUsername] = useState(prompt.username);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setUsername(prompt.username); }, [prompt.id]);
  const site = (() => { try { return new URL(prompt.origin).hostname.replace(/^www\./, ''); } catch { return prompt.origin; } })();
  const save = async () => {
    if (!username.trim()) { notify('Informe o usuário ou e-mail desta conta.'); return; }
    setBusy(true);
    try { if (await act('password:prompt:save', { id: prompt.id, username: username.trim() })) notify(prompt.update ? 'Senha atualizada no cofre.' : 'Senha salva no cofre.'); }
    finally { setBusy(false); }
  };
  return <form className="pw-bar" role="dialog" aria-label={prompt.update ? 'Atualizar senha salva' : 'Salvar senha'} onSubmit={event => { event.preventDefault(); void save(); }}>
    <span className="pw-bar-mark"><KeyRound size={16}/></span>
    <div className="pw-bar-copy">
      <strong>{prompt.update ? `Atualizar a senha de ${site}?` : `Salvar a senha de ${site}?`}</strong>
      <small>{prompt.leaked > 0 ? <span className="pw-bar-leak">Atenção: esta senha apareceu em {prompt.leaked.toLocaleString('pt-BR')} vazamentos. Troque-a no site.</span> : 'Fica no cofre local, criptografada pelo Windows.'}</small>
    </div>
    <label className="pw-bar-user"><span>Usuário</span><input aria-label="Usuário ou e-mail" value={username} onChange={event => setUsername(event.target.value)} placeholder="nome@exemplo.com" maxLength={256} spellCheck={false}/></label>
    <div className="pw-bar-actions">
      <button type="submit" className="sec-btn sec-btn-primary" disabled={busy}>{prompt.update ? 'Atualizar' : 'Salvar'}</button>
      {!prompt.update && <button type="button" className="sec-btn" onClick={() => void act('password:prompt:never', { id: prompt.id })}>Nunca neste site</button>}
      <button type="button" className="pw-bar-close" aria-label="Agora não" title="Agora não" onClick={() => void act('password:prompt:dismiss', { id: prompt.id })}><X size={15}/></button>
    </div>
  </form>;
}
