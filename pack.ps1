# Empaqueta la extension en un zip listo para Chrome Web Store / Edge Add-ons.
# Uso: powershell -NoProfile -File pack.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$out  = Join-Path (Split-Path -Parent $root) 'whatsapp-web-deluxe.zip'

& node (Join-Path $root 'tools\validate.js')
if ($LASTEXITCODE -ne 0) { throw 'validacion fallida: no se empaqueta' }

$staging = Join-Path $env:TEMP ('deluxe-pack-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $staging | Out-Null
Copy-Item (Join-Path $root 'manifest.json') $staging
Copy-Item (Join-Path $root 'background.js') $staging
Copy-Item (Join-Path $root 'options.html')  $staging
Copy-Item (Join-Path $root 'options.js')    $staging
Copy-Item (Join-Path $root 'privacy.md')    $staging
Copy-Item (Join-Path $root 'icons')         $staging -Recurse

if (Test-Path $out) { Remove-Item $out -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($staging, $out, [System.IO.Compression.CompressionLevel]::Optimal, $false)
Remove-Item $staging -Recurse -Force

$bytes = (Get-Item $out).Length
$hash  = (Get-FileHash $out -Algorithm SHA256).Hash.ToLower()
Write-Host ('zip     ' + $out)
Write-Host ('bytes   ' + $bytes)
Write-Host ('sha256  ' + $hash)
