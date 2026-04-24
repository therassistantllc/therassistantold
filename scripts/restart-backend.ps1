$ErrorActionPreference = "SilentlyContinue"

$projectRoot = "C:\Users\Thera\therassistant ehr"
$backendPort = 4000

$listener = Get-NetTCPConnection -LocalPort $backendPort -State Listen
if ($listener) {
  Stop-Process -Id $listener.OwningProcess -Force
  Start-Sleep -Milliseconds 500
}

Set-Location $projectRoot
$env:PORT = "$backendPort"
node server.js
