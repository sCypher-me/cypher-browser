# Cypher — novidades

## [Unreleased]

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
