$ErrorActionPreference = 'Stop'

$source = Join-Path $PSScriptRoot 'RussianDictationLauncher.cs'
$output = Join-Path $PSScriptRoot 'RussianDictation.exe'
$candidates = @(
  "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe",
  "$env:WINDIR\Microsoft.NET\Framework\v4.0.30319\csc.exe"
)

$csc = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $csc) {
  throw 'C# compiler was not found. Install .NET Framework developer tools or build the launcher another way.'
}

& $csc /nologo /target:winexe /out:$output $source
Write-Host "Built $output"
