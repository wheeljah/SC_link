@echo off
chcp 65001 > nul
title ScholarLink Server Starter

echo ========================================
echo  ScholarLink 서버 + ngrok 자동 실행
echo ========================================
echo.

:: ── 1. 기존 포트 점유 프로세스 종료 ──────────────────────────
echo [1/5] 포트 4000 점유 프로세스 종료 중...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4000 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F > nul 2>&1
)
:: node 전부 종료 (안전장치)
taskkill /F /IM node.exe > nul 2>&1
echo  ✓ 종료 완료
echo.

:: ── 2. 백엔드 서버 실행 ──────────────────────────────────────
echo [2/5] 백엔드 서버 실행 중 (포트 4000)...
start "ScholarLink-Backend" cmd /k "cd /d D:\SC_link\server && npx tsx src/app.ts"
echo  ✓ 백엔드 시작됨
echo  (백엔드 창에서 서버 실행 완료 대기...)
echo.

:: ── 3. ngrok 실행 ──────────────────────────────────────────
echo [3/5] ngrok 터널 시작 중 (10초 대기)...
ping 127.0.0.1 -n 10 > nul
start "ScholarLink-ngrok" cmd /k "ngrok http 4000"
echo  ✓ ngrok 시작됨 (ngrok 창에서 URL 확인)
echo.

:: ── 4. ngrok URL 입력 ──────────────────────────────────────
echo ========================================
echo  ngrok URL을 입력하세요.
echo  (ngrok 창에서 Forwarding 주소 복사: https://xxx.ngrok-free.app)
echo ========================================
echo.
set /p NGROK_URL="URL: "

if "%NGROK_URL%"=="" (
    echo  경고: URL 미입력. api-config.json 업데이트 건너뜀.
    echo.
    goto :skipUpdate
)

:: ── 5. api-config.json 갱신 + git push ───────────────────────
echo.
echo [5/5] api-config.json 갱신 + GitHub 푸시 중...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$f='D:\SC_link\client\public\api-config.json'; " ^
  "$c=Get-Content $f -Raw|ConvertFrom-Json; " ^
  "$c.backend='%NGROK_URL%'; " ^
  "$c.version=[string]([int]($c.version)+1); " ^
  "$j=ConvertTo-Json $c -Depth 3 -Compress; " ^
  "[System.IO.File]::WriteAllText($f,$j,[System.Text.UTF8Encoding]::new($false)); " ^
  "Write-Host 'config.json 갱신 완료'"

echo  ✓ config.json 갱신 완료

cd /d D:\SC_link
git add client\public\api-config.json
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
echo  완료! GitHub Actions에서 배포 확인하세요.
echo  https://github.com/wheeljah/SC_link/actions
echo ========================================
echo.
pause
exit

:skipUpdate
echo ========================================
echo  서버 실행 완료!
echo ========================================
echo.
echo  1. 백엔드: localhost:4000 (새 창)
echo  2. ngrok: ngrok 창에서 URL 확인
echo  3. API 설정: PowerShell에서 .\update-ngrok.ps1 실행
echo.
pause