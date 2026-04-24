$ErrorActionPreference = "SilentlyContinue"

$projectRoot = "C:\Users\Thera\therassistant ehr"

foreach ($port in @(3000, 3001, 4000)) {
  $listeners = Get-NetTCPConnection -LocalPort $port -State Listen
  foreach ($listener in $listeners) {
    Stop-Process -Id $listener.OwningProcess -Force
    Start-Sleep -Milliseconds 300
  }
}

Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "$projectRoot\scripts\restart-backend.ps1"
Start-Sleep -Seconds 1
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-File", "$projectRoot\scripts\restart-frontend.ps1"
