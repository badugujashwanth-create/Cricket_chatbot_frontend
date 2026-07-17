[CmdletBinding()]
param([Parameter(Mandatory = $true)][string]$BaseUrl)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot
$env:DEMO_BASE_URL = $BaseUrl

npm install --no-save --package-lock=false --ignore-scripts '@playwright/test@1.57.0'
npx playwright install chromium
npx playwright test scripts/demo.spec.ts --workers=1

$video = Get-ChildItem -Path 'test-results' -Filter '*.webm' -Recurse |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
if (-not $video) { throw 'Playwright completed without producing a WebM video.' }
Copy-Item -LiteralPath $video.FullName -Destination 'docs/demo/demo.webm' -Force
Write-Host 'Created docs/demo/demo.webm. Review every frame before committing.'

