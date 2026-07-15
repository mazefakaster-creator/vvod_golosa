param(
  [string]$OutputPath = (Join-Path $PSScriptRoot 'dist\RussianDictation-Portable')
)

$ErrorActionPreference = 'Stop'

$node = (Get-Command node.exe -ErrorAction Stop).Source
$launcher = Join-Path $PSScriptRoot 'RussianDictation.exe'

if (-not (Test-Path -LiteralPath $launcher)) {
  & (Join-Path $PSScriptRoot 'build-launcher.ps1')
}

if (Test-Path -LiteralPath $OutputPath) {
  throw "Output folder already exists: $OutputPath"
}

$runtimeDirectory = Join-Path $OutputPath 'runtime\node'
New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null

foreach ($file in @('RussianDictation.exe', 'Launch-RussianDictation.ps1', 'server.mjs', 'README.md', 'LICENSE')) {
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination $OutputPath
}

Copy-Item -LiteralPath $node -Destination (Join-Path $runtimeDirectory 'node.exe')

$archivePath = "$OutputPath.zip"
Compress-Archive -Path (Join-Path $OutputPath '*') -DestinationPath $archivePath

Write-Host "Portable folder: $OutputPath"
Write-Host "ZIP archive: $archivePath"
