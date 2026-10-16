# Auditoria de prontidão do Cypher

**Base analisada:** código e documentação do Cypher 0.7.17. Esta auditoria descreve o estado do repositório, não certifica a segurança de uma versão publicada.

## O que já existe

| Área | Estado no projeto |
|---|---|
| Motor e navegação | Chromium real via Electron, abas laterais ou horizontais, navegação, zoom, impressão, salvar página, localizar, pop-ups em abas e downloads. |
| Organização | Favoritos, histórico, restauração de abas, abas privadas, preferências de início e Home personalizável com widgets. |
| Proteções | Sandbox, isolamento de contexto, Node desativado nas páginas, permissões por site, filtro local de rastreadores e controles de cookies/WebRTC. |
| Rotas especiais | Tor e I2P incluídos como proxies locais; Proton VPN é integrado pelo navegador e depende do serviço/conta do provedor. |
| Extensões | Pastas locais e pacotes assinados da Chrome Web Store, com compatibilidade parcial das APIs Chromium/Electron. Pacotes `.cypherext` agora têm formato e importação próprios. |
| Perfil e dados | Perfil local. Sincronização disponível por WebDAV configurado pelo usuário; não há nuvem Cypher. |
| Distribuição | Atualizações por GitHub Releases com hash SHA-512. O atualizador agora aceita e valida manifestos Ed25519 quando a chave pública oficial está fixada no aplicativo; as chaves ainda precisam ser configuradas no GitHub Actions para ativar essa proteção nas releases. A auditoria de dependências está agendada semanalmente e bloqueia releases com alertas altos ou críticos. O instalador ainda não tem assinatura Authenticode. |

## Principais lacunas para competir com navegadores atuais

### Prioridade 0 — confiança e segurança de lançamento

- Assinar digitalmente o instalador e os binários com Authenticode; deixar a origem da atualização verificável além do hash do arquivo. A validação Ed25519 do manifesto foi implementada, mas só fica ativa após configurar as chaves descritas em [update-signing.md](update-signing.md).
- Formalizar o ciclo de atualizações de Chromium/Electron, com verificações automatizadas de segurança, política de suporte e recuperação se uma versão falhar. A verificação semanal de dependências e o bloqueio de releases com alertas altos/críticos foram adicionados; falta definir e automatizar a cadência de atualização do Chromium/Electron.
- Testar vazamentos de DNS/WebRTC e isolamento das rotas Tor/I2P. O proxy Tor do Cypher não oferece, por si só, a resistência a fingerprinting do Tor Browser; evitar prometer equivalência até implementar e auditar proteções de padronização e isolamento.
- Testar compatibilidade e acessibilidade em fluxos reais: login, reprodução protegida, chamadas, permissões, leitor de tela e navegação só por teclado.

### Prioridade 1 — recursos esperados no dia a dia

- Gerenciador de senhas com preenchimento seguro e suporte a passkeys.
- Importar e exportar favoritos, senhas, histórico e configurações de outros navegadores.
- Perfis realmente separados, com dados, extensões, contas e inicializações próprios.
- Sincronização entre dispositivos com criptografia ponta a ponta, além da opção atual de WebDAV.
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

1. Assinatura e atualização segura; rotina de atualização de Chromium; testes de segurança e compatibilidade.
2. Importação/exportação, perfis separados, grupos de abas e recuperação de sessão.
3. Passkeys, gerenciador de senhas e sync criptografado com documentação de recuperação.
4. PWAs, modo de leitura, tradução e controles de privacidade por site.
5. SDK/marketplace de extensões e mods Cypher com assinatura e rollback.

O Cypher já tem a base de um navegador desktop funcional. Os maiores bloqueios para uma distribuição ampla são confiança da instalação/atualização, compatibilidade demonstrada, gestão de identidade e dados entre dispositivos, e o fechamento das diferenças entre o motor Electron e uma distribuição Chromium de navegador.
