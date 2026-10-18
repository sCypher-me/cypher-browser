import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { ArrowDown, ArrowUp, Boxes, Code2, Download, Eye, EyeOff, Keyboard, PanelRight, Paintbrush, Route, RotateCcw, Ruler, Trash2, Upload } from 'lucide-react';
import type { DesignTokens, Settings, ShortcutAction, SkinPackage, ToolbarItem } from './types';
import { Panel, Row, Switch } from './settings-ui';

type Command = (action: string, payload?: unknown) => Promise<any>;
type Update = (patch: Partial<Settings>) => void;

export const defaultTokens: DesignTokens = { cut: 12, density: 1, barHeight: 52, borderWidth: 1, displayFont: 'big-shoulders', bodyFont: 'work-sans' };
export const toolbarLabels: Record<ToolbarItem, string> = { navigation: 'Voltar, avançar e recarregar', address: 'Barra de endereço', routes: 'Rotas Normal, Tor e I2P', skin: 'Seletor de pele', media: 'Miniplayer', customize: 'Personalizar', menu: 'Menu do navegador' };
const hideable: ToolbarItem[] = ['navigation', 'routes', 'skin', 'media', 'customize'];
export const shortcutLabels: Record<ShortcutAction, [string, string]> = {
  'tab:new': ['Nova aba', 'CmdOrCtrl+T'], 'tab:private': ['Nova aba privada', 'CmdOrCtrl+Shift+N'], 'tab:close': ['Fechar aba', 'CmdOrCtrl+W'], 'tab:restore': ['Reabrir aba fechada', 'CmdOrCtrl+Shift+T'],
  'tab:next': ['Próxima aba', 'Ctrl+Tab'], 'tab:previous': ['Aba anterior', 'Ctrl+Shift+Tab'], palette: ['Pesquisar abas e comandos', 'CmdOrCtrl+Shift+A'], inspector: ['Editar interface', 'CmdOrCtrl+E'],
  address: ['Barra de endereço', 'CmdOrCtrl+L'], find: ['Localizar na página', 'CmdOrCtrl+F'], bookmark: ['Favoritar página', 'CmdOrCtrl+D'], history: ['Histórico', 'CmdOrCtrl+H'], downloads: ['Downloads', 'CmdOrCtrl+J'],
  reload: ['Recarregar', 'CmdOrCtrl+R'], reader: ['Modo leitura', 'CmdOrCtrl+Shift+R'], capture: ['Capturar tela', 'CmdOrCtrl+Shift+S'], split: ['Dividir tela', 'CmdOrCtrl+Shift+D'], print: ['Imprimir', 'CmdOrCtrl+P'],
  save: ['Salvar página', 'CmdOrCtrl+S'], fullscreen: ['Tela cheia', 'F11'], 'zoom:in': ['Ampliar', 'CmdOrCtrl+='], 'zoom:out': ['Reduzir', 'CmdOrCtrl+-'], 'zoom:reset': ['Zoom original', 'CmdOrCtrl+0'], devtools: ['Ferramentas de desenvolvedor', 'F12'],
};
export const displayFonts: Array<[DesignTokens['displayFont'], string]> = [['big-shoulders', 'Big Shoulders (condensada)'], ['work-sans', 'Work Sans'], ['system', 'Segoe UI'], ['serif', 'Serifada'], ['mono', 'Monoespaçada']];
export const bodyFonts: Array<[DesignTokens['bodyFont'], string]> = [['work-sans', 'Work Sans'], ['system', 'Segoe UI'], ['serif', 'Serifada'], ['mono', 'Monoespaçada']];
export const prettyAccelerator = (value: string) => value.replace('CmdOrCtrl', 'Ctrl').replaceAll('+', ' + ');

function Range({ label, value, min, max, step = 1, suffix = '', onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (value: number) => void }) {
  return <label className="cz-range"><span>{label}<output>{step < 1 ? value.toFixed(2) : value}{suffix}</output></span><input type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))}/></label>;
}

export function TokenControls({ settings: s, onSettings, only }: { settings: Settings; onSettings: Update; only?: Array<keyof DesignTokens> }) {
  const tokens = s.tokens || defaultTokens;
  const set = (patch: Partial<DesignTokens>) => onSettings({ tokens: { ...tokens, ...patch } });
  const show = (key: keyof DesignTokens) => !only || only.includes(key);
  return <div className="cz-token-grid">
    {show('cut') && <Range label="Tamanho do corte" value={tokens.cut} min={0} max={28} suffix=" px" onChange={cut => set({ cut })}/>}
    {show('barHeight') && <Range label="Altura da barra" value={tokens.barHeight} min={40} max={72} suffix=" px" onChange={barHeight => set({ barHeight })}/>}
    {show('density') && <Range label="Densidade" value={tokens.density} min={0.85} max={1.25} step={0.05} suffix="×" onChange={density => set({ density })}/>}
    {show('borderWidth') && <Range label="Espessura das bordas" value={tokens.borderWidth} min={0} max={3} suffix=" px" onChange={borderWidth => set({ borderWidth })}/>}
    {show('displayFont') && <label className="cz-field"><span>Fonte de títulos</span><select className="sc-select" value={tokens.displayFont} onChange={event => set({ displayFont: event.target.value as DesignTokens['displayFont'] })}>{displayFonts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
    {show('bodyFont') && <label className="cz-field"><span>Fonte de texto</span><select className="sc-select" value={tokens.bodyFont} onChange={event => set({ bodyFont: event.target.value as DesignTokens['bodyFont'] })}>{bodyFonts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
  </div>;
}

export function TokensPanel({ settings, onSettings }: { settings: Settings; onSettings: Update }) {
  return <Panel id="appearance-tokens" eyebrow="TOKENS DE DESIGN" title="Proporções da interface" detail="Ajuste os cortes, a altura da barra, a densidade e as fontes. Toda pele usa estes valores." icon={Ruler}>
    <TokenControls settings={settings} onSettings={onSettings}/>
    <div className="cz-actions"><button type="button" className="button secondary" onClick={() => onSettings({ tokens: defaultTokens })}><RotateCcw size={14}/> Restaurar proporções</button></div>
  </Panel>;
}

export function ToolbarArrangement({ settings: s, onSettings }: { settings: Settings; onSettings: Update }) {
  const order = s.toolbarOrder?.length ? s.toolbarOrder : (Object.keys(toolbarLabels) as ToolbarItem[]);
  const move = (index: number, step: number) => { const next = [...order]; const target = index + step; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; onSettings({ toolbarOrder: next }); };
  const toggle = (item: ToolbarItem) => onSettings({ toolbarHidden: s.toolbarHidden.includes(item) ? s.toolbarHidden.filter(entry => entry !== item) : [...s.toolbarHidden, item] });
  return <ol className="cz-order-list">{order.map((item, index) => {
    const hidden = s.toolbarHidden.includes(item);
    return <li key={item} className={hidden ? 'is-hidden' : ''}>
      <span className="cz-order-index">{String(index + 1).padStart(2, '0')}</span><span className="cz-order-label">{toolbarLabels[item]}</span>
      {hideable.includes(item) && <button type="button" className="cz-icon" aria-label={hidden ? `Mostrar ${toolbarLabels[item]}` : `Ocultar ${toolbarLabels[item]}`} title={hidden ? 'Mostrar' : 'Ocultar'} onClick={() => toggle(item)}>{hidden ? <EyeOff size={15}/> : <Eye size={15}/>}</button>}
      <button type="button" className="cz-icon" aria-label={`Mover ${toolbarLabels[item]} para cima`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={15}/></button>
      <button type="button" className="cz-icon" aria-label={`Mover ${toolbarLabels[item]} para baixo`} disabled={index === order.length - 1} onClick={() => move(index, 1)}><ArrowDown size={15}/></button>
    </li>;
  })}</ol>;
}

export function ToolbarPanel({ settings: s, onSettings }: { settings: Settings; onSettings: Update }) {
  return <Panel id="tabs-toolbar" eyebrow="BARRA DE FERRAMENTAS" title="Monte sua barra" detail="Reordene e oculte botões, e escolha onde a barra fica." icon={PanelRight}>
    <Row title="Posição da barra" detail="No topo da janela ou na base, perto de onde o seu olhar termina a leitura"><div className="cz-segment" role="group" aria-label="Posição da barra">{(['top', 'bottom'] as const).map(value => <button type="button" key={value} aria-pressed={s.toolbarPosition === value} className={s.toolbarPosition === value ? 'chosen' : ''} onClick={() => onSettings({ toolbarPosition: value })}>{value === 'top' ? 'Topo' : 'Base'}</button>)}</div></Row>
    <Row title="Abas ocultas" detail="A coluna de abas se recolhe e aparece quando o ponteiro chega à borda"><Switch checked={s.tabsAutoHide} label="Abas ocultas" onChange={() => onSettings({ tabsAutoHide: !s.tabsAutoHide })}/></Row>
    <Row title="Trilho de atalhos" detail="A coluna de ícones à esquerda, com Home, Favoritos e páginas internas"><Switch checked={s.showRail} label="Mostrar trilho de atalhos" onChange={() => onSettings({ showRail: !s.showRail })}/></Row>
    <ToolbarArrangement settings={s} onSettings={onSettings}/>
  </Panel>;
}

export function SkinsPanel({ settings: s, skins, command, onSettings }: { settings: Settings; skins: SkinPackage[]; command: Command; onSettings: Update }) {
  return <Panel id="appearance-skins" eyebrow="PACOTES" title="Peles instaladas" detail="Peles .cypherskin trazem tokens e CSS. Por segurança, só CSS é aceito, sem scripts nem endereços externos." icon={Paintbrush}>
    <div className="cz-skin-list">
      <button type="button" className={`cz-skin ${!s.skinPackage ? 'chosen' : ''}`} onClick={() => void command('skin:apply', '')}><strong>Sem pacote</strong><small>Usa só a pele {s.skin === 'recorte' ? 'Recorte' : 'Clássico'} e seus ajustes.</small></button>
      {skins.map(skin => <div key={skin.id} className={`cz-skin ${s.skinPackage === skin.id ? 'chosen' : ''}`}>
        <button type="button" onClick={() => void command('skin:apply', skin.id)}><strong>{skin.name}</strong><small>{skin.author}{skin.description ? ` · ${skin.description}` : ''}</small></button>
        <button type="button" className="cz-icon" aria-label={`Remover ${skin.name}`} onClick={() => void command('skin:remove', skin.id)}><Trash2 size={15}/></button>
      </div>)}
    </div>
    <div className="cz-actions">
      <button type="button" className="button secondary" onClick={() => void command('skin:import')}><Download size={14}/> Importar pele</button>
      <button type="button" className="button primary" onClick={() => void command('skin:export', { name: 'Minha pele' })}><Upload size={14}/> Exportar minha pele</button>
      {s.skinPackage && <button type="button" className="button secondary" onClick={() => onSettings({ skinPackage: '' })}>Desativar pacote</button>}
    </div>
  </Panel>;
}

export function CustomCssPanel({ settings: s, onSettings }: { settings: Settings; onSettings: Update }) {
  const [draft, setDraft] = useState(s.customCss);
  useEffect(() => setDraft(s.customCss), [s.customCss]);
  return <Panel id="appearance-css" eyebrow="AVANÇADO" title="CSS da interface" detail="Aplicado por último, sobre qualquer pele. Endereços externos e @import são removidos." icon={Code2}>
    <textarea className="cz-code" spellCheck={false} aria-label="CSS personalizado" value={draft} placeholder={'.tab.selected {\n  outline: 2px solid var(--accent);\n}'} onChange={event => setDraft(event.target.value)}/>
    <div className="cz-actions">
      <button type="button" className="button primary" disabled={draft === s.customCss} onClick={() => onSettings({ customCss: draft })}>Aplicar CSS</button>
      <button type="button" className="button secondary" disabled={!s.customCss} onClick={() => { setDraft(''); onSettings({ customCss: '' }); }}>Restaurar</button>
    </div>
  </Panel>;
}

function captureAccelerator(event: ReactKeyboardEvent): string | null {
  const keyName = event.key.length === 1 ? event.key.toUpperCase() : ({ ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', ' ': 'Space' } as Record<string, string>)[event.key] || event.key;
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return null;
  if (!/^(?:[A-Z0-9]|F(?:[1-9]|1[0-2])|Tab|Space|Enter|Backspace|Delete|Up|Down|Left|Right|Home|End|PageUp|PageDown|=|-|,|\.|\/|;)$/.test(keyName)) return null;
  const parts = [event.ctrlKey || event.metaKey ? 'CmdOrCtrl' : '', event.altKey ? 'Alt' : '', event.shiftKey ? 'Shift' : ''].filter(Boolean);
  if (!parts.length && !/^F\d+$/.test(keyName)) return null;
  return [...parts, keyName].join('+');
}

export function ShortcutsPanel({ settings: s, onSettings }: { settings: Settings; onSettings: Update }) {
  const [recording, setRecording] = useState<ShortcutAction | null>(null);
  const current = (action: ShortcutAction) => s.shortcuts?.[action] || shortcutLabels[action][1];
  const conflicts = (action: ShortcutAction) => (Object.keys(shortcutLabels) as ShortcutAction[]).filter(other => other !== action && current(other) === current(action));
  return <Panel id="shortcuts-list" eyebrow="TECLADO" title="Atalhos editáveis" detail="Clique em um atalho e pressione a nova combinação. Esc cancela." icon={Keyboard}>
    {(Object.keys(shortcutLabels) as ShortcutAction[]).map(action => {
      const clash = conflicts(action);
      return <Row key={action} title={shortcutLabels[action][0]} detail={clash.length ? `Conflita com ${clash.map(item => shortcutLabels[item][0]).join(', ')}` : undefined}>
        <button type="button" className={`sc-keycap cz-keycap ${recording === action ? 'recording' : ''} ${clash.length ? 'conflict' : ''}`} onClick={() => setRecording(action)} onBlur={() => setRecording(null)} onKeyDown={event => {
          if (recording !== action) return;
          event.preventDefault();
          if (event.key === 'Escape') { setRecording(null); return; }
          const accelerator = captureAccelerator(event);
          if (accelerator) { onSettings({ shortcuts: { ...s.shortcuts, [action]: accelerator } }); setRecording(null); }
        }}>{recording === action ? 'Pressione as teclas…' : prettyAccelerator(current(action))}</button>
        {s.shortcuts?.[action] && <button type="button" className="cz-icon" aria-label={`Restaurar atalho de ${shortcutLabels[action][0]}`} onClick={() => { const next = { ...s.shortcuts }; delete next[action]; onSettings({ shortcuts: next }); }}><RotateCcw size={14}/></button>}
      </Row>;
    })}
  </Panel>;
}

export function RoutesPanel({ settings: s, onSettings }: { settings: Settings; onSettings: Update }) {
  const [host, setHost] = useState('');
  const [mode, setMode] = useState<'tor' | 'i2p'>('tor');
  const clean = host.trim().toLowerCase().replace(/^https?:\/\//, '').split(/[/?#]/)[0].replace(/^www\./, '');
  const valid = /^[a-z\d.-]+\.[a-z\d-]+$/.test(clean);
  return <Panel id="connections-rules" eyebrow="ROTAS AUTOMÁTICAS" title="Rota por site" detail="Sites desta lista sempre abrem em uma aba com a rota escolhida, sem mudar as outras abas." icon={Route}>
    <form className="cz-inline-form" onSubmit={event => { event.preventDefault(); if (!valid) return; onSettings({ routeRules: [...s.routeRules.filter(rule => rule.host !== clean), { host: clean, mode }] }); setHost(''); }}>
      <input className="sc-input" aria-label="Site" placeholder="exemplo.com" value={host} onChange={event => setHost(event.target.value)}/>
      <select className="sc-select" aria-label="Rota" value={mode} onChange={event => setMode(event.target.value as 'tor' | 'i2p')}><option value="tor">Tor</option><option value="i2p">I2P</option></select>
      <button type="submit" className="button primary" disabled={!valid}>Adicionar</button>
    </form>
    {s.routeRules.length ? <ul className="cz-list">{s.routeRules.map(rule => <li key={rule.host}><strong>{rule.host}</strong><span className="cz-pill">{rule.mode.toUpperCase()}</span><button type="button" className="cz-icon" aria-label={`Remover regra de ${rule.host}`} onClick={() => onSettings({ routeRules: s.routeRules.filter(item => item.host !== rule.host) })}><Trash2 size={14}/></button></li>)}</ul> : <p className="cz-empty">Nenhuma regra ainda. Você também pode criar uma pelo escudo da barra de endereço.</p>}
  </Panel>;
}

const containerColors = ['#ff5436', '#5aa9ff', '#3ddc84', '#ffbf1f', '#c4b3ff', '#ff7ab6'];
export function ContainersPanel({ settings: s, onSettings }: { settings: Settings; onSettings: Update }) {
  const [name, setName] = useState('');
  return <Panel id="connections-containers" eyebrow="ISOLAMENTO" title="Contêineres" detail="Cada contêiner guarda cookies e logins separados. Use para ter duas contas do mesmo site lado a lado." icon={Boxes}>
    <form className="cz-inline-form" onSubmit={event => { event.preventDefault(); if (!name.trim() || s.containers.length >= 12) return; onSettings({ containers: [...s.containers, { id: crypto.randomUUID().slice(0, 8), name: name.trim(), color: containerColors[s.containers.length % containerColors.length] }] }); setName(''); }}>
      <input className="sc-input" aria-label="Nome do contêiner" placeholder="Trabalho, Compras, Conta 2…" value={name} maxLength={32} onChange={event => setName(event.target.value)}/>
      <button type="submit" className="button primary" disabled={!name.trim() || s.containers.length >= 12}>Criar</button>
    </form>
    {s.containers.length ? <ul className="cz-list">{s.containers.map(item => <li key={item.id}>
      <input type="color" className="cz-swatch" aria-label={`Cor de ${item.name}`} value={item.color} onChange={event => onSettings({ containers: s.containers.map(entry => entry.id === item.id ? { ...entry, color: event.target.value } : entry) })}/>
      <strong>{item.name}</strong>
      <button type="button" className="cz-icon" aria-label={`Remover ${item.name}`} onClick={() => onSettings({ containers: s.containers.filter(entry => entry.id !== item.id) })}><Trash2 size={14}/></button>
    </li>)}</ul> : <p className="cz-empty">Crie um contêiner e abra abas nele pelo menu ou pelo clique direito na aba.</p>}
  </Panel>;
}

export function WebPanelsPanel({ settings: s, command, onSettings }: { settings: Settings; command: Command; onSettings: Update }) {
  const [url, setUrl] = useState('');
  return <Panel id="tabs-panels" eyebrow="PAINÉIS LATERAIS" title="Sites fixos ao lado" detail="Deixe WhatsApp, Spotify ou um tradutor sempre à mão, numa coluna ao lado da página." icon={PanelRight}>
    <form className="cz-inline-form" onSubmit={event => { event.preventDefault(); if (!url.trim()) return; void command('panel:add', { url: url.trim() }).then(() => setUrl('')); }}>
      <input className="sc-input" aria-label="Endereço do painel" placeholder="web.whatsapp.com" value={url} onChange={event => setUrl(event.target.value)}/>
      <button type="submit" className="button primary" disabled={!url.trim() || s.webPanels.length >= 8}>Adicionar painel</button>
    </form>
    {s.webPanels.length > 0 && <ul className="cz-list">{s.webPanels.map(panel => <li key={panel.id}><strong>{panel.title}</strong><small>{panel.url}</small><button type="button" className="cz-icon" aria-label={`Remover ${panel.title}`} onClick={() => void command('panel:remove', panel.id)}><Trash2 size={14}/></button></li>)}</ul>}
    <Row title="Largura do painel" detail={`${s.panelWidth} px`}><input type="range" min={280} max={560} step={10} value={s.panelWidth} aria-label="Largura do painel" onChange={event => onSettings({ panelWidth: Number(event.target.value) })}/></Row>
  </Panel>;
}
