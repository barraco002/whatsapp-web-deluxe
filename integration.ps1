# Arranca un navegador Chromium con la extension cargada y corre la prueba CDP real.
#   powershell -NoProfile -File integration.ps1
#   powershell -NoProfile -File integration.ps1 -Chromium 'C:\ruta\chrome.exe'
param(
  [string]$Chromium = $env:CHROMIUM_PATH,
  [int]$Port = 9400,
  [string]$Ext
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
# -Ext permite probar el PAQUETE ya empaquetado (extraido), no solo el arbol de trabajo.
$ext = if ($Ext) { (Resolve-Path $Ext).Path } else { $root }

if (-not $Chromium) {
  foreach ($c in @(
    'D:\dev\chromium-snapshot\chrome-win\chrome.exe',
    "$env:LOCALAPPDATA\Chromium\Application\chrome.exe"
  )) { if (Test-Path $c) { $Chromium = $c; break } }
}
if (-not $Chromium -or -not (Test-Path $Chromium)) {
  Write-Host 'No encuentro un Chromium. Descarga un snapshot:'
  Write-Host '  https://storage.googleapis.com/chromium-browser-snapshots/Win_x64/LAST_CHANGE'
  Write-Host '  https://storage.googleapis.com/chromium-browser-snapshots/Win_x64/<rev>/chrome-win.zip'
  Write-Host 'y pasalo con -Chromium, o define CHROMIUM_PATH.'
  exit 2
}

$udd = Join-Path $env:TEMP ('deluxe-integration-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
$args = @(
  "--user-data-dir=$udd",
  "--load-extension=$ext",
  "--disable-extensions-except=$ext",
  "--remote-debugging-port=$Port",
  '--no-first-run', '--no-default-browser-check', '--window-size=1400,900',
  'about:blank'
)
$proc = Start-Process -FilePath $Chromium -ArgumentList $args -PassThru
try {
  $up = $false
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    try { Invoke-RestMethod "http://127.0.0.1:$Port/json/version" -TimeoutSec 3 | Out-Null; $up = $true; break } catch { }
  }
  if (-not $up) { throw "el navegador no expuso CDP en el puerto $Port" }
  Start-Sleep -Seconds 2
  & node (Join-Path $root 'tools\integration-chromium.js') --port $Port --ext $ext
  $code = $LASTEXITCODE
  if ($code -eq 0) {
    & node (Join-Path $root 'tools\integration-options.js') --port $Port
    $code = $LASTEXITCODE
  }
} finally {
  Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" |
    Where-Object { $_.CommandLine -like "*$udd*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Milliseconds 500
  if (Test-Path $udd) { Remove-Item $udd -Recurse -Force -ErrorAction SilentlyContinue }
}
exit $code
