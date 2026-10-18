import type { CSSProperties, ReactNode } from 'react';
import { ArrowUpRight, Check, House, LayoutPanelLeft, LayoutTemplate, MonitorCog, Moon, Palette, PanelLeft, PanelTop, ShieldCheck, Sparkles, Sun, Volume2 } from 'lucide-react';
import type { Settings } from '../types';
import { Panel, Row, Switch } from '../settings-ui';
import { CustomCssPanel, SkinsPanel, TokensPanel, ToolbarPanel } from '../CustomizationSettings';
import type { SectionProps } from './types';

const themePresets = [
  { id: 'recorte', name: 'Recorte Noite', accent: '#ff5436', surface: '#151310', background: '#0a0908' },
  { id: 'cypher', name: 'Cypher', accent: '#b6f36a', surface: '#111513', background: '#090c0b' },
  { id: 'ultraviolet', name: 'Ultravioleta', accent: '#b5a0ff', surface: '#15121d', background: '#0b0910' },
  { id: 'arctic', name: 'Sinal ártico', accent: '#78d9ee', surface: '#10191e', background: '#080e12' },
  { id: 'ember', name: 'Ember', accent: '#ff9b6a', surface: '#1b1412', background: '#100b09' },
];

function Choice({ chosen, onClick, icon, title, detail }: { chosen: boolean; onClick: () => void; icon: ReactNode; title: string; detail: string }) {
  return <button type="button" className={`sc-choice-card ${chosen ? 'chosen' : ''}`} onClick={onClick} aria-pressed={chosen}><span className="sc-choice-icon">{icon}</span><span><strong>{title}</strong><small>{detail}</small></span>{chosen && <Check size={15}/>}</button>;
}

export default function Appearance({ settings: s, onSettings, command, navigate, skins = [] }: SectionProps) {
  const chooseTheme = (theme: typeof themePresets[number]) => onSettings({ appearanceMode: 'dark', accent: theme.accent, surface: theme.surface, background: theme.background });
  const chooseAppearanceMode = (mode: Settings['appearanceMode']) => onSettings(mode === 'light'
    ? { appearanceMode: mode, accent: '#587b35', surface: '#ffffff', background: '#f0f3ee' }
    : s.skin === 'recorte' ? { appearanceMode: mode, accent: '#ff5436', surface: '#151310', background: '#0a0908' } : { appearanceMode: mode, accent: '#b6f36a', surface: '#111513', background: '#090c0b' });
  const wallpaperName = s.wallpaper === 'video' ? s.wallpaperVideoName || 'vídeo' : s.wallpaper === 'custom' ? 'imagem pessoal' : s.wallpaper === 'none' ? 'minimal' : s.wallpaper === 'grid' ? 'grade' : 'orbital';

  return <>
    <Panel id="appearance-skin" eyebrow="PELE" title="Formato da interface" detail="Muda silhuetas e tipografia. As cores continuam suas." icon={LayoutTemplate}>
      <div className="sc-choice-grid">
        <Choice chosen={s.skin === 'recorte'} onClick={() => onSettings({ skin: 'recorte' })} icon={<svg width="18" height="15" viewBox="0 0 36 30" aria-hidden="true"><path d="M0 0h28l8 8v22H6L0 24Z" fill="currentColor"/></svg>} title="Recorte" detail="Cortes e tipografia condensada"/>
        <Choice chosen={s.skin === 'classic'} onClick={() => onSettings({ skin: 'classic' })} icon={<svg width="18" height="15" viewBox="0 0 36 30" aria-hidden="true"><rect width="36" height="30" rx="9" fill="currentColor"/></svg>} title="Clássico" detail="Cantos suaves, visual original"/>
      </div>
    </Panel>

    <Panel id="appearance-mode" eyebrow="MODO" title="Claro ou escuro" icon={s.appearanceMode === 'light' ? Sun : Moon}>
      <div className="sc-choice-grid sc-choice-grid-3">
        <Choice chosen={s.appearanceMode === 'light'} onClick={() => chooseAppearanceMode('light')} icon={<Sun size={16}/>} title="Claro" detail="Superfícies claras"/>
        <Choice chosen={s.appearanceMode === 'dark'} onClick={() => chooseAppearanceMode('dark')} icon={<Moon size={16}/>} title="Escuro" detail="Superfícies escuras"/>
        <Choice chosen={s.appearanceMode === 'system'} onClick={() => onSettings({ appearanceMode: 'system' })} icon={<MonitorCog size={16}/>} title="Sistema" detail="Segue o Windows"/>
      </div>
      <Row title="Cor do espaço como destaque" detail="Cada Espaço usa a própria cor no navegador inteiro"><Switch checked={s.workspaceAccent} label="Cor do espaço como destaque" onChange={() => onSettings({ workspaceAccent: !s.workspaceAccent })}/></Row>
    </Panel>

    <Panel id="appearance-presets" eyebrow="IDENTIDADE" title="Temas" detail="Comece por uma combinação e ajuste cada detalhe." icon={Sparkles} wide>
      <div className="sc-theme-grid">{themePresets.map(theme => <button type="button" key={theme.id} className={`sc-theme ${s.accent.toLowerCase() === theme.accent ? 'chosen' : ''}`} onClick={() => chooseTheme(theme)} aria-pressed={s.accent.toLowerCase() === theme.accent}>
        <span className="sc-theme-preview" style={{ '--theme-accent': theme.accent, '--theme-surface': theme.surface, '--theme-base': theme.background } as CSSProperties}><i/><i/><i/><b/></span><span className="sc-theme-meta"><strong>{theme.name}</strong>{s.accent.toLowerCase() === theme.accent && <Check size={14}/>}</span>
      </button>)}</div>
    </Panel>

    <Panel id="appearance-shape" eyebrow="ACABAMENTO" title="Cores, cantos e fonte" icon={Palette}>
      <div className="sc-color-grid">{[{ key: 'accent', label: 'Destaque' }, { key: 'surface', label: 'Superfícies' }, { key: 'background', label: 'Fundo' }].map(({ key, label }) => <label className="sc-color-choice" key={key}><span className="sc-color-swatch"><input type="color" aria-label={label} value={s[key as 'accent']} onChange={event => onSettings({ [key]: event.target.value })}/></span><span><strong>{label}</strong><small>{s[key as 'accent'].toUpperCase()}</small></span></label>)}</div>
      <Row id="appearance-radius" title="Cantos" detail={`${s.radius} px na pele Clássico`}><input className="sc-range" aria-label="Arredondamento dos cantos" type="range" min="0" max="24" value={s.radius} onChange={event => onSettings({ radius: +event.target.value })}/><span className="sc-value">{s.radius}px</span></Row>
      <Row id="appearance-font" title="Tipografia da moldura"><select className="sc-select" value={s.font} onChange={event => onSettings({ font: event.target.value as Settings['font'] })}><option value="system">Sistema</option><option value="mono">Monoespaçada</option></select></Row>
      <Row id="appearance-motion" title="Animações da interface"><Switch label="Animações da interface" checked={s.motion} onChange={() => onSettings({ motion: !s.motion })}/></Row>
    </Panel>

    <Panel id="appearance-controls" eyebrow="IDENTIDADE" title="Controles e efeitos" icon={Sparkles}>
      <Row title="Forma dos botões" detail="Barra, painéis e ações"><select className="sc-select" value={s.buttonShape} onChange={event => onSettings({ buttonShape: event.target.value as Settings['buttonShape'] })}><option value="soft">Suave</option><option value="square">Angular</option><option value="pill">Pílula</option></select></Row>
      <Row title="Efeito de interface"><select className="sc-select" value={s.interfaceEffect} onChange={event => onSettings({ interfaceEffect: event.target.value as Settings['interfaceEffect'] })}><option value="signal">Sinal Cypher</option><option value="glow">Brilho</option><option value="scanline">Linhas de varredura</option><option value="none">Sem efeito</option></select></Row>
    </Panel>

    <TokensPanel settings={s} onSettings={onSettings}/>

    <Panel id="tabs-position" eyebrow="ABAS E TRILHO" title="Disposição das abas" icon={LayoutPanelLeft}>
      <div className="sc-choice-grid">
        <Choice chosen={s.tabPosition === 'side'} onClick={() => onSettings({ tabPosition: 'side' })} icon={<PanelLeft size={18}/>} title="Laterais" detail="Lista vertical à esquerda"/>
        <Choice chosen={s.tabPosition === 'top'} onClick={() => onSettings({ tabPosition: 'top' })} icon={<PanelTop size={18}/>} title="No topo" detail="Faixa acima da página"/>
      </div>
      <Row id="tabs-width" title="Barra de abas compacta" detail="Mantém só os ícones"><Switch label="Barra de abas compacta" checked={s.compact} onChange={() => onSettings({ compact: !s.compact })}/></Row>
      {s.tabPosition === 'side' && <Row id="tabs-width-slider" title="Largura da lateral" detail={`${s.sidebarWidth} px`}><input className="sc-range" aria-label="Largura da barra lateral" type="range" min="210" max="360" value={s.sidebarWidth} onChange={event => onSettings({ sidebarWidth: +event.target.value })}/><span className="sc-value">{s.sidebarWidth}px</span></Row>}
      <Row id="tabs-bookmark-bar" title="Barra de favoritos" detail="Primeiros favoritos abaixo do endereço"><Switch label="Mostrar barra de favoritos" checked={s.showBookmarksBar} onChange={() => onSettings({ showBookmarksBar: !s.showBookmarksBar })}/></Row>
    </Panel>

    <ToolbarPanel settings={s} onSettings={onSettings}/>

    <Panel id="home-editor" eyebrow="PÁGINA INICIAL" title="Home e papel de parede" icon={House}>
      <Row id="appearance-wallpaper" title="Fundo da Home" detail={`Atual: ${wallpaperName}`}><select className="sc-select" value={s.wallpaper} onChange={event => onSettings({ wallpaper: event.target.value as Settings['wallpaper'] })}><option value="orbital">Orbital</option><option value="grid">Grade</option><option value="none">Minimal</option>{s.wallpaper === 'custom' && <option value="custom">Imagem pessoal</option>}{s.wallpaper === 'video' && <option value="video">Vídeo pessoal</option>}</select></Row>
      <div className="sc-action-row">
        <button className="sc-button sc-button-subtle" onClick={async () => { const result = await command('appearance:wallpaper:select'); if (result?.dataUrl) onSettings({ wallpaper: 'custom', wallpaperImageData: result.dataUrl, wallpaperVideoPath: '', wallpaperVideoName: '' }); }}>Escolher imagem</button>
        <button className="sc-button sc-button-subtle" onClick={async () => { const result = await command('appearance:wallpaper-video:select'); if (result?.path) onSettings({ wallpaper: 'video', wallpaperVideoPath: result.path, wallpaperVideoName: result.name, wallpaperImageData: '' }); }}>Escolher vídeo</button>
        {s.wallpaperVideoPath && <button className="sc-button sc-button-subtle" onClick={() => onSettings({ wallpaper: 'orbital', wallpaperVideoPath: '', wallpaperVideoName: '' })}>Remover vídeo</button>}
        {s.wallpaperImageData && <button className="sc-button sc-button-subtle" onClick={() => onSettings({ wallpaper: 'orbital', wallpaperImageData: '' })}>Remover imagem</button>}
      </div>
      <Row title="Widgets da Home" detail="Arraste, redimensione e personalize direto na página inicial"><button className="sc-button sc-button-primary" onClick={() => navigate('newtab')}>Editar Home <ArrowUpRight size={14}/></button></Row>
    </Panel>

    <Panel id="mods-manage" eyebrow="MODS" title="Mods e temas" detail="Pacotes que trocam tema, papel de parede, sons, música e o visual dos sites." icon={Sparkles}>
      <Row title="Loja de mods" detail={s.activeMod ? 'Há um tema aplicado' : 'Instalados, Explorar, Criar mod e Temas rápidos'}><button className="sc-button sc-button-primary" onClick={() => navigate('mods')}>Abrir Mods <ArrowUpRight size={14}/></button></Row>
      <Row title="Exportar suas preferências" detail="Arquivo para guardar ou compartilhar"><button className="sc-button sc-button-subtle" onClick={() => void command('mod:export')}>Exportar</button></Row>
      <Row title="Importar tema" detail="Aplicar um pacote salvo no computador"><button className="sc-button sc-button-subtle" onClick={() => void command('mod:import')}>Importar</button></Row>
    </Panel>

    <Panel id="appearance-sounds" eyebrow="ATMOSFERA" title="Sons e música" icon={Volume2}>
      <Row title="Sons dos controles" detail="Tons sintetizados ao acionar botões"><Switch label="Sons dos controles" checked={s.soundEffectsEnabled} onChange={() => onSettings({ soundEffectsEnabled: !s.soundEffectsEnabled })}/></Row>
      <Row title="Tema de som"><select className="sc-select" value={s.soundTheme} onChange={event => onSettings({ soundTheme: event.target.value as Settings['soundTheme'] })}><option value="cypher">Sinal</option><option value="soft">Suave</option><option value="arcade">Arcade</option></select></Row>
      <Row title="Música de fundo" detail={s.backgroundMusicName || 'Pode ser incluída ao exportar um tema'}><div className="sc-control-stack"><button className="sc-button sc-button-subtle" onClick={async () => { const result = await command('appearance:music:select'); if (result?.dataUrl) onSettings({ backgroundMusicData: result.dataUrl, backgroundMusicName: result.name, backgroundMusicEnabled: false }); }}>Escolher áudio</button>{s.backgroundMusicData && <button className="sc-button sc-button-subtle" onClick={() => onSettings({ backgroundMusicData: '', backgroundMusicName: '', backgroundMusicEnabled: false })}>Remover</button>}</div></Row>
      <div className="sc-info-strip"><ShieldCheck size={15}/><span>Imagens e músicas ficam no perfil local.</span></div>
    </Panel>

    <SkinsPanel settings={s} skins={skins} command={command} onSettings={onSettings}/>
    <CustomCssPanel settings={s} onSettings={onSettings}/>
  </>;
}
