# Empaqueta la version Firefox (.xpi) reutilizando el codigo del service worker.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$out  = Join-Path (Split-Path -Parent $root) 'whatsapp-web-deluxe-firefox.xpi'

$staging = Join-Path $env:TEMP ('deluxe-ff-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $staging | Out-Null
Copy-Item (Join-Path $root 'firefox\manifest.json') $staging
Copy-Item (Join-Path $root 'firefox\ff-compat.js')  $staging
Copy-Item (Join-Path $root 'background.js')          $staging
Copy-Item (Join-Path $root 'options.html')           $staging
Copy-Item (Join-Path $root 'options.js')             $staging
Copy-Item (Join-Path $root 'privacy.md')             $staging
Copy-Item (Join-Path $root 'icons')                  $staging -Recurse

if (Test-Path $out) { Remove-Item $out -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($staging, $out, [System.IO.Compression.CompressionLevel]::Optimal, $false)
Remove-Item $staging -Recurse -Force

$bytes = (Get-Item $out).Length
$hash  = (Get-FileHash $out -Algorithm SHA256).Hash.ToLower()
Write-Host ('xpi     ' + $out)
Write-Host ('bytes   ' + $bytes)
Write-Host ('sha256  ' + $hash)
