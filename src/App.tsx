import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, Plus, X, Minus, Square, Copy, Search, Star, Download, Clock3, SlidersHorizontal, Home, Puzzle, PanelLeftClose, PanelLeftOpen, Shield, ShieldCheck, Globe2, ChevronRight, ChevronDown, MoreHorizontal, ArrowUpRight, Pin, Volume2, VolumeX, Trash2, Upload, Check, ExternalLink, FolderOpen, Pause, Play, ScanLine, Command, LockKeyhole, Sparkles, Monitor, LayoutList, Grid2X2, Maximize, Printer, Code2, Save, CheckCircle2, AlertCircle, Github, Youtube, Headphones, MessageCircle, UserRound, ImagePlus, Music2, SkipBack, SkipForward } from 'lucide-react';
import type { BrowserState, ConnectionMode, Settings, Tab } from './types';
import { cn } from './lib/cn';
import { defaultHome } from '../electron/home-layout.mjs';
import HomePage from './HomePage';
import ConnectionSettings from './ConnectionSettings';
import SettingsCenter from './SettingsCenter';
import ExtensionsPage from './ExtensionsPage';
import SitePermissionsCenter from './SitePermissionsCenter';
import ProfileSyncPanel from './ProfileSyncPanel';
import './browser-features.css';

const initial: BrowserState = { tabs: [], activeId: '', settings: { tabPosition: 'side', sidebarWidth: 248, appearanceMode: 'dark', accent: '#b6f36a', surface: '#111513', background: '#090c0b', radius: 14, font: 'system', wallpaper: 'orbital', wallpaperImageData: '', buttonShape: 'soft', interfaceEffect: 'signal', soundEffectsEnabled: false, soundTheme: 'cypher', backgroundMusicData: '', backgroundMusicName: '', backgroundMusicEnabled: false, motion: true, compact: false, searchEngine: 'duckduckgo', customSearchUrl: '', activeMod: 'cypher-original', connectionMode: 'normal', torSocksPort: 9050, i2pHttpPort: 4444, profilePhoto: '', restoreSession: false, startupMode: 'home', startupPages: [], showHomeFirst: false, openLinksInNewTab: true, showSearchSuggestions: true, sendDoNotTrack: false, blockAds: false, blockTrackers: true, blockThirdPartyCookies: false, preferredLanguages: ['pt-BR','en-US'], spellCheckEnabled: true, spellCheckLanguages: ['pt-BR'], translationEnabled: true, hardwareAcceleration: true, webrtcPolicy: 'default', showBookmarksBar: false, suggestBookmarks: true, suggestHistory: true, clearDataOnExit: false, clearHistoryOnExit: false, confirmCloseWithMultipleTabs: false, defaultZoom: 1, downloadDirectory: '', startWithWindows: false, home: defaultHome }, bookmarks: [], history: [], downloads: [], extensions: [], sitePermissions: [], mods: [], maximized: false, hardwareAccelerationPending: false, homeData: { notes: {}, focus: { endsAt: null, remaining: 1500, duration: 1500 }, tasksById: {} }, update: { state: 'unconfigured', currentVersion: '0.7.4', version: '', progress: 0, message: '', releaseNotes: '', repository: '' }, trackerProtection: { available: false, name: 'EasyPrivacy', source: 'https://easylist.to/easylist/easyprivacy.txt', lastModified: '', networkRuleCount: 0, blockedRequests: 0, error: 'A lista EasyPrivacy ainda não foi carregada.' } };
const pageLabels: Record<string, string> = { settings: 'Configurações', security: 'Segurança', extensions: 'Extensões', profile: 'Perfil', mods: 'Mods', bookmarks: 'Favoritos', history: 'Histórico', downloads: 'Downloads' };
const size = (bytes: number) => bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
const date = (value: number) => new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const mediaTime = (value: number) => { if (!Number.isFinite(value) || value < 0) return '0:00'; const minutes = Math.floor(value / 60); return `${minutes}:${Math.floor(value % 60).toString().padStart(2, '0')}`; };
function hostname(url: string) { try { return new URL(url).hostname; } catch { return url; } }

function IconButton({ label, children, onClick, active, disabled, className = '' }: { label: string; children: ReactNode; onClick?: () => void; active?: boolean; disabled?: boolean; className?: string }) {
  return <button className={cn("icon-button", active && "active", className)} title={label} aria-label={label} onClick={onClick} disabled={disabled}>{children}</button>;
}


export default function App() {
  const [state, setState] = useState(initial);
  const [address, setAddress] = useState('');
  const [addressFocus, setAddressFocus] = useState(false);
  const [menu, setMenu] = useState(false);
  const [tabMenu, setTabMenu] = useState<string | null>(null);
  const [find, setFind] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [toast, setToast] = useState('');
  const [pageFullscreen, setPageFullscreen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [backgroundPosition, setBackgroundPosition] = useState(0);
  const addressRef = useRef<HTMLInputElement>(null), findRef = useRef<HTMLInputElement>(null), viewportRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const musicRef = useRef<HTMLAudioElement>(null);
  const soundContext = useRef<AudioContext | null>(null);
  const tab = state.tabs.find(t => t.id === state.activeId);
  const page = tab?.url.startsWith('cypher://') ? tab.url.slice(9) : null;
  const s = state.settings, isSide = s.tabPosition === 'side';
  const pageMedia = state.nowPlaying || null;
  const backgroundSelected = s.backgroundMusicEnabled || (!pageMedia && !!s.backgroundMusicData);
  const playerTitle = backgroundSelected ? s.backgroundMusicName || 'Música de fundo' : pageMedia?.title || '';
  const playerArtist = backgroundSelected ? 'Faixa local do Cypher' : pageMedia?.artist || hostname(pageMedia?.pageUrl || '');
  const playerPlaying = backgroundSelected ? s.backgroundMusicEnabled : !!pageMedia?.playing;
  const playerDuration = backgroundSelected ? musicRef.current?.duration || 0 : pageMedia?.duration || 0;
  const playerPosition = backgroundSelected ? backgroundPosition : pageMedia?.currentTime || 0;
  const overlay = menu || !!tabMenu || addressFocus;
  function notify(message: string) { setToast(message); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 4500); }
  async function act(action: string, payload?: unknown) {
    try { return await window.cypher.invoke(action, payload); }
    catch (error) { notify(String(error instanceof Error ? error.message : error).replace(/^Error invoking remote method '[^']+': Error: /, '')); }
  }
  function openPage(name: string) {
    setMenu(false); setTabMenu(null); setAddressFocus(false); setFind(false); setFilter('');
    const existing = state.tabs.find(t => t.url === `cypher://${name}` && !t.private);
    void act(existing ? 'tab:select' : 'tab:new', existing ? existing.id : { url: `cypher://${name}` });
  }
  function navigate(value: string) { setMenu(false); setTabMenu(null); setAddressFocus(false); addressRef.current?.blur(); void act('navigate', value); }
  const settings = (patch: Partial<Settings>) => { void act('settings', patch); };
  async function chooseProfilePhoto() { const photo = await act('profile:photo:select'); if (typeof photo === 'string') settings({ profilePhoto:photo }); }
  useEffect(() => {
    if (!window.cypher) { setToast('Abra o Cypher pelo aplicativo desktop para navegar.'); return; }
    const off = window.cypher.onState(setState);
    void window.cypher.invoke('state').then(setState);
    return () => { off(); clearTimeout(toastTimer.current); };
  }, []);
  useEffect(() => {
    if (state.update.state !== 'complete') return;
    const timer = setTimeout(() => { void act('update:ack'); }, 4200);
    return () => clearTimeout(timer);
  }, [state.update.state, state.update.version]);
  useEffect(() => { setAddress(tab?.url === 'cypher://newtab' ? '' : tab?.url || ''); setFind(false); setQuery(''); setFilter(''); }, [tab?.id, tab?.url]);
  useEffect(() => {
    if (!window.cypher) return;
    return window.cypher.onShortcut(action => {
      if (action === 'address') { setAddressFocus(true); addressRef.current?.focus(); addressRef.current?.select(); }
      if (action === 'find') { setFind(true); setTimeout(() => findRef.current?.focus(), 0); }
      if (action === 'escape') { setMenu(false); setTabMenu(null); setAddressFocus(false); setFind(false); void act('find', { text: '' }); }
      if (action === 'page-fullscreen') setPageFullscreen(true);
      if (action === 'leave-fullscreen') setPageFullscreen(false);
    });
  }, []);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenu(false); setTabMenu(null); setAddressFocus(false); setFind(false); addressRef.current?.blur(); void act('find', { text: '' }); }
    };
    window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener);
  }, []);
  useEffect(() => {
    const listener = (event: MouseEvent) => {
      if (!s.soundEffectsEnabled) return;
      const target = event.target instanceof Element ? event.target.closest('button,[role="button"]') : null;
      if (!target || target.hasAttribute('disabled') || target.getAttribute('aria-disabled') === 'true') return;
      try {
        const AudioContextCtor = window.AudioContext;
        const context = soundContext.current ||= new AudioContextCtor();
        if (context.state === 'suspended') void context.resume();
        const oscillator = context.createOscillator(), gain = context.createGain();
        const start = context.currentTime;
        const arcade = s.soundTheme === 'arcade';
        oscillator.type = arcade ? 'square' : s.soundTheme === 'soft' ? 'sine' : 'triangle';
        oscillator.frequency.setValueAtTime(arcade ? 520 : s.soundTheme === 'soft' ? 440 : 620, start);
        oscillator.frequency.exponentialRampToValueAtTime(arcade ? 740 : 360, start + (arcade ? .08 : .055));
        gain.gain.setValueAtTime(.0001, start); gain.gain.exponentialRampToValueAtTime(.022, start + .008); gain.gain.exponentialRampToValueAtTime(.0001, start + .09);
        oscillator.connect(gain); gain.connect(context.destination); oscillator.start(start); oscillator.stop(start + .1);
      } catch {}
    };
    document.addEventListener('click', listener, true);
    return () => document.removeEventListener('click', listener, true);
  }, [s.soundEffectsEnabled, s.soundTheme]);
  useEffect(() => {
    const audio = musicRef.current;
    if (!audio) return;
    audio.pause();
    audio.src = s.backgroundMusicData || '';
    audio.loop = true;
    audio.load();
  }, [s.backgroundMusicData]);
  useLayoutEffect(() => {
    const element = viewportRef.current; if (!element || !window.cypher) return;
    function sync() { const r = element!.getBoundingClientRect(); void act('viewport', { x: r.x, y: r.y, width: r.width, height: r.height, obscured: overlay }); }
    sync(); const observer = new ResizeObserver(sync); observer.observe(element);
    window.addEventListener('resize', sync); return () => { observer.disconnect(); window.removeEventListener('resize', sync); };
  }, [overlay, s.tabPosition, s.compact, s.sidebarWidth, find, pageFullscreen, tab?.id]);
  const style = { '--accent': s.accent, '--surface': s.surface, '--base': s.background, '--radius': `${s.radius}px`, '--sidebar': `${s.compact ? 76 : s.sidebarWidth}px`, '--font': s.font === 'mono' ? 'Consolas, monospace' : '"Segoe UI Variable Text", "Segoe UI", sans-serif' } as CSSProperties;
  const suggestionSources = [...(s.suggestBookmarks ? state.bookmarks : []), ...(s.suggestHistory ? state.history : [])];
  const suggestions = suggestionSources.filter((link, index, arr) => arr.findIndex(l => l.url === link.url) === index && (link.title + link.url).toLowerCase().includes(address.toLowerCase())).slice(0,5);
  function TabItem({ item }: { item: Tab }) {
    return <div className={`tab ${item.id === state.activeId ? 'selected' : ''} ${item.private ? 'private-tab' : ''}`} draggable onDragStart={event => event.dataTransfer.setData('text/cypher-tab', item.id)} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); void act('tab:move', { from: event.dataTransfer.getData('text/cypher-tab'), to: item.id }); }} onContextMenu={event => { event.preventDefault(); setTabMenu(item.id); }}>
      <button className="tab-main" title={item.title} onClick={() => { setTabMenu(null); void act('tab:select', item.id); }} onAuxClick={event => { if (event.button === 1) void act('tab:close', item.id); }}>
        <span className={`tab-symbol ${item.loading ? 'spinning' : ''}`}>{item.loading ? <RotateCw size={15} /> : item.private ? <Shield size={16} /> : item.url === 'cypher://newtab' ? <Logo small /> : item.pinned ? <Pin size={15} /> : <Globe2 size={16} />}</span><span className="tab-label">{item.title}</span>
      </button>
      {(item.audible || item.muted) && <button className="tab-close" title="Ativar ou silenciar áudio" aria-label="Ativar ou silenciar áudio" onClick={() => act('tab:mute', item.id)}>{item.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}</button>}
      <button className="tab-close close-tab" title="Fechar aba" aria-label={`Fechar ${item.title}`} onClick={() => act('tab:close', item.id)}><X size={13} /></button>
    </div>;
  }
  async function togglePlayer() {
    if (backgroundSelected || !pageMedia) {
      const audio = musicRef.current;
      if (!s.backgroundMusicData || !audio) { setMediaOpen(false); openPage('settings'); notify('Escolha uma faixa em Configurações → Aparência.'); return; }
      if (audio.paused) {
        try { await audio.play(); settings({ backgroundMusicEnabled: true }); }
        catch { notify('Não foi possível reproduzir este arquivo de áudio.'); }
      } else { audio.pause(); settings({ backgroundMusicEnabled: false }); }
      return;
    }
    await act('media:control', { tabId: pageMedia.tabId, action: pageMedia.playing ? 'pause' : 'play' });
  }
  function seekPlayer(value: number) {
    if (backgroundSelected) { if (musicRef.current) musicRef.current.currentTime = value; setBackgroundPosition(value); }
    else if (pageMedia) void act('media:control', { tabId: pageMedia.tabId, action: 'seek', value });
  }
  const nav = [{ key: 'newtab', icon: Home, title: 'Home' }, { key: 'bookmarks', icon: Star, title: 'Favoritos' }, { key: 'history', icon: Clock3, title: 'Histórico' }, { key: 'downloads', icon: Download, title: 'Downloads' }, { key: 'extensions', icon: Puzzle, title: 'Extensões' }, { key: 'mods', icon: Sparkles, title: 'Mods' }];
  return <div className={`app ${isSide ? 'side-tabs' : 'top-tabs'} ${s.compact ? 'compact' : ''} ${!s.motion ? 'no-motion' : ''} ${pageFullscreen ? 'page-fullscreen' : ''}`} data-appearance={s.appearanceMode} data-button-shape={s.buttonShape} data-interface-effect={s.interfaceEffect} style={style}>
    <header className="titlebar">
      <div className="brand"><Logo /><span>CYPHER</span></div>
      <div className="titlebar-right"><span className="alpha-tag">PREVIEW 04</span><IconButton label="Minimizar" onClick={() => act('window:minimize')}><Minus size={15}/></IconButton><IconButton label={state.maximized ? 'Restaurar janela' : 'Maximizar'} onClick={() => act('window:maximize')}>{state.maximized ? <Copy size={13}/> : <Square size={13}/>}</IconButton><IconButton className="window-close" label="Fechar navegador" onClick={() => act('window:close')}><X size={17}/></IconButton></div>
    </header>
    <div className="browser-body">
      <nav className="rail" aria-label="Navegação do Cypher"><div className="rail-top"><div className="rail-monogram">C<span>_</span></div>{nav.map(({ key, icon: Icon, title }) => <IconButton key={key} label={title} active={page === key} onClick={() => openPage(key)}><Icon size={19}/>{key === 'downloads' && state.downloads.some(d => d.state === 'progressing') && <i className="notification-dot"/>}</IconButton>)}</div><div className="rail-bottom"><IconButton label="Segurança" active={page === 'security'} onClick={() => openPage('security')}><ShieldCheck size={19}/></IconButton><IconButton label="Configurações" active={page === 'settings'} onClick={() => openPage('settings')}><SlidersHorizontal size={19}/></IconButton><button type="button" className={cn('profile-avatar',page === 'profile' && 'active')} title="Perfil" aria-label="Perfil" onClick={() => openPage('profile')}>{s.profilePhoto ? <img src={s.profilePhoto} alt=""/> : <span>EU</span>}</button></div></nav>
      {isSide && <aside className="tab-sidebar"><div className="workspace-heading"><div className="workspace-mark"><ScanLine size={18}/></div><div className="workspace-text"><strong>Espaço pessoal</strong><span>PERFIL LOCAL</span></div><IconButton label={s.compact ? 'Expandir abas' : 'Recolher abas'} onClick={() => settings({ compact: !s.compact })}>{s.compact ? <PanelLeftOpen size={16}/> : <PanelLeftClose size={16}/>}</IconButton></div><div className="tabs-heading"><span>ABAS ABERTAS</span><span>{state.tabs.length.toString().padStart(2,'0')}</span></div><div className="tabs-list">{state.tabs.filter(t => t.pinned).map(item => <TabItem key={item.id} item={item}/>)}{state.tabs.filter(t => !t.pinned).map(item => <TabItem key={item.id} item={item}/>)}</div><button className="new-tab-button" onClick={() => act('tab:new')}><Plus size={17}/><span>Nova aba</span><kbd>Ctrl T</kbd></button><div className="sidebar-spacer"/></aside>}
      <main className="main-shell">
        {!isSide && <div className="horizontal-tabs">{state.tabs.map(item => <TabItem key={item.id} item={item}/>)}<IconButton label="Nova aba" onClick={() => act('tab:new')}><Plus size={17}/></IconButton></div>}
        <div className="toolbar"><div className="navigation-controls"><IconButton label="Voltar · Alt ←" disabled={!tab?.canGoBack} onClick={() => act('back')}><ArrowLeft size={18}/></IconButton><IconButton label="Avançar · Alt →" disabled={!tab?.canGoForward} onClick={() => act('forward')}><ArrowRight size={18}/></IconButton><IconButton label={tab?.loading ? 'Parar carregamento' : 'Recarregar · Ctrl R'} onClick={() => act(tab?.loading ? 'stop' : 'reload')}>{tab?.loading ? <X size={17}/> : <RotateCw size={17}/>}</IconButton></div>
          <form className={`addressbar ${addressFocus ? 'focused' : ''}`} onSubmit={event => { event.preventDefault(); navigate(address); }}><span className="address-status" title={page ? 'Página interna do Cypher' : tab?.url.startsWith('https:') ? 'Conexão HTTPS' : 'Conexão sem HTTPS'}>{page ? <Command size={15}/> : tab?.url.startsWith('https:') ? <LockKeyhole size={14}/> : <AlertCircle size={14}/>}</span><input ref={addressRef} aria-label="Endereço ou pesquisa" placeholder="Pesquise ou digite um endereço" value={address} onChange={event => setAddress(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); navigate(event.currentTarget.value); } }} onFocus={() => setAddressFocus(true)} onBlur={() => setTimeout(() => setAddressFocus(false), 120)} spellCheck={false}/>{tab?.private && <span className="private-badge"><Shield size={12}/> Privada</span>}<IconButton label="Favoritar esta página · Ctrl D" disabled={!!page} active={state.bookmarks.some(b => b.url === tab?.url)} onClick={() => act('bookmark:toggle')}><Star size={16}/></IconButton></form>
          <div className={`connection-launchers route-${tab?.connectionMode || s.connectionMode}`} role="group" aria-label="Selecionar rede de conexão">
            <button type="button" className={(tab?.connectionMode || s.connectionMode) === 'normal' ? 'active' : ''} aria-pressed={(tab?.connectionMode || s.connectionMode) === 'normal'} onClick={() => { setAddressFocus(false); void act('connection:select','normal'); }} title="Usar a conexão normal do sistema"><Globe2 size={14}/><span>Normal</span></button>
            <button type="button" className={(tab?.connectionMode || s.connectionMode) === 'tor' ? 'active' : ''} aria-pressed={(tab?.connectionMode || s.connectionMode) === 'tor'} onClick={() => { setAddressFocus(false); void act('connection:select',(tab?.connectionMode || s.connectionMode) === 'tor' ? 'normal' : 'tor'); }} title="Iniciar Tor · Todas as abas serão movidas para essa rota"><Shield size={14}/><span>{(tab?.connectionMode || s.connectionMode) === 'tor' ? 'Tor ativo' : 'Iniciar Tor'}</span></button>
            <button type="button" className={(tab?.connectionMode || s.connectionMode) === 'i2p' ? 'active' : ''} aria-pressed={(tab?.connectionMode || s.connectionMode) === 'i2p'} onClick={() => { setAddressFocus(false); void act('connection:select',(tab?.connectionMode || s.connectionMode) === 'i2p' ? 'normal' : 'i2p'); }} title="Iniciar I2P · Todas as abas serão movidas para essa rota"><Globe2 size={14}/><span>{(tab?.connectionMode || s.connectionMode) === 'i2p' ? 'I2P ativo' : 'Iniciar I2P'}</span></button>
          </div>
          <IconButton label={pageMedia?.playing ? `Abrir miniplayer · ${pageMedia.title}` : 'Abrir miniplayer'} active={!!pageMedia?.playing || s.backgroundMusicEnabled} onClick={() => setMediaOpen(true)}><Music2 size={17}/></IconButton>
          <audio ref={musicRef} preload="none" aria-hidden="true" onTimeUpdate={event => setBackgroundPosition(event.currentTarget.currentTime)} />
          <IconButton label="Personalizar Cypher" onClick={() => openPage('settings')}><SlidersHorizontal size={18}/></IconButton><IconButton label="Menu do navegador" active={menu} onClick={() => { setMenu(!menu); setAddressFocus(false); }}><MoreHorizontal size={21}/></IconButton>
        </div>
        {s.showBookmarksBar && <div className="bookmarks-bar" aria-label="Barra de favoritos"><div className="bookmarks-items">{state.bookmarks.length ? state.bookmarks.slice(0, 12).map(bookmark => <button type="button" className="bookmark-chip" key={bookmark.id} title={bookmark.url} onClick={() => navigate(bookmark.url)} onAuxClick={event => { if (event.button === 1) void act('tab:new', { url: bookmark.url }); }}><span>{bookmark.title.trim().slice(0, 1).toUpperCase() || <Globe2 size={13}/>}</span><strong>{bookmark.title || hostname(bookmark.url)}</strong></button>) : <button type="button" className="bookmarks-empty" onClick={() => openPage('bookmarks')}>Seus favoritos aparecerão aqui</button>}</div><button type="button" className="bookmark-manage" title="Gerenciar favoritos" onClick={() => openPage('bookmarks')}><MoreHorizontal size={16}/></button></div>}
        {find && <form className="findbar" onSubmit={event => { event.preventDefault(); void act('find', { text: query }); }}><Search size={15}/><input ref={findRef} placeholder="Localizar nesta página" aria-label="Localizar nesta página" value={query} onChange={event => { setQuery(event.target.value); void act('find', { text: event.target.value }); }}/><IconButton label="Resultado anterior" onClick={() => act('find', { text: query, forward: false })}><ArrowLeft size={15}/></IconButton><IconButton label="Próximo resultado" onClick={() => act('find', { text: query })}><ArrowRight size={15}/></IconButton><IconButton label="Fechar pesquisa" onClick={() => { setFind(false); void act('find', { text: '' }); }}><X size={15}/></IconButton></form>}
        <div className={`viewport ${page ? 'internal' : 'external'}`} ref={viewportRef}>
          {page === 'newtab' && <HomePage key={tab?.id} settings={s} data={state.homeData} bookmarks={state.bookmarks} isPrivate={!!tab?.private} navigate={navigate} openSettings={() => openPage('settings')} save={home => window.cypher.invoke('settings', { home })} command={(action,payload) => window.cypher.invoke(action,payload)}/>}
          {page && page !== 'newtab' && <div className={`internal-page ${page === 'settings' ? 'settings-internal' : ''}`}>{page !== 'settings' && <div className="page-heading"><span className="eyebrow">CYPHER / {pageLabels[page]?.toUpperCase()}</span><h1>{page === 'mods' ? <>Mude a <em>frequência.</em></> : page === 'settings' ? <>Do seu <em>jeito.</em></> : pageLabels[page]}</h1><p>{({ settings: 'Seu navegador deve se adaptar a você. Comece por aqui.', security: 'Gerencie rotas por aba, privacidade da sessão e as permissões salvas para cada site.', extensions: 'Adicione extensões locais compatíveis. Extensões e mods têm funções diferentes.', profile: 'Sua identidade local neste dispositivo.', mods: 'Uma nova atmosfera em um clique. Encontre a sua.', bookmarks: 'Guarde os lugares para onde você quer voltar.', history: 'Os caminhos que você percorreu. Abas privadas ficam fora daqui.', downloads: 'Seus arquivos, em um só lugar.' })[page]}</p></div>}
            {page === 'settings' && <SettingsCenter settings={s} update={state.update} trackerProtection={state.trackerProtection} profileSync={state.profileSync} hardwareAccelerationPending={state.hardwareAccelerationPending} onSettings={settings} command={act} navigate={openPage}/>}
            {page === 'security' && <div className="settings-grid"><ConnectionSettings settings={s} onSettings={settings} onConnection={mode => { void act('connection:select',mode); }}/><section className="settings-card session-privacy-card"><h2><ShieldCheck size={18}/> Privacidade da sessão</h2><p>Controles locais para os dados de navegação.</p><div className="setting-row"><span><strong>Dados do site</strong><small>Limpa cookies e cache e pode desconectar suas contas</small></span><button className="button secondary" onClick={() => act('data:clear')}>Limpar dados</button></div><div className="setting-row"><span><strong>Abas privadas</strong><small>Não entram no histórico e usam sessão temporária</small></span><button className="button secondary" onClick={() => act('tab:new',{ private:true })}><Shield size={15}/> Nova aba privada</button></div></section><SitePermissionsCenter permissions={state.sitePermissions} command={act}/></div>}
            {page === 'extensions' && <ExtensionsPage extensions={state.extensions} command={act}/>}
            {page === 'profile' && <div className="settings-grid"><section className="settings-card wide-card profile-card"><div className="profile-large-avatar">{s.profilePhoto ? <img src={s.profilePhoto} alt="Foto do perfil"/> : <UserRound size={40}/>}</div><div className="profile-copy"><span className="eyebrow">PERFIL</span><h2>Seu perfil do Cypher</h2><p>Preferências, favoritos, histórico e Home podem ser sincronizados entre seus dispositivos.</p><div className="profile-actions"><button className="button primary" onClick={() => void chooseProfilePhoto()}><ImagePlus size={15}/>{s.profilePhoto ? 'Trocar foto' : 'Escolher foto'}</button>{s.profilePhoto && <button className="button secondary" onClick={() => settings({ profilePhoto:'' })}>Remover foto</button>}</div></div></section><ProfileSyncPanel sync={state.profileSync} command={act}/></div>}
            {page === 'mods' && <><div className="collection-toolbar"><span><span className="live-dot"/> {state.mods.length} MODS DISPONÍVEIS</span><div><button className="button secondary" onClick={() => act('mod:import')}><Download size={15}/> Importar mod</button><button className="button primary" onClick={() => act('mod:export')}><Upload size={15}/> Exportar visual</button></div></div><div className="mods-grid">{state.mods.map(mod => <article key={mod.id} className={`mod-card ${s.activeMod === mod.id ? 'mod-active' : ''}`}><div className={`mod-preview mod-${mod.settings.wallpaper}`} style={{ '--mod-accent': mod.settings.accent, '--mod-bg': mod.settings.background, '--mod-surface': mod.settings.surface } as CSSProperties}><div className="mini-rail"/><div className="mini-sidebar"><i/><i/><i/></div><div className="mini-main"><div className="mini-address"/><div className="mini-orbit"/><span>Seu próximo<br/><b>universo.</b></span></div><span className="mod-preview-tag">{mod.custom ? 'COMUNIDADE' : 'CYPHER COLLECTION'}</span></div><div className="mod-info"><div><span className="eyebrow">POR {mod.author.toUpperCase()}</span><h2>{mod.name}</h2><p>{mod.description}</p></div><div className="mod-actions"><button className={`button ${s.activeMod === mod.id ? 'secondary' : 'primary'}`} onClick={() => act('mod:apply', mod.id)}>{s.activeMod === mod.id ? <><Check size={15}/> Em uso</> : <>Aplicar mod <ArrowUpRight size={15}/></>}</button>{mod.custom && <IconButton label="Remover mod" onClick={() => act('mod:remove', mod.id)}><Trash2 size={16}/></IconButton>}</div></div></article>)}</div><div className="info-note"><Puzzle size={19}/><div><strong>Mods visuais e extensões locais.</strong><p>Mods importados ajustam a aparência com segurança. Extensões Chromium descompactadas podem ser gerenciadas na seção Extensões; mods com código e marketplace ainda estão no roadmap.</p></div></div></>}
            {(page === 'bookmarks' || page === 'history') && <><div className="collection-toolbar"><label className="filter-input"><Search size={16}/><input aria-label="Filtrar lista" placeholder="Encontre um endereço…" value={filter} onChange={event => setFilter(event.target.value)}/></label>{page === 'history' && <button className="button secondary" disabled={!state.history.length} onClick={() => act('history:clear')}><Trash2 size={15}/> Limpar histórico</button>}</div><div className="link-list">{(page === 'history' ? state.history : state.bookmarks).filter(link => (link.title + link.url).toLowerCase().includes(filter.toLowerCase())).map(link => <div className="link-row" key={link.id}><span className="link-avatar">{hostname(link.url)[0]?.toUpperCase()}</span><button className="link-details" onClick={() => act('tab:new', { url: link.url })}><strong>{link.title}</strong><small>{link.url}</small></button><span className="link-date">{date(link.date)}</span><IconButton label="Abrir em nova aba" onClick={() => act('tab:new', { url: link.url })}><ArrowUpRight size={16}/></IconButton><IconButton label="Remover item" onClick={() => act(page === 'history' ? 'history:remove' : 'bookmark:remove', link.id)}><Trash2 size={15}/></IconButton></div>)}</div>{!(page === 'history' ? state.history : state.bookmarks).length && <Empty icon={page === 'history' ? <Clock3/> : <Star/>} title={page === 'history' ? 'Toda jornada começa em algum lugar.' : 'Seus próximos lugares favoritos.'} description={page === 'history' ? 'Suas páginas visitadas aparecerão aqui.' : 'Clique na estrela da barra de endereço para guardar uma página.'}/>}</>}
            {page === 'downloads' && <><div className="collection-toolbar"><span>{state.downloads.length} ARQUIVOS</span><span className="muted-text">Os arquivos são salvos na pasta escolhida no download.</span></div><div className="link-list">{state.downloads.map(item => <div className="download-row" key={item.id}><div className="link-avatar"><Download size={19}/></div><div className="download-details"><strong>{item.name}</strong><small>{({ progressing: 'Baixando', paused: 'Pausado', completed: 'Concluído', cancelled: 'Cancelado', interrupted: 'Interrompido' } as Record<string,string>)[item.state] || item.state} · {size(item.received)}{item.total ? ` / ${size(item.total)}` : ''}{item.private ? ' · Privado' : ''}</small>{['progressing','paused'].includes(item.state) && <progress value={item.received} max={item.total || 1}/>}</div>{item.state === 'completed' && <IconButton label="Mostrar na pasta" onClick={() => act('download:action', { id: item.id, action: 'show' })}><FolderOpen size={18}/></IconButton>}{['progressing','paused'].includes(item.state) ? <><IconButton label={item.state === 'paused' ? 'Continuar' : 'Pausar'} onClick={() => act('download:action', { id: item.id, action: item.state === 'paused' ? 'resume' : 'pause' })}>{item.state === 'paused' ? <Play size={16}/> : <Pause size={16}/>}</IconButton><IconButton label="Cancelar download" onClick={() => act('download:action', { id: item.id, action: 'cancel' })}><X size={17}/></IconButton></> : <IconButton label="Remover da lista" onClick={() => act('download:action', { id: item.id, action: 'remove' })}><Trash2 size={16}/></IconButton>}</div>)}</div>{!state.downloads.length && <Empty icon={<Download/>} title="Tudo pronto para o próximo download." description="Acompanhe o progresso e encontre seus arquivos por aqui."/>}</>}
          </div>}
          {tab?.error && <div className="error-page"><AlertCircle size={40}/><h1>Não chegamos a esse lugar.</h1><p>Confira o endereço e sua conexão, depois tente novamente.</p><code>{tab.error}</code><button className="button primary" onClick={() => act('reload')}><RotateCw size={16}/> Tentar novamente</button></div>}
          {!page && !tab?.error && overlay && <div className="obscured-page"><Globe2 size={32}/><span>{tab?.title}</span><small>A página continua aberta</small></div>}
        </div>
      </main>
    </div>
    {addressFocus && <div className="address-suggestions" style={{ left: (isSide ? (s.compact ? 76 : s.sidebarWidth) : 0) + 64 + 132 }}><button onMouseDown={event => event.preventDefault()} onClick={() => navigate(address)}><Search size={17}/><span>{address || 'Digite um endereço ou uma pesquisa'}</span><kbd>Enter</kbd></button>{s.showSearchSuggestions && suggestions.map(link => <button key={link.id} onMouseDown={event => event.preventDefault()} onClick={() => navigate(link.url)}><Clock3 size={16}/><span><strong>{link.title}</strong><small>{link.url}</small></span><ArrowUpRight size={15}/></button>)}</div>}
    {menu && <><div className="menu-backdrop" onClick={() => setMenu(false)}/><div className="browser-menu"><span className="eyebrow">CYPHER / CONTROLES</span>{[{ title: 'Nova aba', icon: Plus, action: () => act('tab:new'), key: 'Ctrl T' }, { title: 'Nova aba privada', icon: Shield, action: () => act('tab:new', { private: true }), key: 'Ctrl Shift N' }, { title: 'Favoritos', icon: Star, action: () => openPage('bookmarks'), key: '' }, { title: 'Histórico', icon: Clock3, action: () => openPage('history'), key: 'Ctrl H' }, { title: 'Downloads', icon: Download, action: () => openPage('downloads'), key: 'Ctrl J' }].map(item => <button key={item.title} onClick={() => { setMenu(false); item.action(); }}><item.icon size={16}/><span>{item.title}</span><kbd>{item.key}</kbd></button>)}<div className="menu-separator"/><div className="zoom-controls"><span>Zoom</span><IconButton label="Reduzir zoom" onClick={() => act('zoom', (tab?.zoom || 1) - 0.1)}><Minus size={15}/></IconButton><button onClick={() => act('zoom', 1)}>{Math.round((tab?.zoom || 1) * 100)}%</button><IconButton label="Ampliar zoom" onClick={() => act('zoom', (tab?.zoom || 1) + 0.1)}><Plus size={15}/></IconButton></div>{[{ title: 'Localizar na página', icon: Search, action: () => { setFind(true); setTimeout(() => findRef.current?.focus(), 0); } }, { title: 'Salvar página', icon: Save, action: () => act('save') }, { title: 'Imprimir', icon: Printer, action: () => act('print') }, { title: 'Tela cheia', icon: Maximize, action: () => act('window:fullscreen') }, { title: 'Ferramentas de desenvolvedor', icon: Code2, action: () => act('devtools') }, { title: 'Personalizar Cypher', icon: SlidersHorizontal, action: () => openPage('settings') }].map(item => <button key={item.title} onClick={() => { setMenu(false); item.action(); }}><item.icon size={16}/><span>{item.title}</span><ChevronRight size={14}/></button>)}</div></>}
    {tabMenu && <><div className="menu-backdrop" onClick={() => setTabMenu(null)}/><div className="tab-context-menu browser-menu"><span className="eyebrow">CONTROLES DA ABA</span>{[{ title: 'Fixar / desafixar', icon: Pin, action: 'tab:pin' }, { title: 'Silenciar / ativar áudio', icon: VolumeX, action: 'tab:mute' }, { title: 'Fechar aba', icon: X, action: 'tab:close' }].map(item => <button key={item.action} onClick={() => { void act(item.action, tabMenu); setTabMenu(null); }}><item.icon size={16}/><span>{item.title}</span></button>)}</div></>}
    {mediaOpen && <div className="media-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setMediaOpen(false); }}><section className="media-player" role="dialog" aria-modal="true" aria-label="Miniplayer"><header><span><Music2 size={15}/> REPRODUÇÃO</span><IconButton label="Fechar miniplayer" onClick={() => setMediaOpen(false)}><X size={17}/></IconButton></header>
      {playerTitle ? <><div className="media-player-track"><div className="media-player-art">{pageMedia?.artwork && !backgroundSelected ? <img src={pageMedia.artwork} alt=""/> : <Music2 size={28}/>}</div><div><strong>{playerTitle}</strong><span>{playerArtist}</span><small>{backgroundSelected ? 'Música de fundo' : `${pageMedia?.tabTitle || 'Aba do navegador'} · ${hostname(pageMedia?.pageUrl || '')}`}</small></div></div>
        <div className="media-player-progress"><input type="range" aria-label="Posição da reprodução" min="0" max={Math.max(1, playerDuration)} step="1" value={Math.min(playerPosition, playerDuration || playerPosition)} disabled={!playerDuration} onChange={event => seekPlayer(Number(event.target.value))}/><div><span>{mediaTime(playerPosition)}</span><span>{playerDuration ? mediaTime(playerDuration) : '—:—'}</span></div></div>
        <div className="media-player-controls"><IconButton label="Voltar 10 segundos" disabled={backgroundSelected || !pageMedia} onClick={() => void act('media:control', { tabId: pageMedia?.tabId, action: 'seek-back' })}><SkipBack size={17}/></IconButton><button type="button" className="media-play-toggle" aria-label={playerPlaying ? 'Pausar' : 'Reproduzir'} onClick={() => void togglePlayer()}>{playerPlaying ? <Pause size={19} fill="currentColor"/> : <Play size={19} fill="currentColor"/>}</button><IconButton label="Avançar 10 segundos" disabled={backgroundSelected || !pageMedia} onClick={() => void act('media:control', { tabId: pageMedia?.tabId, action: 'seek-forward' })}><SkipForward size={17}/></IconButton></div>
        {!backgroundSelected && pageMedia && <button type="button" className="media-player-tab" onClick={() => { void act('media:select', pageMedia.tabId); void act('tab:select', pageMedia.tabId); setMediaOpen(false); }}>Ir para a aba que está reproduzindo <ArrowUpRight size={14}/></button>}
        {!s.backgroundMusicEnabled && s.backgroundMusicData && !backgroundSelected && <button type="button" className="media-background-option" onClick={() => { void (async () => { const audio = musicRef.current; if (!audio) return; try { await audio.play(); settings({ backgroundMusicEnabled: true }); } catch { notify('Não foi possível reproduzir este arquivo de áudio.'); } })(); }}>Reproduzir música de fundo</button>}
      </> : <div className="media-player-empty"><Music2 size={28}/><strong>Nada está tocando</strong><span>Quando uma aba começar a reproduzir áudio ou vídeo, os controles aparecerão aqui.</span>{!s.backgroundMusicData && <button type="button" onClick={() => { setMediaOpen(false); openPage('settings'); }}>Escolher música de fundo</button>}</div>}
    </section></div>}
    {toast && <div className="toast" role="status"><AlertCircle size={16}/><span>{toast}</span><button onClick={() => setToast('')} aria-label="Fechar aviso"><X size={15}/></button></div>}
    {state.update.state === 'available' && <aside className="update-notice" role="status" aria-live="polite"><span className="update-notice-icon"><Sparkles size={18}/></span><div className="update-notice-copy"><strong>Uma nova versão do Cypher chegou</strong><small>Versão {state.update.version}{state.update.releaseNotes ? ` · ${state.update.releaseNotes}` : ''}</small></div><button className="update-install-button" onClick={() => void act('update:install')}>Instalar agora <ArrowRight size={14}/></button><button className="update-dismiss-button" aria-label="Lembrar depois" title="Lembrar depois" onClick={() => void act('update:dismiss')}><X size={16}/></button></aside>}
    {['downloading','restarting','complete'].includes(state.update.state) && <div className="update-screen" role="dialog" aria-modal="true" aria-label="Atualização do Cypher"><div className={`update-card ${state.update.state === 'complete' ? 'update-complete' : ''}`}><div className="update-animation"><span className="update-orbit update-orbit-one"/><span className="update-orbit update-orbit-two"/><Logo/></div><span className="sc-eyebrow">CYPHER / {state.update.state === 'complete' ? 'ATUALIZADO' : 'ATUALIZAÇÃO'}</span><h2>{state.update.state === 'complete' ? 'Seu espaço evoluiu.' : state.update.state === 'restarting' ? 'Aplicando a nova versão.' : 'Preparando sua nova versão.'}</h2><p>{state.update.state === 'complete' ? `Cypher ${state.update.version} está pronto para você.` : state.update.message}</p>{state.update.state === 'downloading' && <div className="update-progress"><span><i style={{ width: `${state.update.progress}%` }}/></span><small>{state.update.progress ? `${state.update.progress}%` : 'Conectando ao canal seguro'}</small></div>}{state.update.state !== 'complete' && <div className="update-loader" aria-label="Atualização em andamento"><i/><i/><i/></div>}</div></div>}
  </div>;
}
function Logo({ small = false }: { small?: boolean }) { return <svg className={`cypher-logo ${small ? 'small' : ''}`} width={small ? 18 : 25} height={small ? 18 : 25} viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M25 7H13L5 16l8 9h12l-5-6h-6l-3-3 3-3h6l5-6Z" fill="currentColor"/><path d="m25 14-3 3h7l-4-3Z" fill="currentColor" opacity=".45"/></svg>; }
function Empty({ icon,title,description }: { icon: ReactNode; title: string; description: string }) { return <div className="empty-state"><div>{icon}</div><h2>{title}</h2><p>{description}</p></div>; }
