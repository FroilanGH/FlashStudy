import os
import sys
import webview

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

if getattr(sys, "frozen", False):
    # Corriendo como .exe empaquetado con PyInstaller: index.html,
    # styles.css, app.js y favicon.svg quedan bundleados junto al
    # ejecutable (ver 3-crear-exe.bat), no en una carpeta separada.
    ROOT_DIR = getattr(sys, "_MEIPASS", BASE_DIR)
else:
    # Corriendo como script (python app.py): index.html vive un nivel
    # arriba, en la raiz del proyecto, porque tambien lo usa la version web.
    ROOT_DIR = os.path.dirname(BASE_DIR)

INDEX_PATH = os.path.join(ROOT_DIR, "index.html")

if __name__ == "__main__":
    window = webview.create_window(
        "Fichero de estudio",
        url=INDEX_PATH,
        width=1080,
        height=800,
        min_size=(720, 560),
        text_select=True,
    )
    # Si algo no funciona, descomenta la linea de abajo (en vez de la que
    # esta activa) para abrir las herramientas de desarrollador y ver
    # errores en la consola:
    # webview.start(private_mode=False, debug=True)
    webview.start(private_mode=False)
