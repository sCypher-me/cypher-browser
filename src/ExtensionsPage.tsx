import { useState, type FormEvent } from 'react';
import { AlertTriangle, Check, FolderPlus, Puzzle, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import type { BrowserExtension } from './types';

type Props = { extensions: BrowserExtension[]; command: (action: string, payload?: unknown) => Promise<any> };

export default function ExtensionsPage({ extensions, command }: Props) {
  const [choosing, setChoosing] = useState(false);
  const [storeUrl, setStoreUrl] = useState('');
  const [installingStore, setInstallingStore] = useState(false);
  const install = async () => {
    setChoosing(true);
    try { await command('extension:install'); } finally { setChoosing(false); }
  };
  const installFromStore = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!storeUrl.trim()) return;
    setInstallingStore(true);
    try { await command('extension:install-webstore',storeUrl.trim()); setStoreUrl(''); }
    finally { setInstallingStore(false); }
  };

  return <div className="extension-manager">
    <section className="settings-card extension-manager-hero">
      <span className="extension-manager-mark"><Puzzle size={23}/></span>
      <div className="extension-manager-intro"><span className="eyebrow">CYPHER / PERSONALIZE A NAVEGAÇÃO</span><h2>Suas extensões</h2><p>Abra a Chrome Web Store e clique em instalar: o Cypher identifica a extensão, valida o pacote e pede confirmação das permissões. Você também pode colar um link ou carregar uma pasta local.</p></div>
      <button className="button secondary" disabled={choosing} onClick={() => void install()}><FolderPlus size={16}/>{choosing ? 'Selecionando…' : 'Adicionar pasta local'}</button>
    </section>

    <form className="extension-store-install" onSubmit={event => void installFromStore(event)}>
      <div><span className="eyebrow">CHROME WEB STORE</span><strong>Adicionar pelo endereço da extensão</strong><small>Cole o link da página da extensão. O Cypher valida o pacote assinado antes de instalar.</small></div>
      <label><Puzzle size={16}/><input aria-label="Endereço da extensão na Chrome Web Store" type="url" required value={storeUrl} onChange={event => setStoreUrl(event.target.value)} placeholder="https://chromewebstore.google.com/detail/nome/identificador"/><button type="submit" className="button primary" disabled={installingStore}>{installingStore ? 'Verificando…' : 'Instalar extensão'}</button></label>
    </form>

    <div className="extension-limit-note"><AlertTriangle size={16}/><span>As APIs de extensões no Chromium do Electron são parciais; algumas extensões da loja não funcionarão. Extensões só carregam no perfil normal persistente, não em abas privadas, Tor ou I2P. Extensões instaladas têm acesso de acordo com as permissões aprovadas.</span></div>

    {extensions.length ? <div className="extension-card-list">{extensions.map(extension => <article className={`extension-card ${extension.error ? 'has-error' : ''}`} key={extension.id}>
      <span className="extension-card-icon"><Puzzle size={19}/></span>
      <div className="extension-card-copy"><div className="extension-card-title"><strong>{extension.name}</strong><span className={`extension-state ${extension.error ? 'error' : extension.enabled ? 'enabled' : ''}`}>{extension.error ? 'Não carregada' : extension.enabled ? 'Ativada' : 'Desativada'}</span></div><small>Versão {extension.version || '—'} · {extension.id} · {extension.source === 'chrome-web-store' ? 'Chrome Web Store' : 'Pasta local'}</small>{extension.error && <p className="extension-error-copy">{extension.error}</p>}</div>
      <button type="button" className={`extension-toggle ${extension.enabled && !extension.error ? 'active' : ''}`} aria-pressed={extension.enabled && !extension.error} title={extension.enabled && !extension.error ? 'Desativar extensão' : 'Ativar extensão'} onClick={() => void command('extension:toggle', { id: extension.id, enabled: !extension.enabled || !!extension.error })}>{extension.enabled && !extension.error ? <ToggleRight size={21}/> : <ToggleLeft size={21}/>}<span>{extension.enabled && !extension.error ? 'Desativar' : 'Ativar'}</span></button>
      <button type="button" className="icon-button extension-remove" title="Remover extensão" aria-label={`Remover ${extension.name}`} onClick={() => void command('extension:remove', extension.id)}><Trash2 size={16}/></button>
    </article>)}</div> : <div className="extension-empty"><span><Puzzle size={24}/></span><h3>Nenhuma extensão instalada</h3><p>Adicione uma pasta de extensão descompactada para experimentar ferramentas compatíveis com o Chromium.</p><button className="button secondary" disabled={choosing} onClick={() => void install()}><FolderPlus size={15}/> Escolher pasta</button></div>}

    <div className="extension-manager-footer"><Check size={14}/><span>O pacote da loja é baixado pela rota de conexão ativa, sua assinatura é validada e os arquivos instalados ficam no computador.</span></div>
  </div>;
}
