$ErrorActionPreference = 'Stop'

$appDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverPath = Join-Path $appDir 'server.mjs'
$profilePath = Join-Path $appDir 'chrome-profile'
$url = 'http://127.0.0.1:17891/?auto=1'
$logPath = Join-Path $appDir 'launch.log'

function Write-LaunchLog {
  param(
    [Parameter(Mandatory)]
    [string]$Message
  )

  try {
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Add-Content -LiteralPath $logPath -Value "$timestamp $Message" -Encoding UTF8
  } catch {
  }
}

function Get-ProcessByCommandLine {
  param(
    [Parameter(Mandatory)]
    [string]$Name,
    [Parameter(Mandatory)]
    [string]$Text
  )

  Get-CimInstance Win32_Process -Filter "name = '$Name'" |
    Where-Object { $_.CommandLine -like "*$Text*" }
}

Write-LaunchLog 'Launch requested.'

try {
  $node = (Get-Command node.exe -ErrorAction Stop).Source
  $chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
  Write-LaunchLog "Node found at $node"

  if (-not (Test-Path -LiteralPath $chrome)) {
    throw "Chrome was not found at $chrome"
  }
  Write-LaunchLog "Chrome found at $chrome"

  $serverProcess = Get-ProcessByCommandLine -Name 'node.exe' -Text $serverPath | Select-Object -First 1
  if ($null -eq $serverProcess) {
    Write-LaunchLog 'Starting dictation server.'
    Start-Process -FilePath $node -ArgumentList "`"$serverPath`"" -WorkingDirectory $appDir -WindowStyle Hidden
  } else {
    Write-LaunchLog "Dictation server already running. PID: $($serverProcess.ProcessId)"
  }

  $ready = $false
  for ($i = 0; $i -lt 30; $i++) {
    try {
      $response = Invoke-WebRequest -Uri 'http://127.0.0.1:17891/' -UseBasicParsing -TimeoutSec 1
      if ($response.StatusCode -eq 200) {
        $ready = $true
        break
      }
    } catch {
      Start-Sleep -Milliseconds 250
    }
  }

  if (-not $ready) {
    throw 'Russian dictation server did not start.'
  }
  Write-LaunchLog 'Dictation server is ready.'

  New-Item -ItemType Directory -Path $profilePath -Force | Out-Null

  $chromeProcess = Get-ProcessByCommandLine -Name 'chrome.exe' -Text $profilePath | Select-Object -First 1
  if ($null -eq $chromeProcess) {
    Write-LaunchLog 'Starting Chrome app window.'
    Start-Process -FilePath $chrome -ArgumentList @(
      "--user-data-dir=$profilePath",
      '--use-fake-ui-for-media-stream',
      "--app=$url"
    )
    Write-LaunchLog 'Chrome app window start requested.'
    exit 0
  }

  $signature = @'
using System;
using System.Runtime.InteropServices;
public static class WindowFocus {
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
'@
  Add-Type $signature -ErrorAction SilentlyContinue

  $chromePids = @(Get-ProcessByCommandLine -Name 'chrome.exe' -Text $profilePath | Select-Object -ExpandProperty ProcessId)
  $windows = Get-Process -Name chrome -ErrorAction SilentlyContinue |
    Where-Object { $chromePids -contains $_.Id -and $_.MainWindowHandle -ne 0 }

  $window = $windows | Select-Object -First 1
  if ($null -ne $window) {
    Write-LaunchLog "Restoring existing Chrome app window. PID: $($window.Id)"
    [void][WindowFocus]::ShowWindowAsync([intptr]$window.MainWindowHandle, 9)
    Start-Sleep -Milliseconds 150
    [void][WindowFocus]::SetForegroundWindow([intptr]$window.MainWindowHandle)
    Write-LaunchLog 'Existing Chrome app window restored.'
  } else {
    Write-LaunchLog 'Chrome profile is running, but no app window was found. Starting a new window.'
    Start-Process -FilePath $chrome -ArgumentList @(
      "--user-data-dir=$profilePath",
      '--use-fake-ui-for-media-stream',
      "--app=$url"
    )
  }
} catch {
  Write-LaunchLog "ERROR: $($_.Exception.Message)"
  throw
}
