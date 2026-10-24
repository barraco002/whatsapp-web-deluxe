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

Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

# Un zip de extension tiene que usar '/' como separador. CreateFromDirectory de
# .NET Framework escribe '\\' en Windows y Chrome/AMO lo interpretan como un
# nombre de archivo literal: los iconos dejan de encontrarse. Por eso las
# entradas se crean a mano y con la ruta normalizada.
function New-ExtensionZip {
  param([string]$Staging, [string[]]$Files, [string]$Out)
  if (Test-Path $Out) { Remove-Item $Out -Force }
  $fs = [System.IO.File]::Open($Out, [System.IO.FileMode]::Create)
  $zip = New-Object System.IO.Compression.ZipArchive($fs, [System.IO.Compression.ZipArchiveMode]::Create)
  $stamp = [DateTimeOffset]::new(2026, 10, 24, 12, 0, 0, [TimeSpan]::Zero)
  try {
    foreach ($rel in $Files) {
      $src = Join-Path $Staging ($rel -replace '/', '\')
      $entry = $zip.CreateEntry($rel, [System.IO.Compression.CompressionLevel]::Optimal)
      $entry.LastWriteTime = $stamp
      $stream = $entry.Open()
      try {
        $bytes = [System.IO.File]::ReadAllBytes($src)
        $stream.Write($bytes, 0, $bytes.Length)
      } finally { $stream.Dispose() }
    }
  } finally { $zip.Dispose(); $fs.Dispose() }
}

function Assert-SlashPaths {
  param([string]$Path)
  $z = [System.IO.Compression.ZipFile]::OpenRead($Path)
  try {
    $bad = @($z.Entries | Where-Object { $_.FullName.Contains('\') })
    if ($bad.Count -gt 0) { throw ('entradas con separador de Windows: ' + ($bad[0].FullName)) }
    return $z.Entries.Count
  } finally { $z.Dispose() }
}

$files = @(
  'manifest.json', 'background.js', 'options.html', 'options.js', 'privacy.md',
  'icons/icon16.png', 'icons/icon32.png', 'icons/icon48.png', 'icons/icon128.png'
)
New-ExtensionZip -Staging $staging -Files $files -Out $out
Remove-Item $staging -Recurse -Force
$count = Assert-SlashPaths -Path $out

$bytes = (Get-Item $out).Length
$hash  = (Get-FileHash $out -Algorithm SHA256).Hash.ToLower()
Write-Host ('zip     ' + $out)
Write-Host ('bytes   ' + $bytes)
Write-Host ('entries ' + $count)
Write-Host ('sha256  ' + $hash)
