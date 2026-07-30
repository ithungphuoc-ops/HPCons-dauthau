@echo off
rem ============================================================
rem  LUU CONG VIEC LEN GITHUB (bam dup de chay)
rem  Gom moi thay doi -> commit -> keo ban moi nhat -> day len
rem ============================================================
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ===== CAC FILE DA THAY DOI =====
git status -s
echo.

set MSG=
set /p MSG=Nhap mo ta ngan (Enter de dung "cap nhat cong viec"):
if "%MSG%"=="" set MSG=cap nhat cong viec

git add -A
git commit -m "%MSG%"

echo.
echo ===== KEO BAN MOI NHAT TU GITHUB (neu may kia co day truoc) =====
git pull --no-edit origin master

echo.
echo ===== DAY LEN GITHUB =====
git push origin master

echo.
echo ===== KET QUA (dong tren cung la ban vua luu) =====
git log --oneline -3
echo.
echo Neu thay chu "CONFLICT" o tren thi DUNG LAI, nho Claude xu ly.
pause
