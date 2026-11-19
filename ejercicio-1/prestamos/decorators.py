import logging
from functools import wraps
from django.contrib.auth.views import redirect_to_login
from django.http import HttpResponseForbidden
from .models import LogAuditoria

logger = logging.getLogger("prestamos.auditoria")


def obtener_ip(request):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def rol_requerido(*roles):
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return redirect_to_login(request.get_full_path())

            if request.user.is_superuser or getattr(request.user, "rol", None) in roles:
                return view_func(request, *args, **kwargs)

            ip = obtener_ip(request)
            LogAuditoria.objects.create(
                usuario=request.user,
                username_snapshot=request.user.username,
                ip=ip,
                accion="Intento de acceso no autorizado",
                detalle=f"Ruta bloqueada: {request.path} | Rol actual: {request.user.rol}",
                es_intento_no_autorizado=True,
            )
            logger.warning(
                "Acceso no autorizado | usuario=%s | rol=%s | ip=%s | ruta=%s",
                request.user.username,
                request.user.rol,
                ip,
                request.path,
            )
            return HttpResponseForbidden("Acceso denegado: no cuenta con permisos para esta operacion.")

        return _wrapped_view

    return decorator