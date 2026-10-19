// Roda no mundo isolado das abas. Percebe quando a pessoa envia um login e avisa o processo
// principal (que só oferece salvar em abas normais) e aplica o volume da aba. A página não
// enxerga este script.
const { contextBridge, ipcRenderer, webFrame } = require('electron');

// ---- Proteção contra impressão digital ----
// Roda no mundo da página antes dos scripts dela. Canvas e áudio recebem ruído determinístico
// pela semente do site; WebGL e alguns dados do aparelho ficam genéricos. As funções trocadas
// continuam dizendo "[native code]" em toString().
function farble(seedHex) {
  const seed = parseInt(seedHex, 16) >>> 0;
  const mix = index => { let x = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0; x ^= x >>> 16; x = Math.imul(x, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return x >>> 0; };
  const nativeToString = Function.prototype.toString;
  const disguised = new WeakMap();
  const toStringProxy = function toString() { return disguised.has(this) ? disguised.get(this) : nativeToString.call(this); };
  disguised.set(toStringProxy, nativeToString.call(nativeToString));
  Object.defineProperty(Function.prototype, 'toString', { value: toStringProxy, configurable: true, writable: true });
  const replace = (target, name, build) => {
    const original = target?.[name];
    if (typeof original !== 'function') return;
    const fake = build(original);
    disguised.set(fake, nativeToString.call(original));
    Object.defineProperty(fake, 'name', { value: name });
    Object.defineProperty(target, name, { value: fake, configurable: true, writable: true, enumerable: false });
  };
  const replaceGetter = (target, name, value) => {
    const descriptor = Object.getOwnPropertyDescriptor(target, name);
    if (!descriptor?.get) return;
    const getter = { get [name]() { return value(descriptor.get.call(this)); } }.__lookupGetter__(name);
    disguised.set(getter, nativeToString.call(descriptor.get));
    Object.defineProperty(target, name, { ...descriptor, get: getter });
  };
  // Canvas: inverte o bit menos significativo de ~3% dos pixels, sempre nos mesmos lugares.
  const noisify = data => { for (let i = 0; i < data.length; i += 4) { const r = mix(i >> 2); if ((r & 0xff) < 8) data[i + ((r >>> 8) % 3)] ^= 1; } return data; };
  const getImageData = CanvasRenderingContext2D.prototype.getImageData;
  replace(CanvasRenderingContext2D.prototype, 'getImageData', original => function () { const image = original.apply(this, arguments); noisify(image.data); return image; });
  const noisyCopy = canvas => {
    if (!canvas.width || !canvas.height || canvas.width * canvas.height > 16_000_000) return null;
    const copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height;
    const context = copy.getContext('2d');
    context.drawImage(canvas, 0, 0);
    const image = getImageData.call(context, 0, 0, copy.width, copy.height);
    noisify(image.data); context.putImageData(image, 0, 0);
    return copy;
  };
  for (const name of ['toDataURL', 'toBlob']) replace(HTMLCanvasElement.prototype, name, original => function () {
    try { const copy = noisyCopy(this); if (copy) return original.apply(copy, arguments); } catch {}
    return original.apply(this, arguments);
  });
  // WebGL: placa de vídeo genérica.
  for (const proto of [window.WebGLRenderingContext?.prototype, window.WebGL2RenderingContext?.prototype]) replace(proto, 'getParameter', original => function (parameter) {
    if (parameter === 37445) return 'Google Inc.';
    if (parameter === 37446) return 'ANGLE (Generic, Generic GPU, D3D11)';
    return original.apply(this, arguments);
  });
  // Áudio: variação mínima e estável nas amostras e nas frequências analisadas.
  const touched = new WeakSet();
  replace(window.AudioBuffer?.prototype, 'getChannelData', original => function () {
    const data = original.apply(this, arguments);
    if (!touched.has(data)) { touched.add(data); for (let i = 0; i < data.length; i += 97) data[i] += ((mix(i) & 1) ? 1 : -1) * 1e-7; }
    return data;
  });
  replace(window.AnalyserNode?.prototype, 'getFloatFrequencyData', original => function (array) { original.apply(this, arguments); for (let i = 0; i < array.length; i += 7) array[i] += ((mix(i) & 3) - 1.5) * 0.01; });
  // Aparelho: núcleos e memória em valores comuns.
  replaceGetter(Navigator.prototype, 'hardwareConcurrency', real => Math.min(real || 8, (mix(7) & 1) ? 8 : 4));
  replaceGetter(Navigator.prototype, 'deviceMemory', () => 8);
}
try {
  const config = /^https?:$/.test(location.protocol) ? ipcRenderer.sendSync('cypher:fingerprint', location.hostname) : null;
  if (config?.seed) contextBridge.executeInMainWorld({ func: farble, args: [config.seed] });
} catch {}

// ---- Prévia de link: Shift + clique abre o link numa janela por cima da página ----
window.addEventListener('click', event => {
  if (!event.shiftKey || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey) return;
  const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
  if (!link || !/^https?:/i.test(link.href)) return;
  event.preventDefault(); event.stopImmediatePropagation();
  ipcRenderer.send('cypher:link-preview', link.href);
}, true);

// Volume por aba: multiplica o volume que o próprio site escolheu. O ajuste só é instalado na
// página quando o volume sai de 100%, para não mudar nada nos sites que não usam o recurso.
const volumeHook = `(() => {
  if (window[Symbol.for('cypher.volume')]) return;
  const native = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume');
  const chosen = new WeakMap();
  let factor = 1;
  const base = element => chosen.has(element) ? chosen.get(element) : native.get.call(element);
  const apply = element => { const value = base(element); chosen.set(element, value); native.set.call(element, Math.max(0, Math.min(1, value * factor))); };
  Object.defineProperty(HTMLMediaElement.prototype, 'volume', { configurable: true, enumerable: true,
    get() { return base(this); },
    set(value) { native.set.call(this, Math.max(0, Math.min(1, Number(value) * factor))); chosen.set(this, Number(value)); } });
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { apply(this); return play.apply(this, arguments); };
  document.addEventListener('play', event => { if (event.target instanceof HTMLMediaElement) apply(event.target); }, true);
  Object.defineProperty(window, Symbol.for('cypher.volume'), { value: next => { factor = next; document.querySelectorAll('audio, video').forEach(apply); } });
})()`;
let volumeInstalled = false;
ipcRenderer.on('cypher:volume', (_event, value) => {
  const factor = Number(value);
  if (!Number.isFinite(factor) || (!volumeInstalled && factor === 1)) return;
  if (!volumeInstalled) { volumeInstalled = true; void webFrame.executeJavaScript(volumeHook); }
  void webFrame.executeJavaScript(`window[Symbol.for('cypher.volume')](${Math.max(0, Math.min(1, factor))})`);
});

let lastKey = '', lastAt = 0;

function filled(field) { return !field.disabled && typeof field.value === 'string' && field.value.length > 0 && field.value.length <= 4096; }

function usernameFor(scope, passwordField) {
  const fields = [...scope.querySelectorAll('input')].filter(field => filled(field) && ['text', 'email', 'tel', ''].includes((field.type || '').toLowerCase()));
  const hint = field => `${field.name} ${field.id} ${field.autocomplete} ${field.getAttribute('aria-label') || ''} ${field.placeholder || ''}`;
  const named = fields.find(field => /\busername\b/i.test(field.autocomplete)) || fields.find(field => /user|login|e-?mail|identifier|account|conta|usu[aá]rio|cpf/i.test(hint(field)));
  const before = fields.filter(field => field.compareDocumentPosition(passwordField) & Node.DOCUMENT_POSITION_FOLLOWING).pop();
  return String((named || before)?.value || '').trim().slice(0, 256);
}

function capture(origin) {
  const scope = origin?.closest?.('form') || document;
  const passwords = [...scope.querySelectorAll('input[type="password"]')].filter(filled);
  if (!passwords.length) return;
  // Troca de senha: o campo "nova senha" vale mais que o da senha atual.
  const password = passwords.find(field => /new-password/i.test(field.autocomplete)) || (passwords.length > 1 && passwords[0].value !== passwords[1].value ? passwords[1] : passwords[0]);
  const username = usernameFor(scope, password);
  const key = `${username}\n${password.value}`;
  if (key === lastKey && Date.now() - lastAt < 4000) return;
  lastKey = key; lastAt = Date.now();
  ipcRenderer.send('cypher:login-captured', { username, password: password.value });
}

window.addEventListener('submit', event => capture(event.target), true);
window.addEventListener('keydown', event => {
  if (event.key === 'Enter' && event.target instanceof HTMLInputElement) capture(event.target);
}, true);
window.addEventListener('click', event => {
  const target = event.target instanceof Element ? event.target.closest('button, input[type="submit"], input[type="button"], [role="button"]') : null;
  if (!target || /mostrar|show|revelar|exibir|eye|olho/i.test(`${target.getAttribute('aria-label') || ''} ${target.className || ''} ${target.textContent || ''}`.slice(0, 200))) return;
  capture(target);
}, true);
