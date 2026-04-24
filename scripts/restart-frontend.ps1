$ErrorActionPreference = "SilentlyContinue"

$projectRoot = "C:\Users\Thera\therassistant ehr"

foreach ($port in @(3000, 3001)) {
  $listeners = Get-NetTCPConnection -LocalPort $port -State Listen
  foreach ($listener in $listeners) {
    Stop-Process -Id $listener.OwningProcess -Force
    Start-Sleep -Milliseconds 300
  }
}

Set-Location $projectRoot
npm run dev
