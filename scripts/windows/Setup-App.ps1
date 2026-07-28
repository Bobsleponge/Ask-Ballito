<#
.SYNOPSIS
  Clone Ask Ballito (if needed) and run the local app bootstrap on Windows.

.PARAMETER OpenAiApiKey
  Required OpenAI API key (sk-...). Can also be set via $env:OPENAI_API_KEY.

.PARAMETER RepoUrl
  Git remote to clone when not already inside the repo.

.PARAMETER RepoDir
  Target folder when cloning. Defaults to .\Ask-Ballito next to the current directory.

.EXAMPLE
  .\scripts\windows\Setup-App.ps1 -OpenAiApiKey "sk-..."

.EXAMPLE
  $env:OPENAI_API_KEY = "sk-..."
  .\scripts\windows\Setup-App.ps1
#>

[CmdletBinding()]
param(
  [string]$OpenAiApiKey = $env:OPENAI_API_KEY,
  [string]$RepoUrl = "https://github.com/Bobsleponge/Ask-Ballito.git",
  [string]$RepoDir = ""
)

$ErrorActionPreference = "Stop"

function Test-Command([string]$Name) {
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Assert-Prereq([string]$Name) {
  if (-not (Test-Command $Name)) {
    throw @"
Missing required tool: $Name

On a fresh Windows 11 machine, run as Administrator first:
  powershell -ExecutionPolicy Bypass -File .\scripts\windows\Install-Prereqs.ps1

Then start Docker Desktop and open a NEW terminal.
"@
  }
}

Write-Host "Ask Ballito — Windows app setup"
Write-Host "================================"

Assert-Prereq "git"
Assert-Prereq "node"
Assert-Prereq "npm"
Assert-Prereq "docker"

Write-Host "→ Checking Docker engine..."
docker info 1>$null 2>$null
if ($LASTEXITCODE -ne 0) {
  throw "Docker Desktop is installed but the engine is not running. Start it and wait until it is healthy."
}
Write-Host "  Docker OK"

if (-not $OpenAiApiKey -or $OpenAiApiKey -match "your-openai") {
  throw @"
OPENAI_API_KEY is required for the app to boot.

Pass it in:
  .\scripts\windows\Setup-App.ps1 -OpenAiApiKey "sk-..."

Or set it for the session:
  `$env:OPENAI_API_KEY = "sk-..."
"@
}
$env:OPENAI_API_KEY = $OpenAiApiKey

# Resolve repo root: prefer current git root, otherwise clone.
$inRepo = $false
try {
  $gitRoot = (git rev-parse --show-toplevel 2>$null)
  if ($LASTEXITCODE -eq 0 -and $gitRoot -and (Test-Path (Join-Path $gitRoot "package.json"))) {
    Set-Location $gitRoot
    $inRepo = $true
    Write-Host "→ Using existing repo at $gitRoot"
  }
} catch {
  $inRepo = $false
}

if (-not $inRepo) {
  if (-not $RepoDir) {
    $RepoDir = Join-Path (Get-Location) "Ask-Ballito"
  }
  if (-not (Test-Path $RepoDir)) {
    Write-Host "→ Cloning $RepoUrl into $RepoDir ..."
    git clone $RepoUrl $RepoDir
  } else {
    Write-Host "→ Using existing folder $RepoDir"
  }
  Set-Location $RepoDir
}

Write-Host "→ Running npm run setup:local ..."
npm run setup:local
if ($LASTEXITCODE -ne 0) {
  throw "setup:local failed (exit $LASTEXITCODE)."
}

Write-Host ""
Write-Host "Bootstrap finished. Start the app with:"
Write-Host "  npm run dev"
Write-Host "Then open http://localhost:3000"
