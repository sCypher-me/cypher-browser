import { useEffect, useState } from 'react';
import { Check, Download, ExternalLink, FolderOpen, Globe2, PanelTop, Search } from 'lucide-react';
import type { Settings } from '../types';
import { Panel, Row, Switch } from '../settings-ui';
import { ShortcutsPanel, WebPanelsPanel } from '../CustomizationSettings';
import type { SectionProps } from './types';

const languageOptions = [
  { code: 'pt-BR', label: 'português (Brasil)' }, { code: 'pt', label: 'português' },
  { code: 'en-US', label: 'inglês (Estados Unidos)' }, { code: 'en', label: 'inglês' },
  { code: 'es', label: 'espanhol' }, { code: 'fr', label: 'francês' }, { code: 'de', label: 'alemão' },
  { code: 'it', label: 'italiano' }, { code: 'ja', label: 'japonês' }, { code: 'ko', label: 'coreano' }, { code: 'zh-CN', label: 'chinês (simplificado)' },
];

export default function Browsing({ settings: s, onSettings, command, navigate }: SectionProps) {
  const [customSearchDraft, setCustomSearchDraft] = useState(s.customSearchUrl);
  const [startupPagesDraft, setStartupPagesDraft] = useState(s.startupPages.join('\n'));
  const [languageChoice, setLanguageChoice] = useState('');
  useEffect(() => setCustomSearchDraft(s.customSearchUrl), [s.customSearchUrl]);
  useEffect(() => setStartupPagesDraft(s.startupPages.join('\n')), [s.startupPages]);
  const customSearchReady = customSearchDraft.includes('{query}') && (() => { try { return new URL(customSearchDraft.replace('{query}', 'cypher-query')).protocol === 'https:'; } catch { return false; } })();

  return <>
    <Panel id="search-panel" eyebrow="BUSCA" title="Pesquisa" icon={Search}>
      <Row id="search-engine" title="Mecanismo padrão" detail="Usado na Home e na barra de endereço"><select className="sc-select" aria-label="Mecanismo de pesquisa padrão" value={s.searchEngine} onChange={event => onSettings({ searchEngine: event.target.value as Settings['searchEngine'] })}><option value="duckduckgo">DuckDuckGo</option><option value="google">Google</option><option value="bing">Bing</option><option value="custom">Personalizado</option></select></Row>
      {s.searchEngine === 'custom' && <Row id="search-custom-url" title="URL personalizada" detail={customSearchReady ? 'HTTPS com {query} no lugar do termo' : 'Informe uma URL HTTPS com {query}; até lá, o DuckDuckGo é usado.'}><input className="sc-text-input" aria-label="URL de pesquisa personalizada" value={customSearchDraft} placeholder="https://example.com/search?q={query}" onChange={event => setCustomSearchDraft(event.target.value)} onBlur={() => onSettings({ customSearchUrl: customSearchDraft })}/></Row>}
      <Row id="search-suggestions" title="Sugestões ao digitar"><Switch label="Sugestões na barra de endereço" checked={s.showSearchSuggestions} onChange={() => onSettings({ showSearchSuggestions: !s.showSearchSuggestions })}/></Row>
      {s.showSearchSuggestions && <>
        <Row id="search-suggest-history" title="Incluir histórico"><Switch label="Incluir histórico nas sugestões" checked={s.suggestHistory} onChange={() => onSettings({ suggestHistory: !s.suggestHistory })}/></Row>
        <Row id="search-suggest-bookmarks" title="Incluir favoritos"><Switch label="Incluir favoritos nas sugestões" checked={s.suggestBookmarks} onChange={() => onSettings({ suggestBookmarks: !s.suggestBookmarks })}/></Row>
      </>}
      <div className="sc-info-strip"><Search size={15}/><span>Digite !yt, !gh, !w ou !maps para pesquisar direto no site.</span></div>
    </Panel>

    <Panel id="startup-mode" eyebrow="AO ABRIR" title="Ao iniciar e links" icon={PanelTop}>
      <Row title="Ao iniciar o Cypher" detail="A Home é sempre a primeira aba visível"><select className="sc-select" aria-label="Ao iniciar o Cypher" value={s.startupMode} onChange={event => onSettings({ startupMode: event.target.value as Settings['startupMode'] })}><option value="home">Página inicial</option><option value="restore">Restaurar sessão anterior</option><option value="specific">Páginas específicas</option></select></Row>
      {s.startupMode === 'specific' && <div className="sc-startup-pages"><label htmlFor="startup-pages">Um endereço por linha, até 10</label><textarea id="startup-pages" className="sc-text-input sc-textarea" value={startupPagesDraft} onChange={event => setStartupPagesDraft(event.target.value)} placeholder={'https://example.com\nhttps://news.example.com'}/><div className="sc-action-row"><button className="sc-button sc-button-primary" onClick={() => onSettings({ startupPages: startupPagesDraft.split(/\r?\n/).map(url => url.trim()).filter(Boolean).slice(0, 10) })}>Salvar páginas</button></div></div>}
      <Row id="tabs-archive" title="Arquivar abas paradas" detail="Abas sem uso saem da barra e ficam em Espaços e pesquisa; fixadas e com som ficam"><select className="sc-select" aria-label="Arquivar abas paradas" value={s.archiveTabsHours} onChange={event => onSettings({ archiveTabsHours: +event.target.value })}><option value={0}>Nunca</option><option value={12}>Depois de 12 horas</option><option value={24}>Depois de 1 dia</option><option value={72}>Depois de 3 dias</option><option value={168}>Depois de 7 dias</option></select></Row>
      <Row id="tabs-link-preview" title="Prévia de links" detail="Shift + clique abre o link numa janela por cima da página"><Switch label="Prévia de links" checked={s.linkPreview} onChange={() => onSettings({ linkPreview: !s.linkPreview })}/></Row>
      <Row id="tabs-quick-window" title="Atalho da janela rápida" detail="Ctrl Alt N abre uma janela pequena de consulta, mesmo com o Cypher em segundo plano"><Switch label="Atalho da janela rápida" checked={s.quickWindowShortcut} onChange={() => onSettings({ quickWindowShortcut: !s.quickWindowShortcut })}/></Row>
      <Row id="tabs-auto-pip" title="Vídeo flutuante ao trocar de aba" detail="O vídeo que está tocando continua numa janela por cima"><Switch label="Janela flutuante automática" checked={s.autoPictureInPicture} onChange={() => onSettings({ autoPictureInPicture: !s.autoPictureInPicture })}/></Row>
      <Row id="tabs-links" title="Abrir links em nova aba" detail="Links que abririam janelas vão para uma aba"><Switch label="Abrir links em nova aba" checked={s.openLinksInNewTab} onChange={() => onSettings({ openLinksInNewTab: !s.openLinksInNewTab })}/></Row>
    </Panel>

    <Panel id="download-location" eyebrow="ARQUIVOS" title="Downloads" icon={Download}>
      <div className="sc-folder-current"><span className="sc-folder-icon"><FolderOpen size={17}/></span><div><strong>{s.downloadDirectory || 'Perguntar onde salvar cada arquivo'}</strong><small>{s.downloadDirectory ? 'Novos downloads vão direto para esta pasta.' : 'O Cypher pergunta o local a cada download.'}</small></div></div>
      <div className="sc-action-row">
        <button className="sc-button sc-button-primary" onClick={() => void command('download:directory:select')}><FolderOpen size={14}/>{s.downloadDirectory ? 'Trocar pasta' : 'Escolher pasta'}</button>
        {s.downloadDirectory && <button className="sc-button sc-button-subtle" onClick={() => void command('download:directory:clear')}>Perguntar sempre</button>}
        <button className="sc-button sc-button-subtle" onClick={() => void command('download:directory:open')}><ExternalLink size={13}/>Abrir pasta</button>
        <button className="sc-button sc-button-subtle" onClick={() => navigate('downloads')}>Ver downloads</button>
      </div>
    </Panel>

    <Panel id="languages-preferred" eyebrow="IDIOMAS" title="Idiomas dos sites" detail="Ordem enviada aos sites. Não muda o idioma do Cypher." icon={Globe2}>
      <div className="sc-action-row sc-language-add"><select className="sc-select" aria-label="Adicionar idioma preferido" value={languageChoice} onChange={event => setLanguageChoice(event.target.value)}><option value="">Adicionar idioma…</option>{languageOptions.filter(language => !s.preferredLanguages.includes(language.code)).map(language => <option key={language.code} value={language.code}>{language.label}</option>)}</select><button className="sc-button sc-button-primary" disabled={!languageChoice} onClick={() => { if (languageChoice) onSettings({ preferredLanguages: [...s.preferredLanguages, languageChoice] }); setLanguageChoice(''); }}>Adicionar</button></div>
      {s.preferredLanguages.map((code, index) => <Row key={code} title={`${index + 1}. ${languageOptions.find(language => language.code === code)?.label || code}`} detail={index === 0 ? 'Enviado primeiro' : undefined}><div className="sc-inline-actions"><button className="sc-button sc-button-subtle" aria-label={`Mover ${code} para cima`} disabled={index === 0} onClick={() => { const next = [...s.preferredLanguages]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; onSettings({ preferredLanguages: next }); }}>↑</button><button className="sc-button sc-button-subtle" aria-label={`Remover ${code}`} disabled={s.preferredLanguages.length <= 1} onClick={() => onSettings({ preferredLanguages: s.preferredLanguages.filter(item => item !== code) })}>Remover</button></div></Row>)}
    </Panel>

    <Panel id="languages-spellcheck" eyebrow="CORRETOR" title="Ortografia e tradução" icon={Check}>
      <Row title="Verificar ortografia" detail="Dicionários do Chromium em campos de texto"><Switch label="Verificação ortográfica" checked={s.spellCheckEnabled} onChange={() => onSettings({ spellCheckEnabled: !s.spellCheckEnabled })}/></Row>
      {s.spellCheckEnabled && <div className="sc-chip-list">{languageOptions.slice(0, 7).map(language => { const on = s.spellCheckLanguages.includes(language.code); return <button type="button" key={language.code} className={`sc-chip ${on ? 'is-on' : ''}`} aria-pressed={on} onClick={() => onSettings({ spellCheckLanguages: on ? s.spellCheckLanguages.filter(code => code !== language.code) : [...s.spellCheckLanguages, language.code] })}>{language.label}</button>; })}</div>}
      <Row id="languages-translate" title="Opção Traduzir esta página" detail="No menu do botão direito; envia o endereço ao Google Tradutor só quando você escolhe"><Switch label="Habilitar tradução de páginas" checked={s.translationEnabled} onChange={() => onSettings({ translationEnabled: !s.translationEnabled })}/></Row>
    </Panel>

    <ShortcutsPanel settings={s} onSettings={onSettings}/>
    <WebPanelsPanel settings={s} command={command} onSettings={onSettings}/>
  </>;
}
