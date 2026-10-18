# Mods do Cypher (`.cyphermod`)

Um mod muda a experiência do Cypher inteira, não só as cores. Cada mod é um arquivo `.cyphermod`, que é um ZIP com um manifesto `cypher-mod.json` na raiz e os arquivos que ele cita. Vários mods podem ficar ativos ao mesmo tempo e cada componente pode ser ligado ou desligado em **Mods → Instalados**. Quando dois mods trazem o mesmo componente, vale o de maior prioridade.

## Componentes

| Componente | O que faz | Arquivos |
| --- | --- | --- |
| `theme` | Cores (`accent`, `surface`, `background`), `skin` (`recorte`/`classic`), `appearanceMode` e `tokens` | — |
| `wallpaper` | Papel de parede da Home, imagem ou vídeo, com `dim` (0–0.9) para escurecer | `.png .jpg .webp .gif .svg .mp4 .webm` |
| `sounds` | Sons de `click`, `hover`, `tabOpen`, `tabClose`, `typing` e `navigate`, com `volume` | `.mp3 .ogg .wav .m4a` |
| `music` | Música reativa: `base` toca sempre; `active` aparece quando você clica, digita ou navega | `.mp3 .ogg .wav .m4a` |
| `pageStyles` | CSS aplicado só aos sites em `matches` (subdomínios incluídos; `*.` opcional) | `.css` |
| `shader` | Filtro em todas as páginas: `crt`, `sepia`, `neon`, `noir`, `warm`, `cool`, `vignette` ou `dream`, com `intensity` (0.1–1) | — |
| `fonts` | Fontes para títulos (`display`) ou texto (`body`) da interface | `.woff2 .woff .ttf .otf` |
| `interfaceCss` | CSS extra para a interface do navegador | `.css` |

## Manifesto

```json
{
  "format": "cypher-mod",
  "formatVersion": 1,
  "id": "com.seunome.meu-mod",
  "name": "Meu mod",
  "version": "1.0.0",
  "author": "Seu nome",
  "description": "O que o mod muda.",
  "preview": "preview.png",
  "tags": ["escuro", "música"],
  "components": {
    "theme": { "accent": "#39e0ff", "surface": "#0e1226", "background": "#05070f", "skin": "recorte", "tokens": { "cut": 6 } },
    "wallpaper": { "file": "wallpaper.webm", "dim": 0.3 },
    "sounds": { "click": "sounds/click.ogg", "tabOpen": "sounds/open.ogg", "volume": 0.6 },
    "music": { "base": "music/base.ogg", "active": "music/active.ogg", "volume": 0.45 },
    "pageStyles": [{ "matches": ["youtube.com"], "css": "pages/youtube.css" }],
    "shader": { "preset": "crt", "intensity": 0.5 },
    "fonts": [{ "file": "fonts/titulo.woff2", "use": "display", "family": "Titulo" }]
  }
}
```

O `id` usa o formato reverso de domínio e precisa ter pelo menos um ponto. A `version` é semântica (`1.0.0`). Para a música, use dois loops com a mesma duração.

## Regras de segurança

- Os arquivos aceitos são só os tipos da tabela, além de `.json`, `.txt` e `.md`. Nenhum script ou executável é aceito.
- O pacote tem no máximo 60 MB e 120 MB descompactado, com até 400 arquivos. Caminhos com `..`, absolutos ou com nomes reservados do Windows são recusados.
- O CSS (de páginas e da interface) perde `@import`, `url()` para endereços externos e `expression`. Só são aceitos `data:` de imagens e fontes.
- Os arquivos do mod são servidos pelo protocolo `cypher-mod://`. SVGs recebem uma política que bloqueia scripts.

## Criar um mod

1. Em **Mods → Criar mod**, escolha o que entra: cores e pele atuais, papel de parede, sons, música, estilos por site e filtro de página.
2. Clique em **Exportar .cyphermod** para salvar o arquivo, ou em **Exportar e instalar** para usar na hora.

Para criar à mão, monte a pasta com o manifesto e os arquivos e compacte em ZIP com a extensão `.cyphermod`.

## Catálogo

A aba **Explorar** mostra os mods embutidos e o catálogo publicado na release `mods-catalog` do repositório. O workflow `Publicar catálogo de mods` empacota as pastas de `electron/builtin-mods/` e `catalog/mods/` e gera um `index.json` com o SHA-512 de cada pacote. O índice é assinado com a mesma chave Ed25519 das atualizações. Antes de instalar, o Cypher verifica a assinatura do índice e o SHA-512 do pacote baixado.

Para publicar um mod no catálogo, adicione a pasta dele em `catalog/mods/<nome>/` num pull request.
