# Prueba de integracion REAL en Gecko: instala el .xpi en un perfil de Firefox
# Nightly (que acepta add-ons sin firmar), lo arranca y comprueba que la extension
# abrio la ventana de WhatsApp. Sin mocks.
#   powershell -NoProfile -File tools/integration-firefox.ps1
#   powershell -NoProfile -File tools/integration-firefox.ps1 -Firefox 'C:\ruta\firefox.exe'
param(
  [string]$Firefox = $env:FIREFOX_PATH
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

if (-not $Firefox) {
  foreach ($c in @(
    'D:\dev\firefox-nightly\firefox\firefox.exe',
    "$env:ProgramFiles\Mozilla Firefox\firefox.exe",
    (Join-Path ([Environment]::GetEnvironmentVariable('ProgramFiles(x86)')) 'Mozilla Firefox\firefox.exe')
  )) { if (Test-Path $c) { $Firefox = $c; break } }
}
if (-not $Firefox -or -not (Test-Path $Firefox)) {
  Write-Host 'No encuentro Firefox. Un .zip portable oficial (acepta add-ons sin firmar):'
  Write-Host '  https://archive.mozilla.org/pub/firefox/nightly/latest-mozilla-central/'
  Write-Host 'y pasalo con -Firefox, o define FIREFOX_PATH.'
  exit 2
}

Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class FFWin {
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
}
"@
function Get-VisibleTitles {
  $out = New-Object System.Collections.ArrayList
  $cb = [FFWin+EnumWindowsProc]{
    param($h,$l)
    if ([FFWin]::IsWindowVisible($h)) {
      $sb = New-Object System.Text.StringBuilder 512
      [void][FFWin]::GetWindowText($h,$sb,512)
      if ($sb.Length -gt 0) {
        $procId = 0
        [void][FFWin]::GetWindowThreadProcessId($h,[ref]$procId)
        [void]$out.Add([pscustomobject]@{ Title = $sb.ToString(); Pid = $procId })
      }
    }
    return $true
  }
  [void][FFWin]::EnumWindows($cb,[IntPtr]::Zero)
  return $out
}

# 1. paquete
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'pack-firefox.ps1')
$xpi = Join-Path (Split-Path -Parent $root) 'whatsapp-web-deluxe-firefox.xpi'
if (-not (Test-Path $xpi)) { throw 'no se genero el .xpi' }

# 2. perfil desechable con el add-on dentro
$prof = Join-Path $env:TEMP ('ff-integration-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path (Join-Path $prof 'extensions') -Force | Out-Null
@'
user_pref("xpinstall.signatures.required", false);
user_pref("extensions.autoDisableScopes", 0);
user_pref("extensions.enabledScopes", 15);
user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("datareporting.policy.dataSubmissionEnabled", false);
'@ | Set-Content -Path (Join-Path $prof 'user.js') -Encoding ASCII
Copy-Item $xpi (Join-Path $prof 'extensions\whatsapp-web-deluxe@barraco002.xpi')

# 3. arrancar y observar
$proc = Start-Process -FilePath $Firefox -ArgumentList @('-profile', $prof, '-no-remote', 'about:blank') -PassThru
$results = @()
try {
  Start-Sleep -Seconds 25
  # Firefox reparte la ventana entre varios procesos hijos, asi que se busca el
  # titulo en cualquier ventana visible, no solo en el PID lanzado.
  $wa = Get-VisibleTitles | Where-Object { $_.Title -like '*web.whatsapp.com*' }
  $results += @{ ok = [bool]$wa; name = 'la extension abre la ventana de WhatsApp' }

  $ej = Join-Path $prof 'extensions.json'
  $active = $false
  if (Test-Path $ej) {
    $j = Get-Content $ej -Raw | ConvertFrom-Json
    $addon = $j.addons | Where-Object { $_.id -eq 'whatsapp-web-deluxe@barraco002' }
    $active = [bool]($addon -and $addon.active)
  }
  $results += @{ ok = $active; name = 'el add-on queda instalado y activo' }
} finally {
  Get-Process firefox -ErrorAction SilentlyContinue | Where-Object { $_.Id -eq $proc.Id } | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 800
  if (Test-Path $prof) { Remove-Item $prof -Recurse -Force -ErrorAction SilentlyContinue }
}

$fail = 0
foreach ($r in $results) {
  if ($r.ok) { Write-Host ('OK    ' + $r.name) } else { Write-Host ('FALLO ' + $r.name); $fail++ }
}
Write-Host ''
$summary = '{0}/{1} {2}' -f ($results.Count - $fail), $results.Count, $(if ($fail) { 'FALLOS: ' + $fail } else { 'comprobaciones OK (Firefox real)' })
Write-Host $summary
exit $(if ($fail) { 1 } else { 0 })