import { useEffect, useState, type FormEvent } from 'react';
import { Cloud, LockKeyhole, RefreshCw, Unplug } from 'lucide-react';
import type { ProfileSyncStatus } from './types';

type Props = { sync?: ProfileSyncStatus; command: (action: string, payload?: unknown) => Promise<any> };

export default function ProfileSyncPanel({ sync, command }: Props) {
  const [endpoint, setEndpoint] = useState(sync?.endpoint || '');
  const [username, setUsername] = useState(sync?.username || '');
  const [password, setPassword] = useState('');
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => { setEndpoint(sync?.endpoint || ''); setUsername(sync?.username || ''); }, [sync?.endpoint, sync?.username]);

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setWorking(true); setNotice('');
    try {
      const result = await command('profile:sync:configure', { endpoint, username, password });
      if (result?.configured) setNotice('Perfil conectado e sincronizado.');
      setPassword('');
    } finally { setWorking(false); }
  }

  async function synchronize() {
    setWorking(true); setNotice('');
    try { const result = await command('profile:sync:run'); if (result?.lastSync) setNotice('Sincronização concluída.'); }
    finally { setWorking(false); }
  }

  async function disconnect() {
    setWorking(true); setNotice('');
    try { await command('profile:sync:disconnect'); setPassword(''); setNotice('Sincronização desconectada neste dispositivo.'); }
    finally { setWorking(false); }
  }

  return <section className="settings-card profile-sync-panel">
    <div className="profile-sync-heading"><span><Cloud size={19}/></span><div><strong>Sincronização de perfil</strong><p>Sincronize favoritos, histórico, preferências e Home entre seus dispositivos por WebDAV.</p></div><small className={sync?.configured ? 'connected' : ''}><i/>{sync?.syncing ? 'Sincronizando' : sync?.configured ? 'Conectado' : 'Desconectado'}</small></div>
    <form className="profile-sync-form" onSubmit={event => void connect(event)}>
      <label><span>URL HTTPS do arquivo WebDAV</span><input type="url" required value={endpoint} onChange={event => setEndpoint(event.target.value)} placeholder="https://servidor.example/dav/cypher-profile.json" autoComplete="url"/></label>
      <div className="profile-sync-credentials"><label><span>Usuário</span><input required value={username} onChange={event => setUsername(event.target.value)} autoComplete="username"/></label><label><span>Senha {sync?.configured && '· deixe em branco para manter'}</span><input type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required={!sync?.configured}/></label></div>
      <div className="profile-sync-actions"><button type="submit" className="button primary" disabled={working}><LockKeyhole size={14}/>{sync?.configured ? 'Salvar e sincronizar' : 'Conectar e sincronizar'}</button>{sync?.configured && <><button type="button" className="button secondary" onClick={() => void synchronize()} disabled={working}><RefreshCw size={14} className={sync.syncing ? 'spinning' : ''}/>Sincronizar agora</button><button type="button" className="button secondary" onClick={() => void disconnect()} disabled={working}><Unplug size={14}/>Desconectar</button></>}</div>
    </form>
    {sync?.lastSync ? <p className="profile-sync-meta">Última sincronização: {new Date(sync.lastSync).toLocaleString('pt-BR')}</p> : null}
    {sync?.error && <p className="profile-sync-error">{sync.error}</p>}
    {notice && <p className="profile-sync-notice">{notice}</p>}
    <p className="profile-sync-footnote">O Cypher não hospeda uma nuvem própria: use um servidor WebDAV HTTPS seu e de confiança. A senha de acesso fica criptografada pelo Windows neste dispositivo. O arquivo sincronizado contém preferências, Home, favoritos e histórico em JSON; o administrador do servidor pode ler esses dados. Senhas de sites, sessões privadas, extensões e arquivos baixados não são enviados.</p>
  </section>;
}
