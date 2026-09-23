#Requires -RunAsAdministrator
<#
  Install whatsapp-api-nest as a Windows Service via NSSM.
  Run this ON the Windows server, from an elevated PowerShell prompt:

    Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
    .\install-service.ps1 -AppDir "C:\apps\whatsapp-api-nest" -ChromePath "C:\Program Files\Google\Chrome\Application\chrome.exe"

  Prerequisites before running:
    - Node.js installed on the server
    - Chrome (or Chromium/Edge) installed on the server
    - nssm.exe downloaded (https://nssm.cc) and available at -NssmPath
    - Project already deployed to -AppDir, with `npm ci --omit=dev` and `npm run build` already run there
      (this script does not build the app, it only registers the already-built dist/main.js as a service)
#>

param(
    [string]$ServiceName = "WhatsAppApiNest",
    [string]$AppDir = "C:\apps\whatsapp-api-nest",
    [string]$NodeExe = "C:\Program Files\nodejs\node.exe",
    [string]$EntryPoint = "dist\main.js",
    [string]$ChromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe",
    [string]$Port = "3030",
    [string]$NssmPath = "C:\Tools\nssm\nssm.exe"
)

$ErrorActionPreference = "Stop"

function Assert-PathExists {
    param([string]$Path, [string]$Description)
    if (-not (Test-Path $Path)) {
        throw "$Description tidak ditemukan di: $Path"
    }
}

Write-Host "== Validasi prasyarat ==" -ForegroundColor Cyan
Assert-PathExists -Path $NssmPath -Description "nssm.exe"
Assert-PathExists -Path $NodeExe -Description "node.exe"
Assert-PathExists -Path $AppDir -Description "Folder aplikasi (AppDir)"
Assert-PathExists -Path (Join-Path $AppDir $EntryPoint) -Description "Entry point ($EntryPoint) - jalankan 'npm run build' dulu di server"
Assert-PathExists -Path $ChromePath -Description "Chrome executable"

$logDir = Join-Path $AppDir "logs"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

$existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existingService) {
    Write-Host "== Service '$ServiceName' sudah ada, stop & remove dulu untuk reinstall ==" -ForegroundColor Yellow
    & $NssmPath stop $ServiceName confirm | Out-Null
    & $NssmPath remove $ServiceName confirm | Out-Null
}

Write-Host "== Install service '$ServiceName' ==" -ForegroundColor Cyan
& $NssmPath install $ServiceName $NodeExe $EntryPoint

& $NssmPath set $ServiceName AppDirectory $AppDir
& $NssmPath set $ServiceName AppEnvironmentExtra "PORT=$Port" "CHROME_PATH=$ChromePath"
& $NssmPath set $ServiceName AppStdout (Join-Path $logDir "out.log")
& $NssmPath set $ServiceName AppStderr (Join-Path $logDir "err.log")
& $NssmPath set $ServiceName AppRotateFiles 1
& $NssmPath set $ServiceName AppRotateOnline 1
& $NssmPath set $ServiceName AppRotateBytes 10485760
& $NssmPath set $ServiceName AppExit Default Restart
& $NssmPath set $ServiceName AppRestartDelay 5000
& $NssmPath set $ServiceName Start SERVICE_AUTO_START
& $NssmPath set $ServiceName DisplayName "WhatsApp API (NestJS)"
& $NssmPath set $ServiceName Description "NestJS wrapper for whatsapp-web.js - send/batch WhatsApp messages via HTTP API"

Write-Host "== Start service '$ServiceName' ==" -ForegroundColor Cyan
& $NssmPath start $ServiceName

Start-Sleep -Seconds 2
& $NssmPath status $ServiceName

Write-Host ""
Write-Host "Selesai. Cek log di: $logDir" -ForegroundColor Green
Write-Host "Buka http://localhost:$Port/api/status untuk cek status koneksi WhatsApp." -ForegroundColor Green
Write-Host "Scan QR pertama kali lewat: http://localhost:$Port/api/qrcode" -ForegroundColor Green
