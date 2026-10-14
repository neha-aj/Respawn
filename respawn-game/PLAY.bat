@echo off
rem Double-click to play RESPAWN. The first run installs and builds everything (a few minutes).
cd /d "%~dp0"
if not exist node_modules call npm install --no-audit --no-fund
if not exist dist\index.html call npm run build:all
call npx vite preview --port 4180 --open
