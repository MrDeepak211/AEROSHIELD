@echo off
cd /d "%~dp0"
echo Starting AEROSHIELD V25...
where node >nul 2>nul || (echo Node.js is required. Install Node.js 18+ and run this file again.&pause&exit /b 1)
start "AEROSHIELD SERVER" cmd /k "node server.cjs"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:5173"
