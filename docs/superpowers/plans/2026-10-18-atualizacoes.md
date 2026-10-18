# Sistema de atualização Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Canais oficial e Preview, download em segundo plano, bloqueio a 2 versões, reabertura limpa (colar), popup A1 e onboarding R1.

**Architecture:** Lógica pura em `electron/versions.cjs` (semver com `-beta.N`, `isBlocked`), `scripts/changelog.cjs` (CHANGELOG → notas estruturadas, usado pela build e pela release) e `electron/update-manifest.cjs` (validação v1/v2 + assinatura). `electron/updater.cjs` orquestra estados e arquivos. O Setup ganha `--progress-ui` e reabre via Explorer. A interface tem `src/update/` (A1, bloqueio, selo, onboarding, ilustrações).

**Tech Stack:** Electron 44, Node 24, React 19/TS 7, C# 5 WinForms, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-18-atualizacoes-design.md`

## Global Constraints
- Ed25519 + SHA-512 obrigatórios; `latest.json` v1 continua publicado para clientes ≤ 0.7.35.
- Sem internet ou erro de verificação: nunca bloquear.
- Nunca instalar no meio do uso sem pedido; "ao fechar" sem reabrir.
- Copy pt-BR.

## Review Focus
- `0.7.37-beta.1` vs `0.7.37` vs `0.7.36`: ordem semver correta; beta conta como base no bloqueio.
- `stable.json` inexistente (primeira publicação): cair para `latest.json`.
- Sair do Preview estando em beta mais nova que a oficial: não oferecer rebaixamento.
- Pasta `updates` com instaladores antigos e um pronto: apaga só os antigos.
- CHANGELOG sem prefixos (versões antigas): tudo vira "Melhorado", sem destaque, onboarding mostra só a última página.

---

### Task 1: versions + changelog + manifest (puro, testado)
- Create `electron/versions.cjs`: `parseVersion(v) → {major,minor,patch,pre}|null`, `compareVersions(a,b) → -1|0|1`, `baseVersion(v)`, `isBlocked(current, minimum) → boolean`.
- Create `scripts/changelog.cjs`: `parseChangelog(markdown) → [{ version, date, items:[{kind:'new'|'improved'|'fixed', title, body, highlight, illustration}] }]`, `notesBetween(list, from, to)`.
- Create `electron/update-manifest.cjs`: `parseManifest(raw, publicKey)` aceita schema 1 e 2 (com `channel`, `minimumVersion`, `notes`).
- Tests: `tests/versions.test.cjs`, `tests/changelog.test.cjs`, `tests/update-manifest.test.cjs`.

### Task 2: updater
- Rewrite `electron/updater.cjs` com estados `idle/checking/downloading/ready/installing/restarting/up-to-date/blocked/error`, `channel`, `minimumVersion`, `installOnQuit()`, `cleanup()`, ambiente limpo no spawn, `--progress-ui` + `--update-titles=`.
- main.cjs: setting `updateChannel`, recusar comandos de navegação em `blocked`, `before-quit` → `installOnQuit`, `lastRunVersion` → `state.onboarding = { from, to }`.

### Task 3: Setup
- `installer/CypherSetup.cs`: `--progress-ui` (janela A1 sem borda com progresso real), `--update-titles=` (base64url), reabertura via `explorer.exe`.

### Task 4: Interface
- `src/update/UpdateLayer.tsx` (A1 + bloqueio + selo/aviso), `src/update/Onboarding.tsx` (R1 + ilustrações), `src/update/update.css`; card de Sistema com Preview; `dist/changelog.json` gerado na build.

### Task 5: Release
- `release.yml`: tags beta (prerelease), `stable.json`/`preview.json` em `update-channels`, `minimumVersion`, `notes`.

### Task 6: Verificação
- `npm test`, smoke (onboarding e bloqueio via estado simulado), capturas, release 0.7.36.
