# Pacotes de extensão Cypher (`.cypherext`)

Um arquivo `.cypherext` é um ZIP com extensão própria. Ele reúne a extensão Chromium e os metadados do Cypher. O runtime continua sendo o Chromium do Electron; o pacote não promete compatibilidade com APIs que o Cypher ainda não oferece.

## Estrutura

Os dois arquivos JSON precisam ficar na raiz do pacote:

```text
minha-extensao/
├── cypher-extension.json
├── manifest.json
├── popup.html
├── popup.js
└── icons/
```

`cypher-extension.json` identifica o pacote e precisa corresponder à versão do manifesto:

```json
{
  "format": "cypher-extension",
  "formatVersion": 1,
  "id": "com.exemplo.minha-extensao",
  "name": "Minha extensão Cypher",
  "version": "1.0.0",
  "author": "Seu nome",
  "description": "O que a extensão faz.",
  "minCypherVersion": "0.7.17"
}
```

`manifest.json` usa Manifest V2 ou V3. A versão semântica em `manifest.json` e em `cypher-extension.json` deve ser igual. O `id` do pacote deve ser único e seguir o formato reverso de domínio. `minCypherVersion` é opcional.

## Criar o pacote

No PowerShell, a partir da raiz do repositório:

```powershell
.scripts\package-cypher-extension.ps1 -SourceDirectory .\examples\hello-cypher-extension
```

O script cria `hello-cypher-extension.cypherext` ao lado da pasta. Também é possível indicar `-OutputFile`.

Para instalar, abra **Extensões → Instalar .cypherext**, selecione o pacote e confira as permissões pedidas antes de confirmar.

Pacotes locais não têm uma assinatura independente do autor. Trate-os como código executável, revise os arquivos e instale somente de fontes confiáveis. O Cypher valida os caminhos do ZIP, recusa links simbólicos e limita o tamanho compactado a 50 MB, o tamanho extraído a 100 MB e a quantidade a 10.000 arquivos.
