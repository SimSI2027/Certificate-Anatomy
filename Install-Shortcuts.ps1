<#
.SYNOPSIS
  Creates local shortcuts (ignored by Git) in the project folder for the Certificate Anatomy launchers.
  The shortcuts run Windows PowerShell with -ExecutionPolicy Bypass for that one process only;
  the machine and user execution policy are never changed. No Administrator rights are needed.
#>
[CmdletBinding()]
param()

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$shell = New-Object -ComObject WScript.Shell

$shortcuts = @(
    @{ Name = 'Certificate Anatomy.lnk'; Script = 'tools\windows\Launch-Demo.ps1'; Description = 'Run Certificate Anatomy locally' },
    @{ Name = 'Build and Preview Certificate Anatomy.lnk'; Script = 'tools\windows\Build-And-Preview.ps1'; Description = 'Build and preview the GitHub Pages version' },
    @{ Name = 'Export Certificate Anatomy Video.lnk'; Script = 'tools\windows\Export-Video.ps1'; Description = 'Render the Certificate Anatomy film' }
)

foreach ($s in $shortcuts) {
    $path = Join-Path $root $s.Name
    $lnk = $shell.CreateShortcut($path)
    $lnk.TargetPath = $powershell
    $lnk.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $root $s.Script)`""
    $lnk.WorkingDirectory = $root
    $lnk.Description = $s.Description
    $lnk.Save()
    Write-Host "Created $path"
}
Write-Host 'Shortcuts are local only and ignored by Git.'
