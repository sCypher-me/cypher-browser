import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowUpRight, Clock3, CornerDownLeft, Globe2, Search, Star } from 'lucide-react';
import type { Link, Tab } from './types';

export interface PaletteCommand { id: string; title: string; hint?: string; icon: ReactNode; keywords?: string; run: () => void }
interface Entry { id: string; group: string; title: string; detail: string; icon: ReactNode; shortcut?: string; run: () => void }
interface Props { tabs: Tab[]; activeId: string; bookmarks: Link[]; history: Link[]; commands: PaletteCommand[]; onSelectTab: (id: string) => void; onOpen: (url: string) => void; onClose: () => void }

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function host(url: string) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } }

export default function CommandPalette({ tabs, activeId, bookmarks, history, commands, onSelectTab, onOpen, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null), listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const entries = useMemo(() => {
    const terms = normalize(query.trim()).split(/\s+/).filter(Boolean);
    const matches = (...values: string[]) => { const text = normalize(values.join(' ')); return terms.every(term => text.includes(term)); };
    const seen = new Set(tabs.map(tab => tab.url));
    const tabEntries: Entry[] = tabs.filter(tab => (terms.length || tab.id !== activeId) && matches(tab.title, tab.url)).map(tab => ({ id: `tab-${tab.id}`, group: 'Abas abertas', title: tab.title || host(tab.url), detail: tab.id === activeId ? 'Aba atual' : tab.url.startsWith('cypher://') ? 'Página do Cypher' : host(tab.url), icon: <Globe2 size={16}/>, run: () => onSelectTab(tab.id) }));
    const commandEntries: Entry[] = commands.filter(command => matches(command.title, command.keywords || '')).map(command => ({ id: `cmd-${command.id}`, group: 'Ações', title: command.title, detail: '', shortcut: command.hint, icon: command.icon, run: command.run }));
    const linkEntries = (links: Link[], group: string, icon: ReactNode, limit: number) => links.filter(link => !seen.has(link.url) && matches(link.title, link.url)).slice(0, limit).map((link): Entry => { seen.add(link.url); return { id: `${group}-${link.id}`, group, title: link.title || host(link.url), detail: host(link.url), icon, run: () => onOpen(link.url) }; });
    const result: Entry[] = [...tabEntries, ...commandEntries.slice(0, terms.length ? 8 : 6), ...linkEntries(bookmarks, 'Favoritos', <Star size={16}/>, terms.length ? 6 : 3), ...(terms.length ? linkEntries(history, 'Histórico', <Clock3 size={16}/>, 6) : [])];
    if (query.trim()) result.push({ id: 'search', group: 'Pesquisar', title: query.trim(), detail: /^[\w-]+(\.[\w-]+)+(\/\S*)?$|^https?:\/\//i.test(query.trim()) ? 'Abrir endereço' : 'Pesquisar na internet', icon: <Search size={16}/>, run: () => onOpen(query.trim()) });
    return result;
  }, [query, tabs, activeId, bookmarks, history, commands, onSelectTab, onOpen]);
  useEffect(() => { setIndex(0); }, [query]);
  useEffect(() => { listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' }); }, [index]);
  function choose(entry?: Entry) { if (!entry) return; onClose(); entry.run(); }
  let lastGroup = '';
  return <>
    <div className="palette-backdrop" onClick={onClose}/>
    <div className="command-palette" role="dialog" aria-modal="true" aria-label="Pesquisar abas e comandos">
      <label className="palette-input"><Search size={18}/><input ref={inputRef} value={query} placeholder="Pesquise abas, favoritos, histórico ou ações…" aria-label="Pesquisar abas e comandos" role="combobox" aria-expanded="true" aria-controls="palette-results" aria-activedescendant={entries[index] ? `palette-${entries[index].id}` : undefined} spellCheck={false} onChange={event => setQuery(event.target.value)} onKeyDown={event => {
        if (event.key === 'ArrowDown') { event.preventDefault(); setIndex(value => Math.min(entries.length - 1, value + 1)); }
        else if (event.key === 'ArrowUp') { event.preventDefault(); setIndex(value => Math.max(0, value - 1)); }
        else if (event.key === 'Enter') { event.preventDefault(); choose(entries[index]); }
        else if (event.key === 'Escape') { event.preventDefault(); onClose(); }
      }}/><kbd>Esc</kbd></label>
      <div className="palette-results" id="palette-results" role="listbox" ref={listRef}>
        {entries.map((entry, position) => {
          const heading = entry.group !== lastGroup ? <span className="palette-group" key={`group-${entry.group}`}>{entry.group}</span> : null;
          lastGroup = entry.group;
          return [heading, <button type="button" key={entry.id} id={`palette-${entry.id}`} role="option" aria-selected={position === index} data-index={position} className={position === index ? 'active' : ''} onMouseMove={() => setIndex(position)} onClick={() => choose(entry)}>
            <span className="palette-icon">{entry.icon}</span><span className="palette-copy"><strong>{entry.title}</strong>{entry.detail && <small>{entry.detail}</small>}</span>{entry.shortcut ? <kbd>{entry.shortcut}</kbd> : position === index ? <CornerDownLeft size={14}/> : <ArrowUpRight size={14} className="palette-arrow"/>}
          </button>];
        })}
        {!entries.length && <p className="palette-empty">Nada encontrado. Digite um endereço ou termo para pesquisar.</p>}
      </div>
      <footer className="palette-footer"><span><kbd>↑</kbd><kbd>↓</kbd> navegar</span><span><kbd>Enter</kbd> abrir</span><span><kbd>Ctrl</kbd><kbd>Shift</kbd><kbd>A</kbd> a qualquer momento</span></footer>
    </div>
  </>;
}
