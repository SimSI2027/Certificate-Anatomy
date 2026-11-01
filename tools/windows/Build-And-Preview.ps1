<#
.SYNOPSIS
  Builds the production site (same base path as GitHub Pages) and previews it locally.
.PARAMETER Smoke
  Build, start the preview, run the subpath smoke test, then stop.
#>
[CmdletBinding()]
param([switch]$Smoke)

. (Join-Path $PSScriptRoot 'Common.ps1')

$root = Get-ProjectRoot
Assert-NodeTools | Out-Null
Install-DependenciesIfMissing $root

Push-Location $root
try {
    & node node_modules/vite/bin/vite.js build
    if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
} finally { Pop-Location }

$port = 4173
$children = @()
try {
    $companion = Start-Companion -Root $root -AppPort $port
    $children += $companion.Process
    $preview = Start-NodeProcess -Root $root -Arguments @('node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', "$port", '--strictPort')
    $children += $preview
    Wait-HttpReady "http://127.0.0.1:$port/Certificate-Anatomy/" 60 | Out-Null

    if ($Smoke) {
        Push-Location $root
        try {
            & node scripts/smoke/pages-smoke.mjs --url "http://127.0.0.1:$port/Certificate-Anatomy/"
            if ($LASTEXITCODE -ne 0) { throw 'Preview smoke test failed.' }
        } finally { Pop-Location }
        return
    }
    Start-Process "http://127.0.0.1:$port/Certificate-Anatomy/#companion=$($companion.Port)&token=$($companion.Token)"
    Write-Host "Production preview at http://127.0.0.1:$port/Certificate-Anatomy/"
    Write-Host 'Press Enter to stop.'
    [void](Read-Host)
} finally {
    Stop-Children $children
    Write-Host 'Stopped.'
}
