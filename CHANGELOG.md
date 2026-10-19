# Cypher — novidades

## [Unreleased]

## [0.7.40] - 2026-10-18
- [Novo★] Gerenciador de tarefas: veja quanto de CPU, memória e rede cada aba usa e encerre a que travou. Abra com Shift Esc ou pelo menu. {abas}
- [Novo★] Limitadores de CPU, memória e banda: abas pesadas em segundo plano ficam mais lentas, as menos usadas são suspensas acima do limite e o download de cada aba pode ser limitado. Em Configurações → Sistema. {configuracoes}
- [Novo★] Recuperação depois de travar: se o Cypher fechar de repente, ele oferece reabrir as abas de onde você parou. {abas}
- [Novo] Ajustes por site: clique no cadeado da barra de endereço para desligar JavaScript ou imagens, limitar recursos e guardar o zoom de cada site.
- [Novo] Sessões salvas: guarde as abas abertas com um nome e reabra tudo depois, em Espaços e pesquisa.
- [Melhorado] Se a interface do Cypher travar, ela se recarrega sozinha sem fechar as abas.

## [0.7.39] - 2026-10-18
- [Novo★] Vídeo em janela flutuante: tire o vídeo da página e deixe-o por cima de tudo, pelo menu da aba, pela barra de endereço ou sozinho ao trocar de aba. {abas}
- [Novo★] Volume por aba: deixe cada aba mais alta ou mais baixa pelo menu da aba, sem mexer no volume do Windows. {abas}
- [Novo] Aviso de sites perigosos: o Cypher compara os endereços com a lista do Google Safe Browsing guardada no computador, sem enviar o que você visita. Liga assim que a compilação oficial trouxer a chave. {privacidade}
- [Novo] Preparação para Netflix, Disney+ e Spotify: as compilações com o módulo Widevine passam a funcionar com conteúdo protegido.
- [Melhorado] A barra de endereço mostra “Não seguro” também nos sites marcados como perigosos.

## [0.7.38] - 2026-10-18
- [Novo★] Importar de outro navegador: traga favoritos e histórico do Chrome, Edge, Brave, Vivaldi, Opera ou Firefox em um clique, em Configurações → Perfil e dados. {configuracoes}
- [Novo★] Salvar senha ao entrar: depois do login, o Cypher pergunta se quer guardar a senha no cofre local, e oferece atualizar quando ela muda. {privacidade}
- [Novo★] Telas de erro novas: avisos claros para site não encontrado, sem internet, conexão recusada e certificado inválido, com o que fazer em cada caso. {generico}
- [Novo] Modo HTTPS: o Cypher tenta a versão segura dos sites primeiro; no modo Somente HTTPS, avisa antes de abrir uma página sem criptografia.
- [Novo] Importar senhas por CSV: arquivos exportados pelo Chrome, Edge, Firefox, Brave, Bitwarden e 1Password.
- [Novo] Aviso de senhas vazadas (opcional): confere no Have I Been Pwned sem enviar a senha e marca as repetidas entre sites.
- [Melhorado] A barra de endereço mostra “Não seguro” quando o certificado do site não é confiável.

## [0.7.37] - 2026-10-18
- [Melhorado★] Navegar pelo teclado: botões, abas, interruptores e menus mostram com clareza onde está o foco ao usar Tab. {configuracoes}
- [Melhorado] Interruptores maiores e mais fáceis de acertar com o mouse em todas as páginas.
- [Melhorado] Nenhum texto da interface fica abaixo de 11 px, e as caixas de seleção das Configurações anunciam o nome para leitores de tela.
- [Corrigido] Contraste do modo claro: textos secundários, teclas de atalho, descrições e avisos ficaram legíveis.
- [Corrigido] A tecla Tab não passa mais pelos botões de minimizar, maximizar e fechar a janela, evitando fechar o Cypher sem querer.
- [Melhorado] Electron 44.9 com as correções de segurança mais recentes do Chromium, e React 19.3.1.

## [0.7.36] - 2026-10-18
- [Novo★] Canal Preview: experimente as próximas versões antes de todo mundo. Liga e desliga em Configurações → Sistema; ao sair, você fica na sua versão até a oficial chegar nela. {preview}
- [Melhorado★] Atualiza em segundo plano: o Cypher baixa a versão nova sozinho, avisa quando está pronta e instala quando você reiniciar ou fechar o navegador. {atualizacao}
- [Melhorado★] Nova tela de atualização: progresso real, etapas e as novidades passando enquanto instala, também na janela do instalador. {instalador}
- [Corrigido★] Copiar e colar depois de atualizar: o Cypher agora reabre como pelo atalho e a área de transferência funciona logo de cara. {generico}
- [Novo] Versões antigas saem de circulação: só as duas versões oficiais mais recentes navegam; sem internet para verificar, o Cypher abre normalmente.
- [Melhorado] Novidades depois de atualizar: mostram tudo que mudou desde a última versão que você usou, mesmo pulando várias.
- [Corrigido] Instaladores antigos acumulados: a pasta de atualizações agora guarda só a versão pronta para instalar.

## [0.7.35] - 2026-10-18
- Botões "Copiar" dos sites (código, respostas, links) voltaram a copiar direto para a área de transferência do Windows, sem perguntar, como no Chrome. Bloqueios que você salvou continuam valendo.
- Botões "Colar" de sites e editores online agora pedem sua permissão em vez de falhar sempre; em abas Tor e I2P continuam bloqueados.
- Permissões de sites mostram "Copiar" e "Colar" da área de transferência separadamente.

## [0.7.34] - 2026-10-18
- O botão direito na barra de endereço, na busca da Home e em todos os campos do Cypher abre um menu com Desfazer, Refazer, Recortar, Copiar, Colar e Selecionar tudo.
- No menu do botão direito dos sites, as opções de edição aparecem em português e ficam desativadas quando não se aplicam.
- Copiar a captura de tela para a área de transferência voltou a funcionar.

## [0.7.33] - 2026-10-18
- O bloqueio de anúncios voltou a funcionar: a lista EasyList empacotada nas versões 0.7.30 a 0.7.32 tinha sido gerada para uma versão anterior do bloqueador e era ignorada. A publicação agora confere as listas antes de gerar o instalador.
- Fechar o Cypher não gera mais um erro interno quando uma aba termina de fechar depois da janela.
- Com as abas no topo, a numeração segue 01, 02, 03… em vez de repetir 01.
- No modo claro, títulos das rotas Tor/I2P, da Proton VPN, das portas e da lista de senhas voltaram a aparecer.
- Execuções de teste e desenvolvimento não leem nem alteram mais a escolha de relatórios de erro feita no Cypher instalado.

## [0.7.32] - 2026-10-18
- Os painéis de proteção e de pop-ups não ficam mais escondidos atrás do site aberto.
- Menus, popovers e modais aparecem sobre uma imagem escurecida da página, em vez de a página sumir.
- Esc fecha qualquer menu ou popover; um clique fora fecha os popovers da barra; abrir um fecha os outros.
- Com um menu aberto, o teclado volta para a interface do Cypher.
- Menus, popovers, a paleta de comandos e os avisos ganharam o mesmo acabamento: cantos cortados, linha de destaque, sombra e uma entrada suave (desligada quando as animações estão desativadas).

## [0.7.31] - 2026-10-18
- Configurações viraram uma central única, com sete seções em abas: Visão geral, Aparência, Navegação, Privacidade e segurança, Perfil e dados, Extensões e Sistema.
- Segurança, Perfil e Extensões agora moram dentro da central; links e endereços antigos (cypher://security, cypher://profile, cypher://extensions) abrem direto na seção certa.
- Nova Visão geral mostra os bloqueios da semana, a rota padrão, o perfil ativo e a versão, com ações rápidas.
- Cada seção tem um sumário lateral que acompanha a rolagem, e a busca procura em todas as seções e leva até a opção.
- Todas as páginas internas ganharam o mesmo visual: cabeçalho compacto, blocos cortados lado a lado, interruptores e botões padronizados e estados vazios menores.
- Corrigido o bloco de perfis espremido, com nomes cortados e texto uma palavra por linha.
- O gráfico do relatório de privacidade só aparece quando há bloqueios para mostrar.

## [0.7.30] - 2026-10-18
- Novo instalador autoral no visual Recorte Noite, em seis etapas: boas-vindas, termos de uso, pasta, preferências, instalação e conclusão.
- Os termos de uso e o aviso de privacidade precisam ser aceitos antes de instalar; uma cópia fica salva na pasta do Cypher.
- A escolha da pasta mostra o espaço necessário e o disponível, avisa quando a pasta tem outros arquivos e oferece instalar só para você ou para todos os usuários.
- O instalador registra o Cypher como navegador no Windows, inclusive para arquivos HTML e PDF, e ao concluir abre a tela do Windows para você confirmá-lo como padrão.
- Enquanto os arquivos são copiados, um carrossel apresenta mods, modo edição, privacidade, tela dividida, paleta de comandos e a Home.
- Relatórios de erro opcionais: escolha no instalador ou em Configurações → Privacidade. Endereços de sites, nomes de usuário e e-mails são removidos, e você pode ver, copiar, relatar no GitHub ou apagar cada relatório.
- O desinstalador ganhou o mesmo visual e remove também os novos registros do Windows.
- Dependências atualizadas: Electron 44.7.2, TypeScript 7, lucide-react 1, Ghostery adblocker 2.20.1 e ações do GitHub v7.

## [0.7.29] - 2026-10-18
- Mods de verdade: pacotes .cyphermod mudam tema, papel de parede (imagem ou vídeo), sons da interface, música, fontes e até o visual dos sites que você visita.
- Música reativa: a camada base toca sempre e a camada de atividade cresce quando você clica, digita ou navega; ela pausa sozinha quando um site está tocando mídia.
- Estilos por site e filtros de página (CRT, Neon, Sépia, Noir e outros) são aplicados direto nas páginas, e um interruptor desliga tudo de uma vez.
- Vários mods podem ficar ativos juntos: ligue e desligue cada componente separadamente e defina qual mod tem prioridade.
- A página Mods virou uma loja com Instalados, Explorar, Criar mod e Temas rápidos; quatro mods vêm com o Cypher: Recorte Noite, Neon Grid, Fita K7 e Papel.
- O catálogo online é assinado com a chave do Cypher, e cada pacote é conferido pelo SHA-512 antes de instalar.
- Crie seu próprio mod dentro do navegador, com suas cores, papel de parede, sons, música, estilos por site e filtro, e exporte como .cyphermod.
- O modo de exibição Sistema agora acompanha de fato o claro ou escuro do Windows.

## [0.7.28] - 2026-10-18
- Modo edição (Ctrl E): clique em qualquer parte da interface, como barra, abas, trilho, área da página ou logo, e ajuste formato, posição, cores e fontes ali mesmo, com Desfazer.
- Tokens de design: tamanho do corte, altura da barra, densidade, espessura das bordas e fontes de título e texto agora são ajustáveis.
- Barra montável: reordene e oculte botões, coloque a barra na base da janela, esconda as abas até o ponteiro chegar à borda e oculte o trilho de atalhos.
- Peles .cypherskin podem ser importadas e exportadas, e o CSS personalizado da interface é aplicado por último; ambos aceitam só CSS, sem scripts nem endereços externos.
- O modo de exibição pode seguir o Windows, e cada Espaço pode usar a própria cor como destaque; dá para copiar a cor do site aberto.
- Todos os atalhos de teclado podem ser redefinidos em Configurações → Atalhos, com aviso de conflito.
- Tela dividida (Ctrl Shift D) mostra duas abas lado a lado, com divisória ajustável; painéis laterais deixam sites como WhatsApp ou Spotify fixos ao lado da página.
- Atalhos de busca: digite !yt, !gh, !w, !maps e outros na barra para pesquisar direto no site.
- Grupos de abas com cor e recolhimento, modo leitura (Ctrl Shift R) e captura de tela com caneta, marca-texto e retângulo (Ctrl Shift S).
- Rota por site abre endereços escolhidos sempre pelo Tor ou I2P; contêineres separam cookies e logins por aba; avisos de cookies são ocultados; e Segurança ganhou um relatório de privacidade dos últimos 7 dias.

## [0.7.27] - 2026-10-18
- Novo visual principal: a pele Recorte Noite traz silhuetas cortadas, tipografia condensada e uma barra superior única que reúne navegação, endereço, rotas e controles da janela.
- O botão Pele, na barra, e Configurações → Aparência trocam a pele entre Recorte e Clássico sem mudar suas cores; o mod Cypher Original restaura o visual anterior completo.
- As abas são numeradas, e a página interna ganhou um canto cortado com destaque na cor principal; as fontes Big Shoulders Display e Work Sans vêm embutidas no navegador.

## [0.7.26] - 2026-10-17
- Paleta de comandos (Ctrl Shift A) pesquisa abas abertas, favoritos, histórico e ações do navegador, com navegação pelo teclado.
- O menu de contexto das abas abre junto ao cursor e ganhou Recarregar, Duplicar, Copiar endereço, Fechar outras abas e Reabrir aba fechada; Ctrl 1–9 seleciona abas.
- Localizar na página mostra a posição e o total de resultados; Shift Enter volta ao resultado anterior.
- A barra de endereço mostra o zoom quando diferente de 100% e as sugestões ficam alinhadas a ela; o contador de bloqueios só aparece quando há bloqueios.
- A barra de ferramentas se adapta a janelas menores: rotas Tor e I2P viram ícones próprios e os botões do lado direito não saem mais da tela.
- A Home escala o layout inteiro de forma proporcional, sem cortes, setas de rolagem ou rolagem horizontal, e empilha os widgets em janelas muito estreitas.
- No editor da Home, os rótulos dos widgets não se sobrepõem mais ao conteúdo; a nota "Papel" acompanha o tema escuro.
- O tema claro da Home deixou de esconder título, relógio e atalhos.
- O histórico é agrupado por dia e permite copiar endereços; a lista de abas usa toda a altura da barra lateral.

## [0.7.25] - 2026-10-17
- Espaços de trabalho salvam conjuntos separados de abas; a área Espaços e pesquisa inclui fila de leitura com notas e sugestões locais de grupos por domínio.
- Perfis adicionais isolam preferências, histórico, favoritos, senhas e armazenamento de sites em arquivos e partições próprios; navegação de visitante usa sessão temporária.
- Economia de memória suspende após um limite configurável páginas normais ociosas sem formulários alterados ou mídia ativa e as recarrega ao voltar.
- O painel de privacidade mostra bloqueios por site, permite criar exceções de rastreamento e limpar dados e permissões daquele domínio.
- O cofre de senhas ganhou geração criptograficamente segura, revelar/ocultar e cópia da senha.
- O fluxo de publicação agora exige assinatura Ed25519 e executa verificações de tipos, testes unitários e smoke tests antes de empacotar.
- A CI valida PRs e atualizações de dependências; Dependabot verifica npm e GitHub Actions semanalmente.
- README e auditoria de prontidão atualizados para refletir a versão 0.7.25 e os recursos atuais.

## [0.7.24] - 2026-10-17
- Configurações, Mods, Histórico, Downloads e outras páginas internas agora reutilizam a aba atual em vez de abrir uma nova.

## [0.7.23] - 2026-10-17
- Os popovers de proteção agora se abrem alinhados abaixo dos respectivos botões na barra de endereço.

## [0.7.22] - 2026-10-17
- Os painéis de anúncios, rastreadores e pop-ups agora ficam sobrepostos à página sem alterar o espaço do layout.

## [0.7.21] - 2026-10-17
- O bloqueador nativo de pop-ups impede novas janelas inesperadas, mostra solicitações pendentes na barra de endereço e permite decidir por site.
- Após reiniciar com a atualização, o Cypher apresenta as mudanças em um onboarding passo a passo, com opção de pular ou começar a navegar.

## [0.7.20] - 2026-10-17
- Os atalhos de proteção abrem diretamente as configurações de anúncios e rastreadores.
- Os links de permissões levam à seção de permissões por site; as categorias de configurações ficam acessíveis pelo menu.
- O tamanho do texto da interface pode ser ajustado entre 100% e 140%, com 120% como padrão.
- Após atualizar, o Cypher mostra as mudanças da versão e aguarda o usuário escolher Continuar.
