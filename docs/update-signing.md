# Assinatura dos manifestos de atualização

O atualizador pode validar a assinatura Ed25519 de `latest.json` antes de oferecer uma versão. A chave pública fica incluída em `electron/update-config.json` na compilação; a chave privada é lida somente pelo workflow de release e nunca deve entrar no repositório.

## Ativar a assinatura nas releases

1. Gere um par de chaves Ed25519 em um ambiente confiável. Com OpenSSL, por exemplo: `openssl genpkey -algorithm Ed25519 -out cypher-update-private.pem` e `openssl pkey -in cypher-update-private.pem -pubout -out cypher-update-public.pem`. Guarde a chave privada em backup seguro; nunca a adicione ao repositório.
2. No GitHub, abra **Settings → Secrets and variables → Actions** do repositório `sCypher-me/cypher-browser`.
3. Cadastre a chave privada como **Actions secret** `CYPHER_UPDATE_SIGNING_PRIVATE_KEY`.
4. Cadastre a chave pública correspondente como **Actions variable** `CYPHER_UPDATE_SIGNING_PUBLIC_KEY`.
5. Publique uma nova versão do Cypher. O workflow confere se as duas chaves correspondem, grava a chave pública no aplicativo e assina o manifesto com Ed25519.

O workflow aborta se as chaves estiverem ausentes, apenas uma estiver definida ou se o par não corresponder. A assinatura Ed25519 é obrigatória para publicar novas releases. SHA-512 continua sendo conferido para detectar corrupção do arquivo baixado; a assinatura autentica o manifesto e a origem da atualização para versões que já fixam a chave pública.

As versões do Cypher compiladas com uma chave pública fixada recusam manifestos sem assinatura ou com assinatura inválida. Versões anteriores continuam ignorando o campo adicional e validam o hash SHA-512, permitindo a transição sem interromper o atualizador já instalado.

## Rotação e perda da chave

O atualizador ainda não suporta rotação de chaves. Não substitua a variável pública depois de ativar a assinatura: aplicativos instalados confiam na chave que veio dentro deles. Mantenha uma cópia de recuperação da chave privada em armazenamento seguro; perdê-la exige distribuir um novo aplicativo por outro canal confiável ou implementar e publicar uma transição de confiança antes de trocar a chave.

## Limite atual

Esta assinatura protege a autenticidade do manifesto para aplicativos que já têm a chave pública pinada. Ela não substitui assinatura Authenticode do instalador e dos binários, assinatura/verificação do código-fonte, proteção da conta do mantenedor ou publicação de atualizações de Chromium/Electron.
