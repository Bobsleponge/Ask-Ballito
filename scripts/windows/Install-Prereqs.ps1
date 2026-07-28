#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Installs Windows 11 prerequisites for Ask Ballito local development.

.DESCRIPTION
  Uses winget to install Git, Node.js LTS, and Docker Desktop on a fresh
  Windows 11 machine. Re-run safely — already-installed packages are skipped.

  After this script finishes:
    1. Reboot if Docker Desktop was just installed (or start Docker Desktop).
    2. Wait until Docker reports healthy: `docker info`
    3. From the repo root, run:  npm run setup:local
#>

$ErrorActionPreference = "Stop"

function Test-Command([string]$Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Ensure-Winget {
  if (-not (Test-Command "winget")) {
    throw @"
winget is not available. On Windows 11 it ships with App Installer.
Install/update 'App Installer' from the Microsoft Store, then re-run this script.
"@
  }
  Write-Host "winget OK: $(winget --version)"
}

function Install-WingetPackage {
  param(
    [Parameter(Mandatory = $true)][string]$Id,
    [Parameter(Mandatory = $true)][string]$DisplayName
  )

  Write-Host ""
  Write-Host "==> Checking $DisplayName ($Id)..."
  $list = winget list --id $Id --exact --accept-source-agreements 2>$null
  if ($LASTEXITCODE -eq 0 -and ($list | Select-String -SimpleMatch $Id)) {
    Write-Host "    Already installed."
    return
  }

  Write-Host "    Installing $DisplayName..."
  winget install --id $Id --exact --accept-package-agreements --accept-source-agreements --disable-interactivity
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to install $DisplayName (winget exit $LASTEXITCODE)."
  }
  Write-Host "    Installed."
}

Write-Host "Ask Ballito — Windows 11 prerequisite installer"
Write-Host "==============================================="

Ensure-Winget

Install-WingetPackage -Id "Git.Git" -DisplayName "Git"
Install-WingetPackage -Id "OpenJS.NodeJS.LTS" -DisplayName "Node.js LTS"
Install-WingetPackage -Id "Docker.DockerDesktop" -DisplayName "Docker Desktop"

# Refresh PATH for this session so `node` / `git` resolve without a new shell.
$machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$env:Path = "$machinePath;$userPath"

Write-Host ""
Write-Host "Versions (may need a new terminal if blank):"
foreach ($cmd in @("git", "node", "npm", "docker")) {
  if (Test-Command $cmd) {
    try {
      $ver = & $cmd --version 2>$null | Select-Object -First 1
      Write-Host ("  {0,-8} {1}" -f $cmd, $ver)
    } catch {
      Write-Host ("  {0,-8} installed (open a new terminal to refresh PATH)" -f $cmd)
    }
  } else {
    Write-Host ("  {0,-8} not on PATH yet — open a new terminal after Docker finishes setup" -f $cmd)
  }
}

Write-Host ""
Write-Host "Next steps"
Write-Host "----------"
Write-Host "1. Start Docker Desktop and wait until it says Engine running."
Write-Host "2. Open a NEW PowerShell/Terminal in the Ask-Ballito repo folder."
Write-Host "3. Set your OpenAI key for this session (required):"
Write-Host '     $env:OPENAI_API_KEY = "sk-..."'
Write-Host "4. Bootstrap the app:"
Write-Host "     npm run setup:local"
Write-Host "5. Start the dev server:"
Write-Host "     npm run dev"
Write-Host ""
Write-Host "Optional (maps / business ingest):"
Write-Host '     $env:GOOGLE_PLACES_API_KEY = "..."'
Write-Host '     $env:NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "..."'
Write-Host "     then re-run: npm run setup:local"
