# Shared helpers for the Certificate Anatomy launchers.
# Windows PowerShell 5.1 compatible. No Administrator rights required.
# Never changes the machine or user execution policy.

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

function Get-ProjectRoot {
    $root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
    if (-not (Test-Path (Join-Path $root 'package.json'))) {
        throw "Could not find package.json above $PSScriptRoot."
    }
    return $root.Path
}

function Assert-NodeTools {
    $node = Get-Command node -ErrorAction SilentlyContinue
    $npm = Get-Command npm -ErrorAction SilentlyContinue
    if (-not $node -or -not $npm) {
        throw 'Node.js 20 or newer (with npm) is required. Install it from https://nodejs.org and try again.'
    }
    $version = (& node --version).Trim()
    $major = [int]($version.TrimStart('v').Split('.')[0])
    if ($major -lt 20) { throw "Node.js 20 or newer is required; found $version." }
    Write-Host "Node $version found."
    return $node.Source
}

function Install-DependenciesIfMissing([string]$Root) {
    if (Test-Path (Join-Path $Root 'node_modules\vite')) { return }
    Write-Host 'Installing dependencies (first run only)...'
    Push-Location $Root
    try {
        & npm ci --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
    } finally { Pop-Location }
}

function Start-NodeProcess([string]$Root, [string[]]$Arguments, [hashtable]$Environment, [switch]$CaptureOutput) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = (Get-Command node).Source
    $psi.Arguments = ($Arguments | ForEach-Object { if ($_ -match '\s') { '"' + $_ + '"' } else { $_ } }) -join ' '
    $psi.WorkingDirectory = $Root
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = [bool]$CaptureOutput
    if ($Environment) { foreach ($k in $Environment.Keys) { $psi.EnvironmentVariables[$k] = [string]$Environment[$k] } }
    return [System.Diagnostics.Process]::Start($psi)
}

function Wait-HttpReady([string]$Url, [int]$TimeoutSeconds = 60) {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
            if ($r.StatusCode -eq 200) { return $true }
        } catch { Start-Sleep -Milliseconds 400 }
    }
    throw "Timed out waiting for $Url"
}

function Start-Companion([string]$Root, [int]$AppPort) {
    $companion = Start-NodeProcess -Root $Root -Arguments @('scripts/companion/native-viewer.mjs') `
        -Environment @{ CA_COMPANION_ORIGINS = "http://127.0.0.1:$AppPort" } -CaptureOutput
    $line = $companion.StandardOutput.ReadLine()
    if (-not $line) { throw 'The native viewer companion did not start.' }
    $info = $line | ConvertFrom-Json
    Wait-HttpReady "http://127.0.0.1:$($info.port)/health" 15 | Out-Null
    return @{ Process = $companion; Port = $info.port; Token = $info.token }
}

function Stop-Children([System.Diagnostics.Process[]]$Processes) {
    foreach ($p in $Processes) {
        if ($p -and -not $p.HasExited) {
            try { $p.Kill(); $p.WaitForExit(5000) | Out-Null } catch { }
        }
    }
}
