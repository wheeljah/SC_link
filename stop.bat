@echo off
title ScholarLink Stop

echo Stopping ScholarLink...
pm2 delete scholarlink-api >nul 2>&1

for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5173 " ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1

echo Done.
pause >nul
