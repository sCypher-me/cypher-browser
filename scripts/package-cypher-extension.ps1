param(
  [Parameter(Mandatory = $true)][string]$SourceDirectory,
  [string]$OutputFile
)

$ErrorActionPreference = 'Stop'
$source = (Resolve-Path -LiteralPath $SourceDirectory).Path
$metadataPath = Join-Path $source 'cypher-extension.json'
$manifestPath = Join-Path $source 'manifest.json'
if (-not (Test-Path -LiteralPath $metadataPath -PathType Leaf) -or -not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
  throw 'A pasta deve conter cypher-extension.json e manifest.json na raiz.'
}

$metadata = Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($metadata.format -ne 'cypher-extension' -or $metadata.formatVersion -ne 1) { throw 'Formato de pacote Cypher inválido.' }
if ($metadata.version -ne $manifest.version) { throw 'As versões em cypher-extension.json e manifest.json precisam ser iguais.' }

if ([string]::IsNullOrWhiteSpace($OutputFile)) {
  $OutputFile = Join-Path (Split-Path -Parent $source) "$(Split-Path -Leaf $source).cypherext"
}
$target = [System.IO.Path]::GetFullPath($OutputFile)
if ([System.IO.Path]::GetExtension($target) -ne '.cypherext') { throw 'O arquivo de saída precisa usar a extensão .cypherext.' }
if ($target.StartsWith($source + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'O pacote de saída precisa ficar fora da pasta de origem.'
}

$parent = Split-Path -Parent $target
if (-not (Test-Path -LiteralPath $parent -PathType Container)) { New-Item -ItemType Directory -Path $parent | Out-Null }
if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($source, $target, [System.IO.Compression.CompressionLevel]::Optimal, $false)
Write-Output "Pacote criado: $target"
