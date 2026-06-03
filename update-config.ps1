# update-config.ps1
# Usage: update-config.ps1 "https://xxx.ngrok-free.app"
param(
    [string]$NgrokUrl
)

$ErrorActionPreference = "Stop"

if (-not $NgrokUrl) {
    Write-Host "[ERROR] ngrok URL required" -ForegroundColor Red
    exit 1
}

$NgrokUrl = $NgrokUrl.TrimEnd('/')
$ConfigPath = "D:\SC_link\client\public\api-config.json"

Write-Host "Backend URL: $NgrokUrl" -ForegroundColor Cyan

try {
    $config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
    $config.backend = $NgrokUrl
    $config.version = [string]([int]($config.version) + 1)

    $json = ConvertTo-Json -InputObject $config -Depth 3 -Compress
    [System.IO.File]::WriteAllText($ConfigPath, $json, [System.Text.UTF8Encoding]::new($false))

    Write-Host "[OK] config.json updated (version $($config.version))" -ForegroundColor Green
    exit 0
} catch {
    Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}