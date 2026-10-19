import { useEffect, useState } from 'react';
import { ArrowRight, Clock3, Eraser, FileUp, Globe2, LockKeyhole, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { SavedPassword } from '../types';
import { Block, Panel, Row, Switch } from '../settings-ui';
import ConnectionSettings from '../ConnectionSettings';
import SitePermissionsCenter from '../SitePermissionsCenter';
import PrivacyReport from '../PrivacyReport';
import { DiagnosticsPanel } from '../DiagnosticsPanel';
import { ContainersPanel, RoutesPanel } from '../CustomizationSettings';
import type { SectionProps } from './types';

function Passwords({ tabs, activeTabId, command, settings: s, onSettings }: SectionProps) {
  const [saved, setSaved] = useState<SavedPassword[]>([]);
  const [origin, setOrigin] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [never, setNever] = useState<string[]>([]);
  const [checkState, setCheckState] = useState('');
  const refresh = async () => {
    const entries = await command('password:list'); setSaved(Array.isArray(entries) ? entries : []);
    const blocked = await command('password:never:list'); setNever(Array.isArray(blocked) ? blocked : []);
  };
  const checkLeaks = async () => {
    setCheckState('Verificando…');
    const result = await command('password:check');
    setCheckState(result ? (result.leaked ? `${result.leaked} ${result.leaked === 1 ? 'senha apareceu' : 'senhas apareceram'} em vazamentos.` : 'Nenhuma senha apareceu em vazamentos conhecidos.') + (result.reused ? ` ${result.reused} usadas em mais de um site.` : '') : '');
    await refresh();
  };
  const importCsv = async () => {
    const result = await command('password:import');
    if (!result) return;
    setCheckState(`Importação: ${result.added} novas, ${result.updated} atualizadas${result.unchanged ? `, ${result.unchanged} iguais` : ''}${result.skipped ? `, ${result.skipped} ignoradas` : ''}. Apague o arquivo CSV: ele guarda as senhas sem proteção.`);
    await refresh();
  };
  const leakedCount = saved.filter(entry => entry.leaked > 0).length;
  useEffect(() => {
    void refresh().catch(() => setSaved([]));
    const current = tabs.find(tab => tab.id === activeTabId && /^https?:\/\//i.test(tab.url)) || [...tabs].reverse().find(tab => !tab.private && tab.connectionMode === 'normal' && /^https?:\/\//i.test(tab.url));
    if (current) { try { setOrigin(new URL(current.url).origin); } catch {} }
  }, []);
  const normalTabs = tabs.filter(tab => !tab.private && tab.connectionMode === 'normal');
  const preferredTab = normalTabs.find(tab => tab.id === activeTabId)?.id;

  return <Panel id="privacy-passwords" eyebrow="COFRE LOCAL" title="Senhas" detail="Criptografadas pelo Windows e preenchidas só no mesmo site. Nunca entram na sincronização." icon={LockKeyhole} wide>
    <Row id="privacy-password-offer" title="Oferecer para salvar ao entrar" detail="Pergunta depois que você faz login num site"><Switch label="Oferecer para salvar senhas" checked={s.passwordSavePrompt} onChange={() => onSettings({ passwordSavePrompt: !s.passwordSavePrompt })}/></Row>
    <Row title="Preencher logins salvos ao visitar" detail="Preenche campos vazios; nunca envia o formulário"><Switch label="Preenchimento automático de senhas" checked={s.passwordAutofillEnabled} onChange={() => onSettings({ passwordAutofillEnabled: !s.passwordAutofillEnabled })}/></Row>
    <Row id="privacy-password-leaks" title="Avisar sobre senhas vazadas" detail="Consulta o Have I Been Pwned sem enviar a senha: só 5 letras do hash saem do computador"><Switch label="Avisar sobre senhas vazadas" checked={s.passwordLeakCheck} onChange={() => { const next = !s.passwordLeakCheck; onSettings({ passwordLeakCheck: next }); if (next && saved.length) void checkLeaks(); }}/></Row>
    <Row id="privacy-password-import" title="Trazer senhas de outro navegador" detail="Arquivo CSV exportado pelo Chrome, Edge, Firefox, Brave, Bitwarden ou 1Password"><button type="button" className="sc-button sc-button-subtle" onClick={() => void importCsv()}>Importar CSV <FileUp size={13}/></button></Row>
    <form className="sc-password-form" onSubmit={async event => {
      event.preventDefault();
      if (!origin || !username.trim() || !password) return;
      setBusy(true);
      if (await command('password:save', { origin, username: username.trim(), password })) { setPassword(''); setUsername(''); await refresh(); }
      setBusy(false);
    }}>
      <label>Site<input className="sc-text-input" type="url" required value={origin} onChange={event => setOrigin(event.target.value)} placeholder="https://exemplo.com"/></label>
      <label>Usuário ou e-mail<input className="sc-text-input" autoComplete="username" required value={username} onChange={event => setUsername(event.target.value)} placeholder="nome@exemplo.com"/></label>
      <label>Senha<input className="sc-text-input" type={visible ? 'text' : 'password'} autoComplete="new-password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="Até 64 caracteres"/></label>
      <div className="sc-password-actions">
        <button type="button" className="sc-button sc-button-subtle" onClick={() => setVisible(value => !value)}>{visible ? 'Ocultar' : 'Revelar'}</button>
        <button type="button" className="sc-button sc-button-subtle" onClick={async () => { const generated = await command('password:generate', { length: 24 }); if (typeof generated === 'string') { setPassword(generated); setVisible(true); } }}>Gerar senha segura</button>
        <button type="button" className="sc-button sc-button-subtle" disabled={!password} onClick={() => void command('clipboard:write', password)}>Copiar</button>
        <span className="sc-password-strength">{password.length >= 20 ? 'Forte' : password.length >= 12 ? 'Boa' : password.length ? 'Fraca' : ''}</span>
        <button className="sc-button sc-button-primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar senha'} <LockKeyhole size={13}/></button>
      </div>
    </form>
    {checkState && <div className="sc-info-strip" role="status"><ShieldCheck size={15}/><span>{checkState}</span></div>}
    <div className="sc-password-list-heading"><strong>Logins guardados</strong><span>{saved.length}</span>{s.passwordLeakCheck && saved.length > 0 && <button type="button" className="sc-button sc-button-subtle sc-password-check" onClick={() => void checkLeaks()}>Verificar agora</button>}</div>
    {leakedCount > 0 && <div className="sc-info-strip sc-warning-strip"><ShieldAlert size={15}/><span>{leakedCount === 1 ? 'Uma senha salva apareceu' : `${leakedCount} senhas salvas apareceram`} em vazamentos. Troque nos sites marcados e salve a nova aqui.</span></div>}
    {saved.length ? <div className="sc-password-list">{saved.map(entry => {
      const matching = normalTabs.filter(tab => { try { return new URL(tab.url).origin === entry.origin; } catch { return false; } });
      return <div className="sc-password-entry" key={entry.id}><span className="sc-password-site"><strong>{entry.origin}</strong><small>{entry.username}{entry.leaked > 0 && <em className="sc-password-flag is-leaked">Vazada</em>}{entry.reused && <em className="sc-password-flag">Repetida</em>}</small></span><div className="sc-password-actions">{matching.length > 0 && <button className="sc-button sc-button-subtle" type="button" onClick={() => void command('password:fill', { id: entry.id, tabId: matching.find(tab => tab.id === preferredTab)?.id || matching[0].id })}>Preencher na aba</button>}<button className="sc-button sc-button-subtle" type="button" onClick={async () => { await command('password:delete', entry.id); await refresh(); }}>Remover</button></div></div>;
    })}</div> : <div className="sc-empty-line">Nenhuma senha salva ainda.</div>}
    {never.length > 0 && <>
      <div className="sc-password-list-heading"><strong>Nunca salvar em</strong><span>{never.length}</span></div>
      <div className="sc-password-list">{never.map(site => <div className="sc-password-entry" key={site}><span className="sc-password-site"><strong>{site}</strong></span><div className="sc-password-actions"><button className="sc-button sc-button-subtle" type="button" onClick={async () => { const left = await command('password:never:remove', site); if (Array.isArray(left)) setNever(left); }}>Voltar a oferecer</button></div></div>)}</div>
    </>}
  </Panel>;
}

export default function Privacy(props: SectionProps) {
  const { settings: s, onSettings, command, trackerProtection, privacyStats, sitePermissions, safeBrowsing } = props;
  const safeDetail = !safeBrowsing?.available ? 'Chega numa próxima compilação oficial' : safeBrowsing.ready ? `Google Safe Browsing · ${safeBrowsing.prefixes.toLocaleString('pt-BR')} registros na lista local` : s.safeBrowsing ? 'Baixando a lista local…' : 'Google Safe Browsing, sem enviar os endereços';
  return <>
    <Block id="privacy-report" title="Resumo da semana" wide><PrivacyReport stats={privacyStats} protection={trackerProtection}/></Block>

    <Panel id="privacy-blocking" eyebrow="BLOQUEIOS" title="O que o Cypher barra" icon={ShieldCheck}>
      <Row id="privacy-safe-browsing" title="Sites perigosos" detail={safeDetail}><Switch label="Avisar sobre sites perigosos" checked={s.safeBrowsing && !!safeBrowsing?.available} disabled={!safeBrowsing?.available} onChange={() => onSettings({ safeBrowsing: !s.safeBrowsing })}/></Row>
      <Row id="privacy-ad-block" title="Anúncios" detail="EasyList e domínios de publicidade"><Switch label="Bloquear anúncios" checked={s.blockAds} onChange={() => onSettings({ blockAds: !s.blockAds })}/></Row>
      <Row id="privacy-tracker-block" title="Rastreadores" detail={trackerProtection.available ? `${trackerProtection.networkRuleCount.toLocaleString('pt-BR')} regras EasyPrivacy` : (trackerProtection.error || 'Lista indisponível nesta compilação')}><Switch label="Bloqueio de rastreadores" checked={s.blockTrackers} disabled={!trackerProtection.available} onChange={() => onSettings({ blockTrackers: !s.blockTrackers })}/></Row>
      <Row id="privacy-popups" title="Pop-ups e pop-unders" detail="Permita sites pelo ícone ao lado do endereço"><Switch label="Bloquear pop-ups e pop-unders" checked={s.blockPopups} onChange={() => onSettings({ blockPopups: !s.blockPopups })}/></Row>
      <Row id="privacy-third-party-cookies" title="Cookies de terceiros"><Switch label="Bloquear cookies entre domínios" checked={s.blockThirdPartyCookies} onChange={() => onSettings({ blockThirdPartyCookies: !s.blockThirdPartyCookies })}/></Row>
      <Row id="privacy-cookie-banners" title="Avisos de cookies" detail="Esconde os banners de consentimento mais comuns"><Switch checked={s.blockCookieBanners} label="Ocultar avisos de cookies" onChange={() => onSettings({ blockCookieBanners: !s.blockCookieBanners })}/></Row>
      <Row id="privacy-do-not-track" title="Sinal Não rastrear" detail="Cada site decide se respeita"><Switch label="Enviar sinal Não rastrear" checked={s.sendDoNotTrack} onChange={() => onSettings({ sendDoNotTrack: !s.sendDoNotTrack })}/></Row>
      {!trackerProtection.adsAvailable && <div className="sc-info-strip sc-warning-strip"><ShieldCheck size={15}/><span>Esta compilação não trouxe a lista EasyList; só os domínios locais de anúncios estão bloqueados.</span></div>}
    </Panel>

    <Panel id="privacy-https" eyebrow="CONEXÃO" title="HTTPS" detail="Endereços da rede local e IPs ficam de fora." icon={LockKeyhole}>
      <div className="sc-radio-list" role="radiogroup" aria-label="Modo HTTPS">
        {([['upgrade', 'Tentar HTTPS primeiro', 'Usa a versão segura quando existe e volta para HTTP em silêncio quando não existe.'], ['strict', 'Somente HTTPS', 'Avisa antes de abrir qualquer página sem criptografia.'], ['off', 'Desligado', 'Abre os endereços exatamente como foram digitados.']] as const).map(([value, title, detail]) => <label className="sc-radio-option" key={value}><input type="radio" name="https-mode" checked={s.httpsMode === value} onChange={() => onSettings({ httpsMode: value })}/><span><strong>{title}</strong><small>{detail}</small></span></label>)}
      </div>
    </Panel>

    <Panel id="privacy-data" eyebrow="LIMPEZA" title="Dados de navegação" icon={Eraser}>
      <Row title="Cookies e dados dos sites" detail="Pode desconectar suas contas"><button className="sc-button sc-button-subtle" onClick={() => void command('data:clear')}>Limpar agora <ArrowRight size={13}/></button></Row>
      <Row id="privacy-history" title="Histórico" detail="Mantém os favoritos"><button className="sc-button sc-button-subtle" onClick={() => void command('history:clear')}>Limpar <Clock3 size={13}/></button></Row>
      <Row id="privacy-clear-exit" title="Limpar dados dos sites ao sair" detail="Sessões normal, Tor e I2P"><Switch label="Limpar dados dos sites ao sair" checked={s.clearDataOnExit} onChange={() => onSettings({ clearDataOnExit: !s.clearDataOnExit })}/></Row>
      <Row id="privacy-history-exit" title="Limpar histórico ao sair"><Switch label="Limpar histórico ao sair" checked={s.clearHistoryOnExit} onChange={() => onSettings({ clearHistoryOnExit: !s.clearHistoryOnExit })}/></Row>
      <Row id="privacy-private" title="Aba privada" detail="Sem histórico, sessão temporária"><button className="sc-button sc-button-subtle" onClick={() => void command('tab:new', { private: true })}>Abrir <LockKeyhole size={13}/></button></Row>
    </Panel>

    <Block id="connection-routes" title="Rotas Tor · I2P · VPN" wide><ConnectionSettings settings={s} onSettings={onSettings} onConnection={mode => { void command('connection:select', mode); }}/></Block>
    <RoutesPanel settings={s} onSettings={onSettings}/>
    <ContainersPanel settings={s} onSettings={onSettings}/>

    <Block id="site-permissions" title="Permissões de sites" wide><SitePermissionsCenter permissions={sitePermissions} command={command}/></Block>

    <Panel id="privacy-popup-exceptions" eyebrow="EXCEÇÕES" title="Pop-ups permitidos" icon={Globe2}>
      {s.popupExceptions.length ? s.popupExceptions.map(host => <Row key={host} title={host}><button className="sc-button sc-button-subtle" onClick={() => onSettings({ popupExceptions: s.popupExceptions.filter(item => item !== host) })}>Remover</button></Row>) : <div className="sc-empty-line">Nenhum site autorizado. Permita pelo ícone do bloqueador na barra de endereço.</div>}
    </Panel>

    <Passwords {...props}/>
    <DiagnosticsPanel settings={s} command={command} onSettings={onSettings}/>
  </>;
}
