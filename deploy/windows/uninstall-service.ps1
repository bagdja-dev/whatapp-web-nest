#Requires -RunAsAdministrator
<#
  Remove the whatsapp-api-nest Windows Service installed via install-service.ps1.
  Run this ON the Windows server, from an elevated PowerShell prompt:

    .\uninstall-service.ps1
#>

param(
    [string]$ServiceName = "WhatsAppApiNest",
    [string]$NssmPath = "C:\Tools\nssm\nssm.exe"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $NssmPath)) {
    throw "nssm.exe tidak ditemukan di: $NssmPath"
}

$existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $existingService) {
    Write-Host "Service '$ServiceName' tidak ditemukan, tidak ada yang perlu dihapus." -ForegroundColor Yellow
    exit 0
}

Write-Host "== Stop & remove service '$ServiceName' ==" -ForegroundColor Cyan
& $NssmPath stop $ServiceName confirm | Out-Null
& $NssmPath remove $ServiceName confirm | Out-Null

Write-Host "Service '$ServiceName' berhasil dihapus." -ForegroundColor Green
