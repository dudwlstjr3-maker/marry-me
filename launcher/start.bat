@echo off
rem Marry-me wedding planner: downloads the final version from GitHub and opens it.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update.ps1"
if errorlevel 1 pause
