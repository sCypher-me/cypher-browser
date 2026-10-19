// Roda no mundo isolado das abas. Percebe quando a pessoa envia um login e avisa o processo
// principal (que só oferece salvar em abas normais) e aplica o volume da aba. A página não
// enxerga este script.
const { ipcRenderer, webFrame } = require('electron');

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
