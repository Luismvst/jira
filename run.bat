@echo off
setlocal
cd /d "%~dp0"

set PORT=8765
echo.
echo Kanban proyecto - servidor local en puerto %PORT%
echo Carpeta: %CD%
echo.

where python >nul 2>&1
if %ERRORLEVEL% equ 0 (
  start "kanban-http" cmd /k cd /d "%~dp0" ^&^& python -m http.server %PORT%
  timeout /t 2 /nobreak >nul
  start "" "http://127.0.0.1:%PORT%/"
  echo Navegador abierto. El servidor sigue en la ventana "kanban-http".
  echo Cierrala para detener el servidor.
  pause
  goto :eof
)

where py >nul 2>&1
if %ERRORLEVEL% equ 0 (
  start "kanban-http" cmd /k cd /d "%~dp0" ^&^& py -3 -m http.server %PORT%
  timeout /t 2 /nobreak >nul
  start "" "http://127.0.0.1:%PORT%/"
  echo Navegador abierto. El servidor sigue en la ventana "kanban-http".
  echo Cierrala para detener el servidor.
  pause
  goto :eof
)

echo No se encontro Python. Opciones:
echo   1) Instala Python desde https://www.python.org
echo   2) En esta carpeta ejecuta: npx --yes serve .
echo.
pause
exit /b 1
