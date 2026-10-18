import { ImagePlus, UserRound } from 'lucide-react';
import { Block, Panel } from '../settings-ui';
import ProfileManager from '../ProfileManager';
import ProfileSyncPanel from '../ProfileSyncPanel';
import type { SectionProps } from './types';

export default function Profile({ settings: s, onSettings, profiles, profileId, profileSync, command, onChooseProfilePhoto }: SectionProps) {
  const name = profiles.find(profile => profile.id === profileId)?.name || 'Pessoal';
  return <>
    <Panel id="profile-local" eyebrow="PERFIL ATIVO" title={name} detail="Preferências, favoritos, histórico, senhas e sessões ficam separados por perfil neste dispositivo." icon={UserRound} wide>
      <div className="sc-identity">
        <span className="sc-identity-photo">{s.profilePhoto ? <img src={s.profilePhoto} alt="Foto do perfil"/> : <UserRound size={34}/>}</span>
        <div className="sc-action-row">
          <button className="sc-button sc-button-primary" onClick={onChooseProfilePhoto}><ImagePlus size={14}/>{s.profilePhoto ? 'Trocar foto' : 'Escolher foto'}</button>
          {s.profilePhoto && <button className="sc-button sc-button-subtle" onClick={() => onSettings({ profilePhoto: '' })}>Remover foto</button>}
        </div>
      </div>
    </Panel>
    <Block id="profile-manager" title="Perfis e visitante" wide><ProfileManager profiles={profiles} profileId={profileId} command={command}/></Block>
    <Block id="profile-sync" title="Sincronização" wide><ProfileSyncPanel sync={profileSync} command={command}/></Block>
  </>;
}
