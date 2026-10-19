# Code signing policy · Política de assinatura de código

Free code signing provided by [SignPath.io](https://about.signpath.io/), certificate by [SignPath Foundation](https://signpath.org/).

> **Situação:** pedido de certificado em análise na SignPath Foundation. Enquanto ele não for aprovado, as versões saem sem assinatura Authenticode; as notas de cada release dizem quando a versão foi assinada.

Os executáveis do Cypher para Windows (`Cypher.exe`, o desinstalador, `Cypher-<versão>-Setup.exe` e `Cypher-<versão>-Windows.exe`) são assinados com Authenticode pela SignPath Foundation. A assinatura só acontece no GitHub Actions, a partir do código deste repositório, depois da aprovação manual de cada versão.

## Como funciona

1. Uma tag `vX.Y.Z` assinada dispara o workflow [`release.yml`](../.github/workflows/release.yml).
2. A CI compila o aplicativo e envia `Cypher.exe` e o desinstalador para a SignPath (configuração [`app`](../.signpath/artifact-configurations/app.xml)).
3. Com o aplicativo assinado, a CI monta a versão portátil e o instalador e os envia para uma segunda assinatura (configuração [`release`](../.signpath/artifact-configurations/release.xml)).
4. Os manifestos de atualização usam o SHA-512 dos arquivos já assinados e são assinados com Ed25519.

Componentes de terceiros incluídos sem modificação (Electron/Chromium, Tor, i2pd, extensão Proton VPN) mantêm as assinaturas e licenças de seus autores e não são assinados em nome do Cypher. As versões assinadas pela SignPath Foundation não incluem componentes proprietários (como o módulo Widevine).

## Equipe

| Papel | Quem |
| --- | --- |
| Autores (commits sem revisão adicional) | [@sCypher-me](https://github.com/sCypher-me) |
| Revisores (revisam pull requests de terceiros) | [@sCypher-me](https://github.com/sCypher-me) |
| Aprovadores (aprovam cada pedido de assinatura) | [@sCypher-me](https://github.com/sCypher-me) |

Todos os membros usam autenticação em dois fatores no GitHub e na SignPath.

## Privacidade

O Cypher não envia dados para outros sistemas sem que você peça, exceto pelas conexões descritas abaixo. Todas aparecem nos termos mostrados durante a instalação e podem ser desligadas:

- **Atualizações:** consulta os manifestos assinados no GitHub deste projeto.
- **Sites perigosos (Google Safe Browsing):** quando ligado, baixa listas de prefixos de hash e compara os endereços no computador. Só envia ao Google um prefixo de 4 bytes do hash quando há coincidência local, nunca o endereço. Desligue em Configurações → Privacidade → Sites perigosos.
- **Senhas vazadas (Have I Been Pwned):** desligado por padrão. Quando ligado, envia só os 5 primeiros caracteres do hash SHA-1 da senha.
- **Relatórios de erro:** só com o seu consentimento, sem endereços, nomes de usuário ou arquivos pessoais.
- **Catálogo de mods:** consultado no GitHub deste projeto quando você abre a aba Explorar.

O texto completo está em [installer/TERMOS-DE-USO.txt](../installer/TERMOS-DE-USO.txt).
