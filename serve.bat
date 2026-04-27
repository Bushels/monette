@echo off
REM Monette Ledger - local dev server.
REM Double-click to build the browser scripts and serve the site at http://localhost:8765
cd /d "%~dp0"
call npm run build
if errorlevel 1 (
  echo.
  echo Build failed. Fix the error above, then re-run serve.bat.
  pause
  exit /b 1
)
start "" http://localhost:8765/
py -m http.server 8765
