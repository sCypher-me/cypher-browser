import type { HomeConfig } from '../electron/home-layout.mjs';
export type ConnectionMode = 'normal' | 'tor' | 'i2p';
export interface Settings {
  home: HomeConfig; skin: 'recorte' | 'classic';
  tokens: DesignTokens; toolbarOrder: ToolbarItem[]; toolbarHidden: ToolbarItem[]; toolbarPosition: 'top' | 'bottom';
  tabsAutoHide: boolean; showRail: boolean; workspaceAccent: boolean; customCss: string; skinPackage: string;
  shortcuts: Partial<Record<ShortcutAction, string>>; routeRules: RouteRule[]; containers: TabContainer[]; blockCookieBanners: boolean; webPanels: WebPanel[]; panelWidth: number;
  updateChannel?: 'stable' | 'preview'; modSoundsEnabled: boolean; modSoundsVolume: number; modMusicEnabled: boolean; modMusicVolume: number; modPageEffects: boolean; sendErrorReports: boolean;
  tabPosition: 'side' | 'top'; sidebarWidth: number; appearanceMode: 'dark' | 'light' | 'system'; accent: string; surface: string; background: string;
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
  passwordAutofillEnabled: boolean; passwordSavePrompt: boolean; passwordLeakCheck: boolean; httpsMode: 'upgrade' | 'strict' | 'off'; safeBrowsing: boolean; autoPictureInPicture: boolean; fingerprintProtection: boolean; archiveTabsHours: number; linkPreview: boolean; quickWindowShortcut: boolean; limitCpu: boolean; cpuLimitPercent: number; limitMemory: boolean; memoryLimitMb: number; limitBandwidth: boolean; bandwidthMbps: number; trackingExceptions: string[];
  preferredLanguages: string[]; spellCheckEnabled: boolean; spellCheckLanguages: string[]; translationEnabled: boolean;
  hardwareAcceleration: boolean; webrtcPolicy: 'default' | 'default_public_and_private_interfaces' | 'default_public_interface_only' | 'disable_non_proxied_udp';
  showBookmarksBar: boolean; suggestBookmarks: boolean; suggestHistory: boolean;
  clearDataOnExit: boolean; clearHistoryOnExit: boolean; confirmCloseWithMultipleTabs: boolean;
  memorySaverEnabled: boolean; memorySaverMinutes: number;
  defaultZoom: number; downloadDirectory: string; startWithWindows: boolean;
}
export interface DesignTokens { cut: number; density: number; barHeight: number; borderWidth: number; displayFont: 'big-shoulders' | 'work-sans' | 'system' | 'serif' | 'mono'; bodyFont: 'work-sans' | 'system' | 'serif' | 'mono' }
export type ToolbarItem = 'navigation' | 'address' | 'routes' | 'skin' | 'media' | 'customize' | 'menu';
export type ShortcutAction = 'tab:new' | 'tab:private' | 'tab:close' | 'tab:restore' | 'tab:next' | 'tab:previous' | 'palette' | 'inspector' | 'address' | 'find' | 'bookmark' | 'history' | 'downloads' | 'reload' | 'reader' | 'capture' | 'split' | 'print' | 'save' | 'fullscreen' | 'zoom:in' | 'zoom:out' | 'zoom:reset' | 'devtools';
export interface RouteRule { host: string; mode: 'tor' | 'i2p' }
export interface TabContainer { id: string; name: string; color: string }
export interface WebPanel { id: string; url: string; title: string }
export interface SkinPackage { id: string; name: string; author: string; description: string; base: 'recorte' | 'classic'; css: string; tokens: DesignTokens }
export interface DailyPrivacyStats { ads: number; trackers: number; requests: number; normal: number; tor: number; i2p: number }
export type ModComponent = 'theme' | 'wallpaper' | 'sounds' | 'music' | 'pageStyles' | 'shader' | 'fonts' | 'interfaceCss';
export interface ModPackageInfo { id: string; source: 'builtin' | 'catalog' | 'file'; enabled: boolean; toggles: Record<ModComponent, boolean>; installedAt: number; name: string; version: string; author: string; description: string; tags: string[]; components: ModComponent[]; preview: string; shader: string }
export interface CatalogMod { community?: boolean; id: string; name: string; version: string; author: string; description: string; tags: string[]; components: ModComponent[]; preview: string; source: 'builtin' | 'catalog'; size?: number }
export interface ModEffects { wallpaper: { url: string; type: 'image' | 'video'; dim: number; modId: string } | null; sounds: { volume: number; files: Partial<Record<'click' | 'hover' | 'tabOpen' | 'tabClose' | 'typing' | 'navigate', string>> } | null; music: { base: string; active: string; volume: number; modId: string } | null; shader: { preset: string; intensity: number } | null; fonts: Partial<Record<'display' | 'body', { family: string; url: string }>>; interfaceCss: string }
export interface SplitView { left: string; right: string; ratio: number }
export interface Tab { id: string; containerId?: string; title: string; url: string; private: boolean; connectionMode: ConnectionMode; pinned: boolean; muted: boolean; audible: boolean; loading: boolean; canGoBack: boolean; canGoForward: boolean; zoom: number; error: string | null; errorInfo?: TabErrorInfo | null; certificateWarning?: boolean; volume?: number; pictureInPicture?: boolean; limited?: boolean; mediaPlaying?: boolean; workspaceId?: string; group?: string; suspended?: boolean; lastExternalUrl?: string; lastExternalTitle?: string }
export interface NowPlaying { tabId: string; tabTitle: string; pageUrl: string; title: string; artist: string; album: string; artwork: string; currentTime: number; duration: number; playing: boolean }
export interface Link { id: string; title: string; url: string; date: number }
export interface Download { id: string; name: string; url: string; total: number; received: number; state: string; date: number; path: string; private: boolean }
export interface BrowserExtension { id: string; name: string; version: string; enabled: boolean; source?: 'chrome-web-store' | 'cypher-package' | 'local'; packageId?: string; error?: string }
export interface SitePermission { id: string; origin: string; permission: string; allowed: boolean; updated: number }
export interface Mod { id: string; name: string; author: string; description: string; settings: Settings; custom?: boolean }
export interface FocusTimerData { endsAt: number | null; remaining: number; duration: number }
export interface HomeTask { id: string; title: string; done: boolean }
export interface HomeData { notes: Record<string,string>; focus: FocusTimerData; focusById?: Record<string,FocusTimerData>; tasksById?: Record<string,HomeTask[]> }
export type UpdateNoteKind = 'new' | 'improved' | 'fixed';
export type UpdateIllustration = '' | 'preview' | 'atualizacao' | 'privacidade' | 'configuracoes' | 'abas' | 'mods' | 'instalador' | 'generico';
export interface UpdateNote { kind: UpdateNoteKind; title: string; body: string; highlight: boolean; illustration: UpdateIllustration }
export interface UpdateStatus { downloadUrl?: string; state: 'unconfigured' | 'unsupported' | 'idle' | 'available' | 'checking' | 'up-to-date' | 'downloading' | 'ready' | 'installing' | 'restarting' | 'error'; currentVersion: string; version: string; progress: number; message: string; releaseNotes: string; repository: string; notes?: UpdateNote[]; channel?: 'stable' | 'preview'; minimumVersion?: string; blocked?: boolean; lastChecked?: number }
export interface ChangelogVersion { version: string; date: string; items: UpdateNote[] }
export interface UpdateOnboardingState { from: string; to: string; versions: ChangelogVersion[] }
export interface TrackerProtectionStatus { available: boolean; adsAvailable: boolean; name: string; source: string; lastModified: string; fetchedAt?: string; networkRuleCount: number; adRuleCount: number; blockedRequests: number; blockedAds: number; blockedTrackers?: number; bySite?: Record<string, SiteProtectionCounts>; error?: string }
export interface PopupRequest { id: string; tabId: string; openerTitle: string; openerHost: string; url: string; count: number; date: number; canOpen: boolean; formPost: boolean; private: boolean; connectionMode: ConnectionMode }
export interface PopupProtectionStatus { blockedCount: number; pending: PopupRequest[] }
export interface Workspace { id: string; name: string; color: string; tabs: Array<{ url: string; title: string; pinned?: boolean; group?: string }> }
export interface ResearchItem { id: string; url: string; title: string; note: string; tags: string[]; savedAt: number; read: boolean }
export interface BrowserProfile { id: string; name: string; active: boolean }
export interface SiteProtectionCounts { blockedRequests: number; blockedAds: number; blockedTrackers: number }
export interface SavedPassword { id: string; origin: string; username: string; updated: number; leaked: number; reused: boolean; checkedAt: number }
export interface ProfileSyncStatus { configured: boolean; endpoint: string; username: string; syncing: boolean; lastSync: number; error: string }
export interface BrowserState { extensionPartition?: string; archivedTabs?: ArchivedTab[]; linkPreview?: LinkPreviewState | null; quick?: QuickState; siteSettings?: Record<string, SiteSetting>; sessions?: SavedSession[]; crashRecovery?: { count: number; startedAt: number } | null; passwordPrompt?: PasswordPrompt | null; safeBrowsing?: SafeBrowsingStatus; drm?: DrmStatus; tabs: Tab[]; activeId: string; settings: Settings; bookmarks: Link[]; history: Link[]; downloads: Download[]; extensions: BrowserExtension[]; sitePermissions: SitePermission[]; mods: Mod[]; workspaces: Workspace[]; activeWorkspaceId: string; researchItems: ResearchItem[]; profiles: BrowserProfile[]; profileId: string; maximized: boolean; hardwareAccelerationPending: boolean; homeData: HomeData; update: UpdateStatus; trackerProtection: TrackerProtectionStatus; popupProtection: PopupProtectionStatus; nowPlaying?: NowPlaying | null; profileSync?: ProfileSyncStatus; skins?: SkinPackage[]; privacyStats?: Record<string, DailyPrivacyStats>; split?: SplitView | null; openPanelId?: string; systemDark?: boolean; modPackages?: ModPackageInfo[]; modEffects?: ModEffects; onboarding?: UpdateOnboardingState | null }
/** Imagem de uma página nativa, mostrada sob menus e popovers enquanto ela fica escondida. */
export interface PageSnapshot { x: number; y: number; width: number; height: number; dataUrl: string }
declare global {
  interface Window { cypher: { invoke: (action: string, payload?: unknown) => Promise<any>; onState: (callback: (state: BrowserState) => void) => () => void; onShortcut: (callback: (action: string) => void) => () => void; onFindResult?: (callback: (result: { matches: number; active: number }) => void) => () => void; onPageSnapshot?: (callback: (shots: PageSnapshot[]) => void) => () => void } }
}

export type TabErrorKind = 'dangerous' | 'certificate' | 'https' | 'ssl' | 'dns' | 'offline' | 'refused' | 'timeout' | 'network' | 'blocked' | 'crashed' | 'route' | 'generic';
export interface TabErrorInfo { kind: TabErrorKind; code: number; name: string; host: string; url: string; threat?: string }
export interface SafeBrowsingStatus { available: boolean; ready: boolean; lists: number; prefixes: number; lastUpdate: number; error: string }
export interface DrmStatus { available: boolean; ready: boolean; error: string }
export interface PasswordPrompt { id: string; tabId: string; origin: string; username: string; update: boolean; leaked: number }
export interface ImportableBrowser { id: string; name: string; profiles: { id: string; name: string }[] }
export interface SiteSetting { javascript?: false; images?: false; limit?: true; fingerprint?: false; zoom?: number }
export interface ArchivedTab { id: string; url: string; title: string; archivedAt: number; workspaceId: string }
export interface LinkPreviewState { url: string; title: string; loading: boolean; sourceTabId: string }
export interface QuickState { url: string; title: string; loading: boolean; canGoBack: boolean; appearance: string; accent: string; surface: string; background: string; skin: string }
export interface SavedSession { id: string; name: string; created: number; count: number; hosts: string[] }
export interface TaskRow { id: string; kind: 'tab' | 'process'; title: string; url: string; pid: number; cpu: number; memory: number; network: number; suspended: boolean; limited: boolean; active: boolean }
