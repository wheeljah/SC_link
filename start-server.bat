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
taskkill /F /IM node.exe > nul 2>&1
echo  [OK] 종료 완료
echo.

:: ── 2. 백엔드 서버 실행 ──────────────────────────────────────
echo [2/5] 백엔드 서버 실행 중 (포트 4000)...
start "ScholarLink-Backend" cmd /k "cd /d D:\SC_link\server && npx tsx src/app.ts"
echo  [OK] 백엔드 시작됨
echo.

:: ── 3. ngrok 실행 ──────────────────────────────────────────
echo [3/5] ngrok 터널 시작 (10초 대기)...
ping 127.0.0.1 -n 10 > nul
start "ScholarLink-ngrok" cmd /k "ngrok http 4000"
echo  [OK] ngrok 시작됨
echo.
echo ========================================
echo  ngrok 창에서 URL 복사 후 입력하세요.
echo  예: https://abc123.ngrok-free.app
echo ========================================
echo.
set /p NGROK_URL="ngrok URL: "

if "%NGROK_URL%"=="" (
    echo  URL 미입력. config.json 업데이트 건너뜀.
    pause
    exit
)

:: ── 4. config.json 업데이트 ──────────────────────────────────
echo.
echo [4/5] api-config.json 갱신 중...

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update-config.ps1" "%NGROK_URL%"

if errorlevel 1 (
    echo  [FAIL] config.json 갱신 실패
    pause
    exit /b 1
)

:: ── 5. Git push ────────────────────────────────────────────
echo.
echo [5/5] GitHub 푸시 중...
cd /d D:\SC_link
git add client\public\api-config.json
git commit -m "[skip ci] update backend URL to %NGROK_URL%"
git push origin master

if errorlevel 1 (
    echo  [FAIL] Git 푸시 실패
    pause
    exit /b 1
)

echo.
echo ========================================
echo  [OK] 완료!
echo  배포 확인: https://github.com/wheeljah/SC_link/actions
echo ========================================
pause