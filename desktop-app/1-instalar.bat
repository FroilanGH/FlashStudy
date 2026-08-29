@echo off
title Fichero de estudio - Instalacion
echo Instalando dependencias (pywebview)...
echo Esto requiere tener Python instalado y conexion a internet.
echo.
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
echo.
echo Listo. Ahora podes ejecutar "2-abrir-app.bat"
pause
