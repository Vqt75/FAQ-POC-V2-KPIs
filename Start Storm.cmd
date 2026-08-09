@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-storm.ps1"
echo.
echo (Fenetre laissee ouverte pour lire les messages ci-dessus.)
pause
