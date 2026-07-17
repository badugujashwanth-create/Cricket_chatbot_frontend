[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

Write-Host 'Starting Cricket Chatbot Web in local demo mode.'
Write-Host 'Review environment placeholders and use synthetic data before continuing.'
npm run dev -- --host 127.0.0.1

