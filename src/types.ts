import type { HomeConfig } from '../electron/home-layout.mjs';
export type ConnectionMode = 'normal' | 'tor' | 'i2p';
export interface Settings {
  home: HomeConfig;
  tabPosition: 'side' | 'top'; sidebarWidth: number; appearanceMode: 'dark' | 'light'; accent: string; surface: string; background: string;
  radius: number; font: 'system' | 'mono'; wallpaper: 'orbital' | 'grid' | 'none' | 'custom'; wallpaperImageData: string;
  buttonShape: 'soft' | 'square' | 'pill'; interfaceEffect: 'signal' | 'glow' | 'scanline' | 'none';
  soundEffectsEnabled: boolean; soundTheme: 'cypher' | 'soft' | 'arcade';
  backgroundMusicData: string; backgroundMusicName: string; backgroundMusicEnabled: boolean; motion: boolean;
  compact: boolean; searchEngine: 'duckduckgo' | 'google' | 'bing' | 'custom'; customSearchUrl: string; activeMod: string;
  connectionMode: ConnectionMode; torSocksPort: number; i2pHttpPort: number; profilePhoto: string;
  restoreSession: boolean; startupMode: 'home' | 'restore' | 'specific'; startupPages: string[]; showHomeFirst: boolean;
  openLinksInNewTab: boolean; showSearchSuggestions: boolean; sendDoNotTrack: boolean;
  blockAds: boolean; blockTrackers: boolean; blockThirdPartyCookies: boolean;
  preferredLanguages: string[]; spellCheckEnabled: boolean; spellCheckLanguages: string[]; translationEnabled: boolean;
  hardwareAcceleration: boolean; webrtcPolicy: 'default' | 'default_public_and_private_interfaces' | 'default_public_interface_only' | 'disable_non_proxied_udp';
  showBookmarksBar: boolean; suggestBookmarks: boolean; suggestHistory: boolean;
  clearDataOnExit: boolean; clearHistoryOnExit: boolean; confirmCloseWithMultipleTabs: boolean;
  defaultZoom: number; downloadDirectory: string; startWithWindows: boolean;
}
export interface Tab { id: string; title: string; url: string; private: boolean; connectionMode: ConnectionMode; pinned: boolean; muted: boolean; audible: boolean; loading: boolean; canGoBack: boolean; canGoForward: boolean; zoom: number; error: string | null }
export interface Link { id: string; title: string; url: string; date: number }
export interface Download { id: string; name: string; url: string; total: number; received: number; state: string; date: number; path: string; private: boolean }
export interface BrowserExtension { id: string; name: string; version: string; enabled: boolean; source?: 'chrome-web-store' | 'local'; error?: string }
export interface SitePermission { id: string; origin: string; permission: string; allowed: boolean; updated: number }
export interface Mod { id: string; name: string; author: string; description: string; settings: Settings; custom?: boolean }
export interface FocusTimerData { endsAt: number | null; remaining: number; duration: number }
export interface HomeTask { id: string; title: string; done: boolean }
export interface HomeData { notes: Record<string,string>; focus: FocusTimerData; focusById?: Record<string,FocusTimerData>; tasksById?: Record<string,HomeTask[]> }
export interface UpdateStatus { state: 'unconfigured' | 'unsupported' | 'idle' | 'checking' | 'up-to-date' | 'available' | 'dismissed' | 'downloading' | 'restarting' | 'complete' | 'error'; currentVersion: string; version: string; progress: number; message: string; releaseNotes: string; repository: string }
export interface TrackerProtectionStatus { available: boolean; name: string; source: string; lastModified: string; fetchedAt?: string; networkRuleCount: number; blockedRequests: number; error?: string }
export interface BrowserState { tabs: Tab[]; activeId: string; settings: Settings; bookmarks: Link[]; history: Link[]; downloads: Download[]; extensions: BrowserExtension[]; sitePermissions: SitePermission[]; mods: Mod[]; maximized: boolean; hardwareAccelerationPending: boolean; homeData: HomeData; update: UpdateStatus; trackerProtection: TrackerProtectionStatus }
declare global {
  interface Window { cypher: { invoke: (action: string, payload?: unknown) => Promise<any>; onState: (callback: (state: BrowserState) => void) => () => void; onShortcut: (callback: (action: string) => void) => () => void } }
}
