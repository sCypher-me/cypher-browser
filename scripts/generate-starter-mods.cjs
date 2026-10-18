// Generates the built-in starter mods in electron/builtin-mods: synthesized WAV sounds and music loops,
// SVG wallpapers and previews, page styles and manifests. Everything is produced from code (no third-party assets).
const fs = require('node:fs');
const path = require('node:path');

const RATE = 22050;
const root = path.resolve(__dirname, '../electron/builtin-mods');

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((value, index) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), index * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8); header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write('data', 36); header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}
let seed = 7;
const noise = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x3fffffff - 1; };
const render = (seconds, fn) => Array.from({ length: Math.round(seconds * RATE) }, (_, i) => fn(i / RATE, i));
const note = midi => 440 * 2 ** ((midi - 69) / 12);
const env = (t, attack, decay) => (t < attack ? t / attack : Math.exp(-(t - attack) / decay));
const osc = {
  sine: (f, t) => Math.sin(2 * Math.PI * f * t),
  tri: (f, t) => 2 * Math.abs(2 * ((f * t) % 1) - 1) - 1,
  square: (f, t) => ((f * t) % 1 < 0.5 ? 1 : -1),
  saw: (f, t) => 2 * ((f * t) % 1) - 1,
};

function soundSet(style) {
  const s = {
    corte: {
      click: render(0.07, t => (osc.square(1800, t) * 0.25 + noise() * 0.5) * env(t, 0.001, 0.012) * 0.6),
      hover: render(0.03, t => osc.sine(2600, t) * env(t, 0.001, 0.006) * 0.18),
      tabOpen: render(0.14, t => osc.tri(t < 0.06 ? 660 : 990, t) * env(t, 0.002, 0.05) * 0.4),
      tabClose: render(0.14, t => osc.tri(t < 0.06 ? 990 : 520, t) * env(t, 0.002, 0.05) * 0.35),
      typing: render(0.03, t => noise() * env(t, 0.0005, 0.005) * 0.35),
      navigate: render(0.25, t => noise() * Math.sin(Math.PI * t / 0.25) * 0.12),
    },
    neon: {
      click: render(0.09, t => osc.square(note(84) * (1 + t * 3), t) * env(t, 0.001, 0.02) * 0.3),
      hover: render(0.05, t => osc.sine(note(96), t) * env(t, 0.002, 0.01) * 0.15),
      tabOpen: render(0.18, t => osc.saw(note(t < 0.07 ? 76 : 83), t) * env(t, 0.002, 0.07) * 0.28),
      tabClose: render(0.18, t => osc.saw(note(t < 0.07 ? 83 : 71), t) * env(t, 0.002, 0.07) * 0.25),
      typing: render(0.04, t => osc.square(note(100), t) * env(t, 0.0005, 0.006) * 0.12),
      navigate: render(0.3, t => osc.sine(note(60) + 900 * t, t) * Math.sin(Math.PI * t / 0.3) * 0.2),
    },
    fita: {
      click: render(0.08, t => (noise() * 0.7 + osc.sine(140, t) * 0.6) * env(t, 0.001, 0.015) * 0.55),
      hover: render(0.04, t => noise() * env(t, 0.001, 0.008) * 0.1),
      tabOpen: render(0.2, t => (osc.sine(220, t) + noise() * 0.3) * env(t, 0.003, 0.06) * 0.35),
      tabClose: render(0.2, t => (osc.sine(160, t) + noise() * 0.3) * env(t, 0.003, 0.06) * 0.32),
      typing: render(0.04, t => noise() * env(t, 0.0008, 0.01) * 0.28),
      navigate: render(0.35, t => noise() * 0.18 * Math.sin(Math.PI * t / 0.35) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 30 * t))),
    },
    papel: {
      click: render(0.06, t => noise() * env(t, 0.002, 0.01) * 0.22),
      hover: render(0.03, t => noise() * env(t, 0.001, 0.005) * 0.05),
      tabOpen: render(0.16, t => noise() * Math.sin(Math.PI * t / 0.16) * 0.12),
      tabClose: render(0.16, t => noise() * Math.sin(Math.PI * t / 0.16) * 0.1),
      typing: render(0.03, t => noise() * env(t, 0.0005, 0.004) * 0.16),
    },
  };
  return s[style];
}

function loop(seconds, voice) {
  const fade = 0.05 * RATE;
  return render(seconds, voice).map((value, index, list) => value * Math.min(1, index / fade, (list.length - index) / fade));
}
const neonChords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
const lofiChords = [[50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59], [45, 48, 52, 55]];
const music = {
  neon: {
    base: loop(12, t => { const chord = neonChords[Math.floor(t / 3) % 4]; return chord.reduce((sum, m) => sum + osc.saw(note(m), t) * 0.06 + osc.sine(note(m - 12), t) * 0.08, 0) * (0.85 + 0.15 * Math.sin(2 * Math.PI * 0.25 * t)); }),
    active: loop(12, t => { const chord = neonChords[Math.floor(t / 3) % 4]; const step = Math.floor(t * 8); const m = chord[step % chord.length] + 12; return osc.square(note(m), t) * env(t % 0.125, 0.002, 0.04) * 0.12; }),
  },
  fita: {
    base: loop(12, t => { const chord = lofiChords[Math.floor(t / 3) % 4]; return chord.reduce((sum, m) => sum + osc.tri(note(m), t) * 0.05, 0) * (0.9 + 0.1 * Math.sin(2 * Math.PI * 0.5 * t)) + noise() * 0.012; }),
    active: loop(12, t => { const beat = t % 0.75; const kick = osc.sine(60 + 80 * Math.exp(-beat * 30), t) * env(beat, 0.002, 0.08) * 0.35; const half = (t + 0.375) % 0.75; const hat = noise() * env(half, 0.001, 0.02) * 0.08; return kick + hat; }),
  },
};

const svg = (body, background) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><rect width="1600" height="900" fill="${background}"/>${body}</svg>`;
const wallpapers = {
  recorte: svg(`<path d="M1600 0v260l-260-260z" fill="#ff5436"/><path d="M0 900V700l200 200z" fill="#ff5436" opacity=".85"/><g stroke="#ece6d8" stroke-opacity=".06">${Array.from({ length: 24 }, (_, i) => `<path d="M${i * 90 - 400} 900 L${i * 90 + 500} 0"/>`).join('')}</g>`, '#0a0908'),
  neon: svg(`<defs><linearGradient id="h" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#05070f"/><stop offset=".55" stop-color="#140a2a"/><stop offset="1" stop-color="#05070f"/></linearGradient></defs><rect width="1600" height="900" fill="url(#h)"/><circle cx="800" cy="470" r="170" fill="#ff3dbb" opacity=".85"/><g stroke="#05070f" stroke-width="10">${Array.from({ length: 7 }, (_, i) => `<path d="M600 ${420 + i * 22}h400"/>`).join('')}</g><g stroke="#39e0ff" stroke-opacity=".55">${Array.from({ length: 13 }, (_, i) => `<path d="M800 520 L${i * 160 - 160} 900"/>`).join('')}${Array.from({ length: 8 }, (_, i) => `<path d="M0 ${530 + i * i * 6} H1600"/>`).join('')}</g>`, '#05070f'),
  fita: svg(`<g opacity=".9">${['#ffb347', '#ff7a3d', '#e2513a', '#8f3b46'].map((color, i) => `<rect y="${560 + i * 46}" width="1600" height="34" fill="${color}"/>`).join('')}</g><rect x="560" y="200" width="480" height="280" rx="18" fill="none" stroke="#f3e2c3" stroke-opacity=".25" stroke-width="6"/><circle cx="700" cy="340" r="52" fill="none" stroke="#f3e2c3" stroke-opacity=".25" stroke-width="6"/><circle cx="900" cy="340" r="52" fill="none" stroke="#f3e2c3" stroke-opacity=".25" stroke-width="6"/>`, '#120c09'),
  papel: svg(`<g fill="none" stroke="#1d2a6b" stroke-opacity=".08">${Array.from({ length: 30 }, (_, i) => `<path d="M0 ${i * 32} H1600"/>`).join('')}</g><path d="M180 0v900" stroke="#ff5a5a" stroke-opacity=".35" stroke-width="3"/>`, '#f6f2e8'),
};
const preview = (wallpaper, accent, label) => wallpaper.replace('</svg>', `<rect x="70" y="70" width="560" height="120" fill="${accent}"/><text x="100" y="152" font-family="Arial Narrow, Arial, sans-serif" font-weight="800" font-size="64" fill="#0a0908">${label}</text></svg>`);

const mods = [
  { id: 'com.cypher.recorte-noite', folder: 'recorte-noite', name: 'Recorte Noite', description: 'O visual padrão do Cypher como mod: laranja que corta a noite e cliques secos.', tags: ['padrão', 'escuro'],
    theme: { accent: '#ff5436', surface: '#151310', background: '#0a0908', skin: 'recorte', appearanceMode: 'dark', tokens: { cut: 12 } }, sounds: 'corte', wallpaper: 'recorte' },
  { id: 'com.cypher.neon-grid', folder: 'neon-grid', name: 'Neon Grid', description: 'Synthwave: grade em perspectiva, sol magenta, música que acelera quando você navega.', tags: ['synthwave', 'música'],
    theme: { accent: '#39e0ff', surface: '#0e1226', background: '#05070f', skin: 'recorte', appearanceMode: 'dark', tokens: { cut: 6 } }, sounds: 'neon', music: 'neon', wallpaper: 'neon', shader: { preset: 'neon', intensity: 0.35 },
    pageStyles: [{ matches: ['wikipedia.org'], css: 'pages/wikipedia.css', content: 'body,.mw-page-container,.vector-body,#content{background:#05070f!important;color:#d6f4ff!important}a{color:#39e0ff!important}.vector-header-container,.vector-sticky-header,.mw-header{background:#0e1226!important}h1,h2,h3{color:#ff3dbb!important;border-color:#39e0ff44!important}' }] },
  { id: 'com.cypher.fita-k7', folder: 'fita-k7', name: 'Fita K7', description: 'Anos 80 em fita cassete: tons quentes, linhas de CRT nas páginas e um lo-fi que ganha batida.', tags: ['retrô', 'lo-fi'],
    theme: { accent: '#ffb347', surface: '#1c1410', background: '#120c09', skin: 'classic', appearanceMode: 'dark' }, sounds: 'fita', music: 'fita', wallpaper: 'fita', shader: { preset: 'crt', intensity: 0.5 } },
  { id: 'com.cypher.papel', folder: 'papel', name: 'Papel', description: 'Caderno claro e silencioso: cliques de papel e páginas levemente aquecidas para ler.', tags: ['claro', 'leitura'],
    theme: { accent: '#2f4bd8', surface: '#ffffff', background: '#f6f2e8', skin: 'classic', appearanceMode: 'light' }, sounds: 'papel', wallpaper: 'papel', shader: { preset: 'warm', intensity: 0.4 } },
];

fs.rmSync(root, { recursive: true, force: true });
for (const mod of mods) {
  const dir = path.join(root, mod.folder);
  const write = (file, data) => { const target = path.join(dir, ...file.split('/')); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, data); };
  const components = { theme: mod.theme, wallpaper: { file: 'wallpaper.svg', dim: mod.theme.appearanceMode === 'light' ? 0 : 0.3 } };
  write('wallpaper.svg', wallpapers[mod.wallpaper]);
  write('preview.svg', preview(wallpapers[mod.wallpaper], mod.theme.accent, mod.name.toUpperCase()));
  const set = soundSet(mod.sounds);
  components.sounds = { volume: 0.6 };
  for (const [key, samples] of Object.entries(set)) { write(`sounds/${key}.wav`, wav(samples)); components.sounds[key] = `sounds/${key}.wav`; }
  if (mod.music) { write('music/base.wav', wav(music[mod.music].base)); write('music/active.wav', wav(music[mod.music].active)); components.music = { base: 'music/base.wav', active: 'music/active.wav', volume: 0.4 }; }
  if (mod.shader) components.shader = mod.shader;
  if (mod.pageStyles) { components.pageStyles = mod.pageStyles.map(({ matches, css, content }) => { write(css, content); return { matches, css }; }); }
  write('cypher-mod.json', JSON.stringify({ format: 'cypher-mod', formatVersion: 1, id: mod.id, name: mod.name, version: '1.0.0', author: 'Cypher', description: mod.description, minCypherVersion: '0.7.29', preview: 'preview.svg', tags: mod.tags, components }, null, 2) + '\n');
  console.log(`Mod gerado: ${mod.name}`);
}
