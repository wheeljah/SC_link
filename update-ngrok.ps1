# ScholarLink - ngrok URL 자동 갱신 + GitHub Pages 배포 스크립트
# 사용법: PowerShell에서 .\update-ngrok.ps1 실행

param(
    [string]$NgrokApiUrl = "http://localhost:4040/api/request",
    [string]$RepoPath = "D:\SC_link",
    [string]$ConfigFile = "client\public\api-config.json",
    [string]$Branch = "master",
    [int]$MaxWaitMinutes = 5
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $scriptDir) { $scriptDir = $RepoPath }

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " ScholarLink ngrok URL Updater" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. ngrok URL 감지 ─────────────────────────────────────────────────────────
Write-Host "[1/5] ngrok URL 감지 중..." -ForegroundColor Yellow

$ngrokUrl = $null
$maxRetries = 3
for ($i = 1; $i -le $maxRetries; $i++) {
    try {
        $response = Invoke-RestMethod -Uri "$NgrokApiUrl/tunnels" -TimeoutSec 5 -ErrorAction Stop
        $tunnel = $response.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1
        if ($tunnel) {
            $ngrokUrl = $tunnel.public_url
            break
        }
    } catch {
        Write-Warning "시도 $i/$maxRetries 실패: $_"
        Start-Sleep -Seconds 3
    }
}

if (-not $ngrokUrl) {
    Write-Error "ngrok URL을 감지할 수 없습니다. ngrok이 실행 중인지 확인하세요."
    exit 1
}

$ngrokUrl = $ngrokUrl.TrimEnd('/')
Write-Host "  ✓ 감지된 URL: $ngrokUrl" -ForegroundColor Green

# ── 2. api-config.json 갱신 ──────────────────────────────────────────────────
Write-Host "[2/5] api-config.json 갱신 중..." -ForegroundColor Yellow

$configPath = Join-Path $RepoPath $ConfigFile
if (-not (Test-Path $configPath)) {
    Write-Error "설정 파일을 찾을 수 없습니다: $configPath"
    exit 1
}

$config = Get-Content $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
$oldUrl = $config.backend

if ($config.backend -eq $ngrokUrl) {
    Write-Host "  ✓ URL 동일함 — 업데이트 불필요" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host " 완료! ($ngrokUrl)" -ForegroundColor Green
    exit 0
}

$config.backend = $ngrokUrl
$config.version = [string]([int]($config.version) + 1)
$newJson = ConvertTo-Json -InputObject $config -Depth 3 -Compress

# BOM 없이 UTF-8로 저장
[System.IO.File]::WriteAllText($configPath, $newJson, [System.Text.UTF8Encoding]::new($false))
Write-Host "  ✓ $oldUrl → $ngrokUrl" -ForegroundColor Green
Write-Host "  ✓ Version: $($config.version)" -ForegroundColor Gray

# ── 3. Git add + commit ─────────────────────────────────────────────────────
Write-Host "[3/5] Git commit..." -ForegroundColor Yellow

Push-Location $RepoPath
try {
    git add $ConfigFile
    $commitMsg = "[skip ci] chore: update backend URL to $ngrokUrl"
    git commit -m $commitMsg
    Write-Host "  ✓ Commit 완료" -ForegroundColor Green
} catch {
    Pop-Location
    Write-Error "Git commit 실패: $_"
    exit 1
}

# ── 4. Git push ────────────────────────────────────────────────────────────
Write-Host "[4/5] GitHub에 푸시..." -ForegroundColor Yellow

try {
    git push origin $Branch
    Write-Host "  ✓ 푸시 완료" -ForegroundColor Green
} catch {
    Pop-Location
    Write-Error "Git push 실패: $_"
    exit 1
}
Pop-Location

# ── 5. GitHub Actions 완료 대기 + 최종 검증 ───────────────────────────────────
Write-Host "[5/5] GitHub Pages 배포 대기 중..." -ForegroundColor Yellow
Write-Host "  (최대 ${MaxWaitMinutes}분 대기)" -ForegroundColor Gray

$token = $env:GH_TOKEN
if (-not $token) {
    Write-Warning "GH_TOKEN 환경변수 없음 — Actions 상태 확인 건너뜀"
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host " 배포 시작됨! 아래 URL에서 확인:" -ForegroundColor Green
    Write-Host "  https://github.com/wheeljah/SC_link/actions" -ForegroundColor White
    exit 0
}

$headers = @{
    Authorization = "Bearer $token"
    Accept = "application/vnd.github+json"
}

$workflowName = "Deploy to GitHub Pages"
$maxWaitSeconds = $MaxWaitMinutes * 60
$checkInterval = 20
$elapsed = 0

while ($elapsed -lt $maxWaitSeconds) {
    Start-Sleep -Seconds $checkInterval
    $elapsed += $checkInterval

    try {
        $runs = Invoke-RestMethod -Uri "https://api.github.com/repos/wheeljah/SC_link/actions/runs?per_page=1" -Headers $headers -TimeoutSec 10
        $latest = $runs.workflow_runs | Select-Object -First 1

        if ($latest) {
            $status = $latest.status
            $conclusion = $latest.conclusion
            $runNum = $latest.run_number

            Write-Host "  [$($elapsed)s] Run #$runNum — $status / $conclusion" -ForegroundColor Gray

            if ($status -eq "completed") {
                if ($conclusion -eq "success") {
                    Write-Host ""
                    Write-Host "========================================" -ForegroundColor Green
                    Write-Host " ✅ 배포 성공!" -ForegroundColor Green
                    Write-Host ""
                    Write-Host "  🌐 https://wheeljah.github.io/SC_link" -ForegroundColor White
                    Write-Host "  🔗 백엔드: $ngrokUrl" -ForegroundColor White
                    Write-Host ""
                    Write-Host "  Run 로그: $($latest.html_url)" -ForegroundColor Gray
                    exit 0
                } else {
                    Write-Host ""
                    Write-Host "========================================" -ForegroundColor Red
                    Write-Host " ❌ 배포 실패: $conclusion" -ForegroundColor Red
                    Write-Host "  $($latest.html_url)" -ForegroundColor Gray
                    exit 1
                }
            }
        }
    } catch {
        Write-Warning "Actions 상태 확인 실패: $_"
    }
}

Write-Warning "대기 시간(${MaxWaitMinutes}분) 초과"
Write-Host "  https://github.com/wheeljah/SC_link/actions 에서 확인하세요" -ForegroundColor Gray
exit 1