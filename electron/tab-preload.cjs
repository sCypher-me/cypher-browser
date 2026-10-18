// Roda no mundo isolado das abas normais. Percebe quando a pessoa envia um login e avisa o
// processo principal, que decide se oferece salvar a senha. A página não enxerga este script.
const { ipcRenderer } = require('electron');

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
