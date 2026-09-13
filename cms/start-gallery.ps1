# One-click launcher for the gallery editor, for a non-technical user on
# Windows. Started by double-clicking "Galerie bearbeiten.cmd" in the project
# root; that wrapper exists only because Windows opens a .ps1 in an editor
# instead of running it.
#
# This does what `npm run edit` does, plus what a double-click needs: a check
# that Node is installed, a first-run `npm install`, and opening the browser
# once the servers actually answer.
#
# User facing strings are German on purpose; code and comments stay English.
# Saved as UTF-8 with BOM, because Windows PowerShell 5.1 otherwise reads the
# umlauts as ANSI.

$root       = Split-Path -Parent $PSScriptRoot
$startJs    = Join-Path $PSScriptRoot 'start.js'
$websiteUrl = 'http://localhost:5173'
$editorUrl  = 'http://localhost:5174'

$Host.UI.RawUI.WindowTitle = 'Galerie-Editor'
# Setting this also switches the console to code page 65001, so the umlauts
# that node prints arrive intact.
[Console]::OutputEncoding = [Text.Encoding]::UTF8

function Stop-WithMessage([string[]] $lines) {
  Write-Host ''
  foreach ($line in $lines) { Write-Host $line -ForegroundColor Red }
  Write-Host ''
  Read-Host 'Zum Schließen die Eingabetaste drücken' | Out-Null
  exit 1
}

# One connection attempt per address "localhost" resolves to. Each needs a
# socket of its own family: vite listens on ::1 only, the editor on 127.0.0.1
# only, and a TcpClient built without an address family tries IPv4 alone.
function Test-Server([int] $port) {
  foreach ($address in [Net.Dns]::GetHostAddresses('localhost')) {
    $client = New-Object Net.Sockets.TcpClient($address.AddressFamily)
    try {
      $client.Connect($address, $port)
      return $true
    } catch {
      # Not up yet on this address; fall through to the next one.
    } finally {
      $client.Dispose()
    }
  }
  return $false
}

# Polls instead of guessing a delay: the first start has to build the
# thumbnails, which takes far longer than any fixed wait would.
function Wait-ForServer([System.Diagnostics.Process] $process, [int] $port, [int] $seconds) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    if ($process.HasExited) { return $false }
    if (Test-Server $port) { return $true }
    Start-Sleep -Milliseconds 400
  }
  return $false
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Stop-WithMessage @(
    'Node.js ist auf diesem Rechner nicht installiert.',
    '',
    'Bitte einmalig von https://nodejs.org herunterladen und installieren',
    '(die große grüne Schaltfläche, beim Installieren alles bestätigen).',
    'Danach diese Datei noch einmal anklicken.'
  )
}

if (-not (Test-Path (Join-Path $root 'node_modules'))) {
  Write-Host 'Erster Start: die benötigten Bausteine werden geladen.'
  Write-Host 'Das dauert ein paar Minuten und passiert nur dieses eine Mal.'
  Write-Host ''
  Push-Location $root
  try { & npm.cmd install } finally { Pop-Location }
  if ($LASTEXITCODE -ne 0) {
    Stop-WithMessage @(
      'Die Bausteine konnten nicht geladen werden.',
      'Bitte kurz Bescheid geben.'
    )
  }
}

Write-Host ''
Write-Host 'Die Galerie wird gestartet. Beim ersten Mal dauert das etwas länger,'
Write-Host 'weil die Vorschaubilder erzeugt werden.'
Write-Host ''

$server = Start-Process -FilePath 'node' -ArgumentList $startJs `
                        -WorkingDirectory $root -NoNewWindow -PassThru

try {
  if (Wait-ForServer $server 5174 300) {
    # The website takes a moment longer than the editor, but it is not worth
    # failing over: the browser tab reloads by itself a second later.
    Wait-ForServer $server 5173 30 | Out-Null
    Start-Process $websiteUrl
    Start-Process $editorUrl
    Write-Host ''
    Write-Host "  Die Webseite:  $websiteUrl"
    Write-Host "  Der Editor:    $editorUrl"
    Write-Host ''
    Write-Host 'Beide sind gerade im Browser aufgegangen.'
    Write-Host 'Zum Beenden dieses Fenster schließen.'
    Write-Host ''
  }
  $server.WaitForExit()
} finally {
  if (-not $server.HasExited) { $server.Kill() }
}

if ($server.ExitCode -ne 0) {
  Stop-WithMessage @(
    'Die Galerie wurde unerwartet beendet.',
    'Bitte kurz Bescheid geben.'
  )
}
