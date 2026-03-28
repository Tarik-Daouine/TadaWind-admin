@echo off
set "NODE_PATH=C:\Program Files\Microsoft Visual Studio\2022\Community\MSBuild\Microsoft\VisualStudio\NodeJs"
set PATH=%NODE_PATH%;%PATH%
cd /d "%~dp0"
npm run dev
