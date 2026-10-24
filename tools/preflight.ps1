# Preflight: comprueba, sin abrir ningun formulario, que todo lo que hace falta
# para enviar la extension existe, pesa lo que debe y coincide con lo publicado.
#   powershell -NoProfile -File tools\preflight.ps1 [-Lint] [-NoNetwork]
param(
  [switch]$Lint,
  [switch]$NoNetwork,
  [string]$Tag = 'v1.1.0'
)
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$fail = 0
function Pass([string]$m) { Write-Host ('OK    ' + $m) }
function Fail([string]$m) { Write-Host ('FALLO ' + $m); $script:fail++ }

Set-Location $root

# --- 1. manifiestos y gates estaticos ---
foreach ($gate in @('tools\validate.js', 'tools\validate-firefox.js', 'test-background.js')) {
  $out = & node (Join-Path $root $gate) 2>&1 | Out-String
  if ($LASTEXITCODE -eq 0) {
    $last = @($out -split "`r?`n" | Where-Object { $_ -match 'OK' }) | Select-Object -Last 1
    if ($last) { Pass ($gate + ' -> ' + $last.Trim()) } else { Pass $gate }
  }
  else { Fail ($gate + ' fallo'); Write-Host $out }
}

# --- 2. version coherente en los dos manifiestos ---
$mv = (Get-Content (Join-Path $root 'manifest.json') -Raw | ConvertFrom-Json).version
$fv = (Get-Content (Join-Path $root 'firefox\manifest.json') -Raw | ConvertFrom-Json).version
if ($mv -eq $fv) { Pass ('version ' + $mv + ' igual en los dos manifiestos') } else { Fail ('version distinta: chromium ' + $mv + ' vs firefox ' + $fv) }

# --- 3. paquetes locales ---
$zip = Join-Path (Split-Path -Parent $root) 'whatsapp-web-deluxe.zip'
$xpi = Join-Path (Split-Path -Parent $root) 'whatsapp-web-deluxe-firefox.xpi'
foreach ($p in @($zip, $xpi)) {
  if (Test-Path $p) { Pass ('existe ' + (Split-Path -Leaf $p) + ' (' + (Get-Item $p).Length + ' bytes)') } else { Fail ('falta ' + $p) }
}

# --- 4. los paquetes contienen lo que los manifiestos prometen ---
Add-Type -AssemblyName System.IO.Compression.FileSystem
function Entries([string]$path) {
  $z = [System.IO.Compression.ZipFile]::OpenRead($path)
  try { return $z.Entries | ForEach-Object { $_.FullName } } finally { $z.Dispose() }
}
if ((Test-Path $zip) -and (Test-Path $xpi)) {
  $needZip = @('manifest.json', 'background.js', 'options.html', 'options.js', 'icons/icon128.png')
  $needXpi = @('manifest.json', 'ff-compat.js', 'background.js', 'options.html', 'options.js', 'icons/icon128.png')
  $ez = Entries $zip
  $ex = Entries $xpi
  $miss = @($needZip | Where-Object { $ez -notcontains $_ })
  if ($miss.Count -eq 0) { Pass 'el zip trae todos los archivos declarados' } else { Fail ('al zip le falta: ' + ($miss -join ', ')) }
  $miss2 = @($needXpi | Where-Object { $ex -notcontains $_ })
  if ($miss2.Count -eq 0) { Pass 'el xpi trae todos los archivos declarados' } else { Fail ('al xpi le falta: ' + ($miss2 -join ', ')) }

  # el manifest dentro del zip debe ser el de esta version
  $z2 = [System.IO.Compression.ZipFile]::OpenRead($zip)
  try {
    $e = $z2.GetEntry('manifest.json')
    $sr = New-Object System.IO.StreamReader($e.Open())
    $inner = $sr.ReadToEnd() | ConvertFrom-Json
    $sr.Close()
    if ($inner.version -eq $mv) { Pass ('el zip lleva la version ' + $inner.version) } else { Fail ('el zip lleva la version ' + $inner.version + ', no ' + $mv) }
  } finally { $z2.Dispose() }
}

# --- 5. assets de la tienda con las dimensiones exactas ---
Push-Location (Split-Path -Parent $root)
$py = & node -e "process.stdout.write(require('node:path').join(process.env.USERPROFILE,'.dsh'))"
Pop-Location
$python = 'C:\Users\Joseph\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe'
if (Test-Path $python) {
  $env:PYTHONUTF8 = '1'
  $out = & $python (Join-Path $root 'tools\check-images.py') 2>&1 | Out-String
  if ($LASTEXITCODE -eq 0) { Pass 'imagenes de tienda 1280x800, 440x280 y 1400x560' } else { Fail 'imagenes de tienda'; Write-Host $out }
} else { Fail 'no encuentro el python del harness para revisar las imagenes' }

# --- 6. URLs publicas ---
if (-not $NoNetwork) {
  foreach ($u in @('https://barraco002.github.io/whatsapp-web-deluxe/',
                   'https://barraco002.github.io/whatsapp-web-deluxe/privacy.html')) {
    try {
      $r = Invoke-WebRequest $u -UseBasicParsing -TimeoutSec 25
      if ($r.StatusCode -eq 200) { Pass ('HTTP 200 ' + $u) } else { Fail ('HTTP ' + $r.StatusCode + ' ' + $u) }
    } catch { Fail ('no responde ' + $u + ' -> ' + $_.Exception.Message) }
  }
}

# --- 7. el paquete local es el que esta publicado ---
if ((Test-Path $zip) -and (Test-Path $xpi)) {
  $json = & gh release view $Tag --repo barraco002/whatsapp-web-deluxe --json assets 2>&1 | Out-String
  if ($LASTEXITCODE -eq 0) {
    $assets = ($json | ConvertFrom-Json).assets
    foreach ($pair in @(@($zip, 'whatsapp-web-deluxe.zip'), @($xpi, 'whatsapp-web-deluxe-firefox.xpi'))) {
      $local = Get-Item $pair[0]
      $remote = $assets | Where-Object { $_.name -eq $pair[1] }
      if (-not $remote) { Fail ('el release ' + $Tag + ' no tiene ' + $pair[1]); continue }
      $localHash = (Get-FileHash $local.FullName -Algorithm SHA256).Hash.ToLower()
      $remoteHash = ($remote.digest -split ':')[-1]
      if ($local.Length -eq $remote.size -and $localHash -eq $remoteHash) {
        Pass ('publicado y local coinciden: ' + $pair[1] + ' (' + $local.Length + ' B, ' + $localHash.Substring(0, 12) + '...)')
      } else {
        Fail ($pair[1] + ' difiere del release: local ' + $local.Length + ' B vs ' + $remote.size + ' B')
      }
    }
  } else { Fail ('no puedo leer el release ' + $Tag + ' (gh)') }
}

# --- 8. lint de Mozilla ---
if ($Lint) {
  $stage = Join-Path $env:TEMP ('ff-preflight-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
  New-Item -ItemType Directory -Path $stage | Out-Null
  Copy-Item (Join-Path $root 'firefox\manifest.json') $stage
  Copy-Item (Join-Path $root 'firefox\ff-compat.js') $stage
  Copy-Item (Join-Path $root 'background.js') $stage
  Copy-Item (Join-Path $root 'options.html') $stage
  Copy-Item (Join-Path $root 'options.js') $stage
  Copy-Item (Join-Path $root 'privacy.md') $stage
  Copy-Item (Join-Path $root 'icons') $stage -Recurse
  $env:npm_config_cache = 'D:\dev\npm-cache'
  # Ojo: la variable no puede llamarse $lint, el parametro [switch]$Lint ocupa ese nombre.
  $lintOut = npx --yes web-ext@latest lint --source-dir $stage --output json 2>&1 | Out-String
  if ($lintOut -match '"errors":0') {
    $warn = if ($lintOut -match '"warnings":(\d+)') { $Matches[1] } else { '0' }
    Pass ('web-ext lint: 0 errores, ' + $warn + ' aviso(s)')
  } else {
    Fail 'web-ext lint: revisar'
    Write-Host $lintOut.Substring(0, [Math]::Min(600, $lintOut.Length))
  }
  Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host ''
if ($fail -eq 0) { Write-Host 'LISTO PARA ENVIAR: no falta nada'; exit 0 }
Write-Host ($fail.ToString() + ' problemas: no enviar todavia')
exit 1
