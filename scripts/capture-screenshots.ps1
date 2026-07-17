[CmdletBinding()]
param([Parameter(Mandatory = $true)][string]$BaseUrl)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot
$env:DEMO_BASE_URL = $BaseUrl

npm install --no-save --package-lock=false --ignore-scripts '@playwright/test@1.57.0'
npx playwright install chromium
npx playwright test scripts/demo.spec.ts --workers=1

Write-Host 'Review the overview screenshot and demo thumbnail for private data.'

