@echo off
setlocal
cd /d "%~dp0"

set PORT=8765
echo.
echo Last Mile Kanban - servidor en http://127.0.0.1:%PORT%/
echo Carpeta: %CD%
echo Cierra esta ventana o pulsa Ctrl+C para detener el servidor.
echo.

where python >nul 2>&1
if %ERRORLEVEL% equ 0 (
  start "" "http://127.0.0.1:%PORT%/"
  python -m http.server %PORT%
  goto :eof
)

where py >nul 2>&1
if %ERRORLEVEL% equ 0 (
  start "" "http://127.0.0.1:%PORT%/"
  py -3 -m http.server %PORT%
  goto :eof
)

where npx >nul 2>&1
if %ERRORLEVEL% equ 0 (
  echo Usando npx serve (Node.js^)...
  start "" "http://127.0.0.1:%PORT%/"
  npx --yes serve . -l %PORT%
  goto :eof
)

echo No se encontro Python ni npx. Opciones:
echo   1) Instala Python desde https://www.python.org
echo   2) Instala Node.js y ejecuta: npx --yes serve . -l %PORT%
echo.
pause
exit /b 1
