@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 请先安装 Node.js，再重新双击本文件。
  echo 官方下载：https://nodejs.org/
  pause
  exit /b 1
)
if not exist "node_modules\vite\bin\vite.js" (
  echo 首次运行，正在安装依赖……
  call npm install --no-fund --no-audit
  if errorlevel 1 (
    echo 安装未完成，请检查网络后重试。
    pause
    exit /b 1
  )
)
echo 保持本窗口打开即可使用网页。关闭本窗口将停止服务。
call npm run dev -- --open
pause
