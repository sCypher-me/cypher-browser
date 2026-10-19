# Cypher

Navegador livre para Windows e Linux, com interface própria, abas laterais por padrão e opção de abas horizontais, sobre o Chromium do Electron. Site: <https://scypher-me.github.io/cypher-browser/>.

**Licença:** GPL-3.0 (veja [LICENSE](LICENSE)). O suporte às APIs de extensões do Chrome usa a biblioteca [electron-chrome-extensions](https://github.com/samuelmaddock/electron-browser-shell), também sob GPL-3.0. Para publicar mods na loja, veja [docs/mods-comunidade.md](docs/mods-comunidade.md).

**Code signing policy:** os executáveis do Windows passam a ser assinados pela SignPath Foundation assim que o pedido for aprovado (em análise). Free code signing provided by [SignPath.io](https://about.signpath.io/), certificate by [SignPath Foundation](https://signpath.org/). Veja a [política de assinatura](docs/politica-de-assinatura.md) (equipe, processo e privacidade).

**Linux:** a release traz `Cypher-<versão>-Linux-x86_64.AppImage` e `Cypher-<versão>-Linux-amd64.deb` (gerados com `npx electron-builder --linux AppImage deb`). No Linux o Cypher avisa quando sai uma versão nova e abre a página de download; Tor e I2P usam os pacotes `tor` e `i2pd` do sistema.

## Executar

Requer Node.js 22.12 ou superior.

```powershell
npm install
npm exec -- install-electron --no
npm run build
npm start
```

Para desenvolver com atualização da interface: `npm run dev`.

Para gerar as duas opções para Windows: `npm run dist`. O processo baixa e valida os runtimes nativos do Tor e do i2pd antes de empacotar. O instalador autoral `Cypher-<versão>-Setup.exe` e o aplicativo portátil `Cypher-<versão>-Windows.exe` ficam em `release/`. Para gerar somente um deles, use `npm run dist:installer` ou `npm run dist:portable`. O Setup é um aplicativo próprio do Cypher, com interface e fluxo desenhados para o navegador, escolha de pasta, atalhos, progresso de instalação, tela de conclusão e desinstalador visual correspondente. Atualizações silenciosas usam o mesmo mecanismo, mantêm os atalhos escolhidos e reabrem o navegador quando terminam. O perfil de navegação é preservado ao atualizar e também ao desinstalar, a menos que a pessoa escolha removê-lo. O workflow exige assinatura Ed25519 do manifesto nas próximas releases; os executáveis ainda não têm assinatura Authenticode. Builds locais não recebem automaticamente as chaves oficiais.

## Atualizações automáticas

O Cypher consulta em segundo plano o manifesto `latest.json` do GitHub Releases. A ação `.github/workflows/release.yml` publica as duas versões, seus hashes SHA-512 e a assinatura Ed25519. Instalações compiladas com a chave pública oficial validam a assinatura do manifesto e a integridade do arquivo antes de atualizar; versões anteriores sem a chave pública continuam usando HTTPS e SHA-512. A versão portátil faz a troca segura do executável e a versão instalada executa o instalador em modo silencioso, reabre o navegador e exibe a animação de atualização. O link HTTPS de `github.com` e dos assets das Releases é o canal de distribuição, então não é preciso contratar ou configurar um servidor separado. A publicação falha se as chaves de assinatura não estiverem configuradas no GitHub Actions.

O canal está configurado para `sCypher-me/cypher-browser`. Para lançar uma versão, aumente a versão em `package.json` e crie uma tag correspondente no formato `vX.Y.Z`; a ação verifica os tipos, executa testes unitários e smoke tests, audita dependências, compila os executáveis, assina o manifesto e publica a Release.

## Implementado

- Motor Chromium real em `WebContentsView`, com isolamento de contexto, sandbox e acesso ao Node.js desativado nas páginas.
- Abas laterais ou horizontais, largura configurável, modo compacto, ordenação por arraste, fixação, fechamento e reabertura de abas.
- Endereços e pesquisa com DuckDuckGo, Google ou Bing; voltar, avançar, recarregar, parar e links em nova aba.
- Rota de conexão: Normal (proxy do sistema), Tor e I2P. O instalador inclui os runtimes oficiais do Tor e do i2pd; os botões iniciam o serviço selecionado, aplicam a rota às abas e impedem que as duas redes fiquem ativas ao mesmo tempo. Tor usa SOCKS5 na porta 9050; i2pd usa o proxy HTTP na porta 4444. Os dados dos roteadores ficam no perfil local do usuário. I2P é voltado a sites `.i2p`; navegar na web pública depende de um outproxy externo configurado no roteador.
- Proton VPN integrada ao navegador: o cliente vem incluído no Cypher, autentica pela conta Proton e aplica o proxy às abas normais sem instalar outro aplicativo. A conta gratuita e a disponibilidade dos servidores dependem da Proton; a VPN não cobre outros aplicativos do Windows e as rotas Tor/I2P continuam separadas.
- Abas privadas com sessão em memória, sem histórico local ou restauração; dados da sessão são limpos ao fechar a última aba privada. Downloads privados permanecem no disco, como em outros navegadores.
- Favoritos, histórico local, restauração de abas normais e preferências persistentes.
- Cofre de senhas local com criptografia do sistema operacional e preenchimento automático opcional por origem. O preenchimento fica desativado em abas privadas, Tor e I2P; ainda não há suporte a passkeys nem importação de cofres de outros navegadores.
- Sincronização de favoritos, histórico, preferências e Home por WebDAV HTTPS escolhido pelo usuário. O servidor WebDAV pode ler o JSON sincronizado; senhas de sites, extensões e sessões privadas não são enviados.
- Downloads com progresso, pausa, continuação enquanto o processo está aberto, cancelamento e acesso à pasta do arquivo. Downloads em andamento não são retomados automaticamente após reiniciar.
- Localizar na página, zoom, impressão, salvar HTML, tela cheia, ferramentas de desenvolvedor e menu de contexto.
- Solicitação de permissões para câmera/microfone, localização, notificações, tela cheia e área de transferência. É possível permitir uma vez, lembrar a escolha por site, bloquear ou rever/remover as regras na página Segurança; abas privadas nunca persistem essas escolhas.
- Proteções opcionais de privacidade: bloqueio local de uma lista limitada de domínios de anúncios e rastreadores, remoção de cookies em requisições entre hosts e sinal Não rastrear. Isso não equivale a um filtro completo de conteúdo.
- Integração de navegador padrão no instalador Windows: o Cypher se registra como candidato para HTTP/HTTPS e abre a tela de aplicativos padrão; a escolha final continua sendo feita pelo usuário no Windows.
- Inicialização configurável: Home, restauração de sessão ou até 10 páginas específicas, com opção de mostrar a Home primeiro; integração opcional com a inicialização do Windows.
- Idiomas preferidos enviados aos sites, verificação ortográfica do Chromium e opção de tradução sob demanda pelo Google Tradutor. A tradução só compartilha o endereço com o serviço quando você aciona a opção no menu da página.
- Aceleração gráfica configurável (aplicada após reiniciar), quatro políticas WebRTC e atalhos para configurações de proxy/rede do Windows. O DNS sobre HTTPS permanece configurado no sistema operacional.
- Gerenciador de extensões Chromium: carregar pasta descompactada local, ativar/desativar, reinstalar após falhas e remover a referência sem apagar os arquivos originais. O Electron não aceita `.crx` nem oferece todas as APIs do Chrome; extensões não carregam nas sessões privada, Tor ou I2P.
- Pacotes proprietários `.cypherext`: arquivos ZIP com metadados Cypher e extensão Chromium, instalação pela página Extensões, confirmação de permissões e validação contra travessia de diretórios, links simbólicos e arquivos excessivos. Formato e exemplo em [docs/cypher-extension-format.md](docs/cypher-extension-format.md) e `examples/hello-cypher-extension/`.
- Miniplayer em janela flutuante independente, com arte reconhecida pela aba que reproduz, controles em qualquer aba e fundo translúcido colorido pela capa; a página continua visível enquanto o painel está aberto.
- Controles de janela com ícones SVG próprios do Cypher e barras laterais mais compactas.
- Personalização de destaque, superfícies, fundo, fontes, cantos, animações e layout.
- Home de composição livre: arraste e redimensione widgets, que se ajustam para evitar sobreposição e recuperam o tamanho preferido quando o espaço fica livre.
- Conteúdo e aparência configuráveis por widget. Boas-vindas aceitam `{{date}}`, `{{time}}` e `{{city}}`; busca aceita motor próprio; atalhos têm listas independentes; relógio, favoritos, notas e temporizador têm opções específicas.
- Cada widget oferece variações visuais próprias no editor, com prévia ao vivo. Relógios, busca, atalhos, notas, favoritos, foco, texto, stickers, imagens e widgets de código têm estilos próprios para combinar com a Home.
- Quatro widgets novos e locais: calendário mensal navegável, lista de tarefas salva no perfil, contagem regressiva configurável e calculadora com precisão decimal escolhida pelo usuário.
- Navegação lateral: Home, Favoritos, Histórico, Downloads, Extensões e Mods; Segurança e Configurações ficam no rodapé, com acesso ao perfil e à foto local.
- Widgets de texto livre e stickers; imagens do dispositivo com ajuste e texto alternativo. Imagens ficam no perfil local e têm limite de 3 MB.
- Clique em um widget durante a edição para abrir suas opções. A aba Design mostra uma prévia ao vivo e controles de tamanho, rotação, espaçamento, cor, opacidade e cantos. O relógio tem seis visuais: digital, minimalista, analógico, flip, terminal e órbita.
- Widget de código para HTML, CSS e JavaScript próprios. O conteúdo roda em um iframe isolado, sem acesso às APIs do Cypher ou à rede.
- Quatro mods visuais embutidos e importação/exportação de pacotes JSON. Exemplo em `mods/example.cypher.json`.

## Mods nesta versão

O formato `schemaVersion: 1` aceita nome, autor, descrição e preferências visuais na propriedade `settings`. As propriedades são validadas e limitadas ao esquema. Esses mods não executam JavaScript e não alteram permissões de sites. Use **Mods → Importar mod** para abrir o exemplo, ou **Exportar visual** para compartilhar sua configuração.

## Próximas etapas

Próximos passos: passkeys e importação/exportação de dados; perfis isolados, grupos de abas e recuperação de sessão após falha; PWAs e modo de leitura; sincronização ponta a ponta; e uma API própria para extensões Cypher. O Electron não oferece equivalência total às APIs, serviços e DRM do Chrome, então compatibilidade deve ser validada a cada atualização. Consulte a [auditoria de prontidão](docs/browser-readiness-audit.md) para lacunas e prioridades.

O perfil local fica em `%APPDATA%/Cypher/`. Nunca é enviado para um servidor do Cypher; os sites e o mecanismo de busca recebem as requisições de navegação normalmente. Uma aba privada não torna a navegação anônima para sites ou provedores de internet.

## Verificações

```powershell
npm run check
npm test
npm run test:smoke
```

Os testes de integração usam um site HTTP local e um perfil temporário dentro de `.cypher-test-profile/`. Verificam navegação nativa, histórico, favoritos, alternância de layout, isolamento das páginas, limpeza da sessão privada, popups, downloads, validação de URLs e persistência. Capturas da interface são gravadas em `artifacts/`.

Referência da arquitetura: [WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view) e [segurança do Electron](https://www.electronjs.org/docs/latest/tutorial/security).

## Refinamento visual 0.1.1

Página inicial redesenhada com esfera orbital vetorial, hierarquia tipográfica mais clara, ícones de atalhos e seletor de pesquisa funcional. Abas, barra de endereço, configurações e mods receberam ajustes de legibilidade, alinhamento, contraste e espaçamento. O rodapé acompanha o conteúdo em janelas menores. O pacote desta revisão está em `release/refined/`.

## Home personalizável — 0.3.0

Na página inicial, clique em **Editar Home**. O painel tem três seções:

- **Widgets**: adicione boas-vindas, pesquisa, atalhos, relógio, notas, favoritos e foco. Arraste cada widget livremente pela Home e puxe qualquer borda ou canto para redimensioná-lo. Posição X/Y, largura e altura também podem ser ajustadas em pixels, com setas para ajustes precisos pelo teclado. Os widgets permanecem independentes quando se sobrepõem. Limite de 16 widgets; vários widgets do mesmo tipo são permitidos.
- **Visual**: escolha cards preenchidos, contornos ou visual minimalista, alinhamento e tamanho do título, margens, largura do espaço e intensidade da arte orbital. O conteúdo de cada widget se reorganiza conforme a largura e a altura disponíveis.
- **Conteúdo**: edite os títulos, a mensagem e o texto da pesquisa. Adicione, remova, reordene e edite até 12 atalhos com ícones configuráveis e endereços HTTP/HTTPS.

O layout é uma prévia até clicar em **Salvar Home**. **Cancelar** descarta o rascunho; **Restaurar padrão** também é uma prévia até salvar. Layouts de versões anteriores migram para as novas posições livres mantendo a disposição existente.

Notas são salvas automaticamente no perfil local. Em abas privadas, ficam apenas na memória do componente e desaparecem ao sair da Home. O timer de foco de uma aba normal continua contando enquanto você navega; o estado fica salvo no perfil e não envia notificações. O foco privado é temporário. As notas pessoais e o estado do timer não entram nos mods, que compartilham somente a configuração dos widgets e atalhos.

A versão portátil desta etapa está em `release/free-home-final/Cypher-0.3.0-Windows.exe`. Feche a versão anterior antes de abrir a nova, para usar o mesmo perfil sem duas instâncias concorrentes.

## Rotas Tor e I2P — 0.4.0

Use o seletor ao lado da barra de endereço para mudar a rota da aba atual. Ao alterar uma página externa, o Cypher a abre em uma nova aba na rota escolhida e mantém a aba anterior intacta. A escolha feita em Configurações é o padrão de novas abas. Links abertos a partir de uma página herdam sua rota.

Tor usa o runtime incluído e o proxy SOCKS5 local, na porta 9050 por padrão. I2P usa i2pd incluído e o proxy HTTP local, na porta 4444 por padrão. Ao selecionar uma rede, o Cypher inicia o serviço se necessário e mantém a conexão bloqueada até o proxy responder; uma falha não troca para a rede normal. Os runtimes são baixados de suas fontes oficiais e verificados por SHA-256 durante o build. WebRTC desativa UDP fora do proxy nessas rotas. Abas Tor/I2P usam sessões em memória, não entram no histórico e não são restauradas após fechar o aplicativo; os serviços iniciados pelo Cypher também são encerrados ao sair.

I2P é destinado principalmente a serviços da rede I2P. A navegação para sites da web pública depende de um outproxy configurado no roteador. Consulte as informações oficiais sobre o [proxy SOCKS do Tor](https://support.torproject.org/), a [FAQ do I2P](https://geti2p.net/en/faq) e as [sessões e configurações de proxy do Electron](https://www.electronjs.org/docs/latest/api/session).
