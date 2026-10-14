import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  Accessibility, ArrowRight, ArrowUpRight, Check, ChevronRight, CircleHelp, Clock3,
  Download, ExternalLink, FolderOpen, Globe2, House, Keyboard, LayoutPanelLeft,
  LayoutTemplate, LockKeyhole, MonitorCog, Palette, PanelLeft, PanelTop, RefreshCw,
  Puzzle, Search, Settings2, ShieldCheck, Sparkles, UserRound, WandSparkles,
} from 'lucide-react';
import type { Settings, UpdateStatus } from './types';
import ConnectionSettings from './ConnectionSettings';
import WindowsVpnSettings from './WindowsVpnSettings';

type Category = 'appearance' | 'tabs' | 'home' | 'search' | 'privacy' | 'connections' | 'downloads' | 'accessibility' | 'system' | 'updates' | 'shortcuts' | 'mods' | 'profile';
type Props = {
  settings: Settings;
  update: UpdateStatus;
  onSettings: (patch: Partial<Settings>) => void;
  command: (action: string, payload?: unknown) => Promise<any>;
  navigate: (page: string) => void;
};

const categories: { id: Category; label: string; group: string; icon: typeof Palette }[] = [
  { id: 'appearance', label: 'Aparência', group: 'PERSONALIZAÇÃO', icon: Palette },
  { id: 'tabs', label: 'Abas e navegação', group: 'PERSONALIZAÇÃO', icon: LayoutPanelLeft },
  { id: 'home', label: 'Página inicial', group: 'PERSONALIZAÇÃO', icon: House },
  { id: 'search', label: 'Pesquisa', group: 'NAVEGAÇÃO', icon: Search },
  { id: 'connections', label: 'Conexões e VPN', group: 'NAVEGAÇÃO', icon: Globe2 },
  { id: 'downloads', label: 'Downloads', group: 'NAVEGAÇÃO', icon: Download },
  { id: 'privacy', label: 'Privacidade e segurança', group: 'PROTEÇÃO', icon: ShieldCheck },
  { id: 'accessibility', label: 'Acessibilidade', group: 'PROTEÇÃO', icon: Accessibility },
  { id: 'system', label: 'Sistema', group: 'SISTEMA', icon: MonitorCog },
  { id: 'updates', label: 'Atualização', group: 'SISTEMA', icon: RefreshCw },
  { id: 'shortcuts', label: 'Atalhos', group: 'SISTEMA', icon: Keyboard },
  { id: 'mods', label: 'Mods', group: 'SISTEMA', icon: Puzzle },
  { id: 'profile', label: 'Perfil', group: 'SISTEMA', icon: UserRound },
];

const preferenceIndex: { id: string; title: string; detail: string; category: Category }[] = [
  { id: 'appearance-presets', title: 'Temas e cores', detail: 'Tema, destaque, superfícies e fundo do navegador', category: 'appearance' },
  { id: 'appearance-shape', title: 'Cantos e tipografia', detail: 'Arredondamento, fonte e identidade visual', category: 'appearance' },
  { id: 'appearance-wallpaper', title: 'Papel de parede', detail: 'Fundo da página inicial orbital, grade ou minimal', category: 'appearance' },
  { id: 'appearance-motion', title: 'Animações', detail: 'Movimento e transições da interface', category: 'appearance' },
  { id: 'tabs-position', title: 'Posição das abas', detail: 'Abas laterais ou verticais no topo', category: 'tabs' },
  { id: 'tabs-width', title: 'Largura das abas', detail: 'Barra lateral compacta ou largura personalizada', category: 'tabs' },
  { id: 'tabs-behavior', title: 'Comportamento das abas', detail: 'Restaurar sessão, abrir links e confirmar o fechamento', category: 'tabs' },
  { id: 'tabs-bookmark-bar', title: 'Barra de favoritos', detail: 'Exibir atalhos para seus sites favoritos sob a barra de endereço', category: 'tabs' },
  { id: 'home-editor', title: 'Widgets da página inicial', detail: 'Editar, mover, redimensionar e personalizar widgets', category: 'home' },
  { id: 'search-engine', title: 'Mecanismo de pesquisa', detail: 'DuckDuckGo, Google, Bing ou um mecanismo personalizado', category: 'search' },
  { id: 'search-custom-url', title: 'URL de pesquisa personalizada', detail: 'Configure uma URL HTTPS que contenha {query}', category: 'search' },
  { id: 'search-suggestions', title: 'Sugestões de pesquisa', detail: 'Controle sugestões e escolha entre histórico e favoritos', category: 'search' },
  { id: 'connection-routes', title: 'Rotas de conexão', detail: 'Conexão normal, Tor, I2P e portas locais', category: 'connections' },
  { id: 'connection-vpn', title: 'VPN nativa do Windows', detail: 'Perfis de VPN do sistema operacional', category: 'connections' },
  { id: 'download-location', title: 'Local dos downloads', detail: 'Pasta padrão ou perguntar onde salvar arquivos', category: 'downloads' },
  { id: 'privacy-do-not-track', title: 'Não rastrear', detail: 'Enviar o cabeçalho Do Not Track aos sites', category: 'privacy' },
  { id: 'privacy-data', title: 'Dados de navegação', detail: 'Limpar cookies, cache e histórico', category: 'privacy' },
  { id: 'privacy-clear-exit', title: 'Limpeza ao sair', detail: 'Apagar dados dos sites ou histórico ao fechar o Cypher', category: 'privacy' },
  { id: 'privacy-private', title: 'Navegação privada', detail: 'Abrir abas que não entram no histórico', category: 'privacy' },
  { id: 'accessibility-zoom', title: 'Zoom padrão das páginas', detail: 'Aumentar ou reduzir a escala inicial dos sites', category: 'accessibility' },
  { id: 'system-startup', title: 'Iniciar com o Windows', detail: 'Abrir o Cypher ao entrar no computador', category: 'system' },
  { id: 'updates-status', title: 'Atualização do Cypher', detail: 'Verificar versões, acompanhar o canal e instalar atualizações', category: 'updates' },
  { id: 'system-close-confirm', title: 'Confirmar fechamento de abas', detail: 'Pedir confirmação ao fechar uma janela com várias abas abertas', category: 'system' },
  { id: 'shortcuts-list', title: 'Atalhos de teclado', detail: 'Comandos e teclas rápidas do navegador', category: 'shortcuts' },
  { id: 'mods-manage', title: 'Mods e temas', detail: 'Explorar, importar e exportar personalizações', category: 'mods' },
  { id: 'profile-local', title: 'Perfil local', detail: 'Foto e dados salvos neste dispositivo', category: 'profile' },
];

function Switch({ checked, label, onChange }: { checked: boolean; label: string; onChange: () => void }) {
  return <button type="button" className={`sc-switch ${checked ? 'is-on' : ''}`} role="switch" aria-checked={checked} aria-label={label} onClick={onChange}><span /></button>;
}

function Row({ id, title, detail, children }: { id?: string; title: string; detail?: string; children: ReactNode }) {
  return <div id={id} className="sc-row"><div className="sc-row-copy"><strong>{title}</strong>{detail && <small>{detail}</small>}</div><div className="sc-row-control">{children}</div></div>;
}

function Panel({ id, eyebrow, title, detail, icon: Icon, children }: { id?: string; eyebrow?: string; title: string; detail?: string; icon: typeof Palette; children: ReactNode }) {
  return <section id={id} className="sc-panel"><div className="sc-panel-heading"><span className="sc-panel-icon"><Icon size={17} /></span><div><span className="sc-eyebrow">{eyebrow || 'PREFERÊNCIA'}</span><h2>{title}</h2>{detail && <p>{detail}</p>}</div></div><div className="sc-panel-content">{children}</div></section>;
}

const themePresets = [
  { id: 'cypher', name: 'Cypher', accent: '#b6f36a', surface: '#111513', background: '#090c0b' },
  { id: 'ultraviolet', name: 'Ultravioleta', accent: '#b5a0ff', surface: '#15121d', background: '#0b0910' },
  { id: 'arctic', name: 'Sinal ártico', accent: '#78d9ee', surface: '#10191e', background: '#080e12' },
  { id: 'ember', name: 'Ember', accent: '#ff9b6a', surface: '#1b1412', background: '#100b09' },
];

export default function SettingsCenter({ settings: s, update, onSettings, command, navigate }: Props) {
  const [category, setCategory] = useState<Category>('appearance');
  const [query, setQuery] = useState('');
  const [customSearchDraft, setCustomSearchDraft] = useState(s.customSearchUrl);
  const searchRef = useRef<HTMLInputElement>(null);
  const groups = [...new Set(categories.map(item => item.group))];
  const matches = useMemo(() => {
    const value = query.trim().toLocaleLowerCase('pt-BR');
    if (!value) return [];
    return preferenceIndex.filter(item => `${item.title} ${item.detail} ${categories.find(entry => entry.id === item.category)?.label}`.toLocaleLowerCase('pt-BR').includes(value));
  }, [query]);
  const customSearchReady = customSearchDraft.includes('{query}') && (() => { try { return new URL(customSearchDraft.replace('{query}', 'cypher-query')).protocol === 'https:'; } catch { return false; } })();
  const activeCategory = categories.find(item => item.id === category)!;
  useEffect(() => setCustomSearchDraft(s.customSearchUrl), [s.customSearchUrl]);
  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, []);
  const openMatch = (id: string, targetCategory: Category) => {
    setCategory(targetCategory);
    setQuery('');
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
  };
  const chooseTheme = (theme: typeof themePresets[number]) => onSettings({ accent: theme.accent, surface: theme.surface, background: theme.background });

  return <div className="settings-center">
    <header className="sc-header">
      <div><span className="sc-eyebrow"><Settings2 size={12}/> CYPHER / CENTRAL DE CONTROLE</span><h1>Configurações</h1><p>Ajuste o navegador ao seu ritmo, do visual à forma de navegar.</p></div>
      <div className="sc-header-mark"><WandSparkles size={18}/><span>Seu espaço,<br/><strong>suas regras.</strong></span></div>
    </header>

    <label className="sc-search"><Search size={17}/><input ref={searchRef} aria-label="Buscar nas configurações" placeholder="Buscar nas configurações…" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setQuery(''); if (event.key === 'Enter' && matches[0]) { event.preventDefault(); openMatch(matches[0].id, matches[0].category); } }}/>{query ? <button type="button" onClick={() => setQuery('')} aria-label="Limpar busca">Esc</button> : <kbd>Ctrl K</kbd>}</label>

    <div className="sc-layout">
      <aside className="sc-nav" aria-label="Categorias de configurações">
        {groups.map(group => <div className="sc-nav-group" key={group}><span className="sc-eyebrow">{group}</span>{categories.filter(item => item.group === group).map(item => {
          const Icon = item.icon;
          return <button type="button" key={item.id} className={`sc-nav-item ${category === item.id && !query ? 'selected' : ''}`} aria-current={category === item.id && !query ? 'page' : undefined} onClick={() => { setCategory(item.id); setQuery(''); }}><Icon size={15}/><span>{item.label}</span>{category === item.id && !query && <ChevronRight size={14}/>}</button>;
        })}</div>)}
        <div className="sc-nav-footer"><span className="sc-status-dot"/><span>Preferências salvas neste dispositivo</span></div>
      </aside>

      <main className="sc-content" key={query ? 'search-results' : category}>
        {query.trim() ? <>
          <div className="sc-section-heading"><div><span className="sc-eyebrow">BUSCA NAS PREFERÊNCIAS</span><h2>Resultados</h2><p>{matches.length ? `${matches.length} opção${matches.length === 1 ? '' : 'ões'} encontrada${matches.length === 1 ? '' : 's'} para “${query.trim()}”.` : `Nenhuma opção encontrada para “${query.trim()}”.`}</p></div></div>
          {matches.length ? <div className="sc-result-list">{matches.map(item => {
            const Icon = categories.find(entry => entry.id === item.category)!.icon;
            return <button type="button" className="sc-result" key={item.id} onClick={() => openMatch(item.id, item.category)}><span className="sc-result-icon"><Icon size={16}/></span><span><strong>{item.title}</strong><small>{item.detail}</small></span><span className="sc-result-category">{categories.find(entry => entry.id === item.category)?.label}</span><ArrowRight size={15}/></button>;
          })}</div> : <div className="sc-no-results"><CircleHelp size={20}/><span>Tente buscar por aparência, abas, pesquisa, VPN ou acessibilidade.</span></div>}
        </> : <>
          <div className="sc-section-heading"><div><span className="sc-eyebrow">{activeCategory.group}</span><h2>{activeCategory.label}</h2><p>{category === 'appearance' ? 'Uma identidade visual que muda junto com você.' : category === 'tabs' ? 'Organize suas abas do jeito que combina com seu fluxo.' : category === 'home' ? 'Monte uma página inicial que tenha a sua cara.' : category === 'search' ? 'Escolha como encontrar o que procura.' : category === 'connections' ? 'Gerencie rotas, serviços locais e a VPN do Windows.' : category === 'downloads' ? 'Escolha onde seus arquivos ficam e acompanhe o progresso.' : category === 'privacy' ? 'Controles claros para seus dados e sua navegação.' : category === 'accessibility' ? 'Ajustes para ler e navegar com conforto.' : category === 'system' ? 'Preferências do aplicativo e integração com o computador.' : category === 'updates' ? 'Confira a versão, acompanhe o canal e instale atualizações do Cypher.' : category === 'shortcuts' ? 'Ações rápidas para navegar sem tirar as mãos do teclado.' : category === 'mods' ? 'Instale ou compartilhe um visual feito por você.' : 'Sua identidade e suas preferências locais.'}</p></div><span className="sc-category-count">{preferenceIndex.filter(item => item.category === category).length.toString().padStart(2, '0')} AJUSTES</span></div>

          {category === 'appearance' && <>
            <Panel id="appearance-presets" eyebrow="IDENTIDADE VISUAL" title="Temas" detail="Comece por uma combinação de cores e depois ajuste cada detalhe." icon={Sparkles}>
              <div className="sc-theme-grid">{themePresets.map(theme => <button type="button" key={theme.id} className={`sc-theme ${s.accent.toLowerCase() === theme.accent ? 'chosen' : ''}`} onClick={() => chooseTheme(theme)} aria-pressed={s.accent.toLowerCase() === theme.accent}>
                <span className="sc-theme-preview" style={{ '--theme-accent': theme.accent, '--theme-surface': theme.surface, '--theme-base': theme.background } as CSSProperties}><i/><i/><i/><b/></span><span className="sc-theme-meta"><strong>{theme.name}</strong>{s.accent.toLowerCase() === theme.accent && <Check size={14}/>}</span><small><i style={{ background: theme.accent }}/><i style={{ background: theme.surface }}/><i style={{ background: theme.background }}/></small>
              </button>)}</div>
            </Panel>
            <Panel id="appearance-shape" eyebrow="DETALHES DA INTERFACE" title="Ajuste o acabamento" detail="Cores, formas e tipografia da moldura do navegador." icon={Palette}>
              <div className="sc-color-grid">{[{ key: 'accent', label: 'Cor de destaque' }, { key: 'surface', label: 'Superfícies' }, { key: 'background', label: 'Fundo' }].map(({ key, label }) => <label className="sc-color-choice" key={key}><span className="sc-color-swatch"><input type="color" aria-label={label} value={s[key as 'accent']} onChange={event => onSettings({ [key]: event.target.value })}/></span><span><strong>{label}</strong><small>{s[key as 'accent'].toUpperCase()}</small></span></label>)}</div>
              <Row id="appearance-radius" title="Cantos da interface" detail={`${s.radius} px · Ajusta painéis, botões e cartões`}><input className="sc-range" aria-label="Arredondamento dos cantos" type="range" min="0" max="24" value={s.radius} onChange={event => onSettings({ radius: +event.target.value })}/><span className="sc-value">{s.radius}px</span></Row>
              <Row id="appearance-font" title="Tipografia" detail="A fonte é aplicada à interface do Cypher"><select className="sc-select" value={s.font} onChange={event => onSettings({ font: event.target.value as Settings['font'] })}><option value="system">Sistema</option><option value="mono">Monoespaçada</option></select></Row>
              <Row id="appearance-wallpaper" title="Fundo da página inicial" detail="Escolha a atmosfera da Home"><select className="sc-select" value={s.wallpaper} onChange={event => onSettings({ wallpaper: event.target.value as Settings['wallpaper'] })}><option value="orbital">Orbital</option><option value="grid">Grade</option><option value="none">Minimal</option></select></Row>
              <Row id="appearance-motion" title="Animações da interface" detail="Transições suaves e movimento entre telas"><Switch label="Animações da interface" checked={s.motion} onChange={() => onSettings({ motion: !s.motion })}/></Row>
            </Panel>
          </>}

          {category === 'tabs' && <Panel id="tabs-position" eyebrow="ESPAÇO DE NAVEGAÇÃO" title="Abas e navegação" detail="Mude a disposição e o comportamento das suas abas." icon={LayoutPanelLeft}>
            <div className="sc-choice-grid">
              <button type="button" className={`sc-choice-card ${s.tabPosition === 'side' ? 'chosen' : ''}`} aria-pressed={s.tabPosition === 'side'} onClick={() => onSettings({ tabPosition: 'side' })}><span className="sc-choice-icon"><PanelLeft size={18}/></span><span><strong>Abas laterais</strong><small>Lista vertical à esquerda da página</small></span>{s.tabPosition === 'side' && <Check size={15}/>}</button>
              <button type="button" className={`sc-choice-card ${s.tabPosition === 'top' ? 'chosen' : ''}`} aria-pressed={s.tabPosition === 'top'} onClick={() => onSettings({ tabPosition: 'top' })}><span className="sc-choice-icon"><PanelTop size={18}/></span><span><strong>Abas no topo</strong><small>Faixa horizontal acima da página</small></span>{s.tabPosition === 'top' && <Check size={15}/>}</button>
            </div>
            <Row id="tabs-width" title="Barra de abas compacta" detail="Recolha a lateral e mantenha apenas os ícones"><Switch label="Barra de abas compacta" checked={s.compact} onChange={() => onSettings({ compact: !s.compact })}/></Row>
            {s.tabPosition === 'side' && <Row id="tabs-width-slider" title="Largura da barra lateral" detail={`${s.sidebarWidth} px`}><input className="sc-range" aria-label="Largura da barra lateral" type="range" min="210" max="360" value={s.sidebarWidth} onChange={event => onSettings({ sidebarWidth: +event.target.value })}/><span className="sc-value">{s.sidebarWidth}px</span></Row>}
            <Row id="tabs-behavior" title="Restaurar sessão anterior" detail="Reabra as abas normais ao iniciar o Cypher"><Switch label="Restaurar sessão anterior" checked={s.restoreSession} onChange={() => onSettings({ restoreSession: !s.restoreSession })}/></Row>
            <Row id="tabs-links" title="Abrir links em nova aba" detail="Links que abrem janelas serão enviados para uma nova aba"><Switch label="Abrir links em nova aba" checked={s.openLinksInNewTab} onChange={() => onSettings({ openLinksInNewTab: !s.openLinksInNewTab })}/></Row>
            <Row id="tabs-bookmark-bar" title="Mostrar barra de favoritos" detail="Exibe os primeiros favoritos logo abaixo da barra de endereço"><Switch label="Mostrar barra de favoritos" checked={s.showBookmarksBar} onChange={() => onSettings({ showBookmarksBar: !s.showBookmarksBar })}/></Row>
          </Panel>}

          {category === 'home' && <Panel id="home-editor" eyebrow="PÁGINA INICIAL" title="Uma tela feita por você" detail="Adicione widgets, arraste para organizar e abra as opções de cada um para personalizar o conteúdo e o design." icon={LayoutTemplate}>
            <div className="sc-home-card"><span className="sc-home-mark"><House size={22}/></span><div><strong>Editor livre da Home</strong><p>Redimensione widgets puxando as bordas, reposicione-os e personalize estilos, cores, imagens e conteúdo. A Home também aceita stickers, imagens e widgets com código próprio.</p><button className="sc-button sc-button-primary" onClick={() => navigate('newtab')}>Abrir página inicial <ArrowUpRight size={15}/></button></div></div>
            <Row id="home-wallpaper-link" title="Papel de parede atual" detail={`Estilo ${s.wallpaper === 'none' ? 'minimal' : s.wallpaper === 'grid' ? 'grade' : 'orbital'}`}><button className="sc-button sc-button-subtle" onClick={() => setCategory('appearance')}>Personalizar visual <ChevronRight size={14}/></button></Row>
          </Panel>}

          {category === 'search' && <Panel id="search-panel" eyebrow="BUSCA E ENDEREÇOS" title="Pesquisa" detail="Defina o mecanismo usado na Home e na barra de endereço." icon={Search}>
            <Row id="search-engine" title="Mecanismo padrão" detail="Usado quando você digita termos para pesquisar"><select className="sc-select" value={s.searchEngine} onChange={event => onSettings({ searchEngine: event.target.value as Settings['searchEngine'] })}><option value="duckduckgo">DuckDuckGo</option><option value="google">Google</option><option value="bing">Bing</option><option value="custom">Personalizado</option></select></Row>
            <Row id="search-custom-url" title="URL de pesquisa personalizada" detail={s.searchEngine === 'custom' && !customSearchReady ? 'Informe uma URL HTTPS com {query}; até lá, as pesquisas usam o DuckDuckGo.' : 'Use HTTPS e mantenha {query} no lugar do termo pesquisado'}><input className="sc-text-input" aria-label="URL de pesquisa personalizada" value={customSearchDraft} placeholder="https://example.com/search?q={query}" onChange={event => setCustomSearchDraft(event.target.value)} onBlur={() => onSettings({ customSearchUrl: customSearchDraft })}/></Row>
            <Row id="search-suggestions" title="Sugestões na barra de endereço" detail="Ative ou desative sugestões enquanto digita"><Switch label="Sugestões na barra de endereço" checked={s.showSearchSuggestions} onChange={() => onSettings({ showSearchSuggestions: !s.showSearchSuggestions })}/></Row>
            {s.showSearchSuggestions && <>
              <Row id="search-suggest-history" title="Incluir histórico" detail="Encontrar páginas que você visitou anteriormente"><Switch label="Incluir histórico nas sugestões" checked={s.suggestHistory} onChange={() => onSettings({ suggestHistory: !s.suggestHistory })}/></Row>
              <Row id="search-suggest-bookmarks" title="Incluir favoritos" detail="Encontrar páginas salvas nos seus favoritos"><Switch label="Incluir favoritos nas sugestões" checked={s.suggestBookmarks} onChange={() => onSettings({ suggestBookmarks: !s.suggestBookmarks })}/></Row>
            </>}
            <div className="sc-info-strip"><Search size={16}/><span>Enter pesquisa o texto digitado. Endereços completos abrem o site diretamente.</span></div>
          </Panel>}

          {category === 'connections' && <>
            <div id="connection-routes"><ConnectionSettings settings={s} onSettings={onSettings}/></div>
            <div id="connection-vpn"><WindowsVpnSettings/></div>
          </>}

          {category === 'downloads' && <>
            <Panel id="download-location" eyebrow="ARQUIVOS RECEBIDOS" title="Local dos downloads" detail="Use uma pasta padrão ou escolha onde salvar cada arquivo." icon={Download}>
              <div className="sc-folder-current"><span className="sc-folder-icon"><FolderOpen size={18}/></span><div><strong>{s.downloadDirectory || 'Perguntar onde salvar cada arquivo'}</strong><small>{s.downloadDirectory ? 'Novos downloads são salvos automaticamente nesta pasta.' : 'O Cypher pergunta o local a cada download.'}</small></div></div>
              <div className="sc-action-row"><button className="sc-button sc-button-primary" onClick={() => void command('download:directory:select')}><FolderOpen size={15}/>{s.downloadDirectory ? 'Trocar pasta' : 'Escolher pasta padrão'}</button>{s.downloadDirectory && <button className="sc-button sc-button-subtle" onClick={() => void command('download:directory:clear')}>Perguntar a cada download</button>}<button className="sc-button sc-button-subtle" onClick={() => void command('download:directory:open')}><ExternalLink size={14}/>Abrir pasta</button></div>
            </Panel>
            <Panel eyebrow="ACOMPANHAMENTO" title="Downloads do Cypher" detail="Veja andamento, pause transferências ou encontre os arquivos salvos." icon={FolderOpen}>
              <div className="sc-home-card"><span className="sc-home-mark"><Download size={21}/></span><div><strong>Central de downloads</strong><p>O histórico de downloads fica disponível na barra lateral do navegador.</p><button className="sc-button sc-button-subtle" onClick={() => navigate('downloads')}>Ver downloads <ArrowUpRight size={14}/></button></div></div>
            </Panel>
          </>}

          {category === 'privacy' && <>
            <Panel eyebrow="PRIVACIDADE" title="Controles da sessão" detail="Ajuste o que o navegador informa e gerencie os dados guardados." icon={ShieldCheck}>
              <Row id="privacy-do-not-track" title="Enviar sinal Não rastrear" detail="Inclui o cabeçalho DNT: 1 nas solicitações aos sites. Cada site decide se respeita o sinal."><Switch label="Enviar sinal Não rastrear" checked={s.sendDoNotTrack} onChange={() => onSettings({ sendDoNotTrack: !s.sendDoNotTrack })}/></Row>
              <Row id="privacy-data" title="Cookies e dados dos sites" detail="Limpa cookies e cache; você pode sair das contas abertas"><button className="sc-button sc-button-subtle" onClick={() => void command('data:clear')}>Limpar dados <ArrowRight size={14}/></button></Row>
              <Row id="privacy-history" title="Histórico de navegação" detail="Apague os endereços visitados e mantenha os favoritos"><button className="sc-button sc-button-subtle" onClick={() => void command('history:clear')}>Limpar histórico <Clock3 size={14}/></button></Row>
              <Row id="privacy-private" title="Nova aba privada" detail="A navegação privada não entra no histórico e usa uma sessão temporária"><button className="sc-button sc-button-subtle" onClick={() => void command('tab:new', { private: true })}>Abrir aba privada <LockKeyhole size={14}/></button></Row>
              <Row id="privacy-clear-exit" title="Limpar dados dos sites ao sair" detail="Remove cookies e cache de sessões normal, Tor e I2P ao encerrar o navegador"><Switch label="Limpar dados dos sites ao sair" checked={s.clearDataOnExit} onChange={() => onSettings({ clearDataOnExit: !s.clearDataOnExit })}/></Row>
              <Row id="privacy-history-exit" title="Limpar histórico ao sair" detail="Remove o histórico local quando o Cypher for fechado"><Switch label="Limpar histórico ao sair" checked={s.clearHistoryOnExit} onChange={() => onSettings({ clearHistoryOnExit: !s.clearHistoryOnExit })}/></Row>
            </Panel>
            <div className="sc-privacy-note"><ShieldCheck size={16}/><span>Permissões de câmera, microfone, localização e notificações podem ser lembradas por site. Revise ou remova essas regras em Segurança.</span></div>
          </>}

          {category === 'accessibility' && <Panel id="accessibility-zoom" eyebrow="LEITURA E MOVIMENTO" title="Acessibilidade" detail="Defina um zoom confortável para os sites e reduza movimento na interface." icon={Accessibility}>
            <Row title="Zoom inicial das páginas" detail={`Aplicado quando uma nova página abre · ${Math.round(s.defaultZoom * 100)}%`}><input className="sc-range" aria-label="Zoom inicial das páginas" type="range" min="0.75" max="1.5" step="0.05" value={s.defaultZoom} onChange={event => onSettings({ defaultZoom: +event.target.value })}/><span className="sc-value">{Math.round(s.defaultZoom * 100)}%</span></Row>
            <Row id="accessibility-motion" title="Reduzir animações" detail="Desativa movimentos e transições da interface"><Switch label="Reduzir animações" checked={!s.motion} onChange={() => onSettings({ motion: !s.motion })}/></Row>
            <div className="sc-info-strip"><Accessibility size={16}/><span>O zoom também pode ser ajustado por aba no menu do Cypher.</span></div>
          </Panel>}

          {category === 'system' && <Panel id="system-startup" eyebrow="CYPHER NO COMPUTADOR" title="Sistema" detail="Controle como o aplicativo se integra ao Windows." icon={MonitorCog}>
            <Row title="Iniciar com o Windows" detail="Abre o Cypher quando você entrar no computador"><Switch label="Iniciar com o Windows" checked={s.startWithWindows} onChange={() => onSettings({ startWithWindows: !s.startWithWindows })}/></Row>
            <Row id="system-close-confirm" title="Confirmar ao fechar várias abas" detail="Evita fechar a janela sem querer quando duas ou mais abas estão abertas"><Switch label="Confirmar ao fechar várias abas" checked={s.confirmCloseWithMultipleTabs} onChange={() => onSettings({ confirmCloseWithMultipleTabs: !s.confirmCloseWithMultipleTabs })}/></Row>
            <Row title="Restaurar sessão" detail={s.restoreSession ? 'A sessão anterior será aberta junto ao navegador.' : 'Uma nova aba será aberta a cada início.'}><button className="sc-button sc-button-subtle" onClick={() => setCategory('tabs')}>Ajustar preferência <ChevronRight size={14}/></button></Row>
            <Row title="Conexões protegidas" detail="Tor, I2P e VPN nativa podem ser configurados na área de conexão"><button className="sc-button sc-button-subtle" onClick={() => setCategory('connections')}>Abrir conexões <ChevronRight size={14}/></button></Row>
          </Panel>}

          {category === 'updates' && <>
            <Panel id="updates-status" eyebrow="CYPHER / UPDATE CENTER" title="Atualizações do navegador" detail="Veja sua versão, confira novidades e escolha quando instalar uma atualização." icon={RefreshCw}>
              <div className="sc-update-summary sc-update-summary-large"><span className={`sc-update-indicator ${update.state === 'up-to-date' ? 'ready' : ['available','dismissed'].includes(update.state) ? 'available' : ''}`}><Sparkles size={17}/></span><div><strong>Cypher <span>{update.currentVersion}</span></strong><small>{update.message || (update.repository ? 'O canal de atualizações está configurado.' : 'Canal de atualizações ainda não configurado.')}</small>{update.version && ['available','dismissed','downloading','restarting','complete'].includes(update.state) && <small className="sc-update-new">{update.state === 'complete' ? `Versão instalada: ${update.version}` : `Nova versão: ${update.version}`}</small>}</div><button className="sc-button sc-button-primary" disabled={['checking','downloading','restarting'].includes(update.state)} onClick={() => void command(['available','dismissed'].includes(update.state) ? 'update:install' : 'update:check')}>{['available','dismissed'].includes(update.state) ? 'Instalar agora' : update.state === 'checking' ? 'Verificando…' : update.state === 'downloading' ? `${update.progress}%` : update.state === 'restarting' ? 'Reiniciando…' : update.state === 'error' ? 'Tentar novamente' : 'Verificar atualizações'} <ArrowRight size={14}/></button></div>
              {update.state === 'downloading' && <div className="sc-update-progress"><span><i style={{ width: `${update.progress}%` }}/></span><small>{update.progress}% · Baixando e verificando o pacote</small></div>}
              {update.releaseNotes && ['available','dismissed'].includes(update.state) && <div className="sc-release-notes"><span className="sc-eyebrow">NOVIDADES DA VERSÃO {update.version}</span><p>{update.releaseNotes}</p></div>}
              {update.state === 'unconfigured' && <div className="sc-info-strip"><Globe2 size={16}/><span>O canal será conectado às Releases públicas do GitHub. O GitHub fornece os links HTTPS; não é necessário manter um servidor separado.</span></div>}
            </Panel>
            <Panel eyebrow="CANAL DE LANÇAMENTO" title="Origem das atualizações" detail="O Cypher consulta o manifesto oficial do repositório para encontrar novas versões." icon={Globe2}>
              <Row title="Canal ativo" detail={update.repository || 'Nenhum repositório de Releases foi configurado nesta compilação.'}><span className={`sc-channel-badge ${update.repository ? 'is-active' : ''}`}><i/>{update.repository ? 'GitHub Releases' : 'Não configurado'}</span></Row>
              <Row title="Verificação automática" detail="O Cypher verifica atualizações ao iniciar e depois a cada 6 horas"><span className="sc-channel-badge is-active"><Clock3 size={13}/> Automática</span></Row>
              <div className="sc-info-strip"><ShieldCheck size={16}/><span>Antes de instalar, o Cypher valida o pacote com SHA-512. A instalação pede reinício e reabre o navegador ao terminar.</span></div>
            </Panel>
          </>}

          {category === 'shortcuts' && <Panel id="shortcuts-list" eyebrow="TECLADO" title="Atalhos essenciais" detail="Os comandos padrão do Cypher para ações frequentes." icon={Keyboard}>
            {[["Nova aba", 'Ctrl + T'], ['Nova aba privada', 'Ctrl + Shift + N'], ['Reabrir aba fechada', 'Ctrl + Shift + T'], ['Barra de endereço', 'Ctrl + L'], ['Localizar na página', 'Ctrl + F'], ['Alternar abas', 'Ctrl + Tab'], ['Favoritar página', 'Ctrl + D'], ['Histórico', 'Ctrl + H'], ['Downloads', 'Ctrl + J'], ['Ferramentas de desenvolvedor', 'F12']].map(([label, shortcut]) => <Row key={shortcut} title={label}><kbd className="sc-keycap">{shortcut}</kbd></Row>)}
          </Panel>}

          {category === 'mods' && <Panel id="mods-manage" eyebrow="APARÊNCIA DA COMUNIDADE" title="Mods" detail="Troque a paleta do Cypher ou compartilhe sua própria combinação." icon={Puzzle}>
            <div className="sc-home-card"><span className="sc-home-mark"><Sparkles size={21}/></span><div><strong>Uma coleção para começar</strong><p>Escolha temas prontos, personalize tudo e salve a sua versão como um mod compartilhável.</p><button className="sc-button sc-button-primary" onClick={() => navigate('mods')}>Explorar mods <ArrowUpRight size={14}/></button></div></div>
            <Row title="Exportar suas preferências" detail="Crie um arquivo de mod para guardar ou compartilhar"><button className="sc-button sc-button-subtle" onClick={() => void command('mod:export')}>Exportar meu mod <ArrowUpRight size={14}/></button></Row>
            <Row title="Importar um mod" detail="Aplicar um pacote de personalização salvo no computador"><button className="sc-button sc-button-subtle" onClick={() => void command('mod:import')}>Importar arquivo <ArrowRight size={14}/></button></Row>
          </Panel>}

          {category === 'profile' && <Panel id="profile-local" eyebrow="PERFIL LOCAL" title="Seu Cypher" detail="Seus dados e personalizações ficam neste dispositivo." icon={UserRound}>
            <div className="sc-home-card"><span className="sc-home-mark sc-avatar-mark">{s.profilePhoto ? <img src={s.profilePhoto} alt=""/> : <UserRound size={22}/>}</span><div><strong>Perfil deste dispositivo</strong><p>Favoritos, histórico, abas e preferências são armazenados localmente.</p><button className="sc-button sc-button-primary" onClick={() => navigate('profile')}>Gerenciar perfil <ArrowUpRight size={14}/></button></div></div>
          </Panel>}
        </>}
      </main>
    </div>
  </div>;
}
