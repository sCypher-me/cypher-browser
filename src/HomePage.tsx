import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, Check, Clock3, Code2, Globe2, Grip, CodeXml, Headphones, Image as ImageIcon, LayoutGrid, MessageCircle, Pause, Play, Plus, RotateCcw, Search, Settings2, Shield, Smile, Sparkles, Star, StickyNote, Timer, Trash2, Type, X, CirclePlay, CalendarDays, ListTodo, CalendarClock, Calculator as CalculatorIcon, ChevronLeft, ChevronRight, CircleCheck } from 'lucide-react';
import { addWidget, defaultHome, moveWidget, resizeWidget, resolveWidgetLayout, sanitizeHome, widgetDefinitions, widgetDesigns, type HomeConfig, type HomeShortcut, type HomeWidget, type ResizeEdge, type WidgetType } from '../electron/home-layout.mjs';
import type { HomeData, HomeTask, Link, Settings } from './types';
import { cn } from './lib/cn';
import './home.css';

interface Props {
  settings: Settings; data: HomeData; bookmarks: Link[]; isPrivate: boolean;
  navigate: (url: string) => void; openSettings: () => void;
  save: (home: HomeConfig) => Promise<unknown>;
  command: (action: string,payload?: unknown) => Promise<unknown>;
  modWallpaper?: { url: string; type: 'image' | 'video'; dim: number } | null;
}
const icons = { welcome: Sparkles, search: Search, shortcuts: LayoutGrid, clock: Clock3, notes: StickyNote, bookmarks: Star, focus: Timer, text: Type, sticker: Smile, image: ImageIcon, custom: Code2, calendar: CalendarDays, tasks: ListTodo, countdown: CalendarClock, calculator: CalculatorIcon };
const linkIcons = { youtube: CirclePlay, github: CodeXml, chat: MessageCircle, music: Headphones, globe: Globe2 };
const clone = (home: HomeConfig) => structuredClone(home);
const emptyData: HomeData = { notes: {}, focus: { endsAt: null,remaining: 1500,duration: 1500 }, tasksById: {} };
function customWidgetDocument(widget: HomeWidget) {
  const policy = "default-src 'none'; img-src data: blob:; media-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'";
  const css = widget.codeCss.replace(/<\/style/gi,'<\\/style');
  const js = widget.codeJs.replace(/<\/script/gi,'<\\/script');
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;min-height:100%;box-sizing:border-box}*,*::before,*::after{box-sizing:inherit}body{padding:0;font:14px system-ui,sans-serif;color:#e4ebdf;background:transparent;overflow:auto}${css}</style></head><body>${widget.codeHtml}<script>${js}</script></body></html>`;
}

function SmallButton({ label,children,onClick,disabled }: { label: string; children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return <button type="button" className="home-small-button" aria-label={label} title={label} onClick={onClick} disabled={disabled}>{children}</button>;
}
export default function HomePage({ settings,data = emptyData,bookmarks,isPrivate,navigate,save,command,openSettings,modWallpaper }: Props) {
  const [editing,setEditing] = useState(false);
  const [draft,setDraft] = useState<HomeConfig>(() => clone(settings.home));
  const [panel,setPanel] = useState<'widgets' | 'appearance' | 'content'>('widgets');
  const [widgetTab,setWidgetTab] = useState<'content' | 'design'>('content');
  const [selectedId,setSelectedId] = useState<string | null>(null);
  const [error,setError] = useState('');
  const [saving,setSaving] = useState(false);
  const [clock,setClock] = useState(new Date());
  const [availableWidth,setAvailableWidth] = useState(1100);
  const gridRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ id: string; edge: ResizeEdge; pointerId: number; startX: number; startY: number; original: HomeWidget; baseline: HomeWidget[] } | null>(null);
  const home = editing ? draft : settings.home;
  const selected = draft.widgets.find(w => w.id === selectedId);
  const fitScale = availableWidth/home.canvasWidth;
  const stacked = !editing && fitScale < .56;
  const canvasScale = Math.max(.56,Math.min(1.12,fitScale));
  const canvasHeight = Math.max(500,...home.widgets.map(w => w.y + w.height + 28));
  const style = { '--home-padding': `${home.padding}px`, '--home-title-size': `${home.titleSize}px`, '--home-align': home.alignment, '--home-art-opacity': home.artOpacity / 100,
    ...(settings.wallpaper === 'custom' && settings.wallpaperImageData ? { backgroundImage:`linear-gradient(180deg, color-mix(in srgb, var(--base) 76%, transparent), color-mix(in srgb, var(--base) 92%, transparent)), url("${settings.wallpaperImageData}")`, backgroundSize:'cover', backgroundPosition:'center' } : {}) } as CSSProperties;
  useEffect(() => { const timer = setInterval(() => setClock(new Date()),1000); return () => clearInterval(timer); },[]);
  useEffect(() => {
    const workspace = gridRef.current?.closest<HTMLElement>('.home-workspace');
    if (!workspace) return;
    const observer = new ResizeObserver(entries => {
      setAvailableWidth(entries[0]?.contentRect.width || workspace.clientWidth);
    });
    observer.observe(workspace);
    setAvailableWidth(workspace.clientWidth);
    return () => observer.disconnect();
  },[editing,home.canvasWidth]);
  function begin() { setDraft(clone(settings.home)); setSelectedId(settings.home.widgets[0]?.id || null); setEditing(true); setPanel('content'); setWidgetTab('content'); setError(''); }
  function patch(value: Partial<HomeConfig>) { setDraft(previous => ({ ...previous,...value })); }
  function move(id: string,value: Partial<HomeWidget>) { setDraft(previous => ({ ...previous,widgets: resolveWidgetLayout(moveWidget(previous.widgets,id,value,previous.canvasWidth),id,previous.canvasWidth) })); }
  function beginGesture(event: ReactPointerEvent<HTMLElement>,widget: HomeWidget,edge: ResizeEdge) {
    if (!editing || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); setSelectedId(widget.id);
    const baseline = draft.widgets.map(item => item.id === widget.id ? { ...item,preferred: { x:item.x,y:item.y,width:item.width,height:item.height } } : item);
    const original = baseline.find(item => item.id === widget.id)!;
    gesture.current = { id: widget.id,edge,pointerId: event.pointerId,startX: event.clientX,startY: event.clientY,original,baseline };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function continueGesture(event: ReactPointerEvent<HTMLElement>) {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const dx = (event.clientX-active.startX) / canvasScale,dy = (event.clientY-active.startY) / canvasScale;
    setDraft(previous => {
      const moved = active.baseline.map(widget => widget.id === active.id ? resizeWidget(active.original,active.edge,dx,dy,previous.canvasWidth) : widget);
      return { ...previous,widgets: resolveWidgetLayout(moved,active.id,previous.canvasWidth) };
    });
  }
  function endGesture(event: ReactPointerEvent<HTMLElement>) {
    if (gesture.current?.pointerId !== event.pointerId) return;
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function resizeByKey(event: ReactKeyboardEvent<HTMLButtonElement>,widget: HomeWidget,edge: ResizeEdge) {
    if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const amount = event.shiftKey ? 10 : 1;
    const dx = event.key === 'ArrowRight' ? amount : event.key === 'ArrowLeft' ? -amount : 0;
    const dy = event.key === 'ArrowDown' ? amount : event.key === 'ArrowUp' ? -amount : 0;
    setDraft(previous => ({ ...previous,widgets: resolveWidgetLayout(previous.widgets.map(item => item.id === widget.id ? resizeWidget(item,edge,dx,dy,draft.canvasWidth) : item),widget.id,draft.canvasWidth) }));
  }
  function add(type: WidgetType) {
    const id = crypto.randomUUID();
    setDraft(previous => ({ ...previous,widgets: resolveWidgetLayout(addWidget(previous.widgets,type,id,previous.canvasWidth),id,previous.canvasWidth) })); setSelectedId(id); setPanel('content'); setWidgetTab('content');
  }
  function remove(id: string) { setDraft(previous => ({ ...previous,widgets: resolveWidgetLayout(previous.widgets.filter(w => w.id !== id),null,previous.canvasWidth) })); setSelectedId(null); }
  async function finish() {
    setSaving(true); setError('');
    try { await save(sanitizeHome(draft)); setEditing(false); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a Home.'); }
    finally { setSaving(false); }
  }
  function patchSelected(value: Partial<HomeWidget>) { if (selected) move(selected.id,value); }
  function submitSearch(widget: HomeWidget,rawValue: string) {
    if (editing || widget.type !== 'search') return;
    const query = rawValue.trim();
    if (!query) return;
    if (/^https?:\/\//i.test(query)) { navigate(query); return; }
    const urls = { duckduckgo:'https://duckduckgo.com/?q=',google:'https://www.google.com/search?q=',bing:'https://www.bing.com/search?q=' };
    if (widget.searchEngine !== 'inherit') navigate(`${urls[widget.searchEngine]}${encodeURIComponent(query)}`);
    else navigate(query);
  }
  function updateShortcut(id: string,value: Partial<HomeShortcut>) { if (selected?.type === 'shortcuts') setDraft(previous => ({ ...previous,widgets:previous.widgets.map(item => item.id === selected.id ? { ...item,shortcuts:item.shortcuts.map(link => link.id === id ? { ...link,...value } : link) } : item) })); }
  function reorderShortcut(index: number,direction: number) { if (selected?.type !== 'shortcuts') return; const target=index+direction; if (target<0 || target>=selected.shortcuts.length) return; setDraft(previous => ({ ...previous,widgets:previous.widgets.map(item => { if (item.id !== selected.id) return item; const links=[...item.shortcuts]; [links[index],links[target]]=[links[target],links[index]]; return { ...item,shortcuts:links }; }) })); }
  async function chooseImage() { try { const dataUrl=await command('home:image:select'); if (typeof dataUrl === 'string' && selected?.type === 'image') patchSelected({ imageData:dataUrl }); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível abrir a imagem.'); } }
  function renderWidget(widget: HomeWidget) {
    const title = widget.title || widgetDefinitions[widget.type].label;
    const city = widget.citySource === 'custom' && widget.city ? widget.city : Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop()?.replaceAll('_',' ') || 'sua região';
    const tokens = { date: clock.toLocaleDateString('pt-BR',{ weekday:'long',day:'numeric',month:'long' }),time: clock.toLocaleTimeString('pt-BR',{ hour:'2-digit',minute:'2-digit' }),city };
    const personalize = (value: string) => value.replace(/\{\{(date|time|city)\}\}/gi,(_,token: string) => tokens[token.toLowerCase() as keyof typeof tokens]);
    if (widget.type === 'welcome') return <div className="welcome-widget" style={{ textAlign: widget.welcomeAlignment, '--welcome-size': `${widget.welcomeTitleSize}px` } as CSSProperties}><div className="home-label" hidden={!widget.showWelcomeLabel}><span className="live-dot" />{personalize(widget.welcomeLabel)}</div><h1>{personalize(widget.welcomeTitle)}<span>{personalize(widget.welcomeAccentTitle)}</span></h1><p>{personalize(widget.description)}</p></div>;
    if (widget.type === 'search') {
      const inheritedEngine = ({ duckduckgo:'DuckDuckGo',google:'Google',bing:'Bing',custom:'Personalizado' } as const)[settings.searchEngine];
      const engines = { duckduckgo:'DuckDuckGo',google:'Google',bing:'Bing',inherit:inheritedEngine } as const;
      return <div className="search-widget"><form className="home-search" onSubmit={event => { event.preventDefault(); submitSearch(widget,String(new FormData(event.currentTarget).get('search') || '')); }}><Search size={20} strokeWidth={1.6}/><input name="search" aria-label="Pesquisar na internet" placeholder={widget.searchPlaceholder} autoComplete="off" disabled={editing} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); submitSearch(widget,event.currentTarget.value); } }}/><button type="submit" disabled={editing} aria-label="Pesquisar"><ArrowRight size={20}/></button></form>{(widget.showProvider || widget.showSearchHint) && <div className="search-meta">{widget.showProvider && <span>Pesquisa com <strong>{engines[widget.searchEngine]}</strong></span>}{widget.showSearchHint && <span className="search-hint"><kbd>Enter</kbd> para explorar</span>}</div>}</div>;
    }
    if (widget.type === 'clock') {
      const parts = Object.fromEntries(new Intl.DateTimeFormat('pt-BR',{ hour:'2-digit',minute:'2-digit',...(widget.showSeconds ? { second:'2-digit' } : {}),hour12:!widget.format24 }).formatToParts(clock).map(part => [part.type,part.value]));
      const clockTime = `${parts.hour}:${parts.minute}${widget.showSeconds ? `:${parts.second}` : ''}${parts.dayPeriod ? ` ${parts.dayPeriod}` : ''}`;
      const handMinute = clock.getMinutes()*6,handHour = (clock.getHours()%12)*30+clock.getMinutes()*.5;
      return <div className={`clock-widget clock-design-${widget.clockDesign}`}><span className="widget-eyebrow"><Clock3 size={13}/>{title}</span>
        {widget.clockDesign === 'analog' ? <div className="analog-face" aria-label={clockTime}><span className="analog-hand analog-hour" style={{ transform:`translateX(-50%) translateY(-100%) rotate(${handHour}deg)` }}/><span className="analog-hand analog-minute" style={{ transform:`translateX(-50%) translateY(-100%) rotate(${handMinute}deg)` }}/>{widget.showSeconds && <span className="analog-hand analog-second" style={{ transform:`translateX(-50%) translateY(-100%) rotate(${clock.getSeconds()*6}deg)` }}/>}<span className="analog-pivot"/></div>
          : widget.clockDesign === 'flip' ? <div className="flip-clock"><span>{parts.hour}</span><b>:</b><span>{parts.minute}</span>{widget.showSeconds && <small>{parts.second}</small>}{parts.dayPeriod && <small>{parts.dayPeriod}</small>}</div>
          : widget.clockDesign === 'terminal' ? <div className="terminal-clock"><small>LOCAL / CYPHER TIME</small><time dateTime={clock.toISOString()}>{clockTime}</time><i>READY</i></div>
          : widget.clockDesign === 'orbit' ? <div className="orbit-clock"><span className="orbit-clock-ring"/><time dateTime={clock.toISOString()}>{clockTime}</time></div>
          : <time dateTime={clock.toISOString()}>{clockTime}</time>}
        {widget.showDate && <span className="clock-date">{tokens.date}</span>}
      </div>;
    }
    if (widget.type === 'shortcuts') return <div className="shortcuts-widget"><div className="widget-title"><span>{title}</span><span>{widget.shortcuts.length.toString().padStart(2,'0')}</span></div><div className="home-shortcuts">{widget.shortcuts.map(link => { const Icon = linkIcons[link.icon] || Globe2; return <button key={link.id} title={link.url} disabled={editing} onClick={() => navigate(link.url)}><Icon size={22} strokeWidth={1.6}/><span>{link.title}</span><ArrowUpRight className="shortcut-arrow" size={13}/></button>; })}</div>{!widget.shortcuts.length && <p className="widget-empty">Adicione links nas opções deste widget.</p>}</div>;
    if (widget.type === 'notes') return <NoteWidget key={widget.id} widget={widget} saved={data.notes[widget.id] || ''} isPrivate={isPrivate} editing={editing} command={command}/>;
    if (widget.type === 'focus') return <FocusWidget widget={widget} clock={clock} focus={data.focusById?.[widget.id] || { endsAt:null,remaining:widget.focusMinutes*60,duration:widget.focusMinutes*60 }} isPrivate={isPrivate} editing={editing} command={command}/>;
    if (widget.type === 'calendar') return <CalendarWidget title={title} monday={widget.calendarMonday} clock={clock}/>;
    if (widget.type === 'tasks') return <TasksWidget widget={widget} tasks={data.tasksById?.[widget.id] || []} isPrivate={isPrivate} editing={editing} command={command}/>;
    if (widget.type === 'countdown') return <CountdownWidget widget={widget} clock={clock}/>;
    if (widget.type === 'calculator') return <CalculatorWidget widget={widget}/>;
    if (widget.type === 'text') return <div className={`free-text-widget free-text-${widget.textStyle}`} style={{ textAlign:widget.textAlignment }}><span className="widget-title">{title}</span><p>{widget.textContent}</p></div>;
    if (widget.type === 'sticker') return <div className="sticker-widget" style={{ '--sticker-angle':`${widget.stickerAngle}deg`, '--sticker-size':`${widget.stickerSize}px` } as CSSProperties}><span>{widget.sticker}</span>{widget.caption && <small>{widget.caption}</small>}</div>;
    if (widget.type === 'image') return <div className="image-widget">{widget.imageData ? <img src={widget.imageData} alt={widget.imageAlt} style={{ objectFit:widget.imageFit }}/> : <div className="image-widget-empty"><ImageIcon size={26}/><span>{editing ? 'Adicione sua imagem nas opções do widget' : 'Nenhuma imagem escolhida'}</span></div>}</div>;
    if (widget.type === 'custom') return <CustomWidgetFrame widget={widget}/>;
    const widgetBookmarks = bookmarks.slice(0,widget.bookmarkLimit);
    return <div className="bookmarks-widget"><div className="widget-title"><span><Star size={14}/>{title}</span><span>{bookmarks.length}</span></div><div className="widget-bookmarks-list">{widgetBookmarks.map(link => <button key={link.id} disabled={editing} onClick={() => navigate(link.url)} title={link.url}>{widget.showBookmarkIcons && <Globe2 size={15}/>}<span>{link.title}</span><ArrowUpRight size={13}/></button>)}</div>{!bookmarks.length && <p className="widget-empty">Clique na estrela da barra de endereço para guardar seus sites aqui.</p>}</div>;
  }
  return <div className={cn('home-page','home-customizable',modWallpaper ? 'wallpaper-mod' : `wallpaper-${settings.wallpaper}`,editing && 'home-editing')} style={modWallpaper ? { ...style, backgroundImage: undefined } : style}>
    {modWallpaper && (modWallpaper.type === 'video' ? <video className="home-wallpaper-video home-mod-wallpaper" src={modWallpaper.url} muted autoPlay loop playsInline aria-hidden="true"/> : <div className="home-mod-wallpaper" style={{ backgroundImage: `url("${modWallpaper.url}")` }} aria-hidden="true"/>)}
    {modWallpaper && modWallpaper.dim > 0 && <div className="home-mod-wallpaper-dim" style={{ opacity: modWallpaper.dim }} aria-hidden="true"/>}
    {!modWallpaper && settings.wallpaper === 'video' && settings.wallpaperVideoPath && <video className="home-wallpaper-video" src="cypher-wallpaper://wallpaper/current" muted autoPlay loop playsInline preload="metadata" aria-hidden="true"/>}
    <div className="home-workspace">
      <div className="home-canvas-header"><span className="home-coordinate"><LayoutGrid size={14}/> ESPAÇO PESSOAL <span className="home-coordinate-divider">/</span> {editing ? 'SEU LAYOUT' : 'NOVA ABA'}</span><button className={cn('button',editing ? 'secondary' : 'home-edit-trigger')} onClick={editing ? () => setPanel('widgets') : begin}><Settings2 size={15}/>{editing ? 'Editando Home' : 'Editar Home'}</button></div>
      {home.showArt && !modWallpaper && <OrbitalArt/>}
      <div className={cn('home-widget-stage',stacked && 'home-widget-stage-stacked')} style={stacked ? undefined : { width: home.canvasWidth*canvasScale,height: canvasHeight*canvasScale }}><div className={cn('home-widget-grid',`widget-style-${home.widgetStyle}`,stacked && 'home-widget-grid-stacked')} ref={gridRef} style={stacked ? undefined : { width: home.canvasWidth,height: canvasHeight,transform: `scale(${canvasScale})`,'--text-boost': Math.min(1.35,Math.max(1,1/canvasScale)) } as CSSProperties}>
        {(stacked ? [...home.widgets].sort((a,b) => a.y-b.y || a.x-b.x) : home.widgets).map(widget => <section key={widget.id} className={cn('home-widget',`widget-${widget.type}`,`widget-background-${widget.background}`,`widget-design-${widget.type === 'clock' ? widget.clockDesign : widget.designVariant}`,editing && widget.id === selectedId && 'widget-selected',`widget-shape-${widget.width > widget.height * 2.2 ? 'wide' : widget.height > widget.width * 1.35 ? 'tall' : 'balanced'}`)} data-widget-id={widget.id} data-widget-type={widget.type} aria-label={widget.title || widgetDefinitions[widget.type].label} onClick={() => { if (editing) { setSelectedId(widget.id); setPanel('content'); setWidgetTab('content'); } }} style={{ ...(stacked ? { height:widget.height,maxWidth:widget.width } as CSSProperties : { left:widget.x,top:widget.y,width:widget.width,height:widget.height } as CSSProperties),transform:`rotate(${widget.widgetRotation}deg)`,'--widget-padding':`${widget.type === 'image' ? 0 : widget.widgetPadding}px`,'--widget-color':widget.backgroundColor,'--widget-text-color':settings.appearanceMode === 'light' && widget.textColor.toLowerCase() === '#e4ebdf' ? undefined : widget.textColor,'--widget-alpha':`${widget.opacity}%`,'--widget-radius':`${widget.cornerRadius}px` } as CSSProperties}>
          {editing && <div className="widget-edit-bar"><button type="button" className="widget-drag-handle" onPointerDown={event => beginGesture(event,widget,'move')} onPointerMove={continueGesture} onPointerUp={endGesture} onPointerCancel={endGesture} aria-label={`Mover ${widgetDefinitions[widget.type].label}`} title="Arraste para posicionar"><Grip size={13}/><span>{widgetDefinitions[widget.type].label}</span></button><SmallButton label={`Remover ${widgetDefinitions[widget.type].label}`} onClick={() => remove(widget.id)}><X size={13}/></SmallButton></div>}
          <div className="widget-body">{renderWidget(widget)}</div>
          {editing && (['n','ne','e','se','s','sw','w','nw'] as ResizeEdge[]).map(edge => <button key={edge} type="button" className={`widget-resize-handle resize-${edge}`} aria-label={`Redimensionar ${widgetDefinitions[widget.type].label} ${edge}`} title="Puxe para redimensionar" onPointerDown={event => beginGesture(event,widget,edge)} onPointerMove={continueGesture} onPointerUp={endGesture} onPointerCancel={endGesture} onKeyDown={event => resizeByKey(event,widget,edge)} />)}
        </section>)}
      </div></div>
      {!home.widgets.length && <div className="home-widgets-empty"><LayoutGrid size={32}/><h2>Uma tela para chamar de sua.</h2><p>Adicione seus primeiros widgets e crie o seu espaço.</p><button className="button primary" onClick={() => { if (!editing) begin(); else setPanel('widgets'); }}><Plus size={16}/> Adicionar widgets</button></div>}
      <div className="home-canvas-footer"><span><Shield size={14}/>{isPrivate ? 'Sessão temporária · suas notas não são salvas' : 'Seu espaço. Suas regras.'}</span><button onClick={openSettings}>Aparência do navegador <ArrowUpRight size={13}/></button></div>
    </div>
    {editing && <aside className="home-editor" aria-label="Editor da Home">
      <div className="home-editor-heading"><div><span className="eyebrow">CYPHER / PERSONALIZAÇÃO</span><h2>Sua Home, de verdade.</h2><p>Monte o espaço que funciona para você.</p></div><SmallButton label="Cancelar edição da Home" onClick={() => setEditing(false)}><X size={17}/></SmallButton></div>
      <div className="home-editor-tabs" aria-label="Seções do editor">{[{ id: 'widgets',label: 'Widgets' },{ id: 'appearance',label: 'Visual' },{ id: 'content',label: 'Conteúdo' }].map(item => <button key={item.id} data-home-panel={item.id} aria-pressed={panel === item.id} className={cn(panel === item.id && 'selected')} onClick={() => setPanel(item.id as typeof panel)}>{item.label}</button>)}</div>
      <div className="home-editor-scroll">
        {panel === 'widgets' && <>
          <div className="editor-section-heading"><h3>Adicionar widgets</h3><span>{draft.widgets.length}/24</span></div>
          <div className="widget-library">{(Object.keys(widgetDefinitions) as WidgetType[]).map(type => { const Icon = icons[type]; const definition = widgetDefinitions[type]; return <button key={type} disabled={draft.widgets.length >= 24} onClick={() => add(type)} title={definition.description} aria-label={`Adicionar ${definition.label}`}><Icon size={18} strokeWidth={1.6}/><span>{definition.label}</span><Plus size={13}/></button>; })}</div>
          <p className="editor-hint">Puxe as alças para mover ou redimensionar. Quando widgets disputam espaço, eles se ajustam e recuperam o tamanho ao liberar a área.</p>
          <label className="editor-field"><span>Widget selecionado</span><select value={selectedId || ''} onChange={event => setSelectedId(event.target.value)}><option value="">Selecione um widget</option>{draft.widgets.map((widget,index) => <option key={widget.id} value={widget.id}>{widget.title || widgetDefinitions[widget.type].label} · {index+1}</option>)}</select></label>
          {selected && <section className="widget-inspector"><div className="editor-section-heading"><h3>{widgetDefinitions[selected.type].label}</h3><SmallButton label="Remover widget selecionado" onClick={() => remove(selected.id)}><Trash2 size={14}/></SmallButton></div>
            <label className="editor-field"><span>Nome do widget</span><input value={selected.title} maxLength={48} placeholder={widgetDefinitions[selected.type].label} onChange={event => patchSelected({ title:event.target.value })}/></label>
            <button className="home-text-button" onClick={() => { setPanel('content'); setWidgetTab('content'); }}>Personalizar conteúdo <ArrowRight size={13}/></button>
            <div className="widget-position-inputs">{[{ key: 'x',label: 'Posição X',min: 0,max: draft.canvasWidth-selected.width },{ key: 'y',label: 'Posição Y',min: 0,max: 6000 },{ key: 'width',label: 'Largura',min: widgetDefinitions[selected.type].minWidth,max: draft.canvasWidth },{ key: 'height',label: 'Altura',min: widgetDefinitions[selected.type].minHeight,max: 2400 }].map(field => <label className="editor-field" key={field.key}><span>{field.label} <small>px</small></span><input type="number" aria-label={field.label} min={field.min} max={field.max} value={selected[field.key as 'x' | 'y' | 'width' | 'height']} onChange={event => { if (event.target.value) move(selected.id,{ [field.key]: +event.target.value }); }}/></label>)}</div>
            <div className="widget-move-controls"><span>Nudge · 1 px <small>Shift · 10 px</small></span><SmallButton label="Mover para esquerda" disabled={selected.x === 0} onClick={() => move(selected.id,{ x: selected.x-10 })}><ArrowLeft size={15}/></SmallButton><SmallButton label="Mover para cima" disabled={selected.y === 0} onClick={() => move(selected.id,{ y: selected.y-10 })}><ArrowUp size={15}/></SmallButton><SmallButton label="Mover para baixo" onClick={() => move(selected.id,{ y: selected.y+10 })}><ArrowDown size={15}/></SmallButton><SmallButton label="Mover para direita" disabled={selected.x+selected.width >= draft.canvasWidth} onClick={() => move(selected.id,{ x: selected.x+10 })}><ArrowRight size={15}/></SmallButton></div>
          </section>}
        </>}
        {panel === 'appearance' && <>
          <div className="editor-section-heading"><h3>Composição</h3><LayoutGrid size={15}/></div>
          <label className="editor-field"><span>Estilo dos widgets</span><select value={draft.widgetStyle} onChange={event => patch({ widgetStyle: event.target.value as HomeConfig['widgetStyle'] })}><option value="minimal">Minimal · integrado ao fundo</option><option value="solid">Cards · superfície preenchida</option><option value="outlined">Contorno · bordas discretas</option></select></label>
          <label className="editor-field"><span>Alinhamento do título</span><select value={draft.alignment} onChange={event => patch({ alignment: event.target.value as HomeConfig['alignment'] })}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label>
          {([{ key: 'titleSize',label: 'Tamanho do título',min: 28,max: 76 },{ key: 'padding',label: 'Margens da Home',min: 16,max: 64 }] as const).map(field => <label className="editor-field editor-range" key={field.key}><span>{field.label}<output>{draft[field.key]} px</output></span><input aria-label={field.label} type="range" min={field.min} max={field.max} value={draft[field.key]} onChange={event => patch({ [field.key]: +event.target.value })}/></label>)}
          <label className="editor-field editor-range"><span>Largura do espaço<output>{draft.canvasWidth} px</output></span><input aria-label="Largura do espaço" type="range" min="600" max="1800" step="20" value={draft.canvasWidth} onChange={event => setDraft(previous => sanitizeHome({ ...previous,canvasWidth: +event.target.value },previous))}/></label>
          <label className="editor-check"><input type="checkbox" checked={draft.showArt} onChange={event => patch({ showArt: event.target.checked })}/><span>Mostrar arte orbital</span></label>
          <label className="editor-field editor-range"><span>Intensidade da arte<output>{draft.artOpacity}%</output></span><input type="range" aria-label="Intensidade da arte" min="0" max="100" value={draft.artOpacity} onChange={event => patch({ artOpacity: +event.target.value })}/></label>
          <p className="editor-hint">Posicione widgets na tela e clique em um para abrir diretamente suas opções.</p>
        </>}
        {panel === 'content' && <>
          <div className="editor-section-heading"><h3>{selected ? widgetDefinitions[selected.type].label : 'Personalização individual'}</h3><Sparkles size={15}/></div>
          {selected && <div className="widget-detail-tabs" role="tablist" aria-label="Configurações do widget"><button role="tab" aria-selected={widgetTab==='content'} className={cn(widgetTab==='content' && 'selected')} onClick={() => setWidgetTab('content')}>Conteúdo</button><button role="tab" aria-selected={widgetTab==='design'} className={cn(widgetTab==='design' && 'selected')} onClick={() => setWidgetTab('design')}>Design</button></div>}
          {!selected ? <><p className="editor-hint">Selecione um widget na tela ou na aba Widgets para editar conteúdo e visual.</p><button className="home-text-button" onClick={() => setPanel('widgets')}>Escolher widget <ArrowRight size={13}/></button></> : widgetTab === 'design' ? <>
            <div className="widget-design-preview-wrap"><span className="preview-caption">PRÉVIA AO VIVO</span><div className={`widget-design-preview widget-style-${draft.widgetStyle}`}><section className={`home-widget widget-${selected.type} widget-background-${selected.background} widget-design-${selected.type === 'clock' ? selected.clockDesign : selected.designVariant}`} style={{ '--widget-color':selected.backgroundColor,'--widget-text-color':selected.textColor,'--widget-alpha':`${selected.opacity}%`,'--widget-radius':`${selected.cornerRadius}px`,transform:`rotate(${selected.widgetRotation}deg)` } as CSSProperties}><div className="widget-body" style={{ padding:selected.type==='image'?0:selected.widgetPadding }}>{renderWidget(selected)}</div></section></div></div>
            <label className="editor-field"><span>Variação visual</span><select value={selected.type === 'clock' ? selected.clockDesign : selected.designVariant} onChange={event => selected.type === 'clock' ? patchSelected({ clockDesign:event.target.value as HomeWidget['clockDesign'],designVariant:event.target.value }) : patchSelected({ designVariant:event.target.value })}>{widgetDesigns[selected.type].map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <div className="editor-section-heading"><h3>Forma e espaço</h3><LayoutGrid size={14}/></div>
            {[{key:'width',label:'Largura',min:widgetDefinitions[selected.type].minWidth,max:draft.canvasWidth},{key:'height',label:'Altura',min:widgetDefinitions[selected.type].minHeight,max:900}].map(field => <label className="editor-field editor-range" key={field.key}><span>{field.label}<output>{selected[field.key as 'width'|'height']} px</output></span><input type="range" min={field.min} max={field.max} step="4" value={selected[field.key as 'width'|'height']} onChange={event => move(selected.id,{ [field.key]:+event.target.value })}/></label>)}
            {[{key:'widgetRotation',label:'Rotação',min:-180,max:180,suffix:'°'},{key:'widgetPadding',label:'Espaçamento interno',min:0,max:64,suffix:' px'},{key:'cornerRadius',label:'Arredondamento',min:0,max:40,suffix:' px'},{key:'opacity',label:'Opacidade',min:0,max:100,suffix:'%'}].map(field => <label className="editor-field editor-range" key={field.key}><span>{field.label}<output>{selected[field.key as 'widgetRotation'|'widgetPadding'|'cornerRadius'|'opacity']}{field.suffix}</output></span><input type="range" min={field.min} max={field.max} value={selected[field.key as 'widgetRotation'|'widgetPadding'|'cornerRadius'|'opacity']} onChange={event => patchSelected({ [field.key]:+event.target.value })}/></label>)}
            <div className="editor-section-heading"><h3>Cores e superfície</h3><Sparkles size={14}/></div>
            <label className="editor-field"><span>Fundo</span><select value={selected.background} onChange={event => patchSelected({ background:event.target.value as HomeWidget['background'] })}><option value="default">Padrão do tema</option><option value="transparent">Transparente</option><option value="surface">Superfície escura</option><option value="accent">Cor de destaque</option><option value="custom">Cor personalizada</option></select></label>
            {selected.background==='custom' && <label className="editor-field"><span>Cor do fundo</span><input type="color" value={selected.backgroundColor} onChange={event => patchSelected({ backgroundColor:event.target.value })}/></label>}
            <label className="editor-field"><span>Cor do texto</span><input type="color" value={selected.textColor} onChange={event => patchSelected({ textColor:event.target.value })}/></label>
          </> : <>
            <label className="editor-field"><span>Nome do widget</span><input value={selected.title} maxLength={48} placeholder={widgetDefinitions[selected.type].label} onChange={event => patchSelected({ title:event.target.value })}/></label>
            {selected.type === 'welcome' && <>
              <label className="editor-field"><span>Título</span><input value={selected.welcomeTitle} maxLength={100} onChange={event => patchSelected({ welcomeTitle:event.target.value })}/></label>
              <label className="editor-field"><span>Destaque</span><input value={selected.welcomeAccentTitle} maxLength={100} onChange={event => patchSelected({ welcomeAccentTitle:event.target.value })}/></label>
              <label className="editor-field"><span>Mensagem</span><textarea rows={3} maxLength={500} value={selected.description} onChange={event => patchSelected({ description:event.target.value })}/></label>
              <label className="editor-field"><span>Chamada pequena</span><input value={selected.welcomeLabel} maxLength={100} onChange={event => patchSelected({ welcomeLabel:event.target.value })}/></label>
              <label className="editor-check"><input type="checkbox" checked={selected.showWelcomeLabel} onChange={event => patchSelected({ showWelcomeLabel:event.target.checked })}/><span>Mostrar chamada pequena</span></label>
              <label className="editor-field"><span>Alinhamento</span><select value={selected.welcomeAlignment} onChange={event => patchSelected({ welcomeAlignment:event.target.value as HomeWidget['welcomeAlignment'] })}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label>
              <label className="editor-field editor-range"><span>Tamanho do título<output>{selected.welcomeTitleSize} px</output></span><input type="range" min="20" max="76" value={selected.welcomeTitleSize} onChange={event => patchSelected({ welcomeTitleSize:+event.target.value })}/></label>
              <label className="editor-field"><span>Cidade para {'{{city}}'}</span><select value={selected.citySource} onChange={event => patchSelected({ citySource:event.target.value as HomeWidget['citySource'] })}><option value="timezone">Automática pelo fuso horário</option><option value="custom">Definir manualmente</option></select></label>
              {selected.citySource === 'custom' && <label className="editor-field"><span>Sua cidade</span><input value={selected.city} maxLength={80} onChange={event => patchSelected({ city:event.target.value })}/></label>}
              <p className="editor-hint">Use {'{{date}}'}, {'{{time}}'} e {'{{city}}'} no título ou mensagem. A cidade automática é uma estimativa pelo fuso horário do dispositivo; você pode informar outra manualmente.</p>
            </>}
            {selected.type === 'search' && <>
              <label className="editor-field"><span>Texto de pesquisa</span><input value={selected.searchPlaceholder} maxLength={100} onChange={event => patchSelected({ searchPlaceholder:event.target.value })}/></label>
              <label className="editor-field"><span>Motor de busca</span><select value={selected.searchEngine} onChange={event => patchSelected({ searchEngine:event.target.value as HomeWidget['searchEngine'] })}><option value="inherit">Usar padrão do navegador ({settings.searchEngine})</option><option value="duckduckgo">DuckDuckGo</option><option value="google">Google</option><option value="bing">Bing</option></select></label>
              <label className="editor-check"><input type="checkbox" checked={selected.showProvider} onChange={event => patchSelected({ showProvider:event.target.checked })}/><span>Mostrar motor escolhido</span></label>
              <label className="editor-check"><input type="checkbox" checked={selected.showSearchHint} onChange={event => patchSelected({ showSearchHint:event.target.checked })}/><span>Mostrar dica de pesquisa</span></label>
            </>}
            {selected.type === 'clock' && <>
              <label className="editor-check"><input type="checkbox" checked={selected.format24} onChange={event => patchSelected({ format24:event.target.checked })}/><span>Formato de 24 horas</span></label>
              <label className="editor-check"><input type="checkbox" checked={selected.showSeconds} onChange={event => patchSelected({ showSeconds:event.target.checked })}/><span>Mostrar segundos</span></label>
              <label className="editor-check"><input type="checkbox" checked={selected.showDate} onChange={event => patchSelected({ showDate:event.target.checked })}/><span>Mostrar data</span></label>
            </>}
            {selected.type === 'calendar' && <label className="editor-check"><input type="checkbox" checked={selected.calendarMonday} onChange={event => patchSelected({ calendarMonday:event.target.checked })}/><span>Começar a semana na segunda-feira</span></label>}
            {selected.type === 'countdown' && <>
              <label className="editor-field"><span>Nome da data</span><input value={selected.countdownLabel} maxLength={100} onChange={event => patchSelected({ countdownLabel:event.target.value })}/></label>
              <label className="editor-field"><span>Data e horário</span><input type="datetime-local" value={selected.countdownTarget} onChange={event => patchSelected({ countdownTarget:event.target.value })}/></label>
            </>}
            {selected.type === 'calculator' && <label className="editor-field"><span>Casas decimais<output>{selected.calculatorPrecision}</output></span><input type="range" min="0" max="8" value={selected.calculatorPrecision} onChange={event => patchSelected({ calculatorPrecision:+event.target.value })}/></label>}
            {selected.type === 'shortcuts' && <>
              <div className="editor-section-heading"><h3>Atalhos deste widget</h3><button className="home-text-button" disabled={selected.shortcuts.length >= 12} onClick={() => setDraft(previous => ({ ...previous,widgets:previous.widgets.map(item => item.id === selected.id ? { ...item,shortcuts:[...item.shortcuts,{ id:crypto.randomUUID(),title:'Novo atalho',url:'https://example.com/',icon:'globe' }] } : item) }))}><Plus size={13}/> Adicionar</button></div>
              {selected.shortcuts.map((link,index) => <div className="shortcut-editor" key={link.id}><div className="shortcut-editor-toolbar"><span>ATALHO {index+1}</span><SmallButton label={`Subir ${link.title}`} disabled={index===0} onClick={() => reorderShortcut(index,-1)}><ArrowUp size={13}/></SmallButton><SmallButton label={`Descer ${link.title}`} disabled={index===selected.shortcuts.length-1} onClick={() => reorderShortcut(index,1)}><ArrowDown size={13}/></SmallButton><SmallButton label={`Remover atalho ${link.title}`} onClick={() => setDraft(previous => ({ ...previous,widgets:previous.widgets.map(item => item.id === selected.id ? { ...item,shortcuts:item.shortcuts.filter(linkItem => linkItem.id!==link.id) } : item) }))}><Trash2 size={13}/></SmallButton></div><label className="editor-field"><span>Nome</span><input value={link.title} maxLength={60} onChange={event => updateShortcut(link.id,{ title:event.target.value })}/></label><label className="editor-field"><span>Endereço HTTP ou HTTPS</span><input value={link.url} onChange={event => updateShortcut(link.id,{ url:event.target.value })}/></label><label className="editor-field"><span>Ícone</span><select value={link.icon} onChange={event => updateShortcut(link.id,{ icon:event.target.value as HomeShortcut['icon'] })}><option value="globe">Globo</option><option value="youtube">Vídeo</option><option value="github">Código</option><option value="chat">Comunidade</option><option value="music">Música</option></select></label></div>)}
              <p className="editor-hint">Cada widget de atalhos mantém sua própria lista. Use endereços HTTP ou HTTPS.</p>
            </>}
            {selected.type === 'bookmarks' && <>
              <label className="editor-field editor-range"><span>Quantidade exibida<output>{selected.bookmarkLimit}</output></span><input type="range" min="1" max="24" value={selected.bookmarkLimit} onChange={event => patchSelected({ bookmarkLimit:+event.target.value })}/></label>
              <label className="editor-check"><input type="checkbox" checked={selected.showBookmarkIcons} onChange={event => patchSelected({ showBookmarkIcons:event.target.checked })}/><span>Mostrar ícones</span></label>
            </>}
            {selected.type === 'notes' && <label className="editor-field"><span>Texto de orientação</span><input value={selected.notePlaceholder} maxLength={120} onChange={event => patchSelected({ notePlaceholder:event.target.value })}/></label>}
            {selected.type === 'focus' && <label className="editor-field editor-range"><span>Duração inicial<output>{selected.focusMinutes} min</output></span><input type="range" min="1" max="120" value={selected.focusMinutes} onChange={event => patchSelected({ focusMinutes:+event.target.value })}/></label>}
            {selected.type === 'text' && <>
              <label className="editor-field"><span>Texto</span><textarea rows={5} maxLength={1000} value={selected.textContent} onChange={event => patchSelected({ textContent:event.target.value })}/></label>
              <label className="editor-field"><span>Estilo</span><select value={selected.textStyle} onChange={event => patchSelected({ textStyle:event.target.value as HomeWidget['textStyle'] })}><option value="plain">Simples</option><option value="quote">Citação</option><option value="callout">Destaque</option></select></label>
              <label className="editor-field"><span>Alinhamento</span><select value={selected.textAlignment} onChange={event => patchSelected({ textAlignment:event.target.value as HomeWidget['textAlignment'] })}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label>
            </>}
            {selected.type === 'sticker' && <>
              <label className="editor-field"><span>Sticker ou emoji</span><input value={selected.sticker} maxLength={8} onChange={event => patchSelected({ sticker:event.target.value })}/></label>
              <label className="editor-field"><span>Legenda opcional</span><input value={selected.caption} maxLength={100} onChange={event => patchSelected({ caption:event.target.value })}/></label>
              {([{key:'stickerSize',label:'Tamanho',min:24,max:160,suffix:' px'},{key:'stickerAngle',label:'Rotação',min:-30,max:30,suffix:'°'}] as const).map(field => <label className="editor-field editor-range" key={field.key}><span>{field.label}<output>{selected[field.key]}{field.suffix}</output></span><input type="range" min={field.min} max={field.max} value={selected[field.key]} onChange={event => patchSelected({ [field.key]:+event.target.value })}/></label>)}
            </>}
            {selected.type === 'image' && <>
              <button className="button secondary image-select-button" onClick={() => void chooseImage()}><ImageIcon size={15}/>{selected.imageData ? 'Trocar imagem' : 'Escolher imagem do dispositivo'}</button>
              {selected.imageData && <button className="home-text-button image-remove-button" onClick={() => patchSelected({ imageData:'' })}><Trash2 size={13}/> Remover imagem</button>}
              <label className="editor-field"><span>Descrição acessível</span><input value={selected.imageAlt} maxLength={120} onChange={event => patchSelected({ imageAlt:event.target.value })}/></label>
              <label className="editor-field"><span>Ajuste da imagem</span><select value={selected.imageFit} onChange={event => patchSelected({ imageFit:event.target.value as HomeWidget['imageFit'] })}><option value="cover">Preencher o widget</option><option value="contain">Mostrar imagem inteira</option></select></label>
              <p className="editor-hint">Imagens são guardadas localmente no perfil do navegador. Limite de 3 MB.</p>
            </>}
            {selected.type === 'custom' && <>
              <p className="editor-hint custom-code-safety">O código roda isolado neste widget: sem acesso ao Cypher, sem rede e sem navegação para fora da moldura.</p>
              <label className="editor-field code-editor-field"><span>HTML <output>{selected.codeHtml.length}/20.000</output></span><textarea spellCheck={false} rows={8} maxLength={20000} value={selected.codeHtml} onChange={event => patchSelected({ codeHtml:event.target.value })} placeholder="<h2>Meu widget</h2>"/></label>
              <label className="editor-field code-editor-field"><span>CSS <output>{selected.codeCss.length}/20.000</output></span><textarea spellCheck={false} rows={8} maxLength={20000} value={selected.codeCss} onChange={event => patchSelected({ codeCss:event.target.value })} placeholder="h2 { color: #9ee37d; }"/></label>
              <label className="editor-field code-editor-field"><span>JavaScript <output>{selected.codeJs.length}/20.000</output></span><textarea spellCheck={false} rows={8} maxLength={20000} value={selected.codeJs} onChange={event => patchSelected({ codeJs:event.target.value })} placeholder="document.querySelector('h2').textContent = 'Olá';"/></label>
            </>}
          </>}
        </>}
      </div>
      <div className="home-editor-actions">{error && <p className="home-save-error" role="alert">{error}</p>}<span className="editor-draft-status"><span className="live-dot"/> Prévia · salve para aplicar</span><button className="button primary" disabled={saving} onClick={() => {
        const invalid = draft.widgets.flatMap(widget => widget.type === 'shortcuts' ? widget.shortcuts : []).some(link => { try { return !['http:','https:'].includes(new URL(link.url).protocol); } catch { return true; } });
        if (invalid) { setError('Revise os endereços dos atalhos. Use HTTP ou HTTPS.'); setPanel('content'); return; }
        void finish();
      }}><Check size={16}/>{saving ? 'Salvando…' : 'Salvar Home'}</button><div><button onClick={() => setEditing(false)}>Cancelar</button><button onClick={() => { setDraft(clone(defaultHome)); setSelectedId('welcome'); setPanel('content'); setWidgetTab('content'); }}>Restaurar padrão</button></div></div>
    </aside>}
  </div>;
}

function CustomWidgetFrame({ widget }: { widget: HomeWidget }) {
  const [source,setSource] = useState(() => customWidgetDocument(widget));
  useEffect(() => {
    const timer = window.setTimeout(() => setSource(customWidgetDocument(widget)),180);
    return () => window.clearTimeout(timer);
  },[widget.codeHtml,widget.codeCss,widget.codeJs]);
  const sourceUrl = useMemo(() => URL.createObjectURL(new Blob([source],{ type:'text/html;charset=utf-8' })),[source]);
  useEffect(() => () => URL.revokeObjectURL(sourceUrl),[sourceUrl]);
  return <iframe className="custom-widget-frame" title={widget.title || 'Widget personalizado'} sandbox="allow-scripts" referrerPolicy="no-referrer" src={sourceUrl}/>;
}
function NoteWidget({ widget,saved,isPrivate,editing,command }: { widget: HomeWidget; saved: string; isPrivate: boolean; editing: boolean; command: Props['command'] }) {
  const [text,setText] = useState(saved),[status,setStatus] = useState('');
  const focused = useRef(false),current = useRef(text),pending = useRef(false);
  useEffect(() => { if (!focused.current && !pending.current) { setText(saved); current.current = saved; } },[saved]);
  async function write() {
    if (isPrivate || editing) return;
    const sent = current.current;
    try { await command('home:note',{ id: widget.id,text: sent }); if (current.current === sent) { pending.current = false; setStatus('Salvo neste dispositivo'); } }
    catch { setStatus('Não foi possível salvar. Tente novamente.'); }
  }
  return <div className="notes-widget"><div className="widget-title"><span><StickyNote size={14}/>{widget.title || 'Notas'}</span></div><textarea aria-label={`Notas ${widget.title || ''}`} value={text} disabled={editing} maxLength={20000} placeholder={editing ? 'Salve o layout para escrever suas notas.' : widget.notePlaceholder} onFocus={() => { focused.current = true; }} onBlur={() => { focused.current = false; if (pending.current) void write(); }} onChange={event => { current.current = event.target.value; setText(event.target.value); if (!isPrivate) { pending.current = true; setStatus('Salvando…'); void write(); } }}/><small role="status">{isPrivate ? 'Temporárias nesta aba privada' : status || 'Suas notas ficam neste dispositivo'}</small></div>;
}
function FocusWidget({ widget,clock,focus,isPrivate,editing,command }: { widget: HomeWidget; clock: Date; focus: HomeData['focus']; isPrivate: boolean; editing: boolean; command: Props['command'] }) {
  const [temporary,setTemporary] = useState(focus),[error,setError] = useState('');
  const value = isPrivate ? temporary : focus;
  const seconds = value.endsAt ? Math.max(0,Math.ceil((value.endsAt-clock.getTime())/1000)) : value.remaining;
  const running = !!value.endsAt && seconds > 0;
  async function update(action: string,minutes?: number) {
    if (isPrivate) {
      setTemporary(previous => action === 'start' ? { ...previous,endsAt: Date.now()+(previous.remaining || previous.duration)*1000 } : action === 'pause' ? { ...previous,remaining: seconds,endsAt: null } : action === 'duration' ? { duration: (minutes || 25)*60,remaining: (minutes || 25)*60,endsAt: null } : { ...previous,remaining: previous.duration,endsAt: null });
      return;
    }
    try { await command('home:focus',{ action,minutes,widgetId:widget.id }); setError(''); } catch { setError('Não foi possível atualizar o timer.'); }
  }
  return <div className="focus-widget"><div className="widget-title"><span><Timer size={14}/>{widget.title || 'Hora de focar'}</span></div><div className="focus-time">{Math.floor(seconds/60).toString().padStart(2,'0')}<span>:</span>{(seconds%60).toString().padStart(2,'0')}</div><p>{seconds === 0 ? 'Sessão concluída. Respire e faça uma pausa.' : running ? 'Uma coisa de cada vez.' : 'Encontre seu ritmo.'}</p><div className="focus-controls"><button className="button primary" disabled={editing} onClick={() => update(running ? 'pause' : 'start')}>{running ? <Pause size={14}/> : <Play size={14}/>} {running ? 'Pausar' : 'Começar'}</button><SmallButton label="Reiniciar foco" disabled={editing} onClick={() => { void update('reset'); }}><RotateCcw size={15}/></SmallButton><select aria-label="Duração do foco" disabled={editing} value={value.duration/60} onChange={event => update('duration',+event.target.value)}>{![5,15,25,45,60].includes(value.duration/60) && <option value={value.duration/60}>{value.duration/60} min</option>}{[5,15,25,45,60].map(minutes => <option value={minutes} key={minutes}>{minutes} min</option>)}</select></div>{error && <small role="alert">{error}</small>}</div>;
}
function CalendarWidget({ title,monday,clock }: { title: string; monday: boolean; clock: Date }) {
  const [month,setMonth] = useState(() => new Date(clock.getFullYear(),clock.getMonth(),1));
  const todayKey = `${clock.getFullYear()}-${clock.getMonth()}-${clock.getDate()}`;
  const first = new Date(month.getFullYear(),month.getMonth(),1);
  const offset = (first.getDay() - (monday ? 1 : 0) + 7) % 7;
  const count = new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
  const cells = Array.from({ length:Math.ceil((offset+count)/7)*7 },(_,index) => index-offset+1);
  const weekdays = monday ? ['S','T','Q','Q','S','S','D'] : ['D','S','T','Q','Q','S','S'];
  return <div className="calendar-widget"><div className="widget-title"><span><CalendarDays size={14}/>{title}</span><div><button aria-label="Mês anterior" onClick={() => setMonth(value => new Date(value.getFullYear(),value.getMonth()-1,1))}><ChevronLeft size={14}/></button><button aria-label="Próximo mês" onClick={() => setMonth(value => new Date(value.getFullYear(),value.getMonth()+1,1))}><ChevronRight size={14}/></button></div></div><strong className="calendar-month">{month.toLocaleDateString('pt-BR',{ month:'long',year:'numeric' })}</strong><div className="calendar-grid calendar-weekdays">{weekdays.map((day,index) => <span key={`${day}-${index}`}>{day}</span>)}</div><div className="calendar-grid calendar-days">{cells.map((day,index) => { const valid = day > 0 && day <= count; const active = valid && `${month.getFullYear()}-${month.getMonth()}-${day}` === todayKey; return <span className={cn(!valid && 'outside-month',active && 'today')} key={index}>{valid ? day : ''}</span>; })}</div></div>;
}
function TasksWidget({ widget,tasks,isPrivate,editing,command }: { widget: HomeWidget; tasks: HomeTask[]; isPrivate: boolean; editing: boolean; command: Props['command'] }) {
  const [temporary,setTemporary] = useState<HomeTask[]>(tasks),[text,setText] = useState(''),[error,setError] = useState('');
  useEffect(() => { if (!isPrivate) setTemporary(tasks); },[tasks,isPrivate]);
  const items = isPrivate ? temporary : tasks;
  async function act(action: 'add'|'toggle'|'remove',item?: HomeTask) {
    if (editing) return;
    if (isPrivate) {
      setTemporary(previous => action === 'add' && text.trim() ? [...previous,{ id:crypto.randomUUID(),title:text.trim().slice(0,180),done:false }] : action === 'toggle' ? previous.map(task => task.id === item?.id ? { ...task,done:!task.done } : task) : previous.filter(task => task.id !== item?.id));
      if (action === 'add') setText('');
      return;
    }
    try { await command('home:tasks',{ widgetId:widget.id,action,title:text,id:item?.id }); setError(''); if (action === 'add') setText(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar as tarefas.'); }
  }
  return <div className="tasks-widget"><div className="widget-title"><span><ListTodo size={14}/>{widget.title || 'Tarefas'}</span><span>{items.filter(item => item.done).length}/{items.length}</span></div><form className="task-add" onSubmit={event => { event.preventDefault(); if (text.trim()) void act('add'); }}><input value={text} maxLength={180} disabled={editing || items.length >= 50} onChange={event => setText(event.target.value)} placeholder="Adicionar tarefa…"/><button aria-label="Adicionar tarefa" disabled={editing || !text.trim() || items.length >= 50}><Plus size={15}/></button></form><div className="task-list">{items.map(item => <div className={cn('task-row',item.done && 'done')} key={item.id}><button disabled={editing} aria-label={`${item.done ? 'Reabrir' : 'Concluir'} ${item.title}`} onClick={() => void act('toggle',item)}>{item.done ? <CircleCheck size={16}/> : <span/>}</button><span title={item.title}>{item.title}</span><button className="task-remove" disabled={editing} aria-label={`Remover ${item.title}`} onClick={() => void act('remove',item)}><X size={13}/></button></div>)}{!items.length && <p className="widget-empty">Sua próxima tarefa começa aqui.</p>}</div>{error && <small className="task-error" role="alert">{error}</small>}</div>;
}
function CountdownWidget({ widget,clock }: { widget: HomeWidget; clock: Date }) {
  const target = widget.countdownTarget ? new Date(widget.countdownTarget).getTime() : NaN;
  const total = Number.isFinite(target) ? Math.max(0,Math.floor((target-clock.getTime())/1000)) : 0;
  const days = Math.floor(total/86400),hours = Math.floor(total%86400/3600),minutes = Math.floor(total%3600/60),seconds = total%60;
  return <div className="countdown-widget"><span className="widget-title"><CalendarClock size={14}/>{widget.title || 'Contagem regressiva'}</span><strong>{widget.countdownLabel}</strong>{Number.isFinite(target) ? <div className="countdown-values">{[[days,'dias'],[hours,'horas'],[minutes,'min'],[seconds,'seg']] .map(([value,label]) => <span key={label}><b>{String(value).padStart(2,'0')}</b><small>{label}</small></span>)}</div> : <p className="widget-empty">Escolha uma data nas opções deste widget.</p>}</div>;
}
function CalculatorWidget({ widget }: { widget: HomeWidget }) {
  const [display,setDisplay] = useState('0'),[stored,setStored] = useState<number|null>(null),[operator,setOperator] = useState<string|null>(null),[replace,setReplace] = useState(false);
  const format = (value:number) => Number.isFinite(value) ? Number(value.toFixed(widget.calculatorPrecision)).toString() : 'Erro';
  function input(value:string) {
    if (value === 'C') { setDisplay('0'); setStored(null); setOperator(null); setReplace(false); return; }
    if (value === '±') { setDisplay(previous => previous === '0' ? previous : previous.startsWith('-') ? previous.slice(1) : `-${previous}`); return; }
    if (value === '%') { setDisplay(previous => format(Number(previous)/100)); return; }
    if (['+','−','×','÷'].includes(value)) { setStored(Number(display)); setOperator(value); setReplace(true); return; }
    if (value === '=') {
      if (stored === null || !operator) return;
      const right = Number(display),result = operator === '+' ? stored+right : operator === '−' ? stored-right : operator === '×' ? stored*right : right === 0 ? NaN : stored/right;
      setDisplay(format(result)); setStored(null); setOperator(null); setReplace(true); return;
    }
    if (value === '.') { setDisplay(previous => replace ? '0.' : previous.includes('.') ? previous : `${previous}.`); setReplace(false); return; }
    setDisplay(previous => replace || previous === '0' || previous === 'Erro' ? value : `${previous}${value}`.slice(0,16)); setReplace(false);
  }
  const keys = ['C','±','%','÷','7','8','9','×','4','5','6','−','1','2','3','+','0','.','='];
  return <div className="calculator-widget"><div className="calculator-display" aria-live="polite">{display}</div><div className="calculator-keys">{keys.map(key => <button key={key} className={cn(['÷','×','−','+','='].includes(key) && 'operator',key === '0' && 'wide-key')} onClick={() => input(key)} aria-label={key === 'C' ? 'Limpar' : key}>{key}</button>)}</div></div>;
}
function OrbitalArt() {
  return <div className="orbital-art" aria-hidden="true"><svg className="orbital-sculpture" viewBox="0 0 620 620" fill="none"><g transform="rotate(-24 310 310)"><circle className="orb-silhouette" cx="310" cy="310" r="184"/>{[36,78,126,162,184].map(r => <ellipse className="orb-meridian" key={`v${r}`} cx="310" cy="310" rx={r} ry="184"/>)}{[42,88,136,170].map(r => <ellipse className="orb-parallel" key={`h${r}`} cx="310" cy="310" rx="184" ry={r}/>)}<path className="orb-axis" d="M310 87V533M87 310H533"/><ellipse className="orb-ring" cx="310" cy="310" rx="282" ry="79" transform="rotate(-17 310 310)"/><ellipse className="orb-ring-secondary" cx="310" cy="310" rx="252" ry="105" transform="rotate(23 310 310)"/><circle className="orb-marker" cx="41" cy="344" r="4"/><circle className="orb-marker-small" cx="494" cy="310" r="3"/></g></svg></div>;
}
