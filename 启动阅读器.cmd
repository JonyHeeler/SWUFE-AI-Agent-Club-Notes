@echo off
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
    py -3 "%~dp0reader.py"
) else (
    python "%~dp0reader.py"
)
if errorlevel 1 pause
