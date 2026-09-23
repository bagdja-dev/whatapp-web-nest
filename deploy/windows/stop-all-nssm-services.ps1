#Requires -RunAsAdministrator
<#
  Stop ALL Windows Services that were installed via NSSM (identified by ImagePath
  containing "nssm"), without uninstalling them. Services stay registered and can
  be started again later with `nssm start <name>` or `Start-Service <name>`.

  Run this ON the Windows server, from an elevated PowerShell prompt:

    Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
    .\stop-all-nssm-services.ps1
#>

$ErrorActionPreference = "Stop"

$nssmServices = Get-CimInstance Win32_Service | Where-Object { $_.PathName -match "nssm" }

if (-not $nssmServices) {
    Write-Host "Tidak ada service NSSM yang ditemukan." -ForegroundColor Yellow
    exit 0
}

Write-Host "== Service NSSM yang ditemukan ==" -ForegroundColor Cyan
$nssmServices | Select-Object Name, DisplayName, State | Format-Table -AutoSize

foreach ($svc in $nssmServices) {
    if ($svc.State -eq "Running") {
        Write-Host "Stopping $($svc.Name)..." -ForegroundColor Cyan
        Stop-Service -Name $svc.Name -Force
    } else {
        Write-Host "$($svc.Name) sudah tidak running (state: $($svc.State)), skip." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "== Status akhir ==" -ForegroundColor Green
Get-CimInstance Win32_Service | Where-Object { $_.PathName -match "nssm" } |
    Select-Object Name, DisplayName, State | Format-Table -AutoSize
