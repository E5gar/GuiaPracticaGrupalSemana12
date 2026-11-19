import logging
from django.contrib import messages
from django.utils import timezone
from .decorators import obtener_ip
from .models import LogAuditoria, Prestamo

logger = logging.getLogger("prestamos.auditoria")


class AuditoriaYAlertasMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.user.is_authenticated and request.session.pop("verificar_vencidos_login", False):
            hoy = timezone.localdate()
            Prestamo.objects.filter(estado="activo", fecha_devolucion__lt=hoy).update(estado="vencido")

            if request.user.rol == "docente":
                vencidos = Prestamo.objects.filter(docente=request.user, estado="vencido").count()
            elif request.user.rol in ("admin", "asistente") or request.user.is_superuser:
                vencidos = Prestamo.objects.filter(estado="vencido").count()
            else:
                vencidos = 0

            if vencidos > 0:
                messages.warning(
                    request,
                    f"Alerta de middleware: existen {vencidos} prestamo(s) vencido(s) pendiente(s) de devolucion.",
                )
                logger.warning(
                    "Alerta de prestamos vencidos al iniciar sesion | usuario=%s | vencidos=%s",
                    request.user.username,
                    vencidos,
                )

        response = self.get_response(request)

        if response.status_code == 403:
            username = request.user.username if request.user.is_authenticated else "anonimo"
            ip = obtener_ip(request)
            logger.warning("Respuesta 403 interceptada | usuario=%s | ip=%s | ruta=%s", username, ip, request.path)
        elif request.method == "POST" and any(
            ruta in request.path for ruta in ("/solicitar/", "/devolver/", "/eliminar/", "/login/", "/logout/")
        ):
            username = request.user.username if request.user.is_authenticated else "anonimo"
            ip = obtener_ip(request)
            logger.info("Accion critica POST | usuario=%s | ip=%s | ruta=%s | status=%s", username, ip, request.path, response.status_code)

        return response


def registrar_auditoria(request, accion, detalle="", es_alerta=False):
    usuario = request.user if request.user.is_authenticated else None
    username = usuario.username if usuario else "anonimo"
    ip = obtener_ip(request)
    LogAuditoria.objects.create(
        usuario=usuario,
        username_snapshot=username,
        ip=ip,
        accion=accion,
        detalle=detalle,
        es_intento_no_autorizado=es_alerta,
    )
    logger.info("Auditoria | usuario=%s | ip=%s | accion=%s | detalle=%s", username, ip, accion, detalle)