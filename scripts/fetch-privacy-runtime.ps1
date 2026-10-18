$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$targetRoot = Join-Path $repositoryRoot 'vendor\privacy-runtime'
$stagingRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('cypher-privacy-runtime-' + [guid]::NewGuid().ToString('N'))
$torVersion = '15.0.25'
$i2pdVersion = '2.61.0'
$torArchiveName = "tor-expert-bundle-windows-x86_64-$torVersion.tar.gz"
$i2pdArchiveName = "i2pd_${i2pdVersion}_win64_mingw.zip"

try {
  $torDirectory = Join-Path $stagingRoot 'tor-unpacked'
  $i2pdDirectory = Join-Path $stagingRoot 'i2pd-unpacked'
  $runtimeDirectory = Join-Path $stagingRoot 'privacy-runtime'
  New-Item -ItemType Directory -Force -Path $torDirectory, $i2pdDirectory, $runtimeDirectory | Out-Null

  $torArchive = Join-Path $stagingRoot $torArchiveName
  $torChecksumFile = Join-Path $stagingRoot 'tor-checksums.txt'
  $torBaseUrl = "https://dist.torproject.org/torbrowser/$torVersion"
  Invoke-WebRequest -Uri "$torBaseUrl/$torArchiveName" -OutFile $torArchive
  Invoke-WebRequest -Uri "$torBaseUrl/sha256sums-signed-build.txt" -OutFile $torChecksumFile
  $checksumLine = Get-Content -LiteralPath $torChecksumFile | Where-Object { $_ -match [regex]::Escape($torArchiveName) } | Select-Object -First 1
  if (-not $checksumLine -or $checksumLine -notmatch '([A-Fa-f0-9]{64})') { throw 'O checksum do Tor não foi encontrado no manifesto oficial.' }
  $expectedTorHash = $Matches[1].ToUpperInvariant()
  $actualTorHash = (Get-FileHash -LiteralPath $torArchive -Algorithm SHA256).Hash.ToUpperInvariant()
  if ($actualTorHash -ne $expectedTorHash) { throw 'A verificação SHA-256 do pacote Tor falhou.' }
  & tar -xzf $torArchive -C $torDirectory
  if ($LASTEXITCODE -ne 0) { throw 'Não foi possível extrair o Tor Expert Bundle.' }
  $torExecutable = Get-ChildItem -LiteralPath $torDirectory -Filter 'tor.exe' -File -Recurse | Select-Object -First 1
  if (-not $torExecutable) { throw 'O pacote oficial não contém tor.exe.' }
  $torTarget = Join-Path $runtimeDirectory 'tor'
  New-Item -ItemType Directory -Force -Path $torTarget | Out-Null
  Copy-Item -Path (Join-Path $torExecutable.Directory.FullName '*') -Destination $torTarget -Recurse -Force

  $gitHubHeaders = @{ 'User-Agent' = 'Cypher-Browser-runtime-builder'; 'Accept' = 'application/vnd.github+json' }
  if (-not [string]::IsNullOrWhiteSpace($env:GITHUB_TOKEN)) { $gitHubHeaders['Authorization'] = "Bearer $env:GITHUB_TOKEN" }
  $i2pdRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/PurpleI2P/i2pd/releases/tags/$i2pdVersion" -Headers $gitHubHeaders
  $i2pdAsset = $i2pdRelease.assets | Where-Object { $_.name -eq $i2pdArchiveName } | Select-Object -First 1
  if (-not $i2pdAsset -or $i2pdAsset.digest -notmatch '^sha256:([A-Fa-f0-9]{64})$') { throw 'O lançamento oficial do i2pd não publicou um SHA-256 verificável para o pacote Windows.' }
  $expectedI2pdHash = $Matches[1].ToUpperInvariant()
  $i2pdArchive = Join-Path $stagingRoot $i2pdArchiveName
  Invoke-WebRequest -Uri $i2pdAsset.browser_download_url -OutFile $i2pdArchive
  $actualI2pdHash = (Get-FileHash -LiteralPath $i2pdArchive -Algorithm SHA256).Hash.ToUpperInvariant()
  if ($actualI2pdHash -ne $expectedI2pdHash) { throw 'A verificação SHA-256 do pacote i2pd falhou.' }
  Expand-Archive -LiteralPath $i2pdArchive -DestinationPath $i2pdDirectory -Force
  $i2pdExecutable = Get-ChildItem -LiteralPath $i2pdDirectory -Filter 'i2pd.exe' -File -Recurse | Select-Object -First 1
  if (-not $i2pdExecutable) { throw 'O pacote oficial não contém i2pd.exe.' }
  $i2pdTarget = Join-Path $runtimeDirectory 'i2pd'
  New-Item -ItemType Directory -Force -Path $i2pdTarget | Out-Null
  Copy-Item -Path (Join-Path $i2pdExecutable.Directory.FullName '*') -Destination $i2pdTarget -Recurse -Force

  @"
Cypher bundles the following upstream privacy network runtimes:

Tor Expert Bundle $torVersion
Source: https://dist.torproject.org/torbrowser/$torVersion/$torArchiveName
Project and license information: https://www.torproject.org/about/history/

i2pd $i2pdVersion (PurpleI2P)
Source: https://github.com/PurpleI2P/i2pd/releases/tag/$i2pdVersion
License: BSD 3-Clause (see the upstream LICENSE file and repository).

The Cypher build downloads these pinned upstream versions and checks their SHA-256 digests before packaging.
"@ | Set-Content -LiteralPath (Join-Path $runtimeDirectory 'THIRD-PARTY-NOTICES.txt') -Encoding utf8

  $resolvedTarget = [System.IO.Path]::GetFullPath($targetRoot)
  if (-not $resolvedTarget.StartsWith($repositoryRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'O diretório de runtime gerado escapou da pasta do repositório.'
  }
  if (Test-Path -LiteralPath $targetRoot) { Remove-Item -LiteralPath $targetRoot -Recurse -Force }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $targetRoot) | Out-Null
  Move-Item -LiteralPath $runtimeDirectory -Destination $targetRoot
  Write-Host "Runtimes Tor $torVersion e i2pd $i2pdVersion preparados e verificados em vendor/privacy-runtime."
}
finally {
  if (Test-Path -LiteralPath $stagingRoot) { Remove-Item -LiteralPath $stagingRoot -Recurse -Force }
}
