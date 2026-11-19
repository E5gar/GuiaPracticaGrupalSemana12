from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.db import transaction
from django.db.models import ProtectedError, Q
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.http import require_POST
from .decorators import rol_requerido
from .forms import DevolucionForm, EquipoForm, LoginInstitucionalForm, PrestamoSolicitudForm
from .middleware import registrar_auditoria
from .models import Equipo, Laboratorio, LogAuditoria, Prestamo, Usuario


def catalogo_view(request):
    equipos = Equipo.objects.select_related("laboratorio").order_by("codigo_patrimonial")
    laboratorios = Laboratorio.objects.order_by("codigo")

    q = request.GET.get("q", "").strip()
    lab_id = request.GET.get("laboratorio", "").strip()
    estado = request.GET.get("estado", "").strip()

    if q:
        equipos = equipos.filter(
            Q(codigo_patrimonial__icontains=q)
            | Q(nombre__icontains=q)
            | Q(categoria__icontains=q)
        )
    if lab_id:
        equipos = equipos.filter(laboratorio_id=lab_id)
    if estado:
        equipos = equipos.filter(estado=estado)

    equipo_form = EquipoForm()
    if request.method == "POST":
        if not request.user.is_authenticated or not (request.user.is_superuser or request.user.rol == "admin"):
            registrar_auditoria(request, "Intento no autorizado de crear equipo", request.path, es_alerta=True)
            messages.error(request, "Solo el Administrador puede registrar nuevos equipos.")
            return redirect("prestamos:catalogo")

        equipo_form = EquipoForm(request.POST)
        if equipo_form.is_valid():
            nuevo = equipo_form.save()
            registrar_auditoria(request, "Registro de equipo", nuevo.codigo_patrimonial)
            messages.success(request, f"Equipo {nuevo.codigo_patrimonial} registrado correctamente.")
            return redirect("prestamos:catalogo")

    context = {
        "equipos": equipos,
        "laboratorios": laboratorios,
        "q": q,
        "lab_id": lab_id,
        "estado_filtro": estado,
        "equipo_form": equipo_form,
    }
    return render(request, "prestamos/catalogo.html", context)


def login_view(request):
    if request.user.is_authenticated:
        return redirect("prestamos:catalogo")

    form = LoginInstitucionalForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        credencial = form.cleaned_data["username"]
        password = form.cleaned_data["password"]

        username_real = credencial
        if "@" in credencial:
            usuario_obj = Usuario.objects.filter(email__iexact=credencial).first()
            if usuario_obj:
                username_real = usuario_obj.username

        user = authenticate(request, username=username_real, password=password)
        if user is not None:
            login(request, user)
            request.session["verificar_vencidos_login"] = True
            registrar_auditoria(request, "Inicio de sesion", f"Rol: {user.rol}")
            messages.success(request, f"Bienvenido {user.get_full_name() or user.username}.")
            return redirect("prestamos:catalogo")

        registrar_auditoria(request, "Intento fallido de login", credencial, es_alerta=True)
        messages.error(request, "Credenciales institucionales incorrectas.")

    return render(request, "prestamos/login.html", {"form": form})


@login_required
def logout_view(request):
    registrar_auditoria(request, "Cierre de sesion", request.user.username)
    logout(request)
    messages.info(request, "Sesion cerrada correctamente.")
    return redirect("prestamos:catalogo")


@login_required
@rol_requerido("docente", "asistente", "admin")
def solicitar_prestamo_view(request):
    form = PrestamoSolicitudForm(request.POST or None, user=request.user)
    if request.method == "POST" and form.is_valid():
        with transaction.atomic():
            prestamo = form.save(commit=False)
            equipo = Equipo.objects.select_for_update().get(pk=prestamo.equipo_id)
            if prestamo.cantidad > equipo.stock_disponible:
                messages.error(request, "El stock disponible cambio antes de confirmar.")
                return render(request, "prestamos/prestamo_form.html", {"form": form})
            equipo.stock_disponible -= prestamo.cantidad
            equipo.save()
            prestamo.registrado_por = request.user
            prestamo.save()
        registrar_auditoria(
            request,
            "Solicitud de prestamo",
            f"Prestamo #{prestamo.id} | {equipo.codigo_patrimonial} x{prestamo.cantidad}",
        )
        messages.success(request, f"Prestamo #{prestamo.id} registrado correctamente.")
        return redirect("prestamos:mis_prestamos")

    return render(request, "prestamos/prestamo_form.html", {"form": form})


@login_required
@rol_requerido("asistente")
def registrar_devolucion_view(request):
    form = DevolucionForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        with transaction.atomic():
            prestamo = Prestamo.objects.select_for_update().select_related("equipo").get(
                pk=form.cleaned_data["prestamo"].pk
            )
            estado_retorno = form.cleaned_data["estado_retorno"]
            obs = form.cleaned_data["observaciones"]

            prestamo.estado = "devuelto"
            prestamo.fecha_retorno_real = timezone.localdate()
            prestamo.estado_retorno = estado_retorno
            if obs:
                prestamo.observaciones = obs
            prestamo.save()

            equipo = Equipo.objects.select_for_update().get(pk=prestamo.equipo_id)
            equipo.stock_disponible += prestamo.cantidad
            equipo.estado = estado_retorno
            if estado_retorno == "mantenimiento":
                equipo.fecha_ultimo_mantenimiento = timezone.localdate()
            equipo.save()

        registrar_auditoria(
            request,
            "Registro de devolucion",
            f"Prestamo #{prestamo.id} | Estado retorno: {estado_retorno}",
        )
        messages.success(request, f"Devolucion del prestamo #{prestamo.id} registrada.")
        return redirect("prestamos:mis_prestamos")

    return render(request, "prestamos/devolucion_form.html", {"form": form})


@login_required
def mis_prestamos_view(request):
    prestamos = Prestamo.objects.select_related("docente", "equipo", "equipo__laboratorio").order_by("-fecha_prestamo", "-id")
    if request.user.rol == "docente":
        prestamos = prestamos.filter(docente=request.user)
    elif request.user.rol == "invitado" and not request.user.is_superuser:
        prestamos = Prestamo.objects.none()

    estado = request.GET.get("estado", "").strip()
    if estado:
        prestamos = prestamos.filter(estado=estado)

    return render(request, "prestamos/mis_prestamos.html", {"prestamos": prestamos, "estado_filtro": estado})


@login_required
@rol_requerido("admin")
def auditoria_view(request):
    logs = LogAuditoria.objects.select_related("usuario").all()[:100]
    return render(request, "prestamos/auditoria.html", {"logs": logs})


@login_required
@rol_requerido("admin")
@require_POST
def equipo_eliminar_view(request, pk):
    equipo = get_object_or_404(Equipo, pk=pk)
    codigo = equipo.codigo_patrimonial
    try:
        equipo.delete()
        registrar_auditoria(request, "Eliminacion de equipo", codigo)
        messages.warning(request, f"Equipo {codigo} eliminado del inventario.")
    except ProtectedError:
        messages.error(request, f"No se puede eliminar {codigo} porque tiene prestamos asociados.")
    return redirect("prestamos:catalogo")