import { useState } from 'react';
import { Check, Plus, Shield, UserRound } from 'lucide-react';
import type { BrowserProfile } from './types';

export default function ProfileManager({ profiles, profileId, command }: { profiles:BrowserProfile[]; profileId:string; command:(action:string,payload?:unknown)=>Promise<any> }) {
  const [name,setName] = useState('');
  const [busy,setBusy] = useState(false);
  async function create(event:React.FormEvent) {
    event.preventDefault(); if (!name.trim() || busy) return;
    setBusy(true);
    const created = await command('profile:create',{name:name.trim()});
    setName('');
    const list = Array.isArray(created) ? created : [];
    const target = list.find((item:BrowserProfile) => !profiles.some(existing => existing.id === item.id));
    if (target) await command('profile:switch',target.id);
    setBusy(false);
  }
  return <section className="profile-manager settings-card wide-card">
    <header className="productivity-section-heading"><div className="productivity-section-icon"><UserRound size={19}/></div><div><span className="eyebrow">IDENTIDADES LOCAIS</span><h2>Perfis do navegador</h2><p>Cada perfil mantém configurações, favoritos, histórico, senhas e sessões de sites em arquivos e partições separados neste dispositivo.</p></div></header>
    <div className="profile-manager-list">{profiles.map(profile => <article className={`profile-manager-item ${profile.id === profileId ? 'is-active' : ''}`} key={profile.id}><div className="profile-manager-avatar"><UserRound size={19}/></div><div><strong>{profile.name}</strong><small>{profile.id === profileId ? 'Perfil atual' : 'Dados isolados neste dispositivo'}</small></div>{profile.id === profileId ? <span className="workspace-active"><Check size={14}/> Em uso</span> : <button className="productivity-button subtle" disabled={busy} onClick={() => { setBusy(true); void command('profile:switch',profile.id).finally(() => setBusy(false)); }}>Trocar perfil</button>}</article>)}</div>
    <form className="workspace-create" onSubmit={event => void create(event)}><input aria-label="Nome do novo perfil" value={name} onChange={event => setName(event.target.value)} placeholder="Nome do novo perfil" maxLength={48}/><button className="productivity-button primary" disabled={busy || !name.trim()}><Plus size={15}/> Criar e trocar</button></form>
    <div className="profile-guest"><Shield size={17}/><span><strong>Navegação de visitante</strong><small>Abre uma sessão temporária sem histórico, cookies ou senhas persistentes.</small></span><button className="productivity-button subtle" onClick={() => void command('tab:new',{private:true,connectionMode:'normal'})}>Abrir visitante</button></div>
  </section>;
}
