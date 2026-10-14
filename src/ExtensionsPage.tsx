import { useState } from 'react';
import { AlertTriangle, Check, FolderPlus, Puzzle, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import type { BrowserExtension } from './types';

type Props = { extensions: BrowserExtension[]; command: (action: string, payload?: unknown) => Promise<any> };

export default function ExtensionsPage({ extensions, command }: Props) {
  const [choosing, setChoosing] = useState(false);
  const install = async () => {
    setChoosing(true);
    try { await command('extension:install'); } finally { setChoosing(false); }
  };

  return <div className="extension-manager">
    <section className="settings-card extension-manager-hero">
      <span className="extension-manager-mark"><Puzzle size={23}/></span>
      <div className="extension-manager-intro"><span className="eyebrow">CYPHER / PERSONALIZE A NAVEGAÇÃO</span><h2>Suas extensões</h2><p>Adicione extensões Chromium a partir de uma pasta descompactada. Elas rodam no seu perfil normal e você pode ativá-las ou removê-las daqui.</p></div>
      <button className="button primary" disabled={choosing} onClick={() => void install()}><FolderPlus size={16}/>{choosing ? 'Selecionando…' : 'Adicionar extensão'}</button>
    </section>

    <div className="extension-limit-note"><AlertTriangle size={16}/><span>O Electron não aceita pacotes .crx nem instalação direta pela Chrome Web Store e oferece apenas parte das APIs de extensões do Chrome. Abas privadas, Tor e I2P não carregam extensões.</span></div>

    {extensions.length ? <div className="extension-card-list">{extensions.map(extension => <article className={`extension-card ${extension.error ? 'has-error' : ''}`} key={extension.id}>
      <span className="extension-card-icon"><Puzzle size={19}/></span>
      <div className="extension-card-copy"><div className="extension-card-title"><strong>{extension.name}</strong><span className={`extension-state ${extension.error ? 'error' : extension.enabled ? 'enabled' : ''}`}>{extension.error ? 'Não carregada' : extension.enabled ? 'Ativada' : 'Desativada'}</span></div><small>Versão {extension.version || '—'} · {extension.id}</small>{extension.error && <p className="extension-error-copy">{extension.error}</p>}</div>
      <button type="button" className={`extension-toggle ${extension.enabled && !extension.error ? 'active' : ''}`} aria-pressed={extension.enabled && !extension.error} title={extension.enabled && !extension.error ? 'Desativar extensão' : 'Ativar extensão'} onClick={() => void command('extension:toggle', { id: extension.id, enabled: !extension.enabled || !!extension.error })}>{extension.enabled && !extension.error ? <ToggleRight size={21}/> : <ToggleLeft size={21}/>}<span>{extension.enabled && !extension.error ? 'Desativar' : 'Ativar'}</span></button>
      <button type="button" className="icon-button extension-remove" title="Remover extensão" aria-label={`Remover ${extension.name}`} onClick={() => void command('extension:remove', extension.id)}><Trash2 size={16}/></button>
    </article>)}</div> : <div className="extension-empty"><span><Puzzle size={24}/></span><h3>Nenhuma extensão instalada</h3><p>Adicione uma pasta de extensão descompactada para experimentar ferramentas compatíveis com o Chromium.</p><button className="button secondary" disabled={choosing} onClick={() => void install()}><FolderPlus size={15}/> Escolher pasta</button></div>}

    <div className="extension-manager-footer"><Check size={14}/><span>Extensões ficam no seu computador. O Cypher não envia suas pastas para um servidor.</span></div>
  </div>;
}
