# Caso 1 - Sistema de Gestion de Prestamos de Equipos de Laboratorio (FIS UNCP)

Aplicacion web desarrollada en Django para digitalizar el prestamo y devolucion de equipos en los 5 laboratorios de la Facultad de Ingenieria de Sistemas de la UNCP.

## Requisitos e instalacion

```powershell
cd ejercicio-1
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py makemigrations prestamos
python manage.py migrate
python manage.py seed_caso1
python manage.py runserver
