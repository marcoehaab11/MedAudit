#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Smart build - builds only the services that changed.

.EXAMPLE
    .\build.ps1              # Auto-detect changes and build
    .\build.ps1 clinic-app   # Build & restart only clinic-app
    .\build.ps1 api          # Build & restart only api
    .\build.ps1 all          # Force rebuild everything
#>

param(
    [string]$Service = ""
)

$env:DOCKER_BUILDKIT = "1"
$env:COMPOSE_DOCKER_CLI_BUILD = "1"

$all_services = @("clinic-app", "public-app", "api", "platform-admin", "worker")

function Build-And-Restart {
    param([string[]]$services)

    if ($services.Count -eq 0) {
        Write-Host "No services to build." -ForegroundColor Green
        return
    }

    $svc_args = $services -join " "
    Write-Host "`n Building: $svc_args" -ForegroundColor Cyan

    $build_cmd = "docker compose build --parallel $svc_args"
    Write-Host $build_cmd -ForegroundColor DarkGray
    Invoke-Expression $build_cmd

    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build failed!" -ForegroundColor Red
        exit 1
    }

    Write-Host "`n Restarting containers..." -ForegroundColor Cyan
    Invoke-Expression "docker compose up -d --no-deps $svc_args"

    Write-Host "`n Done! Updated: $svc_args" -ForegroundColor Green
}

if ($Service -and $Service -ne "all") {
    Build-And-Restart @($Service)
    exit 0
}

if ($Service -eq "all") {
    Build-And-Restart $all_services
    exit 0
}

# Auto-detect changed services via git
Write-Host "Detecting changed services..." -ForegroundColor Yellow

$changed_files = git diff --name-only HEAD 2>$null
if (-not $changed_files) {
    $changed_files = git diff --name-only HEAD~1 HEAD 2>$null
}

$to_build = @()

foreach ($file in $changed_files) {
    if ($file -match "^frontend/dental-clinic-app/" -and "clinic-app" -notin $to_build) {
        $to_build += "clinic-app"
    } elseif ($file -match "^frontend/dental-clinic-public/" -and "public-app" -notin $to_build) {
        $to_build += "public-app"
    } elseif ($file -match "^src/DentalClinic\.Api/" -and "api" -notin $to_build) {
        $to_build += "api"
    } elseif ($file -match "^src/DentalClinic\.PlatformAdmin/" -and "platform-admin" -notin $to_build) {
        $to_build += "platform-admin"
    } elseif ($file -match "^src/DentalClinic\.Worker/" -and "worker" -notin $to_build) {
        $to_build += "worker"
    } elseif ($file -match "^src/DentalClinic\.(Domain|Application|Infrastructure|Contracts)/") {
        foreach ($s in @("api", "platform-admin", "worker")) {
            if ($s -notin $to_build) { $to_build += $s }
        }
    }
}

if ($to_build.Count -eq 0) {
    Write-Host "No changes detected. Run '.\build.ps1 all' to rebuild everything." -ForegroundColor Yellow
} else {
    Build-And-Restart $to_build
}
