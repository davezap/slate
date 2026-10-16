@echo off
setlocal
cd /d "%~dp0"
echo Slate Markdown Editor: http://localhost:8080/
python -m http.server 8080
