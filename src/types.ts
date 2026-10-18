import type { HomeConfig } from '../electron/home-layout.mjs';
export type ConnectionMode = 'normal' | 'tor' | 'i2p';
export interface Settings {
  home: HomeConfig; skin: 'recorte' | 'classic';
  tabPosition: 'side' | 'top'; sidebarWidth: number; appearanceMode: 'dark' | 'light'; accent: string; surface: string; background: string;
  radius: number; font: 'system' | 'mono'; interfaceTextScale: number; wallpaper: 'orbital' | 'grid' | 'none' | 'custom' | 'video'; wallpaperImageData: string; wallpaperVideoPath?: string; wallpaperVideoName?: string;
  buttonShape: 'soft' | 'square' | 'pill'; interfaceEffect: 'signal' | 'glow' | 'scanline' | 'none';
  soundEffectsEnabled: boolean; soundTheme: 'cypher' | 'soft' | 'arcade';
  backgroundMusicData: string; backgroundMusicName: string; backgroundMusicEnabled: boolean; motion: boolean;
  compact: boolean; searchEngine: 'duckduckgo' | 'google' | 'bing' | 'custom'; customSearchUrl: string; activeMod: string;
  connectionMode: ConnectionMode; torSocksPort: number; i2pHttpPort: number; profilePhoto: string;
  restoreSession: boolean; startupMode: 'home' | 'restore' | 'specific'; startupPages: string[]; showHomeFirst: boolean;
  openLinksInNewTab: boolean; showSearchSuggestions: boolean; sendDoNotTrack: boolean;
  blockAds: boolean; blockTrackers: boolean; blockThirdPartyCookies: boolean;
  blockPopups: boolean; popupExceptions: string[];
  passwordAutofillEnabled: boolean; trackingExceptions: string[];
  preferredLanguages: string[]; spellCheckEnabled: boolean; spellCheckLanguages: string[]; translationEnabled: boolean;
  hardwareAcceleration: boolean; webrtcPolicy: 'default' | 'default_public_and_private_interfaces' | 'default_public_interface_only' | 'disable_non_proxied_udp';
  showBookmarksBar: boolean; suggestBookmarks: boolean; suggestHistory: boolean;
  clearDataOnExit: boolean; clearHistoryOnExit: boolean; confirmCloseWithMultipleTabs: boolean;
  memorySaverEnabled: boolean; memorySaverMinutes: number;
  defaultZoom: number; downloadDirectory: string; startWithWindows: boolean;
}
export interface Tab { id: string; title: string; url: string; private: boolean; connectionMode: ConnectionMode; pinned: boolean; muted: boolean; audible: boolean; loading: boolean; canGoBack: boolean; canGoForward: boolean; zoom: number; error: string | null; workspaceId?: string; group?: string; suspended?: boolean; lastExternalUrl?: string; lastExternalTitle?: string }
export interface NowPlaying { tabId: string; tabTitle: string; pageUrl: string; title: string; artist: string; album: string; artwork: string; currentTime: number; duration: number; playing: boolean }
export interface Link { id: string; title: string; url: string; date: number }
export interface Download { id: string; name: string; url: string; total: number; received: number; state: string; date: number; path: string; private: boolean }
export interface BrowserExtension { id: string; name: string; version: string; enabled: boolean; source?: 'chrome-web-store' | 'cypher-package' | 'local'; packageId?: string; error?: string }
export interface SitePermission { id: string; origin: string; permission: string; allowed: boolean; updated: number }
export interface Mod { id: string; name: string; author: string; description: string; settings: Settings; custom?: boolean }
export interface FocusTimerData { endsAt: number | null; remaining: number; duration: number }
export interface HomeTask { id: string; title: string; done: boolean }
export interface HomeData { notes: Record<string,string>; focus: FocusTimerData; focusById?: Record<string,FocusTimerData>; tasksById?: Record<string,HomeTask[]> }
export interface UpdateStatus { state: 'unconfigured' | 'unsupported' | 'idle' | 'checking' | 'up-to-date' | 'available' | 'dismissed' | 'downloading' | 'restarting' | 'complete' | 'error'; currentVersion: string; version: string; progress: number; message: string; releaseNotes: string; repository: string }
export interface TrackerProtectionStatus { available: boolean; adsAvailable: boolean; name: string; source: string; lastModified: string; fetchedAt?: string; networkRuleCount: number; adRuleCount: number; blockedRequests: number; blockedAds: number; blockedTrackers?: number; bySite?: Record<string, SiteProtectionCounts>; error?: string }
export interface PopupRequest { id: string; tabId: string; openerTitle: string; openerHost: string; url: string; count: number; date: number; canOpen: boolean; formPost: boolean; private: boolean; connectionMode: ConnectionMode }
export interface PopupProtectionStatus { blockedCount: number; pending: PopupRequest[] }
export interface Workspace { id: string; name: string; color: string; tabs: Array<{ url: string; title: string; pinned?: boolean; group?: string }> }
export interface ResearchItem { id: string; url: string; title: string; note: string; tags: string[]; savedAt: number; read: boolean }
export interface BrowserProfile { id: string; name: string; active: boolean }
export interface SiteProtectionCounts { blockedRequests: number; blockedAds: number; blockedTrackers: number }
export interface SavedPassword { id: string; origin: string; username: string; updated: number }
export interface ProfileSyncStatus { configured: boolean; endpoint: string; username: string; syncing: boolean; lastSync: number; error: string }
export interface BrowserState { tabs: Tab[]; activeId: string; settings: Settings; bookmarks: Link[]; history: Link[]; downloads: Download[]; extensions: BrowserExtension[]; sitePermissions: SitePermission[]; mods: Mod[]; workspaces: Workspace[]; activeWorkspaceId: string; researchItems: ResearchItem[]; profiles: BrowserProfile[]; profileId: string; maximized: boolean; hardwareAccelerationPending: boolean; homeData: HomeData; update: UpdateStatus; trackerProtection: TrackerProtectionStatus; popupProtection: PopupProtectionStatus; nowPlaying?: NowPlaying | null; profileSync?: ProfileSyncStatus }
declare global {
  interface Window { cypher: { invoke: (action: string, payload?: unknown) => Promise<any>; onState: (callback: (state: BrowserState) => void) => () => void; onShortcut: (callback: (action: string) => void) => () => void; onFindResult?: (callback: (result: { matches: number; active: number }) => void) => () => void } }
}
