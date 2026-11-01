<#
.SYNOPSIS
  Renders the deterministic Certificate Anatomy film into output\ (ignored by Git).
.PARAMETER StillsOnly
  Render shot-boundary stills and the contact sheet only.
#>
[CmdletBinding()]
param([switch]$StillsOnly)

. (Join-Path $PSScriptRoot 'Common.ps1')

$root = Get-ProjectRoot
Assert-NodeTools | Out-Null
Install-DependenciesIfMissing $root
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
    throw 'FFmpeg is required on PATH to render the film (https://ffmpeg.org).'
}

Push-Location $root
try {
    & node node_modules/@playwright/test/cli.js install chromium
    & node scripts/film/render.mjs --stills
    if ($LASTEXITCODE -ne 0) { throw 'Rendering stills failed.' }
    if (-not $StillsOnly) {
        & node scripts/film/render.mjs --video
        if ($LASTEXITCODE -ne 0) { throw 'Rendering the film failed.' }
    }
    Write-Host ''
    Write-Host "Output folder: $(Join-Path $root 'output')"
} finally { Pop-Location }
