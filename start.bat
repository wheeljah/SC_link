@echo off
title ScholarLink Launcher

echo [1/5] Starting PostgreSQL...
sc start postgresql-x64-16 >nul 2>&1
ping 127.0.0.1 -n 3 >nul

echo [2/5] Freeing ports 4000 and 5173...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":4000 " ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5173 " ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1
ping 127.0.0.1 -n 2 >nul

echo [3/5] Building TypeScript...
cd /d D:\SC_link\server
call npx tsc
if %errorlevel% neq 0 (
  echo [ERROR] TypeScript build failed. Check errors above.
  pause
  exit /b 1
)

echo [4/5] Starting API server (port 4000)...
start "ScholarLink API :4000" cmd /k "cd /d D:\SC_link\server && node dist/app.js"
ping 127.0.0.1 -n 4 >nul

echo [5/5] Starting client (port 5173)...
start "ScholarLink Client :5173" cmd /k "cd /d D:\SC_link\client && npm run dev"
ping 127.0.0.1 -n 5 >nul

echo Opening browser...
start http://localhost:5173

echo.
echo ====================================
echo  ScholarLink is running!
echo  App : http://localhost:5173
echo  API : http://localhost:4000
echo
echo  Close the two terminal windows
echo  to stop the servers.
echo ====================================
pause >nul
