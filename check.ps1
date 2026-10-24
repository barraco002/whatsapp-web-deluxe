# Puerta unica: valida el manifest y corre los tests del service worker.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
& node (Join-Path $root 'tools\validate.js')
if ($LASTEXITCODE -ne 0) { exit 1 }
& node (Join-Path $root 'test-background.js')
if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host 'check OK'
exit 0
