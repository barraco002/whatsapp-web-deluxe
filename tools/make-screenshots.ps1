# Arranca un Chromium con la extension cargada y captura las pantallas de la ficha.
#   powershell -NoProfile -File tools\make-screenshots.ps1
param(
  [string]$Chromium = $env:CHROMIUM_PATH,
  [int]$Port = 9411
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

if (-not $Chromium) {
  foreach ($c in @(
    'D:\dev\chromium-snapshot\chrome-win\chrome.exe',
    "$env:LOCALAPPDATA\Chromium\Application\chrome.exe"
  )) { if (Test-Path $c) { $Chromium = $c; break } }
}
if (-not $Chromium -or -not (Test-Path $Chromium)) { throw 'no encuentro Chromium (usa -Chromium o CHROMIUM_PATH)' }

$udd = Join-Path $env:TEMP ('deluxe-shots-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
$args = @(
  "--user-data-dir=$udd",
  "--load-extension=$root",
  "--disable-extensions-except=$root",
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
  Start-Sleep -Seconds 3
  & node (Join-Path $root 'tools\screenshots.js') --port $Port --out (Join-Path $root 'store')
  $code = $LASTEXITCODE
} finally {
  Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" |
    Where-Object { $_.CommandLine -like "*$udd*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Milliseconds 500
  if (Test-Path $udd) { Remove-Item $udd -Recurse -Force -ErrorAction SilentlyContinue }
}
exit $code
