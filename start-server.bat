@echo off
chcp 65001 > nul
title ScholarLink Server Starter

echo ========================================
echo  ScholarLink 서버 + ngrok 자동 실행
echo ========================================
echo.

:: ── 1. 기존 포트 점유 프로세스 종료 ──────────────────────────
echo [1/5] 포트 4000 점유 프로세스 종료 중...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :4000 ^| findstr LISTENING') do (
    taskkill /PID %%a /F > nul 2>&1
)
:: node 전부 종료 (안전장치)
taskkill /F /IM node.exe > nul 2>&1
echo  ✓ 종료 완료
echo.

:: ── 2. 백엔드 서버 실행 ──────────────────────────────────────
echo [2/5] 백엔드 서버 실행 중 (포트 4000)...
start "ScholarLink-Backend" cmd /k "cd /d D:\SC_link\server && npx tsx src/app.ts"
echo  ✓ 백엔드 시작됨 (새 창에서 확인)
echo.

:: ── 3. ngrok 실행 대기 ──────────────────────────────────────
echo [3/5] ngrok 시작 대기 (10초)...
timeout /t 10 /nobreak > nul

echo  ngrok 터널 시작 중...
start "ScholarLink-ngrok" cmd /k "ngrok http 4000 --log=stdout"
echo  ✓ ngrok 시작됨 (ngrok 창에서 URL 확인)
echo.

:: ── 4. ngrok URL 감지 ─────────────────────────────────────────
echo [4/5] ngrok URL 감지 중...
echo  (ngrok 창에서 URL 확인 후 이 창에서 입력)
echo.
set /p NGROK_URL="ngrok URL 입력 (https://xxx.ngrok-free.app): "

if "%NGROK_URL%"=="" (
    echo  경고: URL 입력 안 됨. api-config.json 업데이트 건너뜀.
    goto :skipUpdate
)

:: ── 5. api-config.json 갱신 + git push ───────────────────────
echo.
echo [5/5] api-config.json 갱신 + GitHub 푸시 중...

set CONFIG_FILE=client\public\api-config.json
set REPO_PATH=D:\SC_link

:: config.json 내용 교체 (PowerShell)
powershell -NoProfile -Command ^
  "$c = Get-Content '%REPO_PATH%\%CONFIG_FILE%' -Raw | ConvertFrom-Json; " ^
  "$c.backend = '%NGROK_URL%'; " ^
  "$c.version = [string]([int]($c.version) + 1); " ^
  "$j = ConvertTo-Json -InputObject $c -Depth 3 -Compress; " ^
  "[System.IO.File]::WriteAllText('%REPO_PATH%\%CONFIG_FILE%', $j, [System.Text.UTF8Encoding]::new($false))"

echo  ✓ config.json 갱신 완료

:: git add + commit + push
cd /d %REPO_PATH%
git add %CONFIG_FILE%
git commit -m "[skip ci] chore: update backend URL to %NGROK_URL%"
git push origin master

if errorlevel 1 (
    echo  ✗ Git 푸시 실패
    pause
    exit /b 1
)

echo  ✓ GitHub 푸시 완료!
echo.
echo ========================================
echo  배포 시작됨! GitHub Actions에서 확인하세요.
echo  URL: https://github.com/wheeljah/SC_link/actions
echo ========================================
echo.
echo  Press any key to exit...
pause > nul
exit

:skipUpdate
echo ========================================
echo  서버 실행 완료!
echo ========================================
echo.
echo  1. 백엔드: localhost:4000 (새 창)
echo  2. ngrok: ngrok 창에서 URL 확인
echo  3. API 설정: .\update-ngrok.ps1 (PowerShell)
echo.
pause