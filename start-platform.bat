@echo off
cd /d %~dp0
if not exist node_modules (
  echo [ERROR] Папка node_modules не знайдена.
  echo Розпакуйте архів повністю або виконайте npm install після налаштування доступу до npm.
  pause
  exit /b 1
)
node scripts\start-memory.js
pause
