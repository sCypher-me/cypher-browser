import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CircleHelp, Search } from 'lucide-react';
import { settingsSections, type SettingsSection } from './navigation';
import ExtensionsPage from './ExtensionsPage';
import { Block } from './settings-ui';
import Overview from './central/Overview';
import Appearance from './central/Appearance';
import Browsing from './central/Browsing';
import Privacy from './central/Privacy';
import Profile from './central/Profile';
import System from './central/System';
import type { CentralProps, SectionProps } from './central/types';

const sectionLabels: Record<SettingsSection, string> = {
  overview: 'Visão geral', appearance: 'Aparência', browsing: 'Navegação', privacy: 'Privacidade e segurança',
  profile: 'Perfil e dados', extensions: 'Extensões', system: 'Sistema',
};

/** Índice da busca: cada entrada aponta para um bloco ou linha com o mesmo id no DOM. */
const preferenceIndex: { id: string; title: string; detail: string; section: SettingsSection }[] = [
  { id: 'appearance-skin', title: 'Pele da interface', detail: 'Recorte ou Clássico', section: 'appearance' },
  { id: 'appearance-mode', title: 'Modo claro ou escuro', detail: 'Claro, escuro ou seguir o Windows', section: 'appearance' },
  { id: 'appearance-presets', title: 'Temas e cores', detail: 'Combinações prontas de destaque, superfície e fundo', section: 'appearance' },
  { id: 'appearance-shape', title: 'Cores, cantos e fonte', detail: 'Destaque, superfícies, arredondamento, tipografia e animações', section: 'appearance' },
  { id: 'appearance-controls', title: 'Botões e efeitos', detail: 'Forma dos botões e efeitos da interface', section: 'appearance' },
  { id: 'appearance-tokens', title: 'Tokens de design', detail: 'Corte, altura da barra, densidade, bordas e fontes', section: 'appearance' },
  { id: 'tabs-position', title: 'Posição das abas', detail: 'Abas laterais ou no topo, largura e barra de favoritos', section: 'appearance' },
  { id: 'tabs-toolbar', title: 'Barra de ferramentas', detail: 'Ordem, botões visíveis, posição, abas ocultas e trilho', section: 'appearance' },
  { id: 'home-editor', title: 'Página inicial e papel de parede', detail: 'Fundo orbital, grade, imagem, vídeo e widgets', section: 'appearance' },
  { id: 'mods-manage', title: 'Mods e temas', detail: 'Abrir a loja, importar e exportar', section: 'appearance' },
  { id: 'appearance-sounds', title: 'Sons e música', detail: 'Sons de interface e música de fundo', section: 'appearance' },
  { id: 'appearance-skins', title: 'Pacotes de pele', detail: 'Importar, exportar e aplicar .cypherskin', section: 'appearance' },
  { id: 'appearance-css', title: 'CSS personalizado', detail: 'CSS próprio para a interface', section: 'appearance' },
  { id: 'search-panel', title: 'Mecanismo de pesquisa', detail: 'DuckDuckGo, Google, Bing ou personalizado; sugestões', section: 'browsing' },
  { id: 'startup-mode', title: 'Ao iniciar', detail: 'Home, restaurar sessão ou páginas específicas; links em nova aba', section: 'browsing' },
  { id: 'download-location', title: 'Local dos downloads', detail: 'Pasta padrão ou perguntar a cada arquivo', section: 'browsing' },
  { id: 'languages-preferred', title: 'Idiomas preferidos', detail: 'Ordem dos idiomas enviados aos sites', section: 'browsing' },
  { id: 'languages-spellcheck', title: 'Ortografia e tradução', detail: 'Corretor e opção Traduzir esta página', section: 'browsing' },
  { id: 'shortcuts-list', title: 'Atalhos de teclado', detail: 'Redefinir teclas rápidas', section: 'browsing' },
  { id: 'tabs-panels', title: 'Painéis laterais', detail: 'Sites fixos numa coluna ao lado da página', section: 'browsing' },
  { id: 'privacy-report', title: 'Relatório de privacidade', detail: 'Bloqueios dos últimos 7 dias', section: 'privacy' },
  { id: 'privacy-blocking', title: 'Bloquear anúncios e rastreadores', detail: 'Anúncios, rastreadores, pop-ups, cookies de terceiros, avisos de cookies, Não rastrear', section: 'privacy' },
  { id: 'privacy-data', title: 'Limpar dados de navegação', detail: 'Cookies, cache, histórico, limpeza ao sair, aba privada', section: 'privacy' },
  { id: 'connection-routes', title: 'Rotas Tor, I2P e VPN', detail: 'Rota padrão, portas e Proton VPN', section: 'privacy' },
  { id: 'connections-rules', title: 'Rota por site', detail: 'Abrir sites sempre pelo Tor ou I2P', section: 'privacy' },
  { id: 'connections-containers', title: 'Contêineres', detail: 'Cookies e logins separados por aba', section: 'privacy' },
  { id: 'site-permissions', title: 'Permissões de sites', detail: 'Câmera, microfone, localização e notificações', section: 'privacy' },
  { id: 'privacy-popup-exceptions', title: 'Exceções de pop-ups', detail: 'Sites autorizados a abrir pop-ups', section: 'privacy' },
  { id: 'privacy-passwords', title: 'Senhas', detail: 'Cofre local, salvar ao entrar, vazamentos e importar CSV', section: 'privacy' },
  { id: 'privacy-safe-browsing', title: 'Sites perigosos', detail: 'Google Safe Browsing com lista local', section: 'privacy' },
  { id: 'tabs-auto-pip', title: 'Vídeo flutuante', detail: 'Picture-in-picture ao trocar de aba', section: 'browsing' },
  { id: 'system-drm', title: 'Conteúdo protegido (Widevine)', detail: 'Netflix, Disney+, Spotify', section: 'system' },
  { id: 'privacy-https', title: 'Modo HTTPS', detail: 'Tentar HTTPS primeiro ou somente HTTPS', section: 'privacy' },
  { id: 'privacy-error-reports', title: 'Relatórios de erro', detail: 'Registrar falhas sem dados pessoais', section: 'privacy' },
  { id: 'profile-local', title: 'Foto do perfil', detail: 'Perfil ativo neste dispositivo', section: 'profile' },
  { id: 'profile-import', title: 'Importar de outro navegador', detail: 'Favoritos e histórico do Chrome, Edge, Brave, Vivaldi, Opera e Firefox', section: 'profile' },
  { id: 'profile-manager', title: 'Perfis e visitante', detail: 'Criar, trocar perfis e abrir sessão de visitante', section: 'profile' },
  { id: 'profile-sync', title: 'Sincronização de perfil', detail: 'WebDAV entre dispositivos', section: 'profile' },
  { id: 'extensions-list', title: 'Extensões', detail: 'Instalar pela Chrome Web Store, .cypherext ou pasta local', section: 'extensions' },
  { id: 'updates-status', title: 'Atualização do Cypher', detail: 'Versão, verificar e instalar', section: 'system' },
  { id: 'system-startup', title: 'Navegador padrão e Windows', detail: 'Padrão, iniciar com o Windows, confirmar ao fechar, proxy e DNS', section: 'system' },
  { id: 'tabs-memory-saver', title: 'Economia de memória e aceleração', detail: 'Suspender abas inativas e usar a GPU', section: 'system' },
  { id: 'accessibility-zoom', title: 'Acessibilidade', detail: 'Tamanho do texto, zoom inicial e animações', section: 'system' },
  { id: 'system-webrtc', title: 'WebRTC', detail: 'Como os sites descobrem endereços de rede', section: 'system' },
];

const normalize = (value: string) => value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '');

type Props = CentralProps & { initialCategory: SettingsSection; focusSettingId?: string; focusStamp?: number };

export default function SettingsCenter({ initialCategory, focusSettingId, focusStamp, ...central }: Props) {
  const [section, setSection] = useState<SettingsSection>(initialCategory);
  const [query, setQuery] = useState('');
  const [toc, setToc] = useState<{ id: string; title: string }[]>([]);
  const [current, setCurrent] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<string | undefined>(undefined);

  const matches = useMemo(() => {
    const value = normalize(query.trim());
    if (!value) return [];
    return preferenceIndex.filter(item => normalize(`${item.title} ${item.detail} ${sectionLabels[item.section]}`).includes(value));
  }, [query]);

  const goSection = (target: SettingsSection, focusId?: string) => { pendingFocus.current = focusId; setQuery(''); setSection(target); if (!focusId) contentRef.current?.closest('.internal-page')?.scrollTo({ top: 0 }); };

  useEffect(() => { pendingFocus.current = focusSettingId; setQuery(''); setSection(initialCategory); }, [initialCategory, focusSettingId, focusStamp]);

  // Monta o sumário a partir dos blocos renderizados e leva até o item pedido.
  useEffect(() => {
    if (query) return;
    const root = contentRef.current;
    if (!root) return;
    const blocks = [...root.querySelectorAll<HTMLElement>(':scope > [data-toc][id]')];
    setToc(blocks.map(block => ({ id: block.id, title: block.dataset.toc || '' })));
    setCurrent(blocks[0]?.id || '');
    const focus = pendingFocus.current;
    pendingFocus.current = undefined;
    let timer = 0;
    if (focus) timer = window.setTimeout(() => {
      const target = document.getElementById(focus);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('sc-flash'); window.setTimeout(() => target.classList.remove('sc-flash'), 1600);
    }, 60);
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setCurrent((visible.target as HTMLElement).id);
    }, { rootMargin: '-15% 0px -70% 0px' });
    blocks.forEach(block => observer.observe(block));
    return () => { observer.disconnect(); window.clearTimeout(timer); };
  }, [section, query]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); searchRef.current?.focus(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const props: SectionProps = { ...central, goSection };
  const showToc = !query && section !== 'overview' && toc.length > 2;

  return <div className="central">
    <header className="central-head">
      <div><span className="sc-eyebrow">CYPHER / CONFIGURAÇÕES</span><h1>Configurações</h1></div>
      <label className="central-search"><Search size={15}/><input ref={searchRef} aria-label="Buscar em todas as configurações" placeholder="Buscar em todas as configurações…" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setQuery(''); if (event.key === 'Enter' && matches[0]) { event.preventDefault(); goSection(matches[0].section, matches[0].id); } }}/>{query ? <button type="button" onClick={() => setQuery('')} aria-label="Limpar busca">Esc</button> : <kbd>Ctrl K</kbd>}</label>
    </header>

    <nav className="central-tabs" role="tablist" aria-label="Seções das configurações">
      {settingsSections.map(id => <button key={id} type="button" role="tab" aria-selected={!query && section === id} className={!query && section === id ? 'is-active' : ''} onClick={() => goSection(id)}>{sectionLabels[id]}</button>)}
    </nav>

    <div className={`central-body ${showToc ? 'has-toc' : ''}`}>
      {showToc && <aside className="central-toc" aria-label="Nesta seção">{toc.map(item => <button key={item.id} type="button" className={current === item.id ? 'is-current' : ''} onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{item.title}</button>)}</aside>}

      {query.trim() ? <div className="central-results">
        <p className="central-results-count">{matches.length ? `${matches.length} resultado${matches.length === 1 ? '' : 's'} para “${query.trim()}”` : `Nada encontrado para “${query.trim()}”.`}</p>
        {matches.length ? matches.map(item => <button type="button" className="sc-result" key={item.id} onClick={() => goSection(item.section, item.id)}><span><strong>{item.title}</strong><small>{item.detail}</small></span><span className="sc-result-category">{sectionLabels[item.section]}</span><ArrowRight size={14}/></button>)
          : <div className="sc-empty-line"><CircleHelp size={15}/> Tente aparência, abas, VPN, senhas ou atualização.</div>}
      </div> : <div className={`central-content section-${section}`} ref={contentRef} key={section} role="tabpanel" aria-label={sectionLabels[section]}>
        {section === 'overview' && <Overview {...props}/>}
        {section === 'appearance' && <Appearance {...props}/>}
        {section === 'browsing' && <Browsing {...props}/>}
        {section === 'privacy' && <Privacy {...props}/>}
        {section === 'profile' && <Profile {...props}/>}
        {section === 'extensions' && <Block id="extensions-list" title="Extensões" wide><ExtensionsPage extensions={central.extensions} command={central.command}/></Block>}
        {section === 'system' && <System {...props}/>}
      </div>}
    </div>
  </div>;
}
