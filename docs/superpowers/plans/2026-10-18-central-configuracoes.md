# Central de Configurações Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar Configurações, Segurança, Perfil e Extensões numa Central com 7 seções em abas, e dar a todas as páginas internas um só visual Recorte compacto.

**Architecture:** `navigation.ts` passa a ter as 7 seções, um mapa de seções antigas → novas e um mapa de páginas-alias (`security`, `profile`, `extensions`) → seção. `SettingsCenter.tsx` vira só a moldura (cabeçalho, abas, sumário, busca) e cada seção mora em `src/central/<Seção>.tsx`, reaproveitando os painéis que já existem. O visual novo fica em `src/central.css` (Central) e `src/internal-pages.css` (cabeçalho compacto, Mods, Histórico, Favoritos, Downloads, Espaços), importados por último.

**Tech Stack:** React 19 + TypeScript 7, Vite, Electron 44, CSS puro com variáveis de tema.

**Spec:** `docs/superpowers/specs/2026-10-18-central-configuracoes-design.md`

## Global Constraints

- Seções, nesta ordem: `overview` Visão geral, `appearance` Aparência, `browsing` Navegação, `privacy` Privacidade e segurança, `profile` Perfil e dados, `extensions` Extensões, `system` Sistema.
- Nenhuma função atual some; Mods continua página própria.
- `cypher://security`, `cypher://profile`, `cypher://extensions` continuam válidos e abrem a Central na seção certa.
- IDs de foco antigos (`site-permissions`, `privacy-*`, `appearance-*` etc.) continuam existindo no DOM.
- Sem rolagem horizontal de 960px para cima; pele Clássico e mods continuam aplicando cores/cantos.
- Copy em português do Brasil.

## Review Focus

- Link antigo com seção antiga (`openPage('settings', { category: 'shortcuts' })`, `focusId: 'site-permissions'`) → abre a seção nova e rola até o item.
- Digitar `cypher://security` na barra → Central em Privacidade e segurança, sem página em branco.
- Busca com termo de uma seção diferente da aberta → troca de aba e rola até o item.
- Janela de 960px → abas rolam na horizontal, sumário some, uma coluna, nada cortado.
- Modo claro e pele Clássico → contraste legível e cantos seguindo os tokens.

---

### Task 1: Navegação e aliases

**Files:** Modify `src/navigation.ts`, `src/App.tsx`; Test `tests/navigation.test.cjs` (via `esbuild`-free check: compile with `tsc --noEmit`, plus smoke).

**Interfaces — Produces:**
- `settingsSections` (7 ids), `type SettingsSection`
- `sectionFor(value: string | undefined): SettingsSection` — aceita ids novos e antigos (`tabs|home|mods→appearance`, `startup|search|languages|downloads|shortcuts→browsing`, `connections→privacy`, `accessibility|updates→system`), padrão `overview`
- `centralAlias: Partial<Record<InternalPage, SettingsSection>>` = `{ security:'privacy', profile:'profile', extensions:'extensions' }`

- [ ] App: `openPage` redireciona aliases para `settings` + seção; render trata `page === 'settings' || centralAlias[page]` com a Central.
- [ ] Smoke: `cypher://security` mostra `.central` com aba Privacidade ativa.
- [ ] Commit.

### Task 2: Moldura da Central

**Files:** Rewrite `src/SettingsCenter.tsx`; Create `src/central/types.ts`; Modify `src/settings-ui.tsx` (`Panel` ganha `wide?: boolean`).

- [ ] Cabeçalho compacto, busca (Ctrl K) sobre o índice de preferências com `section`, faixa de abas com `role="tablist"`, sumário gerado dos `.sc-panel[id]` da seção (IntersectionObserver marca o item visível), conteúdo em colunas.
- [ ] Commit.

### Task 3: Seções

**Files:** Create `src/central/Overview.tsx`, `Appearance.tsx`, `Browsing.tsx`, `Privacy.tsx`, `Profile.tsx`, `System.tsx` (Extensões reaproveita `ExtensionsPage`).

- [ ] Redistribuir os painéis atuais conforme a tabela do spec; trazer de App para a Central: `PrivacyReport`, `SitePermissionsCenter` (id `site-permissions`), `ProfileManager`, foto do perfil, `ExtensionsPage`.
- [ ] Visão geral: bloqueios da semana, rota padrão, perfil, versão/atualização, ações rápidas.
- [ ] Commit.

### Task 4: Visual Recorte único

**Files:** Create `src/central.css`, `src/internal-pages.css`; Modify `src/main.tsx` (importar por último), `src/PrivacyReport.tsx` (gráfico só com dados).

- [ ] Componentes: bloco cortado, linha, interruptor paralelogramo, 3 níveis de botão, chip, número grande; normalizar `.settings-card`, `.button`, `.setting-row` dentro da Central.
- [ ] Cabeçalho compacto para todas as páginas internas; listas e estados vazios compactos; Mods com o mesmo cabeçalho.
- [ ] Commit.

### Task 5: Verificação e release

- [ ] `npm test`, `npx tsc --noEmit`, `npm run test:smoke`; capturas de todas as páginas em 1440 e 960; release 0.7.31.
