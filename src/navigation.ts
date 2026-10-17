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
} as const;

export type InternalPage = typeof browserPages[keyof typeof browserPages];

export const settingsSections = [
  'appearance', 'tabs', 'home', 'search', 'languages', 'privacy', 'connections',
  'downloads', 'accessibility', 'startup', 'system', 'updates', 'shortcuts', 'mods', 'profile',
] as const;

export type SettingsSection = typeof settingsSections[number];

const validPages = new Set<string>(Object.values(browserPages));

export function internalPageFromUrl(value: string | undefined): InternalPage | null {
  if (!value?.startsWith('cypher://')) return null;
  const page = value.slice('cypher://'.length).split(/[/?#]/, 1)[0];
  return validPages.has(page) ? page as InternalPage : null;
}
