# Publicar um mod da comunidade

Qualquer pessoa pode publicar um mod na loja do Cypher. Depois de revisado e aceito, ele entra no catálogo assinado e aparece em **Mods → Explorar → Da comunidade** para todo mundo.

## 1. Crie o mod

O jeito mais fácil é pelo próprio Cypher, em **Mods → Criar mod**: escolha cores, papel de parede, sons, música, estilos por site e filtro, e clique em **Exportar .cyphermod**.

O arquivo `.cyphermod` é um ZIP. Descompacte-o: a pasta tem o manifesto `cypher-mod.json` e os arquivos que ele usa. O formato completo está em [cypher-mod-format.md](cypher-mod-format.md).

## 2. Confira o manifesto

- `id` em formato reverso de domínio, único e com o seu nome: `com.seunome.nome-do-mod`.
- `version` semântica (`1.0.0`). Para atualizar um mod já publicado, aumente a versão.
- `author` com o nome que vai aparecer na loja.
- `preview` com uma imagem de até 280 KB (`png`, `jpg`, `webp` ou `svg`).
- Use só arquivos seus ou com licença que permita redistribuição (fontes, músicas, imagens).

## 3. Envie o pull request

1. Faça um fork de [sCypher-me/cypher-browser](https://github.com/sCypher-me/cypher-browser).
2. Coloque a pasta do mod em `catalog/mods/<nome-do-mod>/`.
3. Abra um pull request para `main` com o título `mod: <nome do mod>` e uma imagem de como ele fica.

Uma verificação automática empacota o mod com as mesmas regras do navegador (tipos de arquivo, tamanhos, CSS sem endereços externos). Se ela passar, alguém da equipe revisa e aceita.

## Regras

- Mods não podem conter scripts nem executáveis; o Cypher recusa esses arquivos.
- Nada de conteúdo ofensivo, enganoso ou que imite outra marca.
- O mod é publicado sob a licença do repositório (GPL-3.0), a não ser que a pasta traga uma licença compatível própria (por exemplo, `LICENSE.txt` com CC BY 4.0 para imagens).

Depois do merge, o workflow **Publicar catálogo de mods** gera o pacote, assina o índice e publica na release `mods-catalog`. O Cypher confere a assinatura e o SHA-512 antes de instalar.
