export const widgetDefinitions = {
  welcome: { label: 'Boas-vindas', description: 'Uma chamada sua, com data, hora e cidade em tempo real.', minWidth: 160, minHeight: 90, width: 700, height: 200 },
  search: { label: 'Pesquisa', description: 'Sua busca, com motor e aparência próprios.', minWidth: 180, minHeight: 52, width: 640, height: 110 },
  shortcuts: { label: 'Atalhos', description: 'Uma coleção de links só deste widget.', minWidth: 100, minHeight: 80, width: 650, height: 140 },
  clock: { label: 'Relógio', description: 'Horário e data, no formato que você escolher.', minWidth: 100, minHeight: 70, width: 250, height: 170 },
  notes: { label: 'Notas', description: 'Um espaço local para suas ideias.', minWidth: 130, minHeight: 90, width: 300, height: 230 },
  bookmarks: { label: 'Favoritos', description: 'Seus endereços salvos, com limite e estilo próprios.', minWidth: 140, minHeight: 90, width: 300, height: 230 },
  focus: { label: 'Foco', description: 'Um temporizador com duração inicial configurável.', minWidth: 150, minHeight: 110, width: 300, height: 240 },
  text: { label: 'Texto livre', description: 'Escreva uma frase, lembrete ou citação.', minWidth: 120, minHeight: 70, width: 300, height: 180 },
  sticker: { label: 'Sticker', description: 'Um detalhe decorativo para dar personalidade à Home.', minWidth: 80, minHeight: 80, width: 180, height: 170 },
  image: { label: 'Imagem', description: 'Adicione uma imagem do seu dispositivo.', minWidth: 100, minHeight: 80, width: 320, height: 220 },
  custom: { label: 'Widget de código', description: 'Crie um widget próprio com HTML, CSS e JavaScript.', minWidth: 220, minHeight: 150, width: 360, height: 240 },
  calendar: { label: 'Calendário', description: 'Veja o mês e navegue pelas datas sem sair da Home.', minWidth: 180, minHeight: 180, width: 300, height: 280 },
  tasks: { label: 'Tarefas', description: 'Organize uma lista simples salva neste dispositivo.', minWidth: 170, minHeight: 150, width: 300, height: 250 },
  countdown: { label: 'Contagem regressiva', description: 'Conte os dias e as horas até uma data importante.', minWidth: 170, minHeight: 110, width: 300, height: 160 },
  calculator: { label: 'Calculadora', description: 'Faça contas rápidas diretamente na página inicial.', minWidth: 170, minHeight: 220, width: 250, height: 320 },
};

export const widgetDesigns = {
  welcome: [{ value:'hero',label:'Hero' },{ value:'editorial',label:'Editorial' },{ value:'centered',label:'Central' },{ value:'banner',label:'Banner' },{ value:'compact',label:'Compacto' }],
  search: [{ value:'pill',label:'Pílula' },{ value:'command',label:'Comando' },{ value:'outlined',label:'Contorno' },{ value:'minimal',label:'Minimalista' },{ value:'compact',label:'Compacto' }],
  shortcuts: [{ value:'tiles',label:'Blocos' },{ value:'list',label:'Lista' },{ value:'circles',label:'Círculos' },{ value:'outlined',label:'Contorno' },{ value:'compact',label:'Compacto' }],
  clock: [{ value:'digital',label:'Digital' },{ value:'minimal',label:'Minimalista' },{ value:'analog',label:'Analógico' },{ value:'flip',label:'Flip' },{ value:'terminal',label:'Terminal' },{ value:'orbit',label:'Órbita' }],
  notes: [{ value:'paper',label:'Papel' },{ value:'ruled',label:'Pautado' },{ value:'terminal',label:'Terminal' },{ value:'sticky',label:'Post-it' },{ value:'minimal',label:'Minimalista' }],
  bookmarks: [{ value:'list',label:'Lista' },{ value:'grid',label:'Grade' },{ value:'cards',label:'Cartões' },{ value:'compact',label:'Compacto' },{ value:'icons',label:'Ícones' }],
  focus: [{ value:'pomodoro',label:'Pomodoro' },{ value:'ring',label:'Anel' },{ value:'minimal',label:'Minimalista' },{ value:'bar',label:'Barra' },{ value:'card',label:'Cartão' }],
  text: [{ value:'plain',label:'Simples' },{ value:'quote',label:'Citação' },{ value:'callout',label:'Destaque' },{ value:'poster',label:'Pôster' },{ value:'note',label:'Anotação' }],
  sticker: [{ value:'emoji',label:'Emoji' },{ value:'label',label:'Etiqueta' },{ value:'badge',label:'Selo' },{ value:'tape',label:'Fita' },{ value:'soft',label:'Suave' }],
  image: [{ value:'frame',label:'Moldura' },{ value:'polaroid',label:'Polaroid' },{ value:'rounded',label:'Arredondada' },{ value:'borderless',label:'Sem borda' },{ value:'poster',label:'Pôster' }],
  custom: [{ value:'glass',label:'Vidro' },{ value:'frame',label:'Moldura' },{ value:'terminal',label:'Terminal' },{ value:'minimal',label:'Minimalista' },{ value:'neon',label:'Neon' }],
  calendar: [{ value:'month',label:'Mês' },{ value:'agenda',label:'Agenda' },{ value:'minimal',label:'Minimalista' },{ value:'cards',label:'Cartões' },{ value:'terminal',label:'Terminal' }],
  tasks: [{ value:'checklist',label:'Checklist' },{ value:'list',label:'Lista' },{ value:'cards',label:'Cartões' },{ value:'terminal',label:'Terminal' },{ value:'minimal',label:'Minimalista' }],
  countdown: [{ value:'digital',label:'Digital' },{ value:'calendar',label:'Calendário' },{ value:'minimal',label:'Minimalista' },{ value:'ring',label:'Anel' },{ value:'poster',label:'Pôster' }],
  calculator: [{ value:'keypad',label:'Teclas' },{ value:'compact',label:'Compacta' },{ value:'minimal',label:'Minimalista' },{ value:'terminal',label:'Terminal' },{ value:'glass',label:'Vidro' }],
};
const defaultDesigns = Object.fromEntries(Object.entries(widgetDesigns).map(([type,designs]) => [type,designs[0].value]));

const baseShortcuts = [
  { id: 'youtube', title: 'YouTube', url: 'https://www.youtube.com/', icon: 'youtube' },
  { id: 'github', title: 'GitHub', url: 'https://github.com/', icon: 'github' },
  { id: 'discord', title: 'Discord', url: 'https://discord.com/', icon: 'chat' },
  { id: 'spotify', title: 'Spotify', url: 'https://open.spotify.com/', icon: 'music' },
];

export const defaultHome = {
  layoutVersion: 3, canvasWidth: 1100,
  title: 'A internet.', accentTitle: 'Do seu jeito.', description: 'Novas ideias, próximas descobertas.\nTudo começa com a sua curiosidade.',
  searchPlaceholder: 'Qual é a sua próxima descoberta?', alignment: 'left', titleSize: 48,
  showArt: true, artOpacity: 75, padding: 32, widgetStyle: 'minimal', shortcuts: baseShortcuts,
  widgets: [
    { id: 'welcome', type: 'welcome', designVariant:'hero', x: 12, y: 12, width: 700, height: 200, title: '', welcomeTitle: 'A internet.', welcomeAccentTitle: 'Do seu jeito.', description: 'Novas ideias, próximas descobertas.\nTudo começa com a sua curiosidade.', welcomeLabel: 'UM ESPAÇO PARA O QUE TE MOVE', showWelcomeLabel: true, welcomeAlignment: 'left', welcomeTitleSize: 48, city: '', citySource: 'timezone' },
    { id: 'clock', type: 'clock', designVariant:'digital', x: 820, y: 12, width: 260, height: 160, title: '', showSeconds: false, format24: true, showDate: true, clockDesign: 'digital' },
    { id: 'search', type: 'search', designVariant:'pill', x: 12, y: 226, width: 720, height: 110, title: '', searchPlaceholder: 'Qual é a sua próxima descoberta?', searchEngine: 'inherit', showProvider: true, showSearchHint: true },
    { id: 'shortcuts', type: 'shortcuts', designVariant:'tiles', x: 12, y: 350, width: 720, height: 145, title: '', shortcuts: baseShortcuts },
  ],
};

const clamp = (value, min, max, fallback) => Number.isFinite(value) ? Math.round(Math.max(min,Math.min(max,value))) : fallback;
const string = (value, fallback, max) => typeof value === 'string' ? value.slice(0,max) : fallback;
const geometry = value => ({ x: value.x, y: value.y, width: value.width, height: value.height });
const validColor = value => /^#[\da-f]{6}$/i.test(value || '');
export function overlaps(a,b) { return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y; }

function cleanShortcuts(value, fallback = baseShortcuts) {
  const source = Array.isArray(value) ? value : fallback;
  const ids = new Set();
  return source.slice(0,12).flatMap((link,index) => {
    if (!link || typeof link.url !== 'string') return [];
    try {
      const url = new URL(link.url);
      if (!['http:','https:'].includes(url.protocol)) return [];
      const id = string(link.id,`link-${index}`,80);
      if (!id || ids.has(id)) return [];
      ids.add(id);
      return [{ id, title: string(link.title,url.hostname,60), url: url.href,
        icon: ['youtube','github','chat','music','globe'].includes(link.icon) ? link.icon : 'globe' }];
    } catch { return []; }
  });
}

function cleanWidget(value, canvasWidth = 1100) {
  if (!value || !Object.hasOwn(widgetDefinitions,value.type)) return null;
  const d = widgetDefinitions[value.type];
  if (['__proto__','constructor','prototype'].includes(value.id)) return null;
  const requested = value.preferred && typeof value.preferred === 'object' ? value.preferred : value;
  const preferredWidth = clamp(requested.width,d.minWidth,canvasWidth,Math.min(d.width,canvasWidth));
  const preferred = { x: clamp(requested.x,0,canvasWidth-preferredWidth,0), y: clamp(requested.y,0,48000,0),
    width: preferredWidth, height: clamp(requested.height,d.minHeight,2400,d.height) };
  const width = clamp(value.width,d.minWidth,canvasWidth,preferred.width);
  const height = clamp(value.height,d.minHeight,2400,preferred.height);
  const imageData = typeof value.imageData === 'string' && value.imageData.length <= 4_200_000 && /^data:image\/(?:png|jpeg|webp|gif);base64,[\da-z+/=]+$/i.test(value.imageData) ? value.imageData : '';
  const engine = ['inherit','duckduckgo','google','bing'].includes(value.searchEngine) ? value.searchEngine : 'inherit';
  const output = {
    id: string(value.id,value.type,80), type: value.type, x: clamp(value.x,0,canvasWidth-width,preferred.x),
    y: clamp(value.y,0,48000,preferred.y), width, height, preferred, title: string(value.title,'',48),
    showSeconds: value.showSeconds === true, format24: value.format24 !== false, showDate: value.showDate !== false,
    welcomeTitle: string(value.welcomeTitle,'',100), welcomeAccentTitle: string(value.welcomeAccentTitle,'',100),
    welcomeLabel: string(value.welcomeLabel,'UM ESPAÇO PARA O QUE TE MOVE',100), showWelcomeLabel: value.showWelcomeLabel !== false,
    welcomeAlignment: ['left','center','right'].includes(value.welcomeAlignment) ? value.welcomeAlignment : 'left',
    welcomeTitleSize: clamp(value.welcomeTitleSize,20,76,48), description: string(value.description,'',500),
    city: string(value.city,'',80), citySource: value.citySource === 'custom' ? 'custom' : 'timezone',
    searchPlaceholder: string(value.searchPlaceholder,'Pesquise ou digite um endereço',100), searchEngine: engine,
    showProvider: value.showProvider !== false, showSearchHint: value.showSearchHint !== false,
    shortcuts: value.type === 'shortcuts' ? cleanShortcuts(value.shortcuts) : [], bookmarkLimit: clamp(value.bookmarkLimit,1,24,8),
    showBookmarkIcons: value.showBookmarkIcons !== false, notePlaceholder: string(value.notePlaceholder,'Uma ideia, um lembrete, um começo…',120),
    focusMinutes: clamp(value.focusMinutes,1,120,25), textContent: string(value.textContent,'Escreva o que você quer deixar à vista.',1000),
    textStyle: ['plain','quote','callout'].includes(value.textStyle) ? value.textStyle : 'plain',
    textAlignment: ['left','center','right'].includes(value.textAlignment) ? value.textAlignment : 'left',
    clockDesign: ['digital','minimal','analog','flip','terminal','orbit'].includes(value.clockDesign) ? value.clockDesign : 'digital',
    designVariant: widgetDesigns[value.type].some(option => option.value === (value.type === 'clock' ? value.clockDesign : value.designVariant)) ? (value.type === 'clock' ? value.clockDesign : value.designVariant) : defaultDesigns[value.type],
    calendarMonday: value.calendarMonday !== false,
    countdownLabel: string(value.countdownLabel,'Até o próximo marco',100), countdownTarget: string(value.countdownTarget,'',40),
    calculatorPrecision: clamp(value.calculatorPrecision,0,8,2),
    widgetRotation: clamp(value.widgetRotation,-180,180,0), widgetPadding: clamp(value.widgetPadding,0,64,16),
    sticker: string(value.sticker,'✨',8), caption: string(value.caption,'',100), stickerAngle: clamp(value.stickerAngle,-30,30,0), stickerSize: clamp(value.stickerSize,24,160,72),
    codeHtml: string(value.codeHtml,'<h2>Seu widget</h2><p>Edite o código para começar.</p>',20000),
    codeCss: string(value.codeCss,'',20000), codeJs: string(value.codeJs,'',20000),
    imageData, imageAlt: string(value.imageAlt,'Imagem da Home',120), imageFit: value.imageFit === 'contain' ? 'contain' : 'cover',
    background: ['default','transparent','surface','accent','custom'].includes(value.background) ? value.background : 'default',
    backgroundColor: validColor(value.backgroundColor) ? value.backgroundColor : '#172019',
    textColor: validColor(value.textColor) ? value.textColor : '#e4ebdf',
    opacity: clamp(value.opacity,0,100,100), cornerRadius: clamp(value.cornerRadius,0,40,14),
  };
  return output;
}

export function moveWidget(widgets, id, patch, canvasWidth = 1100) {
  return widgets.map(widget => {
    if (widget.id !== id) return widget;
    const changedGeometry = ['x','y','width','height'].some(key => Object.hasOwn(patch,key));
    const preferred = changedGeometry ? { ...(widget.preferred || geometry(widget)), ...Object.fromEntries(['x','y','width','height'].filter(key => Object.hasOwn(patch,key)).map(key => [key,patch[key]])) } : widget.preferred;
    return cleanWidget({ ...widget, ...patch, preferred, id: widget.id, type: widget.type },canvasWidth);
  });
}

export function resizeWidget(widget, edge, dx, dy, canvasWidth = 1100) {
  const d = widgetDefinitions[widget.type];
  let { x,y,width,height } = widget;
  if (edge === 'move') return cleanWidget({ ...widget,x:x+dx,y:y+dy,preferred:{ x:x+dx,y:y+dy,width,height } },canvasWidth);
  if (edge.includes('w')) { const right=x+width; x=clamp(x+dx,0,right-d.minWidth,x); width=right-x; }
  if (edge.includes('e')) width=clamp(width+dx,d.minWidth,canvasWidth-x,width);
  if (edge.includes('n')) { const bottom=y+height; y=clamp(y+dy,0,bottom-d.minHeight,y); height=bottom-y; }
  if (edge.includes('s')) height=clamp(height+dy,d.minHeight,2400,height);
  return cleanWidget({ ...widget,x,y,width,height,preferred:{ x,y,width,height } },canvasWidth);
}

function subtractObstacle(box, obstacle, minWidth, minHeight) {
  if (!overlaps(box,obstacle)) return [box];
  const right = box.x + box.width, bottom = box.y + box.height;
  const slices = [
    { x:box.x,y:box.y,width:Math.min(box.width,obstacle.x-box.x),height:box.height },
    { x:Math.max(box.x,obstacle.x+obstacle.width),y:box.y,width:right-Math.max(box.x,obstacle.x+obstacle.width),height:box.height },
    { x:box.x,y:box.y,width:box.width,height:Math.min(box.height,obstacle.y-box.y) },
    { x:box.x,y:Math.max(box.y,obstacle.y+obstacle.height),width:box.width,height:bottom-Math.max(box.y,obstacle.y+obstacle.height) },
  ];
  return slices.filter(part => part.width >= minWidth && part.height >= minHeight);
}

function closestOpenSpot(target, obstacles, canvasWidth) {
  const xs = new Set([target.x,0,...obstacles.flatMap(item => [item.x+item.width,item.x-target.width])]);
  const ys = new Set([target.y,0,...obstacles.flatMap(item => [item.y+item.height,item.y-target.height])]);
  const choices = [];
  for (const x of xs) for (const y of ys) {
    const candidate = { x,y,width:target.width,height:target.height };
    if (x < 0 || y < 0 || x+candidate.width > canvasWidth || y > 48000-candidate.height) continue;
    if (obstacles.every(item => !overlaps(candidate,item))) choices.push(candidate);
  }
  choices.sort((a,b) => (Math.abs(a.x-target.x)+Math.abs(a.y-target.y)) - (Math.abs(b.x-target.x)+Math.abs(b.y-target.y)));
  return choices[0] || null;
}

export function resolveWidgetLayout(widgets, priorityId, canvasWidth = 1100) {
  const originals = widgets.map(widget => cleanWidget(widget,canvasWidth)).filter(Boolean);
  const ordered = [...originals].sort((a,b) => (a.id === priorityId ? -1 : b.id === priorityId ? 1 : 0));
  const placed = [];
  for (const widget of ordered) {
    const d = widgetDefinitions[widget.type];
    const desired = { ...widget.preferred };
    let candidate = desired;
    if (placed.some(item => overlaps(candidate,item))) {
      let regions = [desired];
      for (const obstacle of placed) {
        regions = regions.flatMap(region => subtractObstacle(region,obstacle,d.minWidth,d.minHeight));
        regions.sort((a,b) => b.width*b.height-a.width*a.height || (Math.abs(a.x-desired.x)+Math.abs(a.y-desired.y))-(Math.abs(b.x-desired.x)+Math.abs(b.y-desired.y)));
        regions = regions.slice(0,64);
        if (!regions.length) break;
      }
      if (regions.length) candidate = regions[0];
      else candidate = closestOpenSpot(desired,placed,canvasWidth) || { ...desired,x:0,y:Math.min(48000,Math.max(0,...placed.map(item => item.y+item.height))+16) };
    }
    placed.push(cleanWidget({ ...widget,...candidate,preferred:widget.preferred },canvasWidth));
  }
  const resolved = new Map(placed.map(widget => [widget.id,widget]));
  return originals.map(widget => resolved.get(widget.id));
}

export function addWidget(widgets,type,id,canvasWidth = 1100) {
  if (!Object.hasOwn(widgetDefinitions,type) || widgets.length >= 24) return widgets;
  const template = { id,type,shortcuts:type === 'shortcuts' ? baseShortcuts.map(link => ({ ...link })) : [] };
  const widget = cleanWidget(template,canvasWidth);
  if (!widget) return widgets;
  const xs=[12,...widgets.map(w=>w.x+w.width+24)].filter(x=>x+widget.width<=canvasWidth);
  const ys=[12,...widgets.map(w=>w.y+w.height+24)].sort((a,b)=>a-b);
  for (const y of ys) for (const x of xs) {
    const candidate={ ...widget,x,y,preferred:{ x,y,width:widget.width,height:widget.height } };
    if (!widgets.some(other=>overlaps(candidate,other))) return [...widgets,candidate];
  }
  const next={ ...widget,x:12,y:Math.min(48000,Math.max(0,...widgets.map(w=>w.y+w.height))+24) };
  next.preferred=geometry(next);
  return [...widgets,next];
}

function migrateWidget(widget,source) {
  if (source.layoutVersion >= 2 || !widget || !Number.isFinite(widget.col)) return widget;
  const gap=Number.isFinite(source.gap)?source.gap:14;
  const step=(1100+gap)/12;
  const row=(Number.isFinite(source.rowSize)?source.rowSize:36)+gap;
  return { ...widget,x:widget.col*step,y:(widget.row||0)*row,width:widget.width*step-gap,height:widget.height*row-gap };
}

export function sanitizeHome(input, base = defaultHome) {
  const source = input && typeof input === 'object' ? input : {};
  const output = { ...base,layoutVersion: 3,canvasWidth: clamp(source.canvasWidth,600,2400,base.canvasWidth || 1100) };
  for (const key of ['title','accentTitle']) output[key] = string(source[key],base[key],100);
  output.description = string(source.description,base.description,300);
  output.searchPlaceholder = string(source.searchPlaceholder,base.searchPlaceholder,100);
  for (const [key,values] of Object.entries({ alignment: ['left','center','right'], widgetStyle: ['minimal','solid','outlined'] })) if (values.includes(source[key])) output[key] = source[key];
  for (const [key,min,max] of [['titleSize',28,76],['padding',16,64],['artOpacity',0,100]]) output[key] = clamp(source[key],min,max,base[key]);
  if (typeof source.showArt === 'boolean') output.showArt = source.showArt;
  output.shortcuts = cleanShortcuts(source.shortcuts,base.shortcuts);
  if (Array.isArray(source.widgets)) {
    const ids = new Set();
    output.widgets = source.widgets.slice(0,24).map(value => {
      const migrated=migrateWidget(value,source);
      if (!migrated || !Object.hasOwn(widgetDefinitions,migrated.type)) return null;
      const seeded={ ...migrated };
      if (migrated.type === 'welcome') {
        if (typeof seeded.welcomeTitle !== 'string') seeded.welcomeTitle=output.title;
        if (typeof seeded.welcomeAccentTitle !== 'string') seeded.welcomeAccentTitle=output.accentTitle;
        if (typeof seeded.description !== 'string') seeded.description=output.description;
      }
      if (migrated.type === 'search' && typeof seeded.searchPlaceholder !== 'string') seeded.searchPlaceholder=output.searchPlaceholder;
      if (migrated.type === 'shortcuts' && !Array.isArray(seeded.shortcuts)) seeded.shortcuts=output.shortcuts;
      return cleanWidget(seeded,output.canvasWidth);
    }).filter(widget => {
      if (!widget || !widget.id || ids.has(widget.id)) return false;
      ids.add(widget.id); return true;
    });
  } else output.widgets = base.widgets.map(widget=>cleanWidget(widget,output.canvasWidth));
  return output;
}
