$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$local = Join-Path $root "odoo-readonly.local.ps1"
$nodeCandidates = @(
  "C:\Users\PC\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe",
  "node"
)

Set-Location $root

if (Test-Path $local) {
  Get-Content $local | ForEach-Object {
    if ($_ -match '^\s*\$env:([A-Z0-9_]+)\s*=\s*"([^"]*)"\s*$') {
      Set-Item -Path "Env:\$($Matches[1])" -Value $Matches[2]
    }
  }
}

$node = $nodeCandidates | Where-Object { $_ -eq "node" -or (Test-Path $_) } | Select-Object -First 1
$displayPort = if ($env:PORT) { $env:PORT } else { "4185" }
Write-Host "Starting MERAAS Contractor Tracker on http://localhost:$displayPort"
& $node (Join-Path $root "server.js")
