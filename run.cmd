@echo off
rem Starts the app; the installer runs it right after cloning.
rem Arguments go to the app: run.cmd --server --port 8080
setlocal
cd /d "%~dp0"
where node >nul 2>&1 || (
  echo agent needs Node.js 22.18 or newer: https://nodejs.org
  exit /b 1
)
node -e "const [a,b]=process.versions.node.split('.').map(Number); process.exit(a>22||(a===22&&b>=18)?0:1)" || (
  echo agent needs Node.js 22.18 or newer: https://nodejs.org
  exit /b 1
)
rem Install dependencies on the first run and whenever package-lock.json changes.
node -e "const fs=require('fs');const t=f=>fs.statSync(f).mtimeMs;try{process.exit(t('package-lock.json')>t('node_modules/.package-lock.json')?1:0)}catch{process.exit(1)}" || (
  call npm install --no-audit --no-fund || exit /b 1
)
npm start --silent -- %*
