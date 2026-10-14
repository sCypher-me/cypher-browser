!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Seu próximo navegador começa aqui"
  !define MUI_WELCOMEPAGE_TEXT "O Cypher foi criado para se adaptar ao seu jeito de navegar.$\r$\n$\r$\nNas próximas etapas, escolha onde instalar o navegador e para quem ele ficará disponível."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customUnWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Remover o Cypher"
  !define MUI_WELCOMEPAGE_TEXT "O assistente vai remover o aplicativo Cypher.$\r$\n$\r$\nSeus dados pessoais de navegação serão preservados."
  !insertmacro MUI_UNPAGE_WELCOME
!macroend
