# Caso 2 - Plataforma de Gestion de Consultas Medicas (Centro Medico UNCP)

Simulacion en HTML, CSS y JavaScript puros de una plataforma de agendamiento de citas, consulta e historial clinico con control de acceso por grupos. Los datos se guardan en localStorage y la sesion se maneja con sessionStorage y cookies, de modo que no requiere servidor ni base de datos.

## Requisitos y ejecucion

No hay dependencias que instalar. La pagina enlaza los estilos y scripts globales de la carpeta raiz, por lo que debe abrirse desde un servidor local situado en la raiz del repositorio (abrir el archivo con doble clic impide guardar cookies).

Opcion 1, extension Live Server de Visual Studio Code:

1. Abrir la carpeta del repositorio en VS Code.
2. Clic derecho sobre `ejercicio-2/index.html` y elegir Open with Live Server.
3. Visitar `http://127.0.0.1:5500/ejercicio-2/index.html`.

Opcion 2, servidor de Python desde la raiz del repositorio:

```
python -m http.server 8000
```

Luego visitar `http://localhost:8000/ejercicio-2/index.html`.

## Cuentas de prueba

Todas las cuentas usan la clave `Uncp2026`.

| Usuario | Grupo |
| --- | --- |
| admin | Admins |
| recepcion | Recepcionistas |
| medico1, medico2 | Medicos |
| paciente1, paciente2 | Pacientes |

## Datos de prueba

Al abrir la aplicacion por primera vez se generan 8 medicos de distintas especialidades, 15 pacientes y 30 citas. El administrador puede volver a generarlos desde Panel operativo con el boton Restablecer datos.
