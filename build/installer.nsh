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

; Register Cypher as a browser candidate without replacing the user's Windows choice.
!macro customInstall
  WriteRegStr HKCU "Software\Classes\CypherURL" "" "Cypher URL"
  WriteRegStr HKCU "Software\Classes\CypherURL" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\CypherURL\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr HKCU "Software\Classes\CypherURL\shell\open\command" "" "$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\" $\"%1$\""
  WriteRegStr HKCU "Software\Cypher\Capabilities" "ApplicationName" "Cypher"
  WriteRegStr HKCU "Software\Cypher\Capabilities" "ApplicationDescription" "Navegador Cypher"
  WriteRegStr HKCU "Software\Cypher\Capabilities" "ApplicationIcon" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr HKCU "Software\Cypher\Capabilities\URLAssociations" "http" "CypherURL"
  WriteRegStr HKCU "Software\Cypher\Capabilities\URLAssociations" "https" "CypherURL"
  WriteRegStr HKCU "Software\RegisteredApplications" "Cypher" "Software\Cypher\Capabilities"
!macroend

!macro customUnInstall
  DeleteRegValue HKCU "Software\RegisteredApplications" "Cypher"
  DeleteRegKey HKCU "Software\Cypher\Capabilities"
  DeleteRegKey HKCU "Software\Classes\CypherURL"
!macroend
