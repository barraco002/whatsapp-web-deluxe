# Envia la extension a addons.mozilla.org (AMO) y recoge el .xpi firmado.
#   $env:AMO_JWT_ISSUER  = 'user:12345678:123'
#   $env:AMO_JWT_SECRET  = '<secreto>'
#   powershell -NoProfile -File submit-amo.ps1 [-Channel listed|unlisted]
# Las credenciales se generan en https://addons.mozilla.org/developers/addon/api/key/
param([string]$Channel = 'listed')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not $env:AMO_JWT_ISSUER -or -not $env:AMO_JWT_SECRET) {
  Write-Host 'Faltan AMO_JWT_ISSUER / AMO_JWT_SECRET.'
  Write-Host 'Genera las claves en https://addons.mozilla.org/developers/addon/api/key/ y exportalas:'
  Write-Host '  $env:AMO_JWT_ISSUER = "user:NNNNNNN:NNN"'
  Write-Host '  $env:AMO_JWT_SECRET = "..."'
  exit 2
}

$staging = Join-Path $env:TEMP ('amo-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path $staging | Out-Null
Copy-Item (Join-Path $root 'firefox\manifest.json') $staging
Copy-Item (Join-Path $root 'firefox\ff-compat.js')  $staging
Copy-Item (Join-Path $root 'background.js')          $staging
Copy-Item (Join-Path $root 'privacy.md')             $staging
Copy-Item (Join-Path $root 'icons')                  $staging -Recurse

$artifacts = Join-Path $root 'web-ext-artifacts'
& npx --yes web-ext@latest sign `
  --source-dir $staging `
  --artifacts-dir $artifacts `
  --channel $Channel `
  --api-key $env:AMO_JWT_ISSUER `
  --api-secret $env:AMO_JWT_SECRET
$code = $LASTEXITCODE
Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue
if ($code -eq 0) {
  Write-Host ''
  Write-Host 'Firmado. El .xpi esta en:'
  Get-ChildItem $artifacts -Filter '*.xpi' | ForEach-Object { '  ' + $_.FullName + '  ' + $_.Length + ' B' }
} else {
  Write-Host "web-ext sign fallo con codigo $code"
}
exit $code
