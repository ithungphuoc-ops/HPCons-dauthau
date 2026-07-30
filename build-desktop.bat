@echo off
echo =======================================================
echo   HP-CONS ERP - DUNG CU DUNG CHO PHONG DAU THAU
echo   Tu dong dong goi Ung dung Desktop (.exe)
echo =======================================================
echo.

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [LOI] Node.js chua duoc cai dat tren may tinh cua ban!
    echo Vui long tai va cai dat Node.js tai: https://nodejs.org/
    pause
    exit /b
)

echo [1/3] Dang cai dat cac thu vien (Dependencies)...
call npm install
if %errorlevel% neq 0 (
    echo [LOI] Khong the cai dat thu vien.
    pause
    exit /b
)

echo.
echo [2/3] Dang bien dich ma nguon va toi uu hoa tai nguyen...
call npm run build
if %errorlevel% neq 0 (
    echo [LOI] Khong the bien dich ung dung.
    pause
    exit /b
)

echo.
echo [3/3] Dang tien hanh dong goi thanh file .EXE di dong (Portable)...
npx electron-builder --win
if %errorlevel% neq 0 (
    echo [LOI] Tien trinh dong goi gap loi.
    pause
    exit /b
)

echo.
echo =======================================================
echo   THANH CONG! Ung dung cua ban da duoc dong goi.
echo   Kiem tra thu muc "dist-desktop" de lay file .exe.
echo =======================================================
echo.
pause
