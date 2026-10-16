param([switch]$Force)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$root = Split-Path -Parent $PSScriptRoot
$resources = Join-Path $root 'electron/resources'
$compiled = Join-Path $resources 'easyprivacy.bin'
$metadata = Join-Path $resources 'easyprivacy.json'
$download = Join-Path $resources 'easyprivacy.download.txt'
New-Item -ItemType Directory -Force -Path $resources | Out-Null

if (-not $Force -and (Test-Path -LiteralPath $compiled) -and (Test-Path -LiteralPath $metadata)) {
  try {
    $current = Get-Content -LiteralPath $metadata -Raw | ConvertFrom-Json
    $fetchedAt = [DateTimeOffset]$current.fetchedAt
    if ($fetchedAt -gt [DateTimeOffset]::UtcNow.AddDays(-3)) {
      Write-Output "EasyPrivacy já está atualizada no pacote local (última busca: $($current.fetchedAt))."
      exit 0
    }
  } catch {}
}

try {
  Invoke-WebRequest -Uri 'https://easylist.to/easylist/easyprivacy.txt' -OutFile $download -TimeoutSec 60
  $header = (Get-Content -LiteralPath $download -TotalCount 8) -join "`n"
  if ($header -notmatch '\[Adblock Plus 1\.1\]' -or $header -notmatch 'Title: EasyPrivacy' -or (Get-Item -LiteralPath $download).Length -lt 100000) {
    throw 'A resposta recebida não parece ser a lista EasyPrivacy completa.'
  }
  node (Join-Path $PSScriptRoot 'compile-tracker-list.cjs') $download
} finally {
  Remove-Item -LiteralPath $download -Force -ErrorAction SilentlyContinue
}
