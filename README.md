# Cypher

Navegador desktop para Windows com interface dark própria, abas laterais por padrão e opção de abas horizontais. **Versão 0.7.4**, com navegação real em Chromium através do Electron.

## Executar

Requer Node.js 22.12 ou superior.

```powershell
npm install
npm exec -- install-electron --no
npm run build
npm start
```

Para desenvolver com atualização da interface: `npm run dev`.

Para gerar as duas opções para Windows: `npm run dist`. O instalador autoral `Cypher-<versão>-Setup.exe` e o aplicativo portátil `Cypher-<versão>-Windows.exe` ficam em `release/`. Para gerar somente um deles, use `npm run dist:installer` ou `npm run dist:portable`. O Setup é um aplicativo próprio do Cypher, com interface e fluxo desenhados para o navegador, escolha de pasta, atalhos, progresso de instalação, tela de conclusão e desinstalador visual correspondente. Atualizações silenciosas usam o mesmo mecanismo, mantêm os atalhos escolhidos e reabrem o navegador quando terminam. O perfil de navegação é preservado ao atualizar e também ao desinstalar, a menos que a pessoa escolha removê-lo. O pacote local ainda não tem assinatura digital.

## Atualizações automáticas

O Cypher consulta em segundo plano o manifesto `latest.json` do GitHub Releases. A ação `.github/workflows/release.yml` publica as duas versões e seus hashes SHA-512. Antes de atualizar, o aplicativo confere a integridade do arquivo; a versão portátil faz a troca segura do executável e a versão instalada executa o instalador em modo silencioso, reabre o navegador e exibe a animação de atualização. O link HTTPS de `github.com` e dos assets das Releases é o canal de distribuição, então não é preciso contratar ou configurar um servidor separado.

O canal está configurado para `sCypher-me/cypher-browser`. Até a primeira Release publicada, ainda não haverá uma versão nova para instalar. Para lançar uma versão, aumente a versão em `package.json` e crie uma tag correspondente (por exemplo, `v0.7.4`); a ação compila os executáveis, anexa o manifesto e publica a Release.

## Implementado

- Motor Chromium real em `WebContentsView`, com isolamento de contexto, sandbox e acesso ao Node.js desativado nas páginas.
- Abas laterais ou horizontais, largura configurável, modo compacto, ordenação por arraste, fixação, fechamento e reabertura de abas.
- Endereços e pesquisa com DuckDuckGo, Google ou Bing; voltar, avançar, recarregar, parar e links em nova aba.
- Rota de conexão por aba: Normal (proxy do sistema), Tor (SOCKS5 local) ou I2P (proxy HTTP local). As portas padrão podem ser alteradas nas configurações; Tor e I2P precisam estar instalados e em execução à parte.
- VPN nativa no Windows: lista perfis pessoais e compartilhados, abre o diálogo nativo para conectar, acompanha o estado e permite desconectar. A configuração e as credenciais ficam no Windows; é necessário configurar um perfil e contratar/fornecer um servidor VPN. O roteamento segue as regras (túnel dividido ou completo) desse perfil.
- Abas privadas com sessão em memória, sem histórico local ou restauração; dados da sessão são limpos ao fechar a última aba privada. Downloads privados permanecem no disco, como em outros navegadores.
- Favoritos, histórico local, restauração de abas normais e preferências persistentes.
- Downloads com progresso, pausa, continuação enquanto o processo está aberto, cancelamento e acesso à pasta do arquivo. Downloads em andamento não são retomados automaticamente após reiniciar.
- Localizar na página, zoom, impressão, salvar HTML, tela cheia, ferramentas de desenvolvedor e menu de contexto.
- Solicitação de permissões para câmera/microfone, localização, notificações, tela cheia e área de transferência. É possível permitir uma vez, lembrar a escolha por site, bloquear ou rever/remover as regras na página Segurança; abas privadas nunca persistem essas escolhas.
- Proteções opcionais de privacidade: bloqueio local de uma lista limitada de domínios de anúncios e rastreadores, remoção de cookies em requisições entre hosts e sinal Não rastrear. Isso não equivale a um filtro completo de conteúdo.
- Integração de navegador padrão no instalador Windows: o Cypher se registra como candidato para HTTP/HTTPS e abre a tela de aplicativos padrão; a escolha final continua sendo feita pelo usuário no Windows.
- Inicialização configurável: Home, restauração de sessão ou até 10 páginas específicas, com opção de mostrar a Home primeiro; integração opcional com a inicialização do Windows.
- Idiomas preferidos enviados aos sites, verificação ortográfica do Chromium e opção de tradução sob demanda pelo Google Tradutor. A tradução só compartilha o endereço com o serviço quando você aciona a opção no menu da página.
- Aceleração gráfica configurável (aplicada após reiniciar), quatro políticas WebRTC e atalhos para configurações de proxy/rede do Windows. O DNS sobre HTTPS permanece configurado no sistema operacional.
- Gerenciador de extensões Chromium: carregar pasta descompactada local, ativar/desativar, reinstalar após falhas e remover a referência sem apagar os arquivos originais. O Electron não aceita `.crx` nem oferece todas as APIs do Chrome; extensões não carregam nas sessões privada, Tor ou I2P.
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

O objetivo é um navegador completo, mas ainda faltam gerenciador de senhas, autofill, sincronização, importação de perfis, múltiplas janelas, marketplace de mods, sons personalizados e mods funcionais. O suporte a extensões é parcial: o Electron não fornece equivalência total às extensões e serviços do Chrome. Conteúdo com DRM e alguns fluxos de autenticação precisam de trabalho específico e validação antes de serem prometidos.

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

Tor usa o proxy SOCKS5 local, na porta 9050 por padrão (9150 é comum no Tor Browser). I2P usa o proxy HTTP local, na porta 4444 por padrão. O Cypher não instala nem inicia esses serviços: o status nas configurações verifica se a porta local responde. Uma rota Tor/I2P indisponível falha sem passar para a conexão normal. WebRTC desativa UDP fora do proxy nessas rotas. Abas Tor/I2P usam sessões em memória, não entram no histórico e não são restauradas após fechar o aplicativo; downloads e favoritos escolhidos pelo usuário continuam sendo ações explícitas.

I2P é destinado principalmente a serviços da rede I2P. A navegação para sites da web pública depende de um outproxy configurado no roteador. Consulte as informações oficiais sobre o [proxy SOCKS do Tor](https://support.torproject.org/), a [FAQ do I2P](https://geti2p.net/en/faq) e as [sessões e configurações de proxy do Electron](https://www.electronjs.org/docs/latest/api/session).
