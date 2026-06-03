@echo off
chcp 65001 >nul
echo ============================================================
echo  ScholarLink - 초기 설정 스크립트
echo ============================================================
echo.

REM 1. PostgreSQL 서비스 시작 시도
echo [1/4] PostgreSQL 서비스 확인 중...
sc start postgresql-x64-16 >nul 2>&1
IF ERRORLEVEL 1 (
  sc start postgresql-x64-17 >nul 2>&1
)
timeout /t 3 /nobreak >nul

REM 2. DB 및 사용자 생성
echo [2/4] 데이터베이스 생성 중...
SET PGPASSWORD=password
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE DATABASE scholarlink;" 2>nul || (
  "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c "CREATE DATABASE scholarlink;" 2>nul
)

REM 3. 서버 패키지 설치
echo [3/4] 서버 패키지 설치 중...
cd /d "%~dp0server"
call npm install --silent

REM 4. DB 마이그레이션
echo [4/4] DB 마이그레이션 실행 중...
call npx tsx src/db/migrate.ts

echo.
echo ============================================================
echo  설정 완료! 아래 명령어로 서버를 시작하세요:
echo.
echo  서버: cd server ^&^& npx tsx src/app.ts
echo  클라이언트: cd client ^&^& npm run dev
echo ============================================================
pause
