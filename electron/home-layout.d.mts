export type WidgetType = 'welcome' | 'search' | 'shortcuts' | 'clock' | 'notes' | 'bookmarks' | 'focus' | 'text' | 'sticker' | 'image' | 'custom' | 'calendar' | 'tasks' | 'countdown' | 'calculator';
export interface HomeWidget {
  id: string; type: WidgetType; x: number; y: number; width: number; height: number; title: string; preferred: { x: number; y: number; width: number; height: number };
  showSeconds: boolean; format24: boolean; showDate: boolean; welcomeTitle: string; welcomeAccentTitle: string; welcomeLabel: string; showWelcomeLabel: boolean;
  welcomeAlignment: 'left' | 'center' | 'right'; welcomeTitleSize: number; description: string; city: string; citySource: 'timezone' | 'custom';
  searchPlaceholder: string; searchEngine: 'inherit' | 'duckduckgo' | 'google' | 'bing'; showProvider: boolean; showSearchHint: boolean;
  shortcuts: HomeShortcut[]; bookmarkLimit: number; showBookmarkIcons: boolean; notePlaceholder: string; focusMinutes: number;
  textContent: string; textStyle: 'plain' | 'quote' | 'callout'; textAlignment: 'left' | 'center' | 'right';
  clockDesign: 'digital' | 'minimal' | 'analog' | 'flip' | 'terminal' | 'orbit'; widgetRotation: number; widgetPadding: number;
  designVariant: string; calendarMonday: boolean; countdownLabel: string; countdownTarget: string; calculatorPrecision: number;
  codeHtml: string; codeCss: string; codeJs: string;
  sticker: string; caption: string; stickerAngle: number; stickerSize: number; imageData: string; imageAlt: string; imageFit: 'cover' | 'contain';
  background: 'default' | 'transparent' | 'surface' | 'accent' | 'custom'; backgroundColor: string; textColor: string; opacity: number; cornerRadius: number;
}
export interface HomeShortcut { id: string; title: string; url: string; icon: 'youtube' | 'github' | 'chat' | 'music' | 'globe' }
export interface HomeConfig {
  title: string; accentTitle: string; description: string; searchPlaceholder: string;
  alignment: 'left' | 'center' | 'right'; titleSize: number; showArt: boolean; artOpacity: number;
  layoutVersion: 3; canvasWidth: number; padding: number; widgetStyle: 'minimal' | 'solid' | 'outlined';
  widgets: HomeWidget[]; shortcuts: HomeShortcut[];
}
export const defaultHome: HomeConfig;
export const widgetDefinitions: Record<WidgetType,{ label: string; description: string; minWidth: number; minHeight: number; width: number; height: number }>;
export const widgetDesigns: Record<WidgetType,Array<{ value: string; label: string }>>;
export function overlaps(a: HomeWidget,b: HomeWidget): boolean;
export function moveWidget(widgets: HomeWidget[],id: string,patch: Partial<HomeWidget>,canvasWidth?: number): HomeWidget[];
export function addWidget(widgets: HomeWidget[],type: WidgetType,id: string,canvasWidth?: number): HomeWidget[];
export function sanitizeHome(input?: Partial<HomeConfig>,base?: HomeConfig): HomeConfig;
export type ResizeEdge = 'move' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
export function resizeWidget(widget: HomeWidget,edge: ResizeEdge,dx: number,dy: number,canvasWidth?: number): HomeWidget;
export function resolveWidgetLayout(widgets: HomeWidget[],priorityId?: string | null,canvasWidth?: number): HomeWidget[];
