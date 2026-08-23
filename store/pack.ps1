# Pack Chrome Web Store zip: manifest.json + src/ only.
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$stage = Join-Path $env:TEMP "joyproxy-extension-store"
$out = Join-Path $PSScriptRoot "joyproxy-extension-1.0.0.zip"

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage | Out-Null
Copy-Item (Join-Path $root "manifest.json") $stage
Copy-Item (Join-Path $root "src") (Join-Path $stage "src") -Recurse

if (Test-Path $out) { Remove-Item $out -Force }
Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $out -CompressionLevel Optimal
Remove-Item $stage -Recurse -Force
Write-Host "Wrote $out"
Get-Item $out | Select-Object FullName, Length, LastWriteTime
