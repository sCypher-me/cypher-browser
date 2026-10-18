import type { BrowserExtension, BrowserProfile, ConnectionMode, DailyPrivacyStats, ProfileSyncStatus, Settings, SitePermission, SkinPackage, Tab, TrackerProtectionStatus, UpdateStatus } from '../types';
import type { InternalPage, LegacySection, SettingsSection } from '../navigation';

export type Command = (action: string, payload?: unknown) => Promise<any>;

/** Tudo o que as seções da Central recebem do navegador. */
export type CentralProps = {
  settings: Settings;
  update: UpdateStatus;
  trackerProtection: TrackerProtectionStatus;
  profileSync?: ProfileSyncStatus;
  tabs: Tab[];
  activeTabId: string;
  hardwareAccelerationPending: boolean;
  skins?: SkinPackage[];
  privacyStats?: Record<string, DailyPrivacyStats>;
  sitePermissions: SitePermission[];
  profiles: BrowserProfile[];
  profileId: string;
  extensions: BrowserExtension[];
  connectionMode: ConnectionMode;
  onSettings: (patch: Partial<Settings>) => void;
  command: Command;
  navigate: (page: InternalPage, options?: { category?: SettingsSection | LegacySection; focusId?: string }) => void;
  onChooseProfilePhoto: () => void;
};

export type SectionProps = CentralProps & {
  /** Troca de seção e, opcionalmente, rola até um bloco ou linha. */
  goSection: (section: SettingsSection, focusId?: string) => void;
};
