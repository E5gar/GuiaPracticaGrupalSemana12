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

## Funcionalidades

- Registro de pacientes y medicos con validaciones: DNI de 8 digitos, CMP de 5 digitos, fecha de nacimiento no futura y correo institucional @uncp.edu.pe para estudiantes.
- Agendamiento de citas de 30 minutos con motivo de al menos 20 caracteres, una cita por dia para cada paciente y sin superposicion de horarios del medico.
- Consulta con notas del medico e historial clinico por paciente; una consulta registrada no puede modificarse.
- Panel operativo con agenda diaria por medico, busqueda de pacientes, estadisticas y marcado masivo de citas como completadas.
- Auditoria con niveles INFO, AUDIT, SENSIBLE y WARNING, mostrada en la vista Auditoria y en la consola del navegador.

## Middleware

Cada accion pasa por una cadena de middlewares:

1. Sesion: sin sesion activa responde 401.
2. Autorizacion: si el grupo no tiene el permiso requerido responde 403 y registra el intento.
3. Auditoria: registra accesos al historial clinico y acciones criticas.
4. Horario: solo permite citas de lunes a viernes de 8:00 a 18:00 y sabados de 8:00 a 13:00.
5. Alertas: avisa al medico de sus citas pendientes al iniciar sesion.

## Sesion y cookies

- Tiempo maximo de inactividad: 20 minutos, renovado con cada actividad.
- Cookies `cm_sessionid` y `cm_csrftoken` con SameSite Strict; el formulario de acceso incluye token CSRF oculto.
- Para probar la expiracion se puede agregar `?timeout=30` a la direccion, lo que reduce el tiempo a 30 segundos.
- La bandera HttpOnly no puede establecerse desde JavaScript, por lo que esta simulacion no la incluye.

## Estructura

```
ejercicio-2/
  index.html
  script.js
  styles.css
  README.md
```

Se enlazan `../styles/global.css`, `./styles.css`, `../scripts/global.js` y `./script.js`. Los datos se guardan en localStorage con la clave `cm_db_v1`.
