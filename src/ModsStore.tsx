import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Brush, Check, Download, GitPullRequest, Users, FileAudio, Image as ImageIcon, Layers, Music2, Package, Palette, Plus, RefreshCw, Sparkles, Trash2, Type, Upload, Volume2, Wand2 } from 'lucide-react';
import type { CatalogMod, ModComponent, ModPackageInfo, Settings } from './types';
import { Switch } from './settings-ui';

type Command = (action: string, payload?: unknown) => Promise<any>;
type Tab = 'installed' | 'explore' | 'create' | 'themes';
export const componentInfo: Record<ModComponent, { label: string; icon: typeof Palette }> = {
  theme: { label: 'Tema', icon: Palette }, wallpaper: { label: 'Papel de parede', icon: ImageIcon }, sounds: { label: 'Sons', icon: Volume2 }, music: { label: 'Música', icon: Music2 },
  pageStyles: { label: 'Estilos de página', icon: Brush }, shader: { label: 'Filtro de página', icon: Wand2 }, fonts: { label: 'Fontes', icon: Type }, interfaceCss: { label: 'CSS da interface', icon: Layers },
};
const shaderLabels: Record<string, string> = { none: 'Nenhum', crt: 'CRT', sepia: 'Sépia', neon: 'Neon', noir: 'Noir', warm: 'Quente', cool: 'Frio', vignette: 'Vinheta', dream: 'Sonho' };
const soundLabels: Record<string, string> = { click: 'Clique', hover: 'Passar o mouse', tabOpen: 'Abrir aba', tabClose: 'Fechar aba', typing: 'Digitação', navigate: 'Navegar' };
const slug = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'mod';

function Preview({ src, name }: { src: string; name: string }) {
  return <div className="ms-preview">{src ? <img src={src} alt="" loading="lazy"/> : <span>{name.slice(0, 1).toUpperCase()}</span>}</div>;
}

export default function ModsStore({ settings: s, packages, command, onSettings, notify, themes }: { settings: Settings; packages: ModPackageInfo[]; command: Command; onSettings: (patch: Partial<Settings>) => void; notify: (message: string) => void; themes: ReactNode }) {
  const [tab, setTab] = useState<Tab>(packages.length ? 'installed' : 'explore');
  const [catalog, setCatalog] = useState<{ mods: CatalogMod[]; remote: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState('');
  const [origin, setOrigin] = useState<'all' | 'cypher' | 'community'>('all');
  const installedIds = useMemo(() => new Set(packages.map(item => item.id)), [packages]);
  const loadCatalog = () => { setCatalog(null); void command('modpkg:catalog').then(result => setCatalog(result || { mods: [], remote: false, message: 'Não foi possível abrir o catálogo.' })); };
  useEffect(() => { if (tab === 'explore' && !catalog) loadCatalog(); }, [tab]);
  async function run(id: string, action: () => Promise<unknown>, success?: string) { setBusy(id); try { const result = await action(); if (success && result !== null && result !== undefined) notify(success); } finally { setBusy(''); } }
  const ordered = [...packages].reverse();
  return <div className="mods-store">
    <div className="ms-toolbar">
      <div className="ms-tabs" role="tablist" aria-label="Seções de mods">
        {([['installed', `Instalados${packages.length ? ` · ${packages.length}` : ''}`], ['explore', 'Explorar'], ['create', 'Criar mod'], ['themes', 'Temas rápidos']] as const).map(([value, label]) => <button type="button" role="tab" key={value} aria-selected={tab === value} className={tab === value ? 'chosen' : ''} onClick={() => setTab(value)}>{label}</button>)}
      </div>
      <button type="button" className="button secondary" onClick={() => void run('import', () => command('modpkg:import'), 'Mod instalado e ativado.')}><Upload size={15}/> Importar .cyphermod</button>
    </div>

    <div className="ms-mixer" aria-label="Ajustes gerais dos mods">
      <div className="ms-mixer-item"><span><Volume2 size={15}/> Sons</span><Switch checked={s.modSoundsEnabled} label="Sons dos mods" onChange={() => onSettings({ modSoundsEnabled: !s.modSoundsEnabled })}/><input type="range" min={0} max={1} step={0.05} value={s.modSoundsVolume} aria-label="Volume dos sons" disabled={!s.modSoundsEnabled} onChange={event => onSettings({ modSoundsVolume: Number(event.target.value) })}/></div>
      <div className="ms-mixer-item"><span><Music2 size={15}/> Música</span><Switch checked={s.modMusicEnabled} label="Música dos mods" onChange={() => onSettings({ modMusicEnabled: !s.modMusicEnabled })}/><input type="range" min={0} max={1} step={0.05} value={s.modMusicVolume} aria-label="Volume da música" disabled={!s.modMusicEnabled} onChange={event => onSettings({ modMusicVolume: Number(event.target.value) })}/></div>
      <div className="ms-mixer-item"><span><Wand2 size={15}/> Efeitos nas páginas</span><Switch checked={s.modPageEffects} label="Estilos e filtros nas páginas" onChange={() => onSettings({ modPageEffects: !s.modPageEffects })}/></div>
    </div>

    {tab === 'installed' && (ordered.length ? <div className="ms-installed">{ordered.map((item, index) => <article key={item.id} className={`ms-card ${item.enabled ? 'enabled' : ''}`}>
      <Preview src={item.preview} name={item.name}/>
      <div className="ms-card-body">
        <header><div><span className="eyebrow">{item.source === 'builtin' ? 'EMBUTIDO' : item.source === 'catalog' ? 'CATÁLOGO' : 'ARQUIVO'} · v{item.version} · {item.author.toUpperCase()}</span><h2>{item.name}</h2></div><Switch checked={item.enabled} label={item.enabled ? `Desativar ${item.name}` : `Ativar ${item.name}`} onChange={() => void command('modpkg:toggle', { id: item.id, enabled: !item.enabled })}/></header>
        <p>{item.description}</p>
        <div className="ms-components">{item.components.map(component => { const Icon = componentInfo[component].icon; const on = item.toggles[component]; return <button type="button" key={component} className={`ms-chip ${on ? 'on' : ''}`} aria-pressed={on} title={on ? 'Clique para desligar este componente' : 'Clique para ligar este componente'} onClick={() => void command('modpkg:component', { id: item.id, component, enabled: !on })}><Icon size={13}/>{component === 'shader' && item.shader ? `Filtro ${shaderLabels[item.shader] || item.shader}` : componentInfo[component].label}</button>; })}</div>
        <footer>
          <span className="ms-priority">{index === 0 ? 'Prioridade máxima' : `Prioridade ${index + 1}`}</span>
          <button type="button" className="cz-icon" aria-label={`Aumentar prioridade de ${item.name}`} disabled={index === 0} onClick={() => void command('modpkg:move', { id: item.id, direction: 'up' })}><ArrowUp size={15}/></button>
          <button type="button" className="cz-icon" aria-label={`Diminuir prioridade de ${item.name}`} disabled={index === ordered.length - 1} onClick={() => void command('modpkg:move', { id: item.id, direction: 'down' })}><ArrowDown size={15}/></button>
          <button type="button" className="cz-icon" aria-label={`Remover ${item.name}`} onClick={() => { if (window.confirm(`Remover o mod ${item.name}?`)) void command('modpkg:remove', item.id); }}><Trash2 size={15}/></button>
        </footer>
      </div>
    </article>)}</div> : <div className="ms-empty"><Package size={34}/><h2>Nenhum mod instalado.</h2><p>Mods mudam tema, papel de parede, sons, música e até o visual dos sites. Comece pelos mods do Cypher.</p><button type="button" className="button primary" onClick={() => setTab('explore')}><Sparkles size={15}/> Explorar mods</button></div>)}

    {tab === 'explore' && <div className="ms-explore">
      <div className="ms-explore-head"><p>{catalog?.message || (catalog?.remote ? 'Catálogo verificado com a assinatura do Cypher.' : 'Carregando o catálogo…')}</p><button type="button" className="cz-icon" aria-label="Recarregar catálogo" onClick={loadCatalog}><RefreshCw size={15}/></button></div>
      <div className="ms-origin" role="tablist" aria-label="Origem dos mods">{([['all', 'Todos'], ['cypher', 'Do Cypher'], ['community', 'Da comunidade']] as const).map(([value, label]) => <button type="button" role="tab" aria-selected={origin === value} key={value} className={origin === value ? 'is-active' : ''} onClick={() => setOrigin(value)}>{label}</button>)}</div>
      <div className="ms-grid">{(catalog?.mods || []).filter(item => origin === 'all' || (origin === 'community') === !!item.community).map(item => { const installed = installedIds.has(item.id); return <article key={item.id} className={`ms-tile ${item.community ? 'is-community' : ''}`}>
        <Preview src={item.preview} name={item.name}/>
        <div className="ms-tile-body">
          <span className="eyebrow">{item.community && <><Users size={11}/> COMUNIDADE · </>}{item.author.toUpperCase()} · v{item.version}</span>
          <h3>{item.name}</h3>
          <p>{item.description}</p>
          <div className="ms-components">{item.components.map(component => { const Icon = componentInfo[component].icon; return <span key={component} className="ms-chip static"><Icon size={12}/>{componentInfo[component].label}</span>; })}</div>
          <button type="button" className={`button ${installed ? 'secondary' : 'primary'}`} disabled={installed || busy === item.id} onClick={() => void run(item.id, () => command(item.source === 'builtin' ? 'modpkg:install-builtin' : 'modpkg:install-catalog', item.id), `${item.name} instalado e ativado.`)}>{installed ? <><Check size={15}/> Instalado</> : busy === item.id ? 'Instalando…' : <><Download size={15}/> Instalar</>}</button>
        </div>
      </article>; })}
        <article className="ms-tile ms-publish">
          <div className="ms-preview"><span><GitPullRequest size={30}/></span></div>
          <div className="ms-tile-body">
            <span className="eyebrow"><Users size={11}/> COMUNIDADE</span>
            <h3>Publique o seu mod</h3>
            <p>Crie um mod na aba Criar, mande a pasta num pull request e, depois da revisão, ele entra no catálogo assinado para todo mundo.</p>
            <button type="button" className="button secondary" onClick={() => void command('modpkg:publish-guide')}><GitPullRequest size={15}/> Como publicar</button>
          </div>
        </article>
      </div>
    </div>}

    {tab === 'create' && <ModCreator settings={s} command={command} notify={notify}/>}
    {tab === 'themes' && themes}
  </div>;
}

function ModCreator({ settings: s, command, notify }: { settings: Settings; command: Command; notify: (message: string) => void }) {
  const [name, setName] = useState('Meu mod');
  const [author, setAuthor] = useState('Eu');
  const [description, setDescription] = useState('');
  const [includeTheme, setIncludeTheme] = useState(true);
  const [includeCss, setIncludeCss] = useState(!!s.customCss);
  const [wallpaper, setWallpaper] = useState<{ token?: string; name?: string; current?: boolean }>({ current: s.wallpaper === 'custom' && !!s.wallpaperImageData });
  const [sounds, setSounds] = useState<Record<string, { token: string; name: string }>>({});
  const [music, setMusic] = useState<{ base?: { token: string; name: string }; active?: { token: string; name: string } }>({});
  const [styles, setStyles] = useState<Array<{ matches: string; css: string }>>([]);
  const [shader, setShader] = useState('none');
  const [intensity, setIntensity] = useState(0.6);
  const [busy, setBusy] = useState(false);
  const id = `com.${slug(author)}.${slug(name)}`;
  const pick = async (kind: 'audio' | 'image' | 'video') => command('modpkg:pick-file', { kind }) as Promise<{ token: string; name: string } | null>;
  async function create(install: boolean) {
    setBusy(true);
    try {
      const saved = await command('modpkg:create', { id, name, author, description, install, theme: includeTheme, interfaceCss: includeCss, wallpaper: wallpaper.token ? { token: wallpaper.token } : { current: wallpaper.current }, sounds: Object.fromEntries(Object.entries(sounds).map(([key, value]) => [key, value.token])), music: { base: music.base?.token, active: music.active?.token }, pageStyles: styles, shader, shaderIntensity: intensity });
      if (saved) notify(install ? 'Mod criado, salvo e instalado.' : 'Mod salvo como .cyphermod.');
    } finally { setBusy(false); }
  }
  return <div className="ms-creator">
    <section className="ms-creator-block">
      <h3>Identidade</h3>
      <div className="ms-form-grid">
        <label className="cz-field"><span>Nome</span><input className="sc-input" value={name} maxLength={64} onChange={event => setName(event.target.value)}/></label>
        <label className="cz-field"><span>Autor</span><input className="sc-input" value={author} maxLength={64} onChange={event => setAuthor(event.target.value)}/></label>
        <label className="cz-field ms-wide"><span>Descrição</span><input className="sc-input" value={description} maxLength={400} placeholder="O que este mod muda?" onChange={event => setDescription(event.target.value)}/></label>
      </div>
      <p className="cz-empty">ID do pacote: <code>{id}</code></p>
    </section>
    <section className="ms-creator-block">
      <h3>Visual</h3>
      <label className="ms-check"><input type="checkbox" checked={includeTheme} onChange={event => setIncludeTheme(event.target.checked)}/> Usar as cores, a pele e os tokens atuais do navegador</label>
      <label className="ms-check"><input type="checkbox" checked={includeCss} disabled={!s.customCss} onChange={event => setIncludeCss(event.target.checked)}/> Incluir o CSS personalizado da interface {s.customCss ? '' : '(nenhum definido)'}</label>
      <div className="ms-file-row"><span><ImageIcon size={15}/> Papel de parede</span>{wallpaper.name ? <strong>{wallpaper.name}</strong> : wallpaper.current ? <strong>Imagem atual da Home</strong> : <small>Nenhum</small>}<button type="button" className="button secondary" onClick={() => void pick('image').then(file => file && setWallpaper(file))}>Imagem</button><button type="button" className="button secondary" onClick={() => void pick('video').then(file => file && setWallpaper(file))}>Vídeo</button>{(wallpaper.token || wallpaper.current) && <button type="button" className="cz-icon" aria-label="Remover papel de parede" onClick={() => setWallpaper({})}><Trash2 size={14}/></button>}</div>
    </section>
    <section className="ms-creator-block">
      <h3>Sons da interface</h3>
      {Object.keys(soundLabels).map(key => <div className="ms-file-row" key={key}><span><FileAudio size={15}/> {soundLabels[key]}</span>{sounds[key] ? <strong>{sounds[key].name}</strong> : <small>Padrão</small>}<button type="button" className="button secondary" onClick={() => void pick('audio').then(file => file && setSounds(current => ({ ...current, [key]: file })))}>Escolher</button>{sounds[key] && <button type="button" className="cz-icon" aria-label={`Remover som de ${soundLabels[key]}`} onClick={() => setSounds(current => { const next = { ...current }; delete next[key]; return next; })}><Trash2 size={14}/></button>}</div>)}
    </section>
    <section className="ms-creator-block">
      <h3>Música reativa</h3>
      <p className="cz-empty">A camada base toca sempre; a camada de atividade aparece quando você clica, digita ou navega. Use dois loops do mesmo tamanho.</p>
      {(['base', 'active'] as const).map(layer => <div className="ms-file-row" key={layer}><span><Music2 size={15}/> {layer === 'base' ? 'Camada base' : 'Camada de atividade'}</span>{music[layer] ? <strong>{music[layer]!.name}</strong> : <small>Nenhuma</small>}<button type="button" className="button secondary" onClick={() => void pick('audio').then(file => file && setMusic(current => ({ ...current, [layer]: file })))}>Escolher</button></div>)}
    </section>
    <section className="ms-creator-block">
      <h3>Páginas</h3>
      <label className="cz-field"><span>Filtro em todas as páginas</span><select className="sc-select" value={shader} onChange={event => setShader(event.target.value)}>{Object.entries(shaderLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {shader !== 'none' && <label className="cz-range"><span>Intensidade<output>{Math.round(intensity * 100)}%</output></span><input type="range" min={0.1} max={1} step={0.05} value={intensity} onChange={event => setIntensity(Number(event.target.value))}/></label>}
      {styles.map((style, index) => <div className="ms-style" key={index}>
        <input className="sc-input" placeholder="youtube.com, reddit.com" value={style.matches} aria-label="Sites" onChange={event => setStyles(list => list.map((item, position) => position === index ? { ...item, matches: event.target.value } : item))}/>
        <textarea className="cz-code" spellCheck={false} placeholder={'body { background: #000 !important; }'} value={style.css} aria-label="CSS do site" onChange={event => setStyles(list => list.map((item, position) => position === index ? { ...item, css: event.target.value } : item))}/>
        <button type="button" className="cz-icon" aria-label="Remover estilo" onClick={() => setStyles(list => list.filter((_, position) => position !== index))}><Trash2 size={14}/></button>
      </div>)}
      <button type="button" className="button secondary" onClick={() => setStyles(list => [...list, { matches: '', css: '' }])}><Plus size={14}/> Estilo para um site</button>
    </section>
    <div className="ms-creator-actions">
      <button type="button" className="button secondary" disabled={busy || !name.trim()} onClick={() => void create(false)}><Download size={15}/> Exportar .cyphermod</button>
      <button type="button" className="button primary" disabled={busy || !name.trim()} onClick={() => void create(true)}><Sparkles size={15}/> Exportar e instalar</button>
    </div>
  </div>;
}
