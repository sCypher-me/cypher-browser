import { useEffect, useState } from 'react';
import { Import, KeyRound, RotateCw } from 'lucide-react';
import type { ImportableBrowser } from '../types';
import { Panel } from '../settings-ui';
import type { Command } from './types';

const EXPORT_HINTS: Record<string, string> = {
  chrome: 'No Chrome: Gerenciador de senhas › Configurações › Exportar senhas.',
  edge: 'No Edge: Configurações › Perfis › Senhas › ⋯ › Exportar senhas.',
  brave: 'No Brave: Configurações › Preenchimento automático › Senhas › Exportar.',
  vivaldi: 'No Vivaldi: Configurações › Privacidade › Senhas › Exportar.',
  opera: 'No Opera: Configurações › Preenchimento automático › Senhas › Exportar.',
  firefox: 'No Firefox: Senhas (about:logins) › ⋯ › Exportar senhas.',
};

/** Traz favoritos e histórico de outros navegadores; as senhas vêm pelo CSV exportado. */
export function ImportPanel({ command, goPasswords }: { command: Command; goPasswords: () => void }) {
  const [browsers, setBrowsers] = useState<ImportableBrowser[] | null>(null);
  const [choice, setChoice] = useState('');
  const [bookmarks, setBookmarks] = useState(true);
  const [history, setHistory] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const detect = async () => {
    const found = await command('import:detect');
    const list: ImportableBrowser[] = Array.isArray(found) ? found : [];
    setBrowsers(list);
    const first = list[0];
    if (first && !list.some(browser => browser.profiles.some(profile => `${browser.id}|${profile.id}` === choice))) setChoice(`${first.id}|${first.profiles[0]?.id ?? ''}`);
  };
  useEffect(() => { void detect(); }, []);
  const [browserId, ...rest] = choice.split('|');
  const profileId = rest.join('|');
  const browser = browsers?.find(item => item.id === browserId);
  const run = async () => {
    if (!browser) return;
    setBusy(true); setResult('');
    try {
      const done = await command('import:run', { browser: browser.id, profile: profileId, bookmarks, history });
      if (done) setResult(`${browser.name}: ${done.bookmarks} ${done.bookmarks === 1 ? 'favorito novo' : 'favoritos novos'} e ${done.history} ${done.history === 1 ? 'página' : 'páginas'} no histórico.${done.found.bookmarks && !done.bookmarks ? ' Os favoritos já estavam aqui.' : ''}`);
    } finally { setBusy(false); }
  };
  return <Panel id="profile-import" eyebrow="TROCAR É FÁCIL" title="Importar de outro navegador" detail="Lê uma cópia dos dados: o navegador de origem não é alterado e pode continuar aberto." icon={Import} wide>
    {browsers === null ? <div className="sc-empty-line">Procurando navegadores instalados…</div>
      : !browsers.length ? <div className="sc-empty-line">Nenhum Chrome, Edge, Brave, Vivaldi, Opera ou Firefox encontrado neste usuário do Windows. <button type="button" className="sc-button sc-button-subtle" onClick={() => void detect()}><RotateCw size={13}/> Procurar de novo</button></div>
      : <div className="sc-import">
        <div className="sc-import-sources" role="radiogroup" aria-label="Navegador e perfil de origem">
          {browsers.flatMap(item => item.profiles.map(profile => {
            const key = `${item.id}|${profile.id}`;
            return <label className="sc-radio-option" key={key}><input type="radio" name="import-source" checked={choice === key} onChange={() => setChoice(key)}/><span><strong>{item.name}</strong><small>{profile.name}</small></span></label>;
          }))}
        </div>
        <div className="sc-import-what">
          <label className="sc-check"><input type="checkbox" checked={bookmarks} onChange={event => setBookmarks(event.target.checked)}/> Favoritos</label>
          <label className="sc-check"><input type="checkbox" checked={history} onChange={event => setHistory(event.target.checked)}/> Histórico (até 1.000 páginas)</label>
          <button type="button" className="sc-button sc-button-primary" disabled={busy || !browser || (!bookmarks && !history)} onClick={() => void run()}>{busy ? 'Importando…' : 'Importar agora'} <Import size={13}/></button>
        </div>
        {result && <div className="sc-info-strip" role="status"><Import size={15}/><span>{result}</span></div>}
        <div className="sc-info-strip"><KeyRound size={15}/><span>Senhas: os navegadores protegem as senhas com a conta do Windows e não deixam outro programa lê-las. {EXPORT_HINTS[browser?.id || 'chrome']} Depois use <button type="button" className="sc-inline-link" onClick={goPasswords}>Importar CSV</button> em Senhas.</span></div>
      </div>}
  </Panel>;
}
