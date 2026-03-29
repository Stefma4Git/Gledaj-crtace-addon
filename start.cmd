@echo off
title Gledaj Crtace Addon - Starter
echo ================================================
echo     Gledaj Crtace Stremio Addon Starter
echo ================================================
echo.

:: Quick check if npm install was already done
if not exist "node_modules" (
    echo [INFO] node_modules folder not found.
    echo [INFO] Running npm install for the first time...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] npm install failed! Please check your internet connection or package.json.
        pause
        exit /b 1
    )
    echo.
    echo [SUCCESS] Dependencies installed successfully.
    echo.
) else (
    echo [OK] Dependencies already installed. Skipping npm install.
)

echo [INFO] Starting Gledaj Crtace Addon...
echo.

:: Start the addon
node index.js

pause
