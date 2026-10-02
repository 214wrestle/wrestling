param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$gameUrl = 'http://127.0.0.1:5188/'
$runtimePath = Join-Path $projectRoot '.runtime'
$viteScript = Join-Path $projectRoot 'node_modules/vite/bin/vite.js'

function Test-GameReady {
  try {
    $response = Invoke-WebRequest -Uri $gameUrl -UseBasicParsing -TimeoutSec 8
  } catch { return $false }
  if ($response.StatusCode -eq 200 -and $response.Content -match 'VARSITY.*College Wrestling') { return $true }
  throw 'Port 5188 is already serving a different application.'
}

if (-not (Test-GameReady)) {
  $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
  if (-not $nodeCommand) { throw 'Install Node.js 22 or newer, then reopen Play Varsity.cmd.' }
  if (-not (Test-Path -LiteralPath $viteScript)) {
    Write-Host 'Installing the standalone game dependencies...'
    Push-Location $projectRoot
    try { & npm.cmd ci; if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' } }
    finally { Pop-Location }
  }
  New-Item -ItemType Directory -Path $runtimePath -Force | Out-Null
  $serverArgs = @(('"' + $viteScript + '"'), '--host', '0.0.0.0', '--port', '5188', '--strictPort')
  $serverProcess = Start-Process -FilePath $nodeCommand.Source -ArgumentList $serverArgs -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimePath 'server.log') -RedirectStandardError (Join-Path $runtimePath 'server-error.log')
  Set-Content -LiteralPath (Join-Path $runtimePath 'server.pid') -Value $serverProcess.Id -Encoding ASCII
  $isReady = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Milliseconds 500
    if (Test-GameReady) { $isReady = $true; break }
    if ($serverProcess.HasExited) { throw 'The game server stopped. See .runtime/server-error.log.' }
  }
  if (-not $isReady) { throw 'The game is taking longer than expected to open. Check .runtime/server.log.' }
}
Write-Host "Varsity is ready: $gameUrl"
if (-not $NoBrowser) { Start-Process $gameUrl }
