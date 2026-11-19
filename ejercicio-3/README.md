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

## Funcionalidades

- Marcacion de entrada y salida con un reloj simulado que permite probar distintas horas. El horario base es de 08:00 con tolerancia de dos horas: la entrada se acepta entre 06:00 y 10:00 y la salida entre 15:00 y 19:00.
- Jornada de 8 horas; el tiempo adicional se contabiliza como horas extra.
- Solicitud de permisos y vacaciones con fechas validas, sin superposicion, con saldo de 30 dias de vacaciones y motivo de al menos 30 caracteres.
- Flujo de aprobacion: la solicitud queda pendiente, el jefe de su area la aprueba o rechaza y el empleado recibe una notificacion.
- Correccion de asistencia por RRHH con justificacion de al menos 50 caracteres.
- Reportes por area, horas extra por empleado, exportacion simulada y panel de operaciones de RRHH con aprobacion masiva.
- Manual de usuario breve dentro de la propia aplicacion.

## Roles y middleware

Los roles son jerarquicos: el Admin RRHH tiene acceso global, el Jefe de Area solo ve y aprueba lo de su area, el Empleado gestiona su propia asistencia y permisos, y el Contador solo consulta reportes. Los salarios solo son visibles para RRHH.

Cada accion pasa por una cadena de middlewares:

1. Bloqueo: rechaza las cuentas desactivadas.
2. Sesion: sin sesion activa responde 401.
3. Autorizacion: si el rol no tiene el permiso requerido responde 403 y registra el intento.
4. Auditoria: registra modificaciones de asistencia y permisos con usuario y fecha.
5. Horario y recordatorio: valida el rango de marcacion y avisa si aun no se marco la entrada del dia.

## Sesion y cookies

- Tiempo maximo de inactividad: 45 minutos, renovado con cada actividad.
- Cookies `ta_sessionid` y `ta_csrftoken` con SameSite Strict; el formulario de acceso incluye token CSRF oculto.
- Para probar la expiracion se puede agregar `?timeout=30` a la direccion, lo que reduce el tiempo a 30 segundos.
- La bandera HttpOnly no puede establecerse desde JavaScript, por lo que esta simulacion no la incluye.

## Estructura

```
ejercicio-3/
  index.html
  script.js
  styles.css
  README.md
```

Se enlazan `../styles/global.css`, `./styles.css`, `../scripts/global.js` y `./script.js`. Los datos se guardan en localStorage con la clave `ta_db_v1` y el reloj simulado con `ta_clock`.
