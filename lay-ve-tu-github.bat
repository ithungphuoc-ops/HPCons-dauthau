@echo off
rem ============================================================
rem  LAY BAN MOI NHAT TU GITHUB (bam dup de chay)
rem  Chay dau ngay lam viec, TRUOC khi bat dau sua code
rem ============================================================
chcp 65001 >nul
cd /d "%~dp0"

echo ===== KIEM TRA THAY DOI CHUA LUU =====
git status -s
echo (Neu co dong nao o tren: hay chay luu-len-github.bat truoc roi moi lay ve)
echo.

echo ===== KEO BAN MOI NHAT VE =====
git pull --no-edit origin master

echo.
echo ===== 5 LAN LUU GAN NHAT =====
git log --oneline -5
echo.
pause
