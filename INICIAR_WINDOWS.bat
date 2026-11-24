@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Erro: instale Node.js 20 ou superior.
  pause
  exit /b 1
)
echo Abrindo o servidor local de desenvolvimento...
call npm run dev
pause
