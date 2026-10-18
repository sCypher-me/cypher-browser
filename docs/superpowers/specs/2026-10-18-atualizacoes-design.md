# Sistema de atualização, bloqueio por versão e canal Preview — design

Data: 2026-10-18 · Versão alvo: 0.7.36

## Por quê

- Depois de uma atualização, o Cypher reaberto pelo atualizador fica sem copiar e colar (o "Colar" aparece cinza); reaberto pelo atalho, funciona. O atualizador inicia o instalador herdando variáveis internas do Electron antigo (`CHROME_CRASHPAD_PIPE_NAME`, `ELECTRON_*`, `NODE_*`), e o instalador reabre o Cypher dentro dessa cadeia.
- A atualização só começa quando o usuário clica, baixa tudo na hora e mostra um popup simples. A pasta `updates` acumula instaladores antigos (~190 MB cada, desde a 0.7.5).
- As novidades depois de atualizar dependem de um texto passado pela linha de comando (limite de 3.000 caracteres) e mostram só a última versão, mesmo quando o usuário pulou várias.
- Não existe como impedir o uso de versões muito antigas nem como testar versões antes do público.

## Decisões do usuário

1. **Bloqueio:** a navegação para se o Cypher estiver mais de 2 versões oficiais atrás. Valem a mais nova e a anterior. Aparece uma tela com "Atualizar agora". **Sem internet para verificar, o Cypher abre normalmente.**
2. **Instalação:** baixa sozinho em segundo plano, avisa "pronto para instalar" e instala ao reiniciar ou quando o usuário clicar.
3. **Preview/Beta:** opção em Configurações → Sistema. Quem sai do Preview fica na versão atual até a oficial alcançá-la (sem rebaixar).
4. **Visual:** popup de atualização **A1 (Transmissão, versão caprichada)** e onboarding **R1 (Capas)**, conforme os modelos aprovados (`.superpowers/brainstorm/…/update-a1-r1-v3.html`).

## Canais e manifestos

- **Oficial:** tag `vX.Y.Z`, release marcada como *latest*, com `latest.json` (mantido para clientes antigos).
- **Preview:** tag `vX.Y.Z-beta.N`, release *prerelease* (nunca *latest*). Mesmos artefatos (Setup e portátil), assinados igual.
- **Canais fixos:** uma release fixa `update-channels` (prerelease, como `mods-catalog`) guarda `stable.json` e `preview.json`, assinados com Ed25519, que a release atualiza a cada publicação. O cliente lê:
  - canal oficial: `releases/download/update-channels/stable.json`;
  - Preview: `preview.json` e `stable.json`, e fica com a versão mais alta das duas.
- **Manifesto (schemaVersion 2)**, acrescentando ao atual:
  - `channel` (`stable` | `preview`)
  - `minimumVersion`: a versão oficial anterior à atual, calculada na release a partir das tags oficiais
  - `publishedAt`
  - `notes`: lista estruturada (abaixo)
  - `releaseNotes` em texto continua existindo, para compatibilidade.
- **Versões:** passam a aceitar `X.Y.Z-beta.N`. Comparação semver: `0.7.37-beta.1 < 0.7.37`.

## Bloqueio por versão

- Depois de uma verificação **bem-sucedida** do canal oficial, se `versãoAtual < minimumVersion`, o navegador entra no estado `blocked`.
  - Para comparar, um Preview usa a versão-base: `0.7.37-beta.1` conta como `0.7.37`.
- Em `blocked`:
  - as páginas nativas ficam ocultas e navegar, abrir abas e mudar de rota são recusados no processo principal;
  - a interface mostra a tela de bloqueio no visual A1: "Esta versão saiu de circulação", a versão atual e a mínima, e "Atualizar agora", que baixa e instala com o popup A1.
- Se a verificação falhar (sem internet, erro HTTP, manifesto inválido), **não bloqueia**. O estado anterior de bloqueio não é guardado entre sessões.

## Atualização em segundo plano

- Verifica 8 s depois de abrir e a cada 6 h (como hoje). Ao achar uma versão nova, baixa sozinho com baixa prioridade e retoma do zero se falhar, tentando de novo na próxima verificação. Confere o SHA-512 e a assinatura.
- Estados: `idle → checking → downloading → ready → installing → restarting`, mais `up-to-date`, `blocked` e `error`.
- **Pronto:** um selo discreto na barra ("Atualização pronta"), um aviso único no estilo das camadas novas e o card em Sistema. Ações: "Reiniciar e atualizar" agora ou "Ao fechar".
- **Ao fechar:** se houver atualização `ready`, o Cypher fecha e roda o instalador em silêncio, **sem reabrir**. Na próxima abertura, já está na versão nova.
- **Limpeza:** ao iniciar, apaga de `userData/updates` todo instalador que não seja o da atualização pronta.

## Instalação e reabertura (correção do colar)

- O atualizador inicia o Setup com um **ambiente limpo**: sem `ELECTRON_*`, `CHROME_*`, `NODE_*` nem `npm_*`.
- O Setup reabre o Cypher **pelo Explorer**, como o atalho (`explorer.exe "<caminho>\Cypher.exe"`). Os argumentos de pós-atualização deixam de ser necessários (ver Onboarding).
- **Popup A1 do lado do instalador:** no modo silencioso iniciado pelo atualizador (nova flag `--progress-ui`), o Setup mostra uma janela sem borda no visual A1, com o progresso real (arquivos copiados), as etapas Baixado ✓ / Assinatura ✓ / Instalando / Reabrir e o letreiro com os títulos das novidades. Ao terminar, reabre o Cypher e fecha.
- **No navegador:** ao clicar em "Reiniciar e atualizar", aparece o A1 em tela cheia com as etapas já cumpridas por um instante, e o Cypher fecha. A janela do Setup continua a mesma animação.

## Onboarding pós-atualização (R1)

- O app guarda `lastRunVersion` em `userData`. Ao abrir com versão maior, mostra as novidades de **todas** as versões entre a anterior e a atual.
- **Fonte das novidades:** a build gera `dist/changelog.json` a partir do `CHANGELOG.md`. Não há mais passagem por linha de comando.
- **Formato do CHANGELOG** (compatível com o atual), com prefixo opcional por item:
  - `- [Novo] Título: descrição`, `- [Melhorado] …`, `- [Corrigido] …`
  - item sem prefixo conta como Melhorado;
  - `[Novo★]` ou `[Melhorado★]` marca destaque, com `{ilustração}` opcional no fim: `preview`, `atualizacao`, `privacidade`, `configuracoes`, `abas`, `mods`, `instalador`, `generico`.
- **Telas:** uma **capa** por destaque (até 4) com a ilustração correspondente (componentes React desenhados no estilo aprovado). A **última página**, "Tudo que mudou", traz as três colunas Novo / Melhorado / Corrigido. Navegação por setas, Esc fecha, "Pular".
- Sem destaques marcados, mostra só a última página.

## Configurações → Sistema (card de atualização)

- Versão atual e canal, estado (com progresso quando baixando), "Verificar agora", "Reiniciar e atualizar" quando pronto, notas da versão pronta.
- Interruptor **"Participar do Preview"**, com explicação. Ao desligar: "Você fica na 0.7.37-beta.1 até a versão oficial chegar nela."

## Release

- `release.yml` aceita `vX.Y.Z` e `vX.Y.Z-beta.N`, e `package.json` precisa ter a mesma versão (com o sufixo).
  - Oficial: release *latest* + `latest.json` + atualiza `stable.json`.
  - Preview: *prerelease* + atualiza `preview.json`.
- `minimumVersion` = segunda maior tag oficial `vX.Y.Z` existente (incluindo a nova). Com uma só oficial, é ela mesma.
- `notes` vem do mesmo parser do `changelog.json`.

## Restrições

- Assinatura Ed25519 e SHA-512 continuam obrigatórios. Manifestos de canal são assinados com a mesma chave.
- Clientes 0.7.35 e anteriores continuam atualizando via `latest.json`.
- Versão portátil: mesmas regras de canal e bloqueio. A instalação continua pelo script atual, com ambiente limpo.
- Testes e desenvolvimento nunca baixam nem instalam (já é assim: `app.isPackaged`).

## Fora do escopo

- Atualizações diferenciais (delta).
- Servidor próprio; continua GitHub Releases.

## Fracasso, mesmo que funcione

- O colar não funcionar depois de uma atualização.
- Bloquear alguém sem internet ou por erro do GitHub.
- Um usuário do Preview ser rebaixado ao sair do canal.
- Instalar sozinho no meio do uso, sem o usuário pedir ou fechar o app.

## Decisões minhas (o usuário pode revisar)

- Instalar "ao fechar" roda em silêncio, sem a janela A1, porque o usuário já saiu do app. A janela A1 do Setup aparece só quando ele clica em "Reiniciar e atualizar".
- O bloqueio só passa a existir a partir da 0.7.36; versões antigas não têm o código. Quem está na 0.7.35 atualiza pelo caminho antigo, e o Setup novo já reabre pelo Explorer, então a correção do colar vale desde essa atualização.
- Bloqueio e Preview usam só versões oficiais para calcular o mínimo; um Preview nunca torna o mínimo mais alto.

## Deixado para quem constrói

Textos finais, desenho exato de cada ilustração dentro do estilo aprovado, divisão de arquivos, como animar a janela WinForms do Setup e o nome do selo na barra.
