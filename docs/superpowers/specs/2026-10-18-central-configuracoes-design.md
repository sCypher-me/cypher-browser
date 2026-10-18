# Central de Configurações e páginas nativas — design

Data: 2026-10-18 · Versão alvo: 0.7.31

## Por quê

As páginas internas do Cypher cresceram uma de cada vez e hoje:

- repetem assuntos em dois lugares (Privacidade em Configurações **e** em Segurança; Perfil, Mods e Downloads têm página própria **e** categoria em Configurações), então o usuário não sabe aonde ir;
- Configurações tem 16 categorias numa lista lateral que não cabe na tela, e cada painel repete etiqueta + ícone + título + descrição antes do controle;
- o título gigante de cada página ocupa ~1/3 da tela antes de qualquer conteúdo;
- misturam o visual Recorte (cortes, tipografia condensada) com cartões arredondados e três estilos de botão;
- têm layouts quebrados (Perfil → "Perfis do navegador" espremido; texto de visitante uma palavra por linha) e buracos vazios (gráfico de Segurança zerado, Histórico vazio).

O usuário quer **organização** e **aparência** consertadas.

## Decisões do usuário

1. **Central única**: Configurações vira o lugar de tudo. Segurança, Perfil e Extensões deixam de ser páginas separadas e entram nela.
2. **Mods fica separado**, com página própria (é uma loja).
3. Organização em **7 seções** (proposta aprovada): Visão geral, Aparência, Navegação, Privacidade e segurança, Perfil e dados, Extensões, Sistema.
4. Navegação entre seções por **abas no topo** (modelo B), com o sumário da seção aberta numa coluna estreita ao lado do conteúdo.

## Decisões minhas (o usuário pode revisar)

- Histórico, Favoritos, Downloads e Espaços continuam páginas próprias, abertas pelo trilho de ícones, só com o visual novo.
- Mods recebe o mesmo cabeçalho compacto e o mesmo sistema de componentes, mantendo suas abas internas (Instalados, Explorar, Criar mod, Temas rápidos).
- Os endereços antigos continuam funcionando: `cypher://security` abre a Central em Privacidade e segurança, `cypher://profile` em Perfil e dados, `cypher://extensions` em Extensões. Atalhos do trilho, menus e links internos passam a apontar para a seção certa.
- A categoria "Mods" de Configurações sai: os controles dela (sons, música, efeitos nas páginas) já estão na página Mods. Aparência ganha um bloco "Mods" com o mod ativo e um botão que abre a loja.
- Busca no topo da Central procura em todas as seções (usa o índice de preferências que já existe) e leva até o item, destacando-o.

## Estrutura da Central

Cabeçalho compacto (≈96px): trilha "CYPHER / CONFIGURAÇÕES", título condensado ~34px, busca à direita (Ctrl K foca a busca).
Abaixo, faixa de abas: as 7 seções. Aba ativa sublinhada na cor de destaque. Em janelas estreitas a faixa rola na horizontal.
Corpo: coluna de sumário (~170px, fixa ao rolar, some abaixo de ~1100px de largura) + conteúdo em grade de blocos (2 colunas; 1 coluna em janelas estreitas). Clicar num item do sumário rola até o bloco.

Conteúdo de cada seção (o que já existe hoje, redistribuído; nenhuma função é removida):

| Seção | Blocos |
|---|---|
| **Visão geral** | Estado da proteção (bloqueios da semana, rota padrão), perfil ativo com foto, versão e atualização, atalhos para as ações mais usadas (pele, limpar dados, aba privada, verificar atualização) |
| **Aparência** | Pele, peles instaladas, cores e modo, tokens de design, fontes, barra de ferramentas, abas e trilho, página inicial, CSS personalizado, sons e música da interface |
| **Navegação** | Pesquisa e atalhos de busca, ao iniciar, abas e links, idiomas e tradução, downloads, atalhos de teclado, painéis laterais |
| **Privacidade e segurança** | Resumo da semana (relatório atual), bloqueios (anúncios, rastreadores, pop-ups, cookies, avisos de cookies, DNT), rotas Tor/I2P/VPN e rotas por site, contêineres, permissões de sites, exceções, senhas, limpeza (agora e ao sair), relatórios de erro |
| **Perfil e dados** | Perfil ativo e foto, perfis do navegador (criar, trocar), visitante, sincronização WebDAV |
| **Extensões** | Instalar pela loja/.cypherext/pasta, lista de extensões, aviso de compatibilidade |
| **Sistema** | Desempenho (aceleração, economia de memória), acessibilidade (tamanho do texto, movimento), iniciar com o Windows, navegador padrão, atualização, DNS/proxy do sistema |

## Sistema visual (vale para todas as páginas internas)

- Um só conjunto de componentes no visual Recorte: **bloco** (fundo de superfície, borda fina, cantos cortados), **linha** (título + detalhe à esquerda, controle à direita, separadas por filete), **interruptor** em paralelogramo, **botões** em três níveis só (primário laranja inclinado, secundário com borda, discreto só texto), **chip** para escolhas curtas, **número grande** condensado para estatísticas.
- Etiqueta de seção pequena e condensada na cor de destaque; título do bloco em texto forte; descrição só quando acrescenta informação (as descrições redundantes são cortadas).
- Nenhum cartão arredondado, sombra ou gradiente decorativo dentro das páginas internas.
- Estados vazios compactos (uma linha de texto e, se fizer sentido, uma ação), sem gráficos zerados ocupando espaço: o gráfico da semana só aparece quando há dados.
- Cabeçalho compacto igual em todas as páginas (Central, Mods, Histórico, Favoritos, Downloads, Espaços); o título gigante sai.
- Tudo respeita as variáveis de tema já existentes (cor de destaque, superfície, fundo, tokens de corte e densidade, pele Clássico), então mods e peles continuam mudando essas páginas.

## Restrições

- Nenhuma função atual pode sumir; tudo que hoje está em Configurações, Segurança, Perfil e Extensões precisa ter lugar na Central.
- IDs de foco usados por links internos (`navigate('settings', { focusId })`, `navigate('security', { focusId: 'site-permissions' })` etc.) continuam funcionando, apontando para a nova seção.
- Smoke tests existentes continuam passando (ajustando seletores que mudarem).
- Funcionar de 960px até telas grandes, sem rolagem horizontal na página.
- Pele Clássico e mods precisam continuar aplicando cores e cantos nas páginas.

## Fora do escopo

- Mudar a Home, a barra superior, o trilho de ícones ou a lista de abas.
- Novas funções; esta entrega é organização e aparência.

## Fracasso, mesmo que funcione

- Se o usuário procurar algo que existia e não achar.
- Se ainda houver dois estilos visuais convivendo nas páginas internas.
- Se as páginas ficarem com menos área útil que hoje.

## Deixado para quem constrói

Ordem exata dos blocos dentro de cada seção, textos finais dos títulos e detalhes, divisão em componentes React e arquivos CSS, e como migrar os IDs de foco.
