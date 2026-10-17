# Auditoria de prontidão do Cypher

**Base analisada:** código e documentação do Cypher 0.7.25. Revisão estática do repositório; não certifica a segurança de uma versão publicada nem substitui testes em máquina limpa.

## O que já existe

| Área | Estado no projeto |
|---|---|
| Motor e navegação | Chromium real via Electron, abas laterais ou horizontais, navegação, zoom, impressão, salvar página, localizar, pop-ups em abas e downloads. |
| Organização | Favoritos, histórico, restauração de abas, abas privadas, preferências de início e Home personalizável com widgets. |
| Proteções | Sandbox, isolamento de contexto, Node desativado nas páginas, permissões por site, filtro local de rastreadores e controles de cookies/WebRTC. |
| Rotas especiais | Tor e I2P incluídos como proxies locais; Proton VPN é integrado pelo navegador e depende do serviço/conta do provedor. |
| Extensões | Instalação pela Chrome Web Store, pastas locais e pacotes `.cypherext`, com compatibilidade parcial das APIs Chromium/Electron. Pacotes `.cypherext` não têm assinatura independente do autor. |
| Perfil e dados | Perfil local, cofre de senhas com `safeStorage` e preenchimento automático opcional em navegação normal. Sincronização de favoritos, histórico, preferências e Home via WebDAV; os dados sincronizados são JSON legível pelo servidor, não há nuvem Cypher nem criptografia ponta a ponta. |
| Distribuição | Atualizações por GitHub Releases com SHA-512 e assinatura Ed25519 obrigatória no workflow para novas releases. A publicação roda checagem de tipos, testes unitários, smoke tests e auditoria de dependências. O instalador ainda não tem assinatura Authenticode. |

## Principais lacunas para competir com navegadores atuais

### Prioridade 0 — confiança e segurança de lançamento

- Configurar e manter as chaves Ed25519 obrigatórias no GitHub Actions antes da próxima release. Assinar também o instalador e os binários com Authenticode; a assinatura do manifesto não substitui a assinatura do executável.
- Definir a política de suporte e recuperação de versões do Chromium/Electron. Dependabot agora abre atualizações semanais de npm e GitHub Actions, e a CI valida PRs; ainda é necessário revisar e aprovar rapidamente as atualizações do motor e manter testes de recuperação se uma versão falhar.
- Testar vazamentos de DNS/WebRTC e isolamento das rotas Tor/I2P. O proxy Tor do Cypher não oferece, por si só, a resistência a fingerprinting do Tor Browser; evitar prometer equivalência até implementar e auditar proteções de padronização e isolamento.
- Testar compatibilidade e acessibilidade em fluxos reais: login, reprodução protegida, chamadas, permissões, leitor de tela e navegação só por teclado.

### Prioridade 1 — recursos esperados no dia a dia

- Passkeys, importação/exportação de dados e cobertura de testes do cofre atual de senhas e do preenchimento automático.
- Importar e exportar favoritos, senhas, histórico e configurações de outros navegadores.
- Perfis realmente separados, com dados, extensões, contas e inicializações próprios.
- Sincronização entre dispositivos com criptografia ponta a ponta; a opção atual WebDAV envia um JSON que o servidor pode ler.
- Grupos de abas, espaços de trabalho, divisão de tela e recuperação de sessão após falha.
- Instalação e gerenciamento de PWAs, modo de leitura e tradução integrada com controles claros de privacidade.
- Processo consistente de permissões para câmera, microfone, localização, notificações, pop-ups e downloads, com visão por site.

### Prioridade 2 — identidade própria do Cypher

- Marketplace de extensões e mods com autores, assinaturas verificáveis, avaliações, atualizações e reversão de versão.
- API e SDK próprios para extensões Cypher. Hoje `.cypherext` é um pacote proprietário que carrega uma extensão Chromium Manifest V2/V3; ainda não adiciona APIs exclusivas do Cypher.
- Completar os mods pedidos para temas, botões, wallpapers, animações, efeitos sonoros e música, mantendo permissões explícitas e um modo seguro para desativar mods.
- Painel de desempenho por aba, economia de memória, suspensão configurável de abas e diagnóstico de falhas.
- Ferramentas integradas de captura e anotação de página, organização por projetos e ações rápidas pesquisáveis.

## Ordem sugerida

1. Configurar a assinatura Ed25519 no GitHub, adicionar Authenticode e validar o instalador/atualizador em Windows limpo; manter uma cadência documentada de atualização do Chromium/Electron.
2. Importação/exportação, perfis separados, grupos de abas e recuperação de sessão.
3. Passkeys, gerenciador de senhas e sync criptografado com documentação de recuperação.
4. PWAs, modo de leitura, tradução e controles de privacidade por site.
5. SDK/marketplace de extensões e mods Cypher com assinatura e rollback.

O Cypher já tem a base de um navegador desktop funcional. Os maiores bloqueios para uma distribuição ampla são confiança da instalação/atualização, compatibilidade demonstrada, gestão de identidade e dados entre dispositivos, e o fechamento das diferenças entre o motor Electron e uma distribuição Chromium de navegador.
