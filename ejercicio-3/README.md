# Caso 3 - Sistema de Control de Asistencia y Permisos de Empleados (TecnoAndes S.A.C.)

Simulacion en HTML, CSS y JavaScript puros de un sistema de marcacion de asistencia, permisos y vacaciones con flujo de aprobacion y roles jerarquicos. Los datos se guardan en localStorage y la sesion se maneja con sessionStorage y cookies, de modo que no requiere servidor ni base de datos.

## Requisitos y ejecucion

No hay dependencias que instalar. La pagina enlaza los estilos y scripts globales de la carpeta raiz, por lo que debe abrirse desde un servidor local situado en la raiz del repositorio (abrir el archivo con doble clic impide guardar cookies).

Opcion 1, extension Live Server de Visual Studio Code:

1. Abrir la carpeta del repositorio en VS Code.
2. Clic derecho sobre `ejercicio-3/index.html` y elegir Open with Live Server.
3. Visitar `http://127.0.0.1:5500/ejercicio-3/index.html`.

Opcion 2, servidor de Python desde la raiz del repositorio:

```
python -m http.server 8000
```

Luego visitar `http://localhost:8000/ejercicio-3/index.html`.

## Cuentas de prueba

Todas las cuentas usan la clave `Tecno2026`.

| Usuario | Rol |
| --- | --- |
| rrhh | Admin RRHH |
| jefe.sistemas, jefe.ventas | Jefe de Area |
| empleado1, empleado2 | Empleado |
| contador | Contador |
| exempleado | Cuenta desactivada, el acceso es bloqueado |

## Datos de prueba

Al abrir la aplicacion por primera vez se generan 12 empleados, 55 registros de asistencia y 10 solicitudes de permiso.
