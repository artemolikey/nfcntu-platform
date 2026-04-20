#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then
  echo "[ERROR] Папка node_modules не знайдена."
  echo "Розпакуйте архів повністю або виконайте npm install після налаштування доступу до npm."
  exit 1
fi
node scripts/start-memory.js
