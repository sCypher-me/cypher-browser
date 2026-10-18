import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, Plus, X, Minus, Search, Star, Download, Clock3, SlidersHorizontal, Home, Puzzle, PanelLeftClose, PanelLeftOpen, Shield, ShieldCheck, Globe2, ChevronRight, ChevronDown, MoreHorizontal, ArrowUpRight, Pin, Volume2, VolumeX, Trash2, Upload, Check, ExternalLink, FolderOpen, Pause, Play, ScanLine, Command, LockKeyhole, Sparkles, Monitor, Maximize, Printer, Code2, Save, AlertCircle, Music2, Ban, Layers3, Copy, CopyPlus, Undo2, ZoomIn, ListX, Link2, VenetianMask, Waypoints, BookOpen, Camera, Columns2, Boxes, PanelRight, PenTool, Tag, ArrowLeftRight, Pipette } from 'lucide-react';
import type { BrowserState, PageSnapshot, Settings, Tab, ToolbarItem, TrackerProtectionStatus } from './types';
import { cn } from './lib/cn';
import { defaultHome } from '../electron/home-layout.mjs';
import HomePage from './HomePage';
import SettingsCenter from './SettingsCenter';
import PopupProtectionPanel from './PopupProtectionPanel';
import ProductivityCenter from './ProductivityCenter';
import CommandPalette, { type PaletteCommand } from './CommandPalette';
import InspectorPanel, { type InspectTarget } from './InspectorPanel';
import CaptureEditor from './CaptureEditor';
import { defaultTokens } from './CustomizationSettings';
import ModsStore from './ModsStore';
import { useModAudio } from './modAudio';
import { browserPages, centralAlias, internalPageFromUrl, sectionFor, type InternalPage, type LegacySection, type SettingsSection } from './navigation';
import './browser-features.css';
import './productivity.css';

const initial: BrowserState = { tabs: [], activeId: '', settings: { skin: 'recorte', tabPosition: 'side', sidebarWidth: 210, appearanceMode: 'dark', accent: '#ff5436', surface: '#151310', background: '#0a0908', radius: 14, font: 'system', interfaceTextScale: 1.2, wallpaper: 'none', wallpaperImageData: '', buttonShape: 'soft', interfaceEffect: 'signal', soundEffectsEnabled: false, soundTheme: 'cypher', backgroundMusicData: '', backgroundMusicName: '', backgroundMusicEnabled: false, motion: true, compact: false, searchEngine: 'duckduckgo', customSearchUrl: '', activeMod: 'recorte-noite', connectionMode: 'normal', torSocksPort: 9050, i2pHttpPort: 4444, profilePhoto: '', restoreSession: false, startupMode: 'home', startupPages: [], showHomeFirst: false, openLinksInNewTab: true, showSearchSuggestions: true, sendDoNotTrack: false, blockAds: true, blockTrackers: true, blockThirdPartyCookies: false, blockPopups: true, popupExceptions: [], passwordAutofillEnabled: false, trackingExceptions: [], preferredLanguages: ['pt-BR','en-US'], spellCheckEnabled: true, spellCheckLanguages: ['pt-BR'], translationEnabled: true, hardwareAcceleration: true, webrtcPolicy: 'default', showBookmarksBar: false, suggestBookmarks: true, suggestHistory: true, clearDataOnExit: false, clearHistoryOnExit: false, confirmCloseWithMultipleTabs: false, memorySaverEnabled:true, memorySaverMinutes:20, defaultZoom: 1, downloadDirectory: '', startWithWindows: false, home: defaultHome, tokens: defaultTokens, toolbarOrder: ['navigation','address','routes','skin','media','customize','menu'], toolbarHidden: [], toolbarPosition: 'top', tabsAutoHide: false, showRail: true, workspaceAccent: false, customCss: '', skinPackage: '', shortcuts: {}, routeRules: [], containers: [], blockCookieBanners: true, webPanels: [], panelWidth: 380, modSoundsEnabled: true, modSoundsVolume: 0.6, modMusicEnabled: true, modMusicVolume: 0.5, modPageEffects: true, sendErrorReports: false }, bookmarks: [], history: [], downloads: [], extensions: [], sitePermissions: [], mods: [], workspaces:[], activeWorkspaceId:'', researchItems:[], profiles:[], profileId:'default', maximized: false, hardwareAccelerationPending: false, homeData: { notes: {}, focus: { endsAt: null, remaining: 1500, duration: 1500 }, tasksById: {} }, update: { state: 'unconfigured', currentVersion: '0.7.20', version: '', progress: 0, message: '', releaseNotes: '', repository: '' }, trackerProtection: { available: false, adsAvailable: false, name: 'EasyList + EasyPrivacy', source: 'https://easylist.to/', lastModified: '', networkRuleCount: 0, adRuleCount: 0, blockedRequests: 0, blockedAds: 0, blockedTrackers:0, bySite:{}, error: 'As listas de proteção ainda não foram carregadas.' }, popupProtection: { blockedCount: 0, pending: [] } };
const pageLabels: Record<InternalPage, string> = { newtab: 'Página inicial', settings: 'Configurações', security: 'Segurança', extensions: 'Extensões', profile: 'Perfil', mods: 'Mods', bookmarks: 'Favoritos', history: 'Histórico', downloads: 'Downloads', productivity:'Espaços e pesquisa' };
const size = (bytes: number) => bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
const date = (value: number) => new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
function hostname(url: string) { try { return new URL(url).hostname; } catch { return url; } }

function IconButton({ label, children, onClick, active, disabled, className = '', style }: { label: string; children: ReactNode; onClick?: () => void; active?: boolean; disabled?: boolean; className?: string; style?: CSSProperties }) {
  return <button type="button" className={cn("icon-button", active && "active", className)} title={label} aria-label={label} onClick={onClick} disabled={disabled} style={style}>{children}</button>;
}
const fontStacks = { 'big-shoulders': '"Big Shoulders Display", "Arial Narrow", sans-serif', 'work-sans': '"Work Sans", "Segoe UI", sans-serif', system: '"Segoe UI Variable Text", "Segoe UI", sans-serif', serif: 'Georgia, "Times New Roman", serif', mono: 'Consolas, "Cascadia Mono", monospace' } as const;
const groupPalette = ['#ff5436', '#5aa9ff', '#3ddc84', '#ffbf1f', '#c4b3ff', '#ff7ab6', '#7ce0d3'];
const groupColor = (name: string) => groupPalette[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % groupPalette.length];
function isLightColor(hex: string) { const value = parseInt(hex.slice(1), 16); return ((value >> 16 & 255) * 299 + (value >> 8 & 255) * 587 + (value & 255) * 114) / 1000 > 140; }

function WindowMinimizeIcon() { return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 9.5h7.5l2-2"/><path d="M3 12.5h10"/></svg>; }
function WindowMaximizeIcon({ restore = false }: { restore?: boolean }) { return restore ? <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.5h7.5v7.5"/><path d="M10.5 6.5v6H4.5v-6z"/></svg> : <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 4.5h9v8h-9z"/><path d="M6 2.5h7.5v7"/></svg>; }
function WindowCloseIcon() { return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8"/><path d="M2.5 2.5h2M11.5 13.5h2"/></svg>; }

function TrackerProtectionPanel({ settings, status, tab, onSettings, onClose, onConfigure, onClearSite }: { settings:Settings; status:TrackerProtectionStatus; tab?:Tab; onSettings:(patch:Partial<Settings>)=>void; onClose:()=>void; onConfigure:()=>void; onClearSite:(origin:string)=>void }) {
  const routeHost = (() => { try { return tab && /^https?:\/\//i.test(tab.url) ? new URL(tab.url).hostname.replace(/^www\./, '').toLowerCase() : ''; } catch { return ''; } })();
  const routeRule = settings.routeRules.find(rule => rule.host === routeHost);
  const setRoute = (mode: 'normal' | 'tor' | 'i2p') => onSettings({ routeRules: [...settings.routeRules.filter(rule => rule.host !== routeHost), ...(mode === 'normal' ? [] : [{ host: routeHost, mode }])] });
  const siteUrl = tab && /^https?:\/\//i.test(tab.url) ? tab.url : tab?.lastExternalUrl || '';
  const host = siteUrl ? hostname(siteUrl).toLowerCase() : '';
  let origin = ''; try { origin = siteUrl ? new URL(siteUrl).origin : ''; } catch {}
  const excepted = !!host && settings.trackingExceptions.includes(host);
  const siteCounts = host ? status.bySite?.[host] : undefined;
  return <section className="tracker-popover" aria-label="Proteção de navegação"><header><span className="tracker-popover-icon"><ShieldCheck size={17}/></span><div><strong>Proteção de navegação</strong><small>{settings.blockAds || settings.blockTrackers ? 'Ativa nesta sessão' : 'Desativada'}</small></div><button type="button" aria-label="Fechar proteção" onClick={onClose}><X size={16}/></button></header><div className="tracker-popover-summary"><strong>{(siteCounts?.blockedRequests ?? status.blockedRequests).toLocaleString('pt-BR')}</strong><span>{host ? `solicitações bloqueadas em ${host}` : 'solicitações bloqueadas nesta sessão'}</span><small>{siteCounts ? `${siteCounts.blockedAds} anúncios · ${siteCounts.blockedTrackers} rastreadores neste site` : `${status.name} · ${(status.networkRuleCount + status.adRuleCount).toLocaleString('pt-BR')} regras`} {status.available || status.adsAvailable ? '' : '· listas indisponíveis'}</small></div><div className="tracker-popover-controls"><label><span><strong>Bloquear anúncios</strong><small>Filtros EasyList e domínios conhecidos</small></span><button type="button" role="switch" aria-checked={settings.blockAds} className={`tracker-mini-switch ${settings.blockAds ? 'on' : ''}`} onClick={() => onSettings({ blockAds: !settings.blockAds })}><i/></button></label><label><span><strong>Bloquear rastreadores</strong><small>Filtros EasyPrivacy</small></span><button type="button" role="switch" aria-checked={settings.blockTrackers} className={`tracker-mini-switch ${settings.blockTrackers ? 'on' : ''}`} disabled={!status.available} onClick={() => onSettings({ blockTrackers: !settings.blockTrackers })}><i/></button></label>{host && tab && tab.connectionMode === 'normal' && !tab.private && <label><span><strong>Proteção neste site</strong><small>Exceções somente para {host}</small></span><button type="button" role="switch" aria-checked={!excepted} className={`tracker-mini-switch ${!excepted ? 'on' : ''}`} onClick={() => { const exceptions = settings.trackingExceptions || []; onSettings({ trackingExceptions: excepted ? exceptions.filter(entry => entry !== host) : [...exceptions, host] }); }}><i/></button></label>}</div>{routeHost && tab && !tab.private && <div className="tracker-route-row"><span><strong>Rota para {routeHost}</strong><small>Abre sempre por esta rede, numa aba própria</small></span><div className="cz-segment" role="group" aria-label="Rota deste site">{(['normal', 'tor', 'i2p'] as const).map(mode => <button type="button" key={mode} aria-pressed={(routeRule?.mode || 'normal') === mode} className={(routeRule?.mode || 'normal') === mode ? 'chosen' : ''} onClick={() => setRoute(mode)}>{mode === 'normal' ? 'Normal' : mode.toUpperCase()}</button>)}</div></div>}{host && tab && tab.connectionMode === 'normal' && !tab.private && <button type="button" className="tracker-site-clear" onClick={() => onClearSite(origin)}>Limpar dados e permissões de {host}</button>}<footer>{host || 'Proteção geral do Cypher'}<button type="button" onClick={onConfigure}>Ver bloqueadores <ArrowRight size={13}/></button></footer></section>;
}


function TabItem({ item, selected, onSelect, onClose, onMute, onMove, onMenu, containerColor }: { item: Tab; selected: boolean; onSelect: () => void; onClose: () => void; onMute: () => void; onMove: (from: string) => void; onMenu: (x: number, y: number) => void; containerColor?: string }) {
  return <div style={containerColor ? { '--container-color': containerColor } as CSSProperties : undefined} className={cn('tab', selected && 'selected', item.private && 'private-tab', item.suspended && 'tab-suspended', item.group && 'has-group', item.pinned && 'pinned-tab', containerColor && 'container-tab')} draggable onDragStart={event => event.dataTransfer.setData('text/cypher-tab', item.id)} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const from = event.dataTransfer.getData('text/cypher-tab'); if (from && from !== item.id) onMove(from); }} onContextMenu={event => { event.preventDefault(); onMenu(event.clientX, event.clientY); }}>
    <button className="tab-main" title={`${item.title}${item.suspended ? ' · suspensa para economizar memória' : ''}`} aria-current={selected ? 'page' : undefined} onClick={onSelect} onAuxClick={event => { if (event.button === 1) onClose(); }}>
      <span className={`tab-symbol ${item.loading ? 'spinning' : ''}`}>{item.loading ? <RotateCw size={15} /> : item.suspended ? <Pause size={14}/> : item.private ? <Shield size={16} /> : item.url === 'cypher://newtab' ? <Logo small /> : item.pinned ? <Pin size={15} /> : <Globe2 size={16} />}</span><span className="tab-label">{item.title}</span>
    </button>
    {item.group && <small className="tab-group-label">{item.group}</small>}
    {(item.audible || item.muted) && <button className="tab-close tab-audio" title={item.muted ? 'Ativar áudio' : 'Silenciar aba'} aria-label={item.muted ? 'Ativar áudio' : 'Silenciar aba'} onClick={onMute}>{item.muted ? <VolumeX size={13} /> : <Volume2 size={13} />}</button>}
    <button className="tab-close close-tab" title="Fechar aba · Ctrl W" aria-label={`Fechar ${item.title}`} onClick={onClose}><X size={13} /></button>
  </div>;
}

function dayLabel(value: number) {
  const day = new Date(value); day.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - day.getTime()) / 86400000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  return day.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', ...(day.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}) });
}

export default function App() {
  const [state, setState] = useState(initial);
  const [address, setAddress] = useState('');
  const [addressFocus, setAddressFocus] = useState(false);
  const [menu, setMenu] = useState(false);
  const [trackerPanelOpen, setTrackerPanelOpen] = useState(false);
  const [popupPanelOpen, setPopupPanelOpen] = useState(false);
  const [tabMenu, setTabMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [palette, setPalette] = useState(false);
  const [skinMenu, setSkinMenu] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const [inspectTarget, setInspectTarget] = useState<InspectTarget | null>(null);
  const [undoStack, setUndoStack] = useState<Partial<Settings>[]>([]);
  const [captureImage, setCaptureImage] = useState('');
  const [sidebarPeek, setSidebarPeek] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [groupDraft, setGroupDraft] = useState('');
  const [panelDraft, setPanelDraft] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null), peekTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), splitFrame = useRef(0);
  const [findResult, setFindResult] = useState<{ matches: number; active: number } | null>(null);
  const [addressRect, setAddressRect] = useState<{ left: number; top: number; bottom: number; width: number } | null>(null);
  const [find, setFind] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [toast, setToast] = useState('');
  const [pageFullscreen, setPageFullscreen] = useState(false);
  const [settingsDestination, setSettingsDestination] = useState<{ category: SettingsSection; focusId?: string; stamp: number }>({ category: 'overview', stamp: 0 });
  const addressFormRef = useRef<HTMLFormElement>(null), addressRef = useRef<HTMLInputElement>(null), findRef = useRef<HTMLInputElement>(null), viewportRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const soundContext = useRef<AudioContext | null>(null);
  const tab = state.tabs.find(t => t.id === state.activeId);
  const page = internalPageFromUrl(tab?.url);
  const isCentral = page === 'settings' || !!(page && centralAlias[page]);
  const s = state.settings, isSide = s.tabPosition === 'side';
  const activeWorkspace = state.workspaces.find(workspace => workspace.id === state.activeWorkspaceId);
  const visibleTabs = state.tabs.filter(item => item.private || item.connectionMode !== 'normal' || item.workspaceId === state.activeWorkspaceId);
  const pageMedia = state.nowPlaying || null;
  // Qualquer camada da interface sobre a área da página precisa tirar a página nativa da frente.
  const overlay = menu || !!tabMenu || addressFocus || palette || skinMenu || inspecting || !!captureImage || panelDraft !== null || trackerPanelOpen || popupPanelOpen;
  const [pageSnapshot, setPageSnapshot] = useState<PageSnapshot[]>([]);
  useModAudio({ effects: state.modEffects, soundVolume: s.modSoundsVolume ?? 0.6, musicVolume: s.modMusicVolume ?? 0.5, tabCount: state.tabs.length, activeUrl: tab?.url || '', pageMediaPlaying: !!state.nowPlaying?.playing });
  const modSoundsOn = !!state.modEffects?.sounds;
  function notify(message: string) { setToast(message); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 4500); }
  async function act(action: string, payload?: unknown) {
    try { return await window.cypher.invoke(action, payload); }
    catch (error) { notify(String(error instanceof Error ? error.message : error).replace(/^Error invoking remote method '[^']+': Error: /, '')); }
  }
  function openPage(target: InternalPage, options: { category?: SettingsSection | LegacySection; focusId?: string } = {}) {
    setMenu(false); setTabMenu(null); setPalette(false); setSkinMenu(false); setAddressFocus(false); setFind(false); setTrackerPanelOpen(false); setPopupPanelOpen(false); setFilter('');
    // Segurança, Perfil e Extensões agora são seções da Central de Configurações.
    const alias = centralAlias[target];
    const name: InternalPage = alias ? 'settings' : target;
    if (name === 'settings') setSettingsDestination({ category: alias || sectionFor(options.category), focusId: options.focusId, stamp: Date.now() });
    const existing = state.tabs.find(t => (t.url === `cypher://${name}` || (name === 'settings' && !!centralAlias[internalPageFromUrl(t.url) as InternalPage])) && !t.private);
    if (existing) void act('tab:select', existing.id);
    else if (tab) void act('navigate', `cypher://${name}`);
    else void act('tab:new', { url: `cypher://${name}` });
  }
  function navigate(value: string) { setMenu(false); setTabMenu(null); setAddressFocus(false); addressRef.current?.blur(); void act('navigate', value); }
  const settings = (patch: Partial<Settings>) => {
    if (inspecting) setUndoStack(stack => [...stack.slice(-40), Object.fromEntries(Object.keys(patch).map(key => [key, s[key as keyof Settings]])) as Partial<Settings>]);
    void act('settings', patch);
  };
  function undoInspector() { const last = undoStack[undoStack.length - 1]; if (!last) return; setUndoStack(stack => stack.slice(0, -1)); void act('settings', last); }
  async function startCapture() { setMenu(false); setPalette(false); const image = await act('page:capture'); if (typeof image === 'string') setCaptureImage(image); }
  async function useSiteColor() { const color = await act('page:theme-color'); if (typeof color === 'string') { settings({ accent: color }); notify('Cor do site aplicada como destaque.'); } else if (color === null) notify('Este site não informa uma cor que possamos usar.'); }
  function toggleInspector() { setMenu(false); setPalette(false); setSkinMenu(false); setTabMenu(null); setInspectTarget(null); setUndoStack([]); setInspecting(value => !value); }
  async function chooseProfilePhoto() { const photo = await act('profile:photo:select'); if (typeof photo === 'string') settings({ profilePhoto:photo }); }
  useEffect(() => {
    if (!window.cypher) { setToast('Abra o Cypher pelo aplicativo desktop para navegar.'); return; }
    const off = window.cypher.onState(setState);
    void window.cypher.invoke('state').then(setState);
    return () => { off(); clearTimeout(toastTimer.current); };
  }, []);
  useEffect(() => { setAddress(tab?.url === 'cypher://newtab' ? '' : tab?.url || ''); setFind(false); setQuery(''); setFilter(''); setFindResult(null); }, [tab?.id, tab?.url]);
  useEffect(() => window.cypher?.onFindResult?.(setFindResult), []);
  useEffect(() => window.cypher?.onPageSnapshot?.(setPageSnapshot), []);
  // Popovers presos à barra fecham com um clique fora deles ou do botão que os abriu.
  useEffect(() => {
    if (!trackerPanelOpen && !popupPanelOpen && !skinMenu) return;
    const listener = (event: PointerEvent) => {
      if ((event.target as Element | null)?.closest('.toolbar-popover-anchor, .skin-anchor')) return;
      setTrackerPanelOpen(false); setPopupPanelOpen(false); setSkinMenu(false);
    };
    document.addEventListener('pointerdown', listener, true);
    return () => document.removeEventListener('pointerdown', listener, true);
  }, [trackerPanelOpen, popupPanelOpen, skinMenu]);
  useEffect(() => { if (!overlay) setPageSnapshot([]); }, [overlay]);
  useLayoutEffect(() => {
    if (!addressFocus) return;
    const measure = () => { const rect = addressFormRef.current?.getBoundingClientRect(); if (rect) setAddressRect({ left: rect.left, top: rect.bottom + 8, bottom: window.innerHeight - rect.top + 8, width: rect.width }); };
    measure(); window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure);
  }, [addressFocus]);
  useEffect(() => {
    if (!window.cypher) return;
    return window.cypher.onShortcut(action => {
      if (action === 'address') { setAddressFocus(true); addressRef.current?.focus(); addressRef.current?.select(); }
      if (action === 'find') { setFind(true); setTimeout(() => { findRef.current?.focus(); findRef.current?.select(); }, 0); }
      if (action === 'palette') { setMenu(false); setTabMenu(null); setAddressFocus(false); setPalette(value => !value); }
      if (action === 'inspector') toggleInspector();
      if (action === 'capture') void startCapture();
      if (action.startsWith('error:')) notify(action.slice(6).replace(/^Error: /, ''));
      if (action === 'escape') { setMenu(false); setTabMenu(null); setPalette(false); setSkinMenu(false); setAddressFocus(false); setTrackerPanelOpen(false); setPopupPanelOpen(false); setFind(false); void act('find', { text: '' }); }
      if (action === 'page-fullscreen') setPageFullscreen(true);
      if (action === 'leave-fullscreen') setPageFullscreen(false);
    });
  }, []);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenu(false); setTabMenu(null); setPalette(false); setSkinMenu(false); setInspecting(false); setPanelDraft(null); setAddressFocus(false); setTrackerPanelOpen(false); setPopupPanelOpen(false); setFind(false); addressRef.current?.blur(); void act('find', { text: '' }); }
    };
    window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener);
  }, []);
  useEffect(() => {
    const listener = (event: MouseEvent) => {
      if (!s.soundEffectsEnabled || modSoundsOn) return;
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
  }, [s.soundEffectsEnabled, s.soundTheme, modSoundsOn]);
  useLayoutEffect(() => {
    const element = viewportRef.current; if (!element || !window.cypher) return;
    function sync() {
      const r = element!.getBoundingClientRect(), panel = panelRef.current?.getBoundingClientRect();
      void act('viewport', { x: r.x, y: r.y, width: r.width, height: r.height, obscured: overlay, panel: panel && panel.width > 0 ? { x: panel.x, y: panel.y, width: panel.width, height: panel.height } : null });
    }
    sync(); const observer = new ResizeObserver(sync); observer.observe(element); if (panelRef.current) observer.observe(panelRef.current);
    window.addEventListener('resize', sync); return () => { observer.disconnect(); window.removeEventListener('resize', sync); };
  }, [overlay, s.tabPosition, s.compact, s.sidebarWidth, find, pageFullscreen, tab?.id, state.openPanelId, s.panelWidth, s.toolbarPosition, s.tabsAutoHide, sidebarPeek, s.showRail, s.tokens?.barHeight, s.showBookmarksBar]);
  const tokens = s.tokens || defaultTokens;
  const sidebarSize = s.tabsAutoHide && !sidebarPeek ? 10 : s.compact ? 68 : Math.max(180, s.sidebarWidth - 18);
  const effectiveMode = s.appearanceMode === 'system' ? (state.systemDark === false ? 'light' : 'dark') : s.appearanceMode;
  const systemPalette = s.appearanceMode === 'system' && effectiveMode === 'light' && !isLightColor(s.background)
    ? (s.skin === 'recorte' ? { accent: '#d2401f', surface: '#ffffff', base: '#efe9dc' } : { accent: '#587b35', surface: '#ffffff', base: '#f0f3ee' })
    : s.appearanceMode === 'system' && effectiveMode === 'dark' && isLightColor(s.background)
      ? (s.skin === 'recorte' ? { accent: '#ff5436', surface: '#151310', base: '#0a0908' } : { accent: '#b6f36a', surface: '#111513', base: '#090c0b' })
      : { accent: s.accent, surface: s.surface, base: s.background };
  const accentColor = s.workspaceAccent && activeWorkspace ? activeWorkspace.color : systemPalette.accent;
  const bodyFont = s.font === 'mono' ? fontStacks.mono : s.skin === 'classic' && tokens.bodyFont === 'work-sans' ? fontStacks.system : fontStacks[tokens.bodyFont];
  const skinPackage = state.skins?.find(item => item.id === s.skinPackage);
  const modFonts = state.modEffects?.fonts || {};
  const userCss = [Object.values(modFonts).map(font => font ? `@font-face{font-family:"${font.family}";src:url("${font.url}");font-display:swap}` : '').join(''), state.modEffects?.interfaceCss, skinPackage?.css, s.customCss].filter(Boolean).join('\n\n');
  const fontTokens = Object.fromEntries(Array.from({ length: 47 }, (_, index) => {
    const points = 7 + index * .5;
    const key = Number.isInteger(points) ? String(points) : String(points).replace('.', '-');
    return [`--ui-font-${key}`, `${(points * s.interfaceTextScale).toFixed(2)}px`];
  }));
  const style = { ...fontTokens, '--accent': accentColor, '--surface': systemPalette.surface, '--base': systemPalette.base, '--radius': `${s.radius}px`, '--sidebar': `${sidebarSize}px`, '--font': modFonts.body ? `"${modFonts.body.family}", ${bodyFont}` : bodyFont, '--display': modFonts.display ? `"${modFonts.display.family}", ${fontStacks[tokens.displayFont]}` : s.skin === 'recorte' ? fontStacks[tokens.displayFont] : 'var(--font)', '--cut': `${tokens.cut}px`, '--bar-h': `${tokens.barHeight}px`, '--density': tokens.density, '--border-w': `${tokens.borderWidth}px`, '--rail-w': s.showRail ? (s.skin === 'recorte' ? '52px' : '58px') : '0px', '--panel-w': `${s.panelWidth}px` } as CSSProperties;
  const suggestionSources = [...(s.suggestBookmarks ? state.bookmarks : []), ...(s.suggestHistory ? state.history : [])];
  const suggestions = suggestionSources.filter((link, index, arr) => arr.findIndex(l => l.url === link.url) === index && (link.title + link.url).toLowerCase().includes(address.toLowerCase())).slice(0,5);
  const containerOf = (item: Tab) => item.containerId ? s.containers.find(entry => entry.id === item.containerId) : undefined;
  const renderTab = (item: Tab) => <TabItem key={item.id} item={item} containerColor={containerOf(item)?.color} selected={item.id === state.activeId} onSelect={() => { setTabMenu(null); void act('tab:select', item.id); }} onClose={() => void act('tab:close', item.id)} onMute={() => void act('tab:mute', item.id)} onMove={from => void act('tab:move', { from, to: item.id })} onMenu={(x, y) => setTabMenu({ id: item.id, x, y })}/>;
  const orderedTabs = [...visibleTabs.filter(t => t.pinned), ...visibleTabs.filter(t => !t.pinned)];
  const groupNames = [...new Set(state.tabs.map(item => item.group).filter((name): name is string => !!name))];
  function renderSidebarTabs() {
    const blocks: ReactNode[] = visibleTabs.filter(item => item.pinned).map(renderTab);
    const rest = visibleTabs.filter(item => !item.pinned), seen = new Set<string>();
    for (const item of rest) {
      if (!item.group) { blocks.push(renderTab(item)); continue; }
      if (seen.has(item.group)) continue;
      seen.add(item.group);
      const name = item.group, members = rest.filter(entry => entry.group === name), collapsed = collapsedGroups.includes(name);
      const shown = collapsed ? members.filter(entry => entry.id === state.activeId) : members;
      blocks.push(<div className={cn('tab-group', collapsed && 'collapsed')} key={`group-${name}`} style={{ '--group-color': groupColor(name) } as CSSProperties}>
        <button type="button" className="tab-group-header" aria-expanded={!collapsed} onClick={() => setCollapsedGroups(list => collapsed ? list.filter(entry => entry !== name) : [...list, name])}><i/><span>{name}</span><small>{members.length}</small><ChevronDown size={14}/></button>
        {shown.map(renderTab)}
      </div>);
    }
    return blocks;
  }
  const splitPair = state.split && [state.split.left, state.split.right].includes(state.activeId) ? state.split : null;
  const splitActive = !!splitPair && [splitPair.left, splitPair.right].every(id => { const entry = state.tabs.find(item => item.id === id); return !!entry && /^https?:\/\//i.test(entry.url) && !entry.error; });
  const openPanel = s.webPanels.find(panel => panel.id === state.openPanelId);
  const external = !!tab && /^https?:\/\//i.test(tab.url) && !tab.error;
  const toolbarOrder = (item: ToolbarItem) => ({ order: Math.max(0, (s.toolbarOrder || []).indexOf(item)) } as CSSProperties);
  const toolbarShown = (item: ToolbarItem) => !s.toolbarHidden.includes(item);
  const menuTab = tabMenu ? state.tabs.find(item => item.id === tabMenu.id) : undefined;
  const profileName = state.profiles.find(profile => profile.id === state.profileId)?.name || 'Perfil local';
  const workspaceName = activeWorkspace?.name || 'Espaço pessoal';
  const blockedCount = state.trackerProtection.blockedRequests;
  const zoomPercent = Math.round((tab?.zoom || 1) * 100);
  async function copyText(text: string, message: string) { try { await window.cypher.invoke('clipboard:write', text); notify(message); } catch { notify('Não foi possível copiar o endereço.'); } }
  const paletteCommands: PaletteCommand[] = [
    { id: 'new-tab', title: 'Nova aba', hint: 'Ctrl T', icon: <Plus size={16}/>, keywords: 'abrir', run: () => void act('tab:new') },
    { id: 'private-tab', title: 'Nova aba privada', hint: 'Ctrl Shift N', icon: <Shield size={16}/>, keywords: 'anonima incognito', run: () => void act('tab:new', { private: true }) },
    { id: 'restore-tab', title: 'Reabrir aba fechada', hint: 'Ctrl Shift T', icon: <Undo2 size={16}/>, keywords: 'restaurar desfazer', run: () => void act('tab:restore') },
    ...(tab ? [{ id: 'duplicate', title: 'Duplicar aba atual', icon: <CopyPlus size={16}/>, keywords: 'clonar copia', run: () => void act('tab:duplicate', tab.id) }, { id: 'close-others', title: 'Fechar outras abas', icon: <ListX size={16}/>, keywords: 'limpar', run: () => void act('tab:close-others', tab.id) }] : []),
    ...(tab && !page ? [{ id: 'copy-link', title: 'Copiar endereço da página', icon: <Link2 size={16}/>, keywords: 'url link compartilhar', run: () => void copyText(tab.url, 'Endereço copiado.') }, { id: 'bookmark', title: state.bookmarks.some(b => b.url === tab.url) ? 'Remover dos favoritos' : 'Favoritar esta página', hint: 'Ctrl D', icon: <Star size={16}/>, keywords: 'estrela salvar', run: () => void act('bookmark:toggle') }, { id: 'find', title: 'Localizar na página', hint: 'Ctrl F', icon: <Search size={16}/>, keywords: 'buscar procurar', run: () => { setFind(true); setTimeout(() => findRef.current?.focus(), 0); } }] : []),
    { id: 'inspector', title: inspecting ? 'Sair do modo edição' : 'Editar a interface', hint: 'Ctrl E', icon: <PenTool size={16}/>, keywords: 'inspetor personalizar mudar design', run: toggleInspector },
    ...(external ? [
      { id: 'reader', title: 'Modo leitura', hint: 'Ctrl Shift R', icon: <BookOpen size={16}/>, keywords: 'ler artigo limpo', run: () => void act('page:reader') },
      { id: 'capture', title: 'Capturar e anotar a tela', hint: 'Ctrl Shift S', icon: <Camera size={16}/>, keywords: 'print screenshot', run: () => void startCapture() },
      { id: 'split', title: splitActive ? 'Fechar tela dividida' : 'Dividir tela com a última aba', hint: 'Ctrl Shift D', icon: <Columns2 size={16}/>, keywords: 'lado a lado dividir', run: () => void act('split:toggle') },
      { id: 'site-color', title: 'Usar a cor deste site como destaque', icon: <Pipette size={16}/>, keywords: 'cor tema', run: () => void useSiteColor() },
    ] : []),
    ...(splitActive ? [{ id: 'split-swap', title: 'Trocar lados da tela dividida', icon: <ArrowLeftRight size={16}/>, run: () => void act('split:swap') }] : []),
    ...s.webPanels.map(panel => ({ id: `panel-${panel.id}`, title: `${state.openPanelId === panel.id ? 'Fechar' : 'Abrir'} painel ${panel.title}`, icon: <PanelRight size={16}/>, keywords: 'painel lateral', run: () => void act('panel:toggle', panel.id) })),
    ...s.containers.map(item => ({ id: `container-${item.id}`, title: `Nova aba em ${item.name}`, icon: <Boxes size={16}/>, keywords: 'conteiner isolado', run: () => void act('tab:new', { containerId: item.id }) })),
    { id: 'shortcuts', title: 'Editar atalhos de teclado', icon: <Command size={16}/>, keywords: 'teclas', run: () => openPage('settings', { category: 'shortcuts' }) },
    { id: 'settings', title: 'Configurações', icon: <SlidersHorizontal size={16}/>, keywords: 'preferencias ajustes', run: () => openPage('settings') },
    { id: 'history', title: 'Histórico', hint: 'Ctrl H', icon: <Clock3 size={16}/>, run: () => openPage('history') },
    { id: 'downloads', title: 'Downloads', hint: 'Ctrl J', icon: <Download size={16}/>, keywords: 'arquivos baixados', run: () => openPage('downloads') },
    { id: 'bookmarks', title: 'Favoritos', icon: <Star size={16}/>, run: () => openPage('bookmarks') },
    { id: 'productivity', title: 'Espaços e pesquisa', icon: <Layers3 size={16}/>, keywords: 'workspace leitura', run: () => openPage('productivity') },
    { id: 'mods', title: 'Mods e temas', icon: <Sparkles size={16}/>, keywords: 'aparencia visual', run: () => openPage('mods') },
    { id: 'extensions', title: 'Extensões', icon: <Puzzle size={16}/>, run: () => openPage('extensions') },
    { id: 'security', title: 'Segurança e permissões', icon: <ShieldCheck size={16}/>, keywords: 'privacidade', run: () => openPage('security') },
    { id: 'zoom-reset', title: `Redefinir zoom (${zoomPercent}%)`, hint: 'Ctrl 0', icon: <ZoomIn size={16}/>, keywords: 'tamanho', run: () => void act('zoom', 1) },
    { id: 'fullscreen', title: 'Tela cheia', hint: 'F11', icon: <Maximize size={16}/>, run: () => void act('window:fullscreen') },
    { id: 'compact', title: s.compact ? 'Expandir barra de abas' : 'Recolher barra de abas', icon: s.compact ? <PanelLeftOpen size={16}/> : <PanelLeftClose size={16}/>, keywords: 'sidebar lateral', run: () => settings({ compact: !s.compact }) },
    { id: 'bookmarks-bar', title: s.showBookmarksBar ? 'Ocultar barra de favoritos' : 'Mostrar barra de favoritos', icon: <Star size={16}/>, run: () => settings({ showBookmarksBar: !s.showBookmarksBar }) },
    { id: 'appearance', title: s.appearanceMode === 'dark' ? 'Usar tema claro' : 'Usar tema escuro', icon: <Monitor size={16}/>, keywords: 'modo claro escuro tema', run: () => settings(s.appearanceMode === 'dark' ? { appearanceMode: 'light', accent: '#587b35', surface: '#ffffff', background: '#f0f3ee' } : { appearanceMode: 'dark', accent: '#b6f36a', surface: '#111513', background: '#090c0b' }) },
  ];
  const nav: { key: InternalPage; icon: typeof Home; title: string }[] = [{ key: browserPages.home, icon: Home, title: 'Home' }, { key: browserPages.productivity, icon: Layers3, title: 'Espaços e pesquisa' }, { key: browserPages.bookmarks, icon: Star, title: 'Favoritos' }, { key: browserPages.history, icon: Clock3, title: 'Histórico' }, { key: browserPages.downloads, icon: Download, title: 'Downloads' }, { key: browserPages.extensions, icon: Puzzle, title: 'Extensões' }, { key: browserPages.mods, icon: Sparkles, title: 'Mods' }];
  return <div className={`app ${isSide ? 'side-tabs' : 'top-tabs'} ${s.compact ? 'compact' : ''} ${!s.motion ? 'no-motion' : ''} ${pageFullscreen ? 'page-fullscreen' : ''} ${inspecting ? 'inspecting' : ''}`} data-appearance={effectiveMode} data-skin={s.skin} data-toolbar-position={s.toolbarPosition} data-autohide={s.tabsAutoHide ? (sidebarPeek ? 'peek' : 'hidden') : undefined} data-rail={s.showRail ? 'on' : 'off'}
    onMouseDownCapture={event => { if (!inspecting) return; const target = (event.target as Element).closest('[data-inspect], .inspector-panel'); if (target && !target.classList.contains('inspector-panel')) event.preventDefault(); }}
    onClickCapture={event => { if (!inspecting) return; const target = (event.target as Element).closest('[data-inspect], .inspector-panel'); if (!target || target.classList.contains('inspector-panel')) return; event.preventDefault(); event.stopPropagation(); setInspectTarget(target.getAttribute('data-inspect') as InspectTarget); }} data-button-shape={s.buttonShape} data-interface-effect={s.interfaceEffect} style={style}>
    {userCss && <style data-cypher-user-css="">{userCss}</style>}
    <header className="titlebar">
      <div className="brand" data-inspect="brand"><Logo /><span>CYPHER</span></div>
      <div className="titlebar-right"><IconButton className="window-control window-minimize" label="Minimizar" onClick={() => act('window:minimize')}><WindowMinimizeIcon/></IconButton><IconButton className="window-control window-maximize" label={state.maximized ? 'Restaurar janela' : 'Maximizar'} onClick={() => act('window:maximize')}><WindowMaximizeIcon restore={state.maximized}/></IconButton><IconButton className="window-control window-close" label="Fechar navegador" onClick={() => act('window:close')}><WindowCloseIcon/></IconButton></div>
    </header>
    <div className="browser-body">
      <nav className="rail" aria-label="Navegação do Cypher" data-inspect="rail"><div className="rail-top"><div className="rail-monogram">C<span>_</span></div>{nav.map(({ key, icon: Icon, title }) => <IconButton key={key} label={title} active={page === key} onClick={() => openPage(key)}><Icon size={19}/>{key === 'downloads' && state.downloads.some(d => d.state === 'progressing') && <i className="notification-dot"/>}</IconButton>)}</div><div className="rail-bottom">{s.webPanels.map(panel => <IconButton key={panel.id} className="panel-launcher" label={`Painel ${panel.title}`} active={state.openPanelId === panel.id} onClick={() => void act('panel:toggle', panel.id)}><span className="panel-glyph">{panel.title.slice(0, 1).toUpperCase()}</span></IconButton>)}<IconButton label="Adicionar painel lateral" onClick={() => setPanelDraft('')}><PanelRight size={18}/></IconButton><IconButton label="Segurança" active={page === 'security'} onClick={() => openPage('security')}><ShieldCheck size={19}/></IconButton><IconButton label="Configurações" active={page === 'settings'} onClick={() => openPage('settings')}><SlidersHorizontal size={19}/></IconButton><button type="button" className={cn('profile-avatar',page === 'profile' && 'active')} title="Perfil" aria-label="Perfil" onClick={() => openPage('profile')}>{s.profilePhoto ? <img src={s.profilePhoto} alt=""/> : <span>EU</span>}</button></div></nav>
      {isSide && <aside className="tab-sidebar" data-inspect="tabs" onMouseEnter={() => { if (!s.tabsAutoHide) return; clearTimeout(peekTimer.current); setSidebarPeek(true); }} onMouseLeave={() => { if (!s.tabsAutoHide) return; clearTimeout(peekTimer.current); peekTimer.current = setTimeout(() => setSidebarPeek(false), 420); }}><div className="workspace-heading"><div className="workspace-mark"><ScanLine size={18}/></div><div className="workspace-text"><strong>{workspaceName}</strong><span>{profileName.toLowerCase() === workspaceName.toLowerCase() ? `PERFIL · ${visibleTabs.length} ${visibleTabs.length === 1 ? 'ABA' : 'ABAS'}` : profileName.toUpperCase()}</span></div><IconButton label={s.compact ? 'Expandir abas' : 'Recolher abas'} onClick={() => settings({ compact: !s.compact })}>{s.compact ? <PanelLeftOpen size={16}/> : <PanelLeftClose size={16}/>}</IconButton></div><div className="tabs-heading"><span>ABAS ABERTAS</span><span>{visibleTabs.length.toString().padStart(2,'0')}</span></div><div className="tabs-list" aria-label="Abas abertas">{renderSidebarTabs()}</div><button className="new-tab-button" title="Nova aba · Ctrl T" onClick={() => act('tab:new')}><Plus size={17}/><span>Nova aba</span><kbd>Ctrl T</kbd></button><div className="sidebar-spacer"/></aside>}
      <main className="main-shell">
        {!isSide && <div className="horizontal-tabs" data-inspect="tabs">{orderedTabs.map(renderTab)}<IconButton label="Nova aba · Ctrl T" onClick={() => act('tab:new')}><Plus size={17}/></IconButton></div>}
        <div className="toolbar" data-inspect="toolbar">{toolbarShown('navigation') && <div className="navigation-controls" style={toolbarOrder('navigation')}><IconButton label="Voltar · Alt ←" disabled={!tab?.canGoBack} onClick={() => act('back')}><ArrowLeft size={18}/></IconButton><IconButton label="Avançar · Alt →" disabled={!tab?.canGoForward} onClick={() => act('forward')}><ArrowRight size={18}/></IconButton><IconButton label={tab?.loading ? 'Parar carregamento' : 'Recarregar · Ctrl R'} onClick={() => act(tab?.loading ? 'stop' : 'reload')}>{tab?.loading ? <X size={17}/> : <RotateCw size={17}/>}</IconButton></div>}
          <form ref={addressFormRef} data-inspect="address" style={toolbarOrder('address')} className={`addressbar ${addressFocus ? 'focused' : ''}`} onSubmit={event => { event.preventDefault(); navigate(address); }}>
            <span className="address-status" title={page ? 'Página interna do Cypher' : tab?.url.startsWith('https:') ? 'Conexão HTTPS' : 'Conexão sem HTTPS'}>{page ? <Command size={15}/> : tab?.url.startsWith('https:') ? <LockKeyhole size={14}/> : <AlertCircle size={14}/>}</span>
            <input ref={addressRef} aria-label="Endereço ou pesquisa" placeholder="Pesquise ou digite um endereço" value={address} onChange={event => setAddress(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); navigate(event.currentTarget.value); } }} onFocus={() => setAddressFocus(true)} onBlur={() => setTimeout(() => setAddressFocus(false), 120)} spellCheck={false}/>
            {zoomPercent !== 100 && !page && <button type="button" className="zoom-badge" title="Redefinir zoom · Ctrl 0" aria-label={`Zoom em ${zoomPercent}%. Redefinir para 100%`} onClick={() => act('zoom', 1)}><ZoomIn size={13}/>{zoomPercent}%</button>}
            {tab?.private && <span className="private-badge"><Shield size={12}/> Privada</span>}
            <span className="toolbar-popover-anchor">
              <button type="button" className={`tracker-toolbar-button ${s.blockAds || s.blockTrackers ? 'is-active' : ''}`} aria-label="Proteção contra anúncios e rastreadores" aria-expanded={trackerPanelOpen} onClick={() => { setTrackerPanelOpen(!trackerPanelOpen); setPopupPanelOpen(false); setSkinMenu(false); setMenu(false); setAddressFocus(false); }} title="Proteção de navegação"><ShieldCheck size={15}/>{blockedCount > 0 && <span className="tracker-toolbar-count">{blockedCount > 999 ? `${Math.floor(blockedCount / 1000)}k` : blockedCount}</span>}</button>
              {trackerPanelOpen && <div className="tracker-panel-row"><TrackerProtectionPanel settings={s} status={state.trackerProtection} tab={tab} onSettings={settings} onClose={() => setTrackerPanelOpen(false)} onConfigure={() => openPage(browserPages.settings, { category: 'privacy', focusId: 'privacy-ad-block' })} onClearSite={origin => { if (window.confirm(`Limpar cookies, dados locais e permissões de ${origin}? Isso pode desconectar você do site.`)) void act('site-data:clear',{ origin }).then(() => notify('Dados e permissões do site removidos.')); }}/></div>}
            </span>
            <span className="toolbar-popover-anchor">
              <button type="button" className={`popup-toolbar-button ${s.blockPopups ? 'is-active' : ''}`} aria-label={`Bloqueador de pop-ups, ${state.popupProtection.pending.length} solicitações aguardando`} aria-expanded={popupPanelOpen} onClick={() => { setPopupPanelOpen(!popupPanelOpen); setTrackerPanelOpen(false); setSkinMenu(false); setMenu(false); setAddressFocus(false); }} title="Bloqueador de pop-ups"><Ban size={15}/>{state.popupProtection.pending.length > 0 && <span className="popup-toolbar-count">{state.popupProtection.pending.length > 99 ? '99+' : state.popupProtection.pending.length}</span>}</button>
              {popupPanelOpen && <div className="popup-panel-row"><PopupProtectionPanel settings={s} status={state.popupProtection} tab={tab} onSettings={settings} onClose={() => setPopupPanelOpen(false)} onAction={(id,action) => { void act('popup:action',{ id, action }); }} onClear={() => { void act('popup:clear'); }} onConfigure={() => openPage(browserPages.settings, { category: 'privacy', focusId: 'privacy-popups' })}/></div>}
            </span>
            {external && <>
              <IconButton className="address-tool" label="Modo leitura · Ctrl Shift R" onClick={() => void act('page:reader')}><BookOpen size={15}/></IconButton>
              <IconButton className="address-tool" label="Capturar e anotar · Ctrl Shift S" onClick={() => void startCapture()}><Camera size={15}/></IconButton>
              <IconButton className="address-tool" label={splitActive ? 'Fechar tela dividida · Ctrl Shift D' : 'Dividir tela · Ctrl Shift D'} active={splitActive} onClick={() => void act('split:toggle')}><Columns2 size={15}/></IconButton>
            </>}
            <IconButton label="Favoritar esta página · Ctrl D" disabled={!!page} active={state.bookmarks.some(b => b.url === tab?.url)} onClick={() => act('bookmark:toggle')}><Star size={16}/></IconButton>
          </form>
          {toolbarShown('routes') && <div className={`connection-launchers route-${tab?.connectionMode || s.connectionMode}`} role="group" aria-label="Selecionar rede de conexão" data-inspect="routes" style={toolbarOrder('routes')}>
            <button type="button" className={(tab?.connectionMode || s.connectionMode) === 'normal' ? 'active' : ''} aria-pressed={(tab?.connectionMode || s.connectionMode) === 'normal'} onClick={() => { setAddressFocus(false); void act('connection:select','normal'); }} title="Usar a conexão normal do sistema"><Globe2 size={14}/><span>Normal</span></button>
            <button type="button" className={(tab?.connectionMode || s.connectionMode) === 'tor' ? 'active' : ''} aria-pressed={(tab?.connectionMode || s.connectionMode) === 'tor'} onClick={() => { setAddressFocus(false); void act('connection:select',(tab?.connectionMode || s.connectionMode) === 'tor' ? 'normal' : 'tor'); }} title="Iniciar Tor · Todas as abas serão movidas para essa rota"><VenetianMask size={14}/><span>{(tab?.connectionMode || s.connectionMode) === 'tor' ? 'Tor ativo' : 'Iniciar Tor'}</span></button>
            <button type="button" className={(tab?.connectionMode || s.connectionMode) === 'i2p' ? 'active' : ''} aria-pressed={(tab?.connectionMode || s.connectionMode) === 'i2p'} onClick={() => { setAddressFocus(false); void act('connection:select',(tab?.connectionMode || s.connectionMode) === 'i2p' ? 'normal' : 'i2p'); }} title="Iniciar I2P · Todas as abas serão movidas para essa rota"><Waypoints size={14}/><span>{(tab?.connectionMode || s.connectionMode) === 'i2p' ? 'I2P ativo' : 'Iniciar I2P'}</span></button>
          </div>}
          {toolbarShown('skin') && <span className="toolbar-popover-anchor skin-anchor" style={toolbarOrder('skin')}>
            <button type="button" className="skin-chip" aria-haspopup="menu" aria-expanded={skinMenu} title="Trocar a pele da interface" onClick={() => { setSkinMenu(!skinMenu); setMenu(false); setTrackerPanelOpen(false); setPopupPanelOpen(false); setAddressFocus(false); }}><SkinGlyph skin={s.skin}/><span>Pele: {s.skin === 'recorte' ? 'Recorte' : 'Clássico'}</span><ChevronDown size={13}/></button>
            {skinMenu && <div className="skin-menu" role="menu" aria-label="Pele da interface">
              <span className="eyebrow">PELE DA INTERFACE</span>
              {([['recorte', 'Recorte', 'Silhuetas cortadas e tipografia condensada'], ['classic', 'Clássico', 'Cantos suaves e o visual original']] as const).map(([value, title, detail]) => <button type="button" role="menuitemradio" aria-checked={s.skin === value} key={value} className={s.skin === value ? 'chosen' : ''} onClick={() => { settings({ skin: value }); setSkinMenu(false); }}><SkinGlyph skin={value}/><span><strong>{title}</strong><small>{detail}</small></span>{s.skin === value && <Check size={15}/>}</button>)}
              <div className="menu-separator"/>
              <button type="button" role="menuitem" onClick={() => { setSkinMenu(false); toggleInspector(); }}><PenTool size={16}/><span><strong>Editar a interface</strong><small>Clique em qualquer parte para mudar · Ctrl E</small></span><ArrowRight size={14}/></button>
              <button type="button" role="menuitem" onClick={() => openPage('mods')}><Sparkles size={16}/><span><strong>Mais visuais</strong><small>Mods de cor, importar e exportar</small></span><ArrowRight size={14}/></button>
            </div>}
          </span>}
          {toolbarShown('media') && <IconButton style={toolbarOrder('media')} label={pageMedia?.playing ? `Abrir miniplayer · ${pageMedia.title}` : 'Abrir miniplayer'} active={!!pageMedia?.playing || s.backgroundMusicEnabled} onClick={() => void act('media:window:toggle')}><Music2 size={17}/></IconButton>}
          {toolbarShown('customize') && <IconButton style={toolbarOrder('customize')} label="Personalizar Cypher" onClick={() => openPage('settings')}><SlidersHorizontal size={18}/></IconButton>}<IconButton style={toolbarOrder('menu')} label="Menu do navegador" active={menu} onClick={() => { setMenu(!menu); setSkinMenu(false); setTrackerPanelOpen(false); setPopupPanelOpen(false); setAddressFocus(false); }}><MoreHorizontal size={21}/></IconButton>
        </div>
        {s.showBookmarksBar && <div className="bookmarks-bar" aria-label="Barra de favoritos"><div className="bookmarks-items">{state.bookmarks.length ? state.bookmarks.slice(0, 12).map(bookmark => <button type="button" className="bookmark-chip" key={bookmark.id} title={bookmark.url} onClick={() => navigate(bookmark.url)} onAuxClick={event => { if (event.button === 1) void act('tab:new', { url: bookmark.url }); }}><span>{bookmark.title.trim().slice(0, 1).toUpperCase() || <Globe2 size={13}/>}</span><strong>{bookmark.title || hostname(bookmark.url)}</strong></button>) : <button type="button" className="bookmarks-empty" onClick={() => openPage('bookmarks')}>Seus favoritos aparecerão aqui</button>}</div><button type="button" className="bookmark-manage" title="Gerenciar favoritos" onClick={() => openPage('bookmarks')}><MoreHorizontal size={16}/></button></div>}
        {find && <form className="findbar" onSubmit={event => { event.preventDefault(); void act('find', { text: query }); }}><Search size={15}/><input ref={findRef} placeholder="Localizar nesta página" aria-label="Localizar nesta página" value={query} onChange={event => { setQuery(event.target.value); if (!event.target.value) setFindResult(null); void act('find', { text: event.target.value }); }} onKeyDown={event => { if (event.key === 'Enter' && event.shiftKey) { event.preventDefault(); void act('find', { text: query, forward: false }); } }}/><span className={cn('find-count', query && findResult?.matches === 0 && 'empty')} aria-live="polite">{query && findResult ? findResult.matches ? `${findResult.active} de ${findResult.matches}` : 'Nenhum resultado' : ''}</span><IconButton label="Resultado anterior" onClick={() => act('find', { text: query, forward: false })}><ArrowLeft size={15}/></IconButton><IconButton label="Próximo resultado" onClick={() => act('find', { text: query })}><ArrowRight size={15}/></IconButton><IconButton label="Fechar pesquisa" onClick={() => { setFind(false); void act('find', { text: '' }); }}><X size={15}/></IconButton></form>}
        <div className="content-row">
        <div className={`viewport ${page ? 'internal' : 'external'} ${splitActive ? 'split' : ''}`} ref={viewportRef} data-inspect="page">
          {splitActive && splitPair && <div className="split-divider" role="separator" aria-orientation="vertical" aria-label="Arraste para ajustar a divisão" style={{ left: `calc(${splitPair.ratio * 100}% - 3px)` }} onPointerDown={event => event.currentTarget.setPointerCapture(event.pointerId)} onPointerMove={event => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) return; const rect = viewportRef.current!.getBoundingClientRect(); const ratio = (event.clientX - rect.left) / rect.width; cancelAnimationFrame(splitFrame.current); splitFrame.current = requestAnimationFrame(() => void act('split:ratio', ratio)); }} onDoubleClick={() => void act('split:ratio', 0.5)}/>}
          {page === 'newtab' && <HomePage key={tab?.id} settings={{ ...s, appearanceMode: effectiveMode }} modWallpaper={state.modEffects?.wallpaper} data={state.homeData} bookmarks={state.bookmarks} isPrivate={!!tab?.private} navigate={navigate} openSettings={() => openPage('settings')} save={home => window.cypher.invoke('settings', { home })} command={(action,payload) => window.cypher.invoke(action,payload)}/>}
          {page && page !== 'newtab' && <div className={`internal-page page-${page} ${isCentral ? 'settings-internal' : ''}`}>{!isCentral && <div className="page-heading"><span className="eyebrow">CYPHER / {pageLabels[page]?.toUpperCase()}</span><h1>{page === 'mods' ? <>Mude a <em>frequência.</em></> : pageLabels[page]}</h1><p>{({ security: 'Gerencie rotas por aba, privacidade da sessão e as permissões salvas para cada site.', extensions: 'Adicione extensões locais compatíveis. Extensões e mods têm funções diferentes.', profile: 'Sua identidade local neste dispositivo.', mods: 'Uma nova atmosfera em um clique. Encontre a sua.', bookmarks: 'Guarde os lugares para onde você quer voltar.', history: 'Os caminhos que você percorreu. Abas privadas ficam fora daqui.', downloads: 'Seus arquivos, em um só lugar.', productivity:'Organize contextos de navegação e reúna páginas para consultar depois.' })[page]}</p></div>}
            {isCentral && <SettingsCenter settings={s} update={state.update} trackerProtection={state.trackerProtection} profileSync={state.profileSync} hardwareAccelerationPending={state.hardwareAccelerationPending} tabs={state.tabs} activeTabId={state.activeId} initialCategory={centralAlias[page] || settingsDestination.category} focusSettingId={settingsDestination.focusId} focusStamp={settingsDestination.stamp} onSettings={settings} command={act} navigate={openPage} skins={state.skins}
              privacyStats={state.privacyStats} sitePermissions={state.sitePermissions} profiles={state.profiles} profileId={state.profileId} extensions={state.extensions} connectionMode={state.settings.connectionMode} onChooseProfilePhoto={() => void chooseProfilePhoto()}/>}
            {page === 'productivity' && <ProductivityCenter tabs={state.tabs} activeTab={tab} workspaces={state.workspaces} activeWorkspaceId={state.activeWorkspaceId} researchItems={state.researchItems} command={act} navigate={navigate}/>}
            {page === 'mods' && <ModsStore settings={s} packages={state.modPackages || []} command={act} onSettings={settings} notify={notify} themes={<><div className="collection-toolbar"><span><span className="live-dot"/> {state.mods.length} TEMAS RÁPIDOS · SÓ CORES E PAPEL DE PAREDE</span><div><button className="button secondary" onClick={() => act('mod:import')}><Download size={15}/> Importar tema</button><button className="button primary" onClick={() => act('mod:export')}><Upload size={15}/> Exportar tema</button></div></div><div className="mods-grid">{state.mods.map(mod => <article key={mod.id} className={`mod-card ${s.activeMod === mod.id ? 'mod-active' : ''}`}><div className={`mod-preview mod-${mod.settings.wallpaper}`} style={{ '--mod-accent': mod.settings.accent, '--mod-bg': mod.settings.background, '--mod-surface': mod.settings.surface } as CSSProperties}><div className="mini-rail"/><div className="mini-sidebar"><i/><i/><i/></div><div className="mini-main"><div className="mini-address"/><div className="mini-orbit"/><span>Seu próximo<br/><b>universo.</b></span></div><span className="mod-preview-tag">{mod.custom ? 'COMUNIDADE' : 'CYPHER COLLECTION'}</span></div><div className="mod-info"><div><span className="eyebrow">POR {mod.author.toUpperCase()}</span><h2>{mod.name}</h2><p>{mod.description}</p></div><div className="mod-actions"><button className={`button ${s.activeMod === mod.id ? 'secondary' : 'primary'}`} onClick={() => act('mod:apply', mod.id)}>{s.activeMod === mod.id ? <><Check size={15}/> Em uso</> : <>Aplicar mod <ArrowUpRight size={15}/></>}</button>{mod.custom && <IconButton label="Remover mod" onClick={() => act('mod:remove', mod.id)}><Trash2 size={16}/></IconButton>}</div></div></article>)}</div><div className="info-note"><Puzzle size={19}/><div><strong>Mods visuais e extensões locais.</strong><p>Mods importados ajustam a aparência com segurança. Extensões Chromium descompactadas podem ser gerenciadas na seção Extensões; mods com código e marketplace ainda estão no roadmap.</p></div></div></>}/>}
            {(page === 'bookmarks' || page === 'history') && <><div className="collection-toolbar"><label className="filter-input"><Search size={16}/><input aria-label="Filtrar lista" placeholder="Encontre um endereço…" value={filter} onChange={event => setFilter(event.target.value)}/></label>{page === 'history' && <button className="button secondary" disabled={!state.history.length} onClick={() => act('history:clear')}><Trash2 size={15}/> Limpar histórico</button>}</div><div className="link-list">{(page === 'history' ? state.history : state.bookmarks).filter(link => (link.title + link.url).toLowerCase().includes(filter.toLowerCase())).map((link, index, list) => <div className="link-row-wrap" key={link.id}>{page === 'history' && (index === 0 || dayLabel(list[index - 1].date) !== dayLabel(link.date)) && <h3 className="link-day">{dayLabel(link.date)}</h3>}<div className="link-row"><span className="link-avatar">{hostname(link.url)[0]?.toUpperCase()}</span><button className="link-details" onClick={() => act('tab:new', { url: link.url })}><strong>{link.title}</strong><small>{link.url}</small></button><span className="link-date">{date(link.date)}</span><IconButton label="Abrir em nova aba" onClick={() => act('tab:new', { url: link.url })}><ArrowUpRight size={16}/></IconButton><IconButton label="Copiar endereço" onClick={() => void copyText(link.url, 'Endereço copiado.')}><Copy size={15}/></IconButton><IconButton label="Remover item" onClick={() => act(page === 'history' ? 'history:remove' : 'bookmark:remove', link.id)}><Trash2 size={15}/></IconButton></div></div>)}</div>{!(page === 'history' ? state.history : state.bookmarks).length && <Empty icon={page === 'history' ? <Clock3/> : <Star/>} title={page === 'history' ? 'Toda jornada começa em algum lugar.' : 'Seus próximos lugares favoritos.'} description={page === 'history' ? 'Suas páginas visitadas aparecerão aqui.' : 'Clique na estrela da barra de endereço para guardar uma página.'}/>}</>}
            {page === 'downloads' && <><div className="collection-toolbar"><span>{state.downloads.length} ARQUIVOS</span><span className="muted-text">Os arquivos são salvos na pasta escolhida no download.</span></div><div className="link-list">{state.downloads.map(item => <div className="download-row" key={item.id}><div className="link-avatar"><Download size={19}/></div><div className="download-details"><strong>{item.name}</strong><small>{({ progressing: 'Baixando', paused: 'Pausado', completed: 'Concluído', cancelled: 'Cancelado', interrupted: 'Interrompido' } as Record<string,string>)[item.state] || item.state} · {size(item.received)}{item.total ? ` / ${size(item.total)}` : ''}{item.private ? ' · Privado' : ''}</small>{['progressing','paused'].includes(item.state) && <progress value={item.received} max={item.total || 1}/>}</div>{item.state === 'completed' && <IconButton label="Mostrar na pasta" onClick={() => act('download:action', { id: item.id, action: 'show' })}><FolderOpen size={18}/></IconButton>}{['progressing','paused'].includes(item.state) ? <><IconButton label={item.state === 'paused' ? 'Continuar' : 'Pausar'} onClick={() => act('download:action', { id: item.id, action: item.state === 'paused' ? 'resume' : 'pause' })}>{item.state === 'paused' ? <Play size={16}/> : <Pause size={16}/>}</IconButton><IconButton label="Cancelar download" onClick={() => act('download:action', { id: item.id, action: 'cancel' })}><X size={17}/></IconButton></> : <IconButton label="Remover da lista" onClick={() => act('download:action', { id: item.id, action: 'remove' })}><Trash2 size={16}/></IconButton>}</div>)}</div>{!state.downloads.length && <Empty icon={<Download/>} title="Tudo pronto para o próximo download." description="Acompanhe o progresso e encontre seus arquivos por aqui."/>}</>}
          </div>}
          {tab?.error && <div className="error-page"><AlertCircle size={40}/><h1>Não chegamos a esse lugar.</h1><p>Confira o endereço e sua conexão, depois tente novamente.</p><code>{tab.error}</code><button className="button primary" onClick={() => act('reload')}><RotateCw size={16}/> Tentar novamente</button></div>}
          {overlay && pageSnapshot.length > 0 && <div className="page-snapshot" aria-hidden="true">{pageSnapshot.map(shot => <img key={`${shot.x}-${shot.y}`} src={shot.dataUrl} alt="" style={{ left: shot.x, top: shot.y, width: shot.width, height: shot.height }}/>)}</div>}
          {!page && !tab?.error && overlay && !pageSnapshot.length && <div className="obscured-page"><Globe2 size={32}/><span>{tab?.title}</span><small>{inspecting ? 'Modo edição · clique na interface para mudá-la' : 'A página continua aberta'}</small></div>}
        </div>
        {openPanel && <aside className="web-panel" aria-label={`Painel ${openPanel.title}`}><header><strong>{openPanel.title}</strong><IconButton label="Abrir em uma aba" onClick={() => void act('tab:new', { url: openPanel.url })}><ExternalLink size={14}/></IconButton><IconButton label="Fechar painel" onClick={() => void act('panel:toggle', openPanel.id)}><X size={15}/></IconButton></header><div className="web-panel-view" ref={panelRef}>{overlay && <div className="obscured-page"><PanelRight size={24}/><small>{openPanel.title}</small></div>}</div></aside>}
        </div>
      </main>
    </div>
    {addressFocus && <div className="address-suggestions" style={addressRect ? (s.toolbarPosition === 'bottom' ? { left: addressRect.left, bottom: addressRect.bottom, top: 'auto', width: addressRect.width, right: 'auto' } : { left: addressRect.left, top: addressRect.top, width: addressRect.width, right: 'auto' }) : undefined}><button onMouseDown={event => event.preventDefault()} onClick={() => navigate(address)}><Search size={17}/><span>{address || 'Digite um endereço ou uma pesquisa'}</span><kbd>Enter</kbd></button>{s.showSearchSuggestions && suggestions.map(link => <button key={link.id} onMouseDown={event => event.preventDefault()} onClick={() => navigate(link.url)}><Clock3 size={16}/><span><strong>{link.title}</strong><small>{link.url}</small></span><ArrowUpRight size={15}/></button>)}</div>}
    {menu && <><div className="menu-backdrop" onClick={() => setMenu(false)}/><div className="browser-menu"><span className="eyebrow">CYPHER / CONTROLES</span>{[{ title: 'Nova aba', icon: Plus, action: () => act('tab:new'), key: 'Ctrl T' }, { title: 'Nova aba privada', icon: Shield, action: () => act('tab:new', { private: true }), key: 'Ctrl Shift N' }, { title: 'Reabrir aba fechada', icon: Undo2, action: () => act('tab:restore'), key: 'Ctrl Shift T' }, { title: 'Pesquisar abas e comandos', icon: Command, action: () => setPalette(true), key: 'Ctrl Shift A' }, { title: 'Editar a interface', icon: PenTool, action: toggleInspector, key: 'Ctrl E' }, ...s.containers.map(item => ({ title: `Nova aba em ${item.name}`, icon: Boxes, action: () => act('tab:new', { containerId: item.id }), key: '' })), { title: 'Favoritos', icon: Star, action: () => openPage('bookmarks'), key: '' }, { title: 'Histórico', icon: Clock3, action: () => openPage('history'), key: 'Ctrl H' }, { title: 'Downloads', icon: Download, action: () => openPage('downloads'), key: 'Ctrl J' }].map(item => <button key={item.title} onClick={() => { setMenu(false); item.action(); }}><item.icon size={16}/><span>{item.title}</span><kbd>{item.key}</kbd></button>)}<div className="menu-separator"/><div className="zoom-controls"><span>Zoom</span><IconButton label="Reduzir zoom" onClick={() => act('zoom', (tab?.zoom || 1) - 0.1)}><Minus size={15}/></IconButton><button onClick={() => act('zoom', 1)}>{Math.round((tab?.zoom || 1) * 100)}%</button><IconButton label="Ampliar zoom" onClick={() => act('zoom', (tab?.zoom || 1) + 0.1)}><Plus size={15}/></IconButton></div>{[...(external ? [{ title: 'Modo leitura', icon: BookOpen, action: () => act('page:reader') }, { title: 'Capturar e anotar', icon: Camera, action: () => startCapture() }, { title: splitActive ? 'Fechar tela dividida' : 'Dividir tela', icon: Columns2, action: () => act('split:toggle') }] : []), { title: 'Localizar na página', icon: Search, action: () => { setFind(true); setTimeout(() => findRef.current?.focus(), 0); } }, { title: 'Salvar página', icon: Save, action: () => act('save') }, { title: 'Imprimir', icon: Printer, action: () => act('print') }, { title: 'Tela cheia', icon: Maximize, action: () => act('window:fullscreen') }, { title: 'Ferramentas de desenvolvedor', icon: Code2, action: () => act('devtools') }, { title: 'Personalizar Cypher', icon: SlidersHorizontal, action: () => openPage('settings') }].map(item => <button key={item.title} onClick={() => { setMenu(false); item.action(); }}><item.icon size={16}/><span>{item.title}</span><ChevronRight size={14}/></button>)}</div></>}
    {tabMenu && menuTab && <><div className="menu-backdrop" onClick={() => setTabMenu(null)} onContextMenu={event => { event.preventDefault(); setTabMenu(null); }}/><div className="tab-context-menu browser-menu" role="menu" style={{ left: Math.min(tabMenu.x, window.innerWidth - 284), top: Math.min(tabMenu.y, window.innerHeight - 360) }}><span className="eyebrow">CONTROLES DA ABA</span>{[
      { title: 'Recarregar', icon: RotateCw, run: () => act('tab:reload', menuTab.id), hidden: !!internalPageFromUrl(menuTab.url) },
      { title: 'Duplicar aba', icon: CopyPlus, run: () => act('tab:duplicate', menuTab.id) },
      { title: menuTab.pinned ? 'Desafixar aba' : 'Fixar aba', icon: Pin, run: () => act('tab:pin', menuTab.id) },
      { title: menuTab.muted ? 'Ativar áudio' : 'Silenciar aba', icon: menuTab.muted ? Volume2 : VolumeX, run: () => act('tab:mute', menuTab.id) },
      { title: 'Copiar endereço', icon: Link2, run: () => copyText(menuTab.url, 'Endereço copiado.'), hidden: !/^https?:/i.test(menuTab.url) },
      { title: 'Dividir tela com esta aba', icon: Columns2, run: () => act('split:toggle', menuTab.id), hidden: !/^https?:/i.test(menuTab.url) || menuTab.id === state.activeId || !external },
      { title: 'Remover do grupo', icon: Tag, run: () => act('tab:group', { id: menuTab.id, group: '' }), hidden: !menuTab.group },
      ...s.containers.filter(item => item.id !== menuTab.containerId).map(item => ({ title: `Reabrir em ${item.name}`, icon: Boxes, run: () => act('tab:new', { url: menuTab.url, containerId: item.id }), hidden: !/^https?:/i.test(menuTab.url) || menuTab.private })),
      { title: '-', icon: X, run: () => undefined },
      { title: 'Fechar outras abas', icon: ListX, run: () => act('tab:close-others', menuTab.id), hidden: orderedTabs.length < 2 },
      { title: 'Reabrir aba fechada', icon: Undo2, run: () => act('tab:restore'), kbd: 'Ctrl Shift T' },
      { title: 'Fechar aba', icon: X, run: () => act('tab:close', menuTab.id), kbd: 'Ctrl W' },
    ].filter(item => !item.hidden).map(item => item.title === '-' ? <div key="separator" className="menu-separator"/> : <button key={item.title} role="menuitem" onClick={() => { setTabMenu(null); void item.run(); }}><item.icon size={16}/><span>{item.title}</span>{'kbd' in item && item.kbd && <kbd>{item.kbd}</kbd>}</button>)}
      <form className="menu-inline-form" onSubmit={event => { event.preventDefault(); if (!groupDraft.trim()) return; void act('tab:group', { id: menuTab.id, group: groupDraft.trim() }); setGroupDraft(''); setTabMenu(null); }}><Tag size={15}/><input aria-label="Adicionar a um grupo" placeholder={menuTab.group ? `Grupo: ${menuTab.group}` : 'Adicionar a um grupo…'} list="cypher-group-names" value={groupDraft} maxLength={50} onChange={event => setGroupDraft(event.target.value)}/><datalist id="cypher-group-names">{groupNames.map(name => <option key={name} value={name}/>)}</datalist></form>
    </div></>}
    {inspecting && <InspectorPanel settings={s} target={inspectTarget} canUndo={undoStack.length > 0} onSettings={settings} onUndo={undoInspector} onClose={() => { setInspecting(false); setInspectTarget(null); }} onSiteColor={() => void useSiteColor()}/>}
    {inspecting && !inspectTarget && <div className="inspect-banner" role="status"><PenTool size={15}/> Modo edição · clique em qualquer parte da interface · <kbd>Esc</kbd> para sair</div>}
    {captureImage && <CaptureEditor image={captureImage} command={(action, payload) => window.cypher.invoke(action, payload)} notify={notify} onClose={() => setCaptureImage('')}/>}
    {panelDraft !== null && <><div className="menu-backdrop" onClick={() => setPanelDraft(null)}/><form className="panel-draft browser-menu" onSubmit={event => { event.preventDefault(); if (!panelDraft.trim()) return; void act('panel:add', { url: panelDraft.trim() }).then(id => { if (id) setPanelDraft(null); }); }}><span className="eyebrow">NOVO PAINEL LATERAL</span><p>Fixe um site numa coluna ao lado da página, como WhatsApp, Spotify ou um tradutor.</p><input className="sc-input" autoFocus aria-label="Endereço do painel" placeholder="web.whatsapp.com" value={panelDraft} onChange={event => setPanelDraft(event.target.value)}/><div className="cz-actions"><button type="button" className="button secondary" onClick={() => setPanelDraft(null)}>Cancelar</button><button type="submit" className="button primary" disabled={!panelDraft.trim()}>Adicionar</button></div></form></>}
    {palette && <CommandPalette tabs={orderedTabs} activeId={state.activeId} bookmarks={state.bookmarks} history={state.history} commands={paletteCommands} onSelectTab={id => void act('tab:select', id)} onOpen={value => navigate(value)} onClose={() => setPalette(false)}/>}
    {toast && <div className="toast" role="status"><AlertCircle size={16}/><span>{toast}</span><button onClick={() => setToast('')} aria-label="Fechar aviso"><X size={15}/></button></div>}
    {state.update.state === 'available' && <aside className="update-notice" role="status" aria-live="polite"><span className="update-notice-icon"><Sparkles size={18}/></span><div className="update-notice-copy"><strong>Uma nova versão do Cypher chegou</strong><small>Versão {state.update.version}{state.update.releaseNotes ? ` · ${state.update.releaseNotes}` : ''}</small></div><button className="update-install-button" onClick={() => void act('update:install')}>Instalar agora <ArrowRight size={14}/></button><button className="update-dismiss-button" aria-label="Lembrar depois" title="Lembrar depois" onClick={() => void act('update:dismiss')}><X size={16}/></button></aside>}
    {state.update.state === 'complete' && <UpdateOnboarding version={state.update.version} releaseNotes={state.update.releaseNotes} onComplete={() => void act('update:ack')}/>}
    {['downloading','restarting'].includes(state.update.state) && <div className="update-screen" role="dialog" aria-modal="true" aria-label="Atualização do Cypher"><div className="update-card"><div className="update-animation"><span className="update-orbit update-orbit-one"/><span className="update-orbit update-orbit-two"/><Logo/></div><span className="sc-eyebrow">CYPHER / ATUALIZAÇÃO</span><h2>{state.update.state === 'restarting' ? 'Aplicando a nova versão.' : 'Preparando sua nova versão.'}</h2><p>{state.update.message}</p>{state.update.state === 'downloading' && <div className="update-progress"><span><i style={{ width: `${state.update.progress}%` }}/></span><small>{state.update.progress ? `${state.update.progress}%` : 'Conectando ao canal seguro'}</small></div>}<div className="update-loader" aria-label="Atualização em andamento"><i/><i/><i/></div></div></div>}
  </div>;
}
function UpdateOnboarding({ version, releaseNotes, onComplete }: { version: string; releaseNotes: string; onComplete: () => void }) {
  const changes = releaseNotes.split(/\r?\n/).map(line => line.trim().replace(/^[-*•]\s*/, '')).filter(Boolean);
  const steps = changes.length ? changes : ['A versão mais recente do Cypher está instalada e pronta para uso.'];
  const [step, setStep] = useState(0);
  const showingWelcome = step === 0;
  const change = steps[step - 1];
  const total = steps.length + 1;
  const ChangeIcon = showingWelcome ? Sparkles : /bloqueador|rastreador|proteção|permissões|segurança/i.test(change || '') ? ShieldCheck : /texto|fonte|acessibilidade|configurações/i.test(change || '') ? SlidersHorizontal : Sparkles;
  return <div className="update-screen update-onboarding-screen" role="dialog" aria-modal="true" aria-labelledby="update-onboarding-title">
    <section className="update-onboarding-card">
      <header className="update-onboarding-header"><div className="update-onboarding-brand"><Logo/><span>CYPHER</span><i/></div><button type="button" className="update-onboarding-skip" onClick={onComplete}>Pular apresentação</button></header>
      <div className="update-onboarding-progress" role="progressbar" aria-label="Progresso das novidades" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step + 1}>{Array.from({ length: total }, (_, index) => <i key={index} className={index <= step ? 'current' : ''}/>)}</div>
      <div className="update-onboarding-content" key={step}>
        <div className="update-onboarding-art" aria-hidden="true"><span className="update-onboarding-index">{String(step).padStart(2, '0')}</span><i className="update-onboarding-ring ring-one"/><i className="update-onboarding-ring ring-two"/><i className="update-onboarding-ring ring-three"/><span className="update-onboarding-art-icon"><ChangeIcon size={31}/></span><span className="update-onboarding-art-caption">{showingWelcome ? 'CYPHER / RELEASE' : `CYPHER / ${String(step).padStart(2, '0')}`}</span></div>
        <div className="update-onboarding-copy"><span className="sc-eyebrow">{showingWelcome ? `VERSÃO ${version}` : `NOVIDADE ${step} DE ${steps.length}`}</span><h1 id="update-onboarding-title">{showingWelcome ? 'O Cypher evoluiu.' : 'O que mudou.'}</h1><p>{showingWelcome ? 'A atualização foi concluída. Veja as novidades antes de voltar à navegação.' : change}</p>{showingWelcome && <span className="update-onboarding-summary">{steps.length} {steps.length === 1 ? 'novidade para conhecer' : 'novidades para conhecer'}</span>}</div>
      </div>
      <footer className="update-onboarding-footer"><span>{showingWelcome ? 'BEM-VINDO DE VOLTA' : `${step} / ${steps.length}`}</span><div>{step > 0 && <button type="button" className="update-onboarding-back" onClick={() => setStep(step - 1)}><ArrowLeft size={15}/> Anterior</button>}<button type="button" className="update-onboarding-next" onClick={() => showingWelcome ? setStep(1) : step < steps.length ? setStep(step + 1) : onComplete()}>{showingWelcome ? 'Ver novidades' : step === steps.length ? 'Começar a navegar' : 'Próxima novidade'} <ArrowRight size={15}/></button></div></footer>
    </section>
  </div>;
}
function SkinGlyph({ skin }: { skin: Settings['skin'] }) { return skin === 'recorte' ? <svg width="16" height="13" viewBox="0 0 36 30" aria-hidden="true"><path d="M0 0h28l8 8v22H6L0 24Z" fill="currentColor"/></svg> : <svg width="16" height="13" viewBox="0 0 36 30" aria-hidden="true"><rect width="36" height="30" rx="9" fill="currentColor"/></svg>; }
function Logo({ small = false }: { small?: boolean }) { return <svg className={`cypher-logo ${small ? 'small' : ''}`} width={small ? 18 : 25} height={small ? 18 : 25} viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M25 7H13L5 16l8 9h12l-5-6h-6l-3-3 3-3h6l5-6Z" fill="currentColor"/><path d="m25 14-3 3h7l-4-3Z" fill="currentColor" opacity=".45"/></svg>; }
function Empty({ icon,title,description }: { icon: ReactNode; title: string; description: string }) { return <div className="empty-state"><div>{icon}</div><h2>{title}</h2><p>{description}</p></div>; }
