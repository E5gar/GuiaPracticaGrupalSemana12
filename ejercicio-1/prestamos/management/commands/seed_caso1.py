from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from prestamos.models import Equipo, Laboratorio, LogAuditoria, Prestamo, Usuario


class Command(BaseCommand):
    help = "Carga datos de prueba para el Caso 1 (minimo 10 equipos, 5 usuarios, 15 prestamos)"

    def handle(self, *args, **options):
        labs_data = [
            ("LAB-01", "Lab 01 - Redes", "Pabellon B - Piso 2"),
            ("LAB-02", "Lab 02 - Software", "Pabellon B - Piso 3"),
            ("LAB-03", "Lab 03 - Electronica", "Pabellon C - Piso 1"),
            ("LAB-04", "Lab 04 - Multimedia", "Pabellon C - Piso 2"),
            ("LAB-05", "Lab 05 - Investigacion", "Pabellon D - Piso 1"),
        ]
        labs = {}
        for codigo, nombre, ubicacion in labs_data:
            lab, _ = Laboratorio.objects.get_or_create(
                codigo=codigo,
                defaults={"nombre": nombre, "ubicacion": ubicacion},
            )
            labs[codigo] = lab

        users_data = [
            ("admin_fis", "admin.fis@uncp.edu.pe", "Jefe", "Laboratorio", "admin", "ADM-001", True),
            ("asistente_1", "jquispe@uncp.edu.pe", "Juan", "Quispe", "asistente", "ASI-002", False),
            ("docente_1", "cmendoza@uncp.edu.pe", "Carlos", "Mendoza", "docente", "DOC-101", False),
            ("docente_2", "lparedes@uncp.edu.pe", "Lucia", "Paredes", "docente", "DOC-102", False),
            ("docente_3", "rtorres@uncp.edu.pe", "Raul", "Torres", "docente", "DOC-103", False),
            ("invitado_1", "invitado@uncp.edu.pe", "Usuario", "Invitado", "invitado", "INV-001", False),
        ]
        users = {}
        for username, email, first_name, last_name, rol, cod, is_super in users_data:
            user, created = Usuario.objects.get_or_create(
                username=username,
                defaults={
                    "email": email,
                    "first_name": first_name,
                    "last_name": last_name,
                    "rol": rol,
                    "codigo_uncp": cod,
                    "is_staff": is_super,
                    "is_superuser": is_super,
                },
            )
            if created:
                user.set_password("uncp2026")
                user.save()
            users[username] = user

        hoy = timezone.localdate()
        equipos_data = [
            ("UNCP-FIS-001", "Laptop Dell Latitude 5430", "Dell", "Latitude 5430", "Laptop", "operativo", "LAB-02", 6, 5, 35),
            ("UNCP-FIS-002", "Proyector Epson PowerLite X49", "Epson", "PowerLite X49", "Proyector", "operativo", "LAB-04", 4, 3, 50),
            ("UNCP-FIS-003", "Kit Arduino Mega 2560 Pro", "Arduino", "Mega 2560", "Arduino", "operativo", "LAB-03", 12, 10, 15),
            ("UNCP-FIS-004", "Router Cisco ISR 4321", "Cisco", "ISR 4321", "Router", "operativo", "LAB-01", 5, 4, 80),
            ("UNCP-FIS-005", "Switch Catalyst 2960-X", "Cisco", "Catalyst 2960-X", "Switch", "mantenimiento", "LAB-01", 3, 3, 4),
            ("UNCP-FIS-006", "Camara Sony Alpha A6400", "Sony", "Alpha A6400", "Camara", "operativo", "LAB-04", 3, 3, 20),
            ("UNCP-FIS-007", "Laptop Lenovo ThinkPad T14", "Lenovo", "ThinkPad T14", "Laptop", "operativo", "LAB-05", 8, 6, 40),
            ("UNCP-FIS-008", "Kit Arduino Uno R3 IoT", "Arduino", "Uno R3", "Arduino", "operativo", "LAB-03", 10, 10, 60),
            ("UNCP-FIS-009", "Proyector BenQ MH560", "BenQ", "MH560", "Proyector", "baja", "LAB-02", 1, 0, 210),
            ("UNCP-FIS-010", "Switch Aruba 2530-24G", "HPE Aruba", "2530-24G", "Switch", "operativo", "LAB-05", 4, 4, 18),
        ]
        equipos = []
        for cod, nombre, marca, modelo, cat, est, lab_cod, st_tot, st_disp, dias_m in equipos_data:
            eq, _ = Equipo.objects.get_or_create(
                codigo_patrimonial=cod,
                defaults={
                    "nombre": nombre,
                    "marca": marca,
                    "modelo": modelo,
                    "categoria": cat,
                    "estado": est,
                    "laboratorio": labs[lab_cod],
                    "stock_total": st_tot,
                    "stock_disponible": st_disp,
                    "fecha_ultimo_mantenimiento": hoy - timedelta(days=dias_m),
                    "imagen_url": f"https://picsum.photos/seed/{cod.lower()}/640/450",
                    "descripcion": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor.",
                },
            )
            equipos.append(eq)

        if Prestamo.objects.count() == 0:
            docentes = [users["docente_1"], users["docente_2"], users["docente_3"]]
            asistente = users["asistente_1"]
            prestamos_seed = [
                (docentes[0], equipos[0], 1, -10, -4, "vencido", None),
                (docentes[0], equipos[2], 2, -2, 3, "activo", None),
                (docentes[1], equipos[1], 1, -3, 2, "activo", None),
                (docentes[2], equipos[3], 1, -8, -2, "vencido", None),
                (docentes[2], equipos[6], 2, -1, 5, "activo", None),
                (docentes[0], equipos[7], 1, -25, -20, "devuelto", -20),
                (docentes[1], equipos[9], 1, -22, -18, "devuelto", -18),
                (docentes[2], equipos[0], 1, -20, -16, "devuelto", -15),
                (docentes[1], equipos[2], 3, -18, -14, "devuelto", -14),
                (docentes[0], equipos[3], 1, -16, -12, "devuelto", -12),
                (docentes[2], equipos[5], 1, -15, -11, "devuelto", -11),
                (docentes[1], equipos[6], 1, -14, -10, "devuelto", -10),
                (docentes[0], equipos[9], 1, -12, -8, "devuelto", -8),
                (docentes[2], equipos[7], 2, -11, -7, "devuelto", -7),
                (docentes[1], equipos[5], 1, -9, -5, "devuelto", -5),
            ]
            for doc, eq, cant, d_ini, d_fin, est, d_ret in prestamos_seed:
                Prestamo.objects.create(
                    docente=doc,
                    equipo=eq,
                    registrado_por=asistente,
                    cantidad=cant,
                    fecha_prestamo=hoy + timedelta(days=d_ini),
                    fecha_devolucion=hoy + timedelta(days=d_fin),
                    fecha_retorno_real=(hoy + timedelta(days=d_ret)) if d_ret is not None else None,
                    estado=est,
                    estado_retorno="operativo" if est == "devuelto" else "",
                    observaciones="Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
                )

        if LogAuditoria.objects.count() == 0:
            LogAuditoria.objects.create(
                usuario=users["admin_fis"],
                username_snapshot="admin_fis",
                ip="127.0.0.1",
                accion="Carga inicial de datos",
                detalle="10 equipos, 6 usuarios y 15 prestamos creados",
            )

        self.stdout.write(self.style.SUCCESS("Seed Caso 1 completado correctamente."))