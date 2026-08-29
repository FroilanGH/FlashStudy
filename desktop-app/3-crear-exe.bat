@echo off
title Fichero de estudio - Crear .exe
echo Esto va a generar un archivo .exe independiente (no va a necesitar
echo tener Python instalado para correr).
echo.
echo Necesita conexion a internet SOLO esta vez, para descargar pyinstaller.
echo.
pause

python -m pip install --upgrade pip
python -m pip install pyinstaller
python -m pip install -r requirements.txt

echo.
echo Ubicando pyinstaller...
for /f "delims=" %%i in ('python -c "import sysconfig; print(sysconfig.get_path('scripts'))"') do set SCRIPTS_DIR=%%i

set PYI=%SCRIPTS_DIR%\pyinstaller.exe

if not exist "%PYI%" (
    echo No se encontro pyinstaller.exe en:
    echo   %PYI%
    echo Probando con "python -m PyInstaller" como alternativa...
    set PYI=
)

echo.
echo Generando el ejecutable, puede tardar 1-2 minutos...
echo.

if defined PYI (
    "%PYI%" --onefile --windowed --name FicheroDeEstudio --add-data "..\index.html;." --add-data "..\styles.css;." --add-data "..\app.js;." --add-data "..\favicon.svg;." app.py
) else (
    python -m PyInstaller --onefile --windowed --name FicheroDeEstudio --add-data "..\index.html;." --add-data "..\styles.css;." --add-data "..\app.js;." --add-data "..\favicon.svg;." app.py
)

echo.
if exist dist\FicheroDeEstudio.exe (
    echo ============================================
    echo   LISTO. El archivo esta en la carpeta "dist"
    echo   Se llama FicheroDeEstudio.exe
    echo   Podes moverlo o copiarlo a donde quieras,
    echo   ya no necesita nada mas de esta carpeta.
    echo ============================================
    explorer dist
) else (
    echo Algo fallo. Revisa los mensajes de arriba (en rojo)
    echo para ver el detalle del error.
)
pause
