$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$pidPath = Join-Path $projectRoot '.runtime/server.pid'
if (-not (Test-Path -LiteralPath $pidPath)) {
  Write-Host 'No launcher-managed game server is recorded. If you used npm run dev, stop it with Ctrl+C in its terminal.'
  exit 0
}
$serverId = [int](Get-Content -LiteralPath $pidPath)
$serverInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $serverId"
if ($serverInfo) {
  $expectedScript = Join-Path $projectRoot 'node_modules/vite/bin/vite.js'
  if (-not $serverInfo.CommandLine.Contains($expectedScript)) { throw 'The recorded process belongs to something else; it was not stopped.' }
  Stop-Process -Id $serverId
}
Remove-Item -LiteralPath $pidPath
Write-Host 'Varsity stopped.'
