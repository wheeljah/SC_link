@echo off
title ScholarLink Server Starter

echo ========================================
echo  ScholarLink Server + ngrok Launcher
echo ========================================
echo.

REM --- 1. Kill existing port 4000 process ---
echo [1/5] Freeing port 4000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":4000 " ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1
echo  [OK] Done
echo.

REM --- 2. Build TypeScript ---
echo [2/5] Building backend...
cd /d D:\SC_link\server
call npx tsc
if errorlevel 1 (
  echo  [FAIL] Build failed. See errors above.
  pause
  exit /b 1
)
echo  [OK] Build done
echo.

REM --- 3. Start backend (compiled JS - stable) ---
echo [3/5] Starting backend on port 4000...
start "ScholarLink-Backend" cmd /k "cd /d D:\SC_link\server && node dist/app.js"
echo  [OK] Backend started
echo.

REM --- 4. Start ngrok ---
echo [4/5] Starting ngrok tunnel (waiting 8s)...
ping 127.0.0.1 -n 8 >nul
start "ScholarLink-ngrok" cmd /k "ngrok http 4000"
echo  [OK] ngrok started
echo.

echo ========================================
echo  Copy the ngrok URL from the ngrok window
echo  Example: https://abc123.ngrok-free.app
echo ========================================
echo.
set /p NGROK_URL="ngrok URL (or press Enter to skip): "

if "%NGROK_URL%"=="" (
  echo  Skipped config update.
  echo.
  echo  Backend running at http://localhost:4000
  pause
  exit /b 0
)

REM --- 5. Update config + git push ---
echo.
echo [5/5] Updating api-config.json...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update-config.ps1" "%NGROK_URL%"
if errorlevel 1 (
  echo  [FAIL] config update failed
  pause
  exit /b 1
)

cd /d D:\SC_link
git add client\public\api-config.json
git commit -m "[skip ci] update backend URL to %NGROK_URL%"
git push origin master
if errorlevel 1 (
  echo  [FAIL] git push failed
  pause
  exit /b 1
)

echo.
echo ========================================
echo  [OK] All done!
echo  Deploy status: https://github.com/wheeljah/SC_link/actions
echo ========================================
pause
