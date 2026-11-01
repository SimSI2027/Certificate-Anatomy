<#
.SYNOPSIS
  Starts Certificate Anatomy locally (dev server plus the native Certificate Viewer companion) and opens it.
.PARAMETER Smoke
  Start, verify both services respond, then stop. Does not open a browser.
#>
[CmdletBinding()]
param([switch]$Smoke)

. (Join-Path $PSScriptRoot 'Common.ps1')

$root = Get-ProjectRoot
Assert-NodeTools | Out-Null
Install-DependenciesIfMissing $root

$port = 5173
$children = @()
try {
    $companion = Start-Companion -Root $root -AppPort $port
    $children += $companion.Process
    Write-Host "Native viewer companion on 127.0.0.1:$($companion.Port)"

    $vite = Start-NodeProcess -Root $root -Arguments @('node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', "$port", '--strictPort')
    $children += $vite
    Wait-HttpReady "http://127.0.0.1:$port/" 60 | Out-Null

    $url = "http://127.0.0.1:$port/#companion=$($companion.Port)&token=$($companion.Token)"
    if ($Smoke) {
        Write-Host 'Smoke test passed: app and companion are responding.'
        return
    }
    Start-Process $url
    Write-Host ''
    Write-Host "Certificate Anatomy is running at http://127.0.0.1:$port/"
    Write-Host 'Press Enter to stop.'
    [void](Read-Host)
} finally {
    Stop-Children $children
    Write-Host 'Stopped.'
}
