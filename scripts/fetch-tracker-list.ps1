param([switch]$Force)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$root = Split-Path -Parent $PSScriptRoot
$resources = Join-Path $root 'electron/resources'
$compiledPrivacy = Join-Path $resources 'easyprivacy.bin'
$compiledAds = Join-Path $resources 'easylist.bin'
$metadataPrivacy = Join-Path $resources 'easyprivacy.json'
$metadataAds = Join-Path $resources 'easylist.json'
$privacyDownload = Join-Path $resources 'easyprivacy.download.txt'
$adsDownload = Join-Path $resources 'easylist.download.txt'
New-Item -ItemType Directory -Force -Path $resources | Out-Null

if (-not $Force -and (Test-Path -LiteralPath $compiledPrivacy) -and (Test-Path -LiteralPath $metadataPrivacy) -and (Test-Path -LiteralPath $compiledAds) -and (Test-Path -LiteralPath $metadataAds)) {
  try {
    $privacy = Get-Content -LiteralPath $metadataPrivacy -Raw | ConvertFrom-Json
    $ads = Get-Content -LiteralPath $metadataAds -Raw | ConvertFrom-Json
    $privacyFetched = [DateTimeOffset]$privacy.fetchedAt
    $adsFetched = [DateTimeOffset]$ads.fetchedAt
    if ($privacyFetched -gt [DateTimeOffset]::UtcNow.AddDays(-3) -and $adsFetched -gt [DateTimeOffset]::UtcNow.AddDays(-3)) {
      Write-Output 'EasyList e EasyPrivacy já estão atualizadas no pacote local.'
      exit 0
    }
  } catch {}
}

try {
  Invoke-WebRequest -Uri 'https://easylist.to/easylist/easyprivacy.txt' -OutFile $privacyDownload -TimeoutSec 60
  Invoke-WebRequest -Uri 'https://easylist.to/easylist/easylist.txt' -OutFile $adsDownload -TimeoutSec 60
  $privacyHeader = (Get-Content -LiteralPath $privacyDownload -TotalCount 8) -join "`n"
  $adsHeader = (Get-Content -LiteralPath $adsDownload -TotalCount 8) -join "`n"
  if ($privacyHeader -notmatch '\[Adblock Plus (1\.\d+|2\.0)\]' -or $privacyHeader -notmatch 'Title: EasyPrivacy' -or (Get-Item -LiteralPath $privacyDownload).Length -lt 100000) {
    throw 'A resposta recebida não parece ser a lista EasyPrivacy completa.'
  }
  if ($adsHeader -notmatch '\[Adblock Plus (1\.\d+|2\.0)\]' -or $adsHeader -notmatch 'Title: EasyList' -or (Get-Item -LiteralPath $adsDownload).Length -lt 100000) {
    throw 'A resposta recebida não parece ser a lista EasyList completa.'
  }
  node (Join-Path $PSScriptRoot 'compile-tracker-list.cjs') $privacyDownload $adsDownload
} finally {
  Remove-Item -LiteralPath $privacyDownload -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $adsDownload -Force -ErrorAction SilentlyContinue
}
