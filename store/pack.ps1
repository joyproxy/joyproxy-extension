# Pack zips: Chrome Web Store (no key) and developer-mode unpacked (keeps key).
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$manifestPath = Join-Path $root "manifest.json"
$version = (Get-Content $manifestPath -Raw | ConvertFrom-Json).version
$utf8 = New-Object System.Text.UTF8Encoding $false

function Write-Zip($stage, $out, $keepKey) {
  if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
  New-Item -ItemType Directory -Path $stage | Out-Null

  $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
  if (-not $keepKey -and $manifest.PSObject.Properties.Name -contains "key") {
    $manifest.PSObject.Properties.Remove("key")
  }
  $manifestJson = $manifest | ConvertTo-Json -Depth 20
  [System.IO.File]::WriteAllText((Join-Path $stage "manifest.json"), $manifestJson + [Environment]::NewLine, $utf8)
  Copy-Item (Join-Path $root "src") (Join-Path $stage "src") -Recurse

  if (Test-Path $out) { Remove-Item $out -Force }
  Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $out -CompressionLevel Optimal
  Remove-Item $stage -Recurse -Force
  Write-Host "Wrote $out"
  Get-Item $out | Select-Object FullName, Length, LastWriteTime
}

Write-Zip (Join-Path $env:TEMP "joyproxy-extension-store") (Join-Path $PSScriptRoot "joyproxy-extension-$version.zip") $false
Write-Zip (Join-Path $env:TEMP "joyproxy-extension-dev") (Join-Path $PSScriptRoot "joyproxy-extension-$version-unpacked.zip") $true
Copy-Item (Join-Path $PSScriptRoot "joyproxy-extension-$version-unpacked.zip") (Join-Path $PSScriptRoot "joyproxy-extension-unpacked.zip") -Force
Write-Host "Wrote $(Join-Path $PSScriptRoot 'joyproxy-extension-unpacked.zip') (copy for GitHub latest/download)"
