export const browserPages = {
  home: 'newtab',
  bookmarks: 'bookmarks',
  history: 'history',
  downloads: 'downloads',
  extensions: 'extensions',
  mods: 'mods',
  security: 'security',
  settings: 'settings',
  profile: 'profile',
  productivity: 'productivity',
} as const;

export type InternalPage = typeof browserPages[keyof typeof browserPages];

export const settingsSections = ['overview', 'appearance', 'browsing', 'privacy', 'profile', 'extensions', 'system'] as const;

export type SettingsSection = typeof settingsSections[number];

/** Seções da versão anterior das Configurações, para links e atalhos antigos. */
export type LegacySection = 'tabs' | 'home' | 'mods' | 'startup' | 'search' | 'languages' | 'downloads' | 'shortcuts' | 'connections' | 'accessibility' | 'updates';

const legacySections: Record<LegacySection, SettingsSection> = {
  tabs: 'appearance', home: 'appearance', mods: 'appearance',
  startup: 'browsing', search: 'browsing', languages: 'browsing', downloads: 'browsing', shortcuts: 'browsing',
  connections: 'privacy', accessibility: 'system', updates: 'system',
};

export function sectionFor(value: string | undefined): SettingsSection {
  if ((settingsSections as readonly string[]).includes(value || '')) return value as SettingsSection;
  return legacySections[value as LegacySection] || 'overview';
}

/** Páginas que hoje moram dentro da Central de Configurações. */
export const centralAlias: Partial<Record<InternalPage, SettingsSection>> = { security: 'privacy', profile: 'profile', extensions: 'extensions' };

const validPages = new Set<string>(Object.values(browserPages));

export function internalPageFromUrl(value: string | undefined): InternalPage | null {
  if (!value?.startsWith('cypher://')) return null;
  const page = value.slice('cypher://'.length).split(/[/?#]/, 1)[0];
  return validPages.has(page) ? page as InternalPage : null;
}
