from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils import timezone
from django.utils.html import format_html
from .models import Equipo, Laboratorio, LogAuditoria, Prestamo, Usuario


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    list_display = ("username", "email", "first_name", "last_name", "rol", "codigo_uncp", "is_staff")
    list_filter = ("rol", "is_staff", "is_active")
    fieldsets = UserAdmin.fieldsets + (
        ("Datos Institucionales UNCP", {"fields": ("rol", "codigo_uncp")}),
    )


@admin.register(Laboratorio)
class LaboratorioAdmin(admin.ModelAdmin):
    list_display = ("codigo", "nombre", "ubicacion")
    search_fields = ("codigo", "nombre")


@admin.register(Equipo)
class EquipoAdmin(admin.ModelAdmin):
    list_display = (
        "codigo_patrimonial",
        "nombre",
        "categoria",
        "laboratorio",
        "estado_visual",
        "stock_disponible",
        "dias_mantenimiento_col",
    )
    list_filter = ("laboratorio", "estado", "categoria")
    search_fields = ("codigo_patrimonial", "nombre", "categoria")
    list_select_related = ("laboratorio",)
    actions = ["marcar_en_mantenimiento"]

    @admin.display(description="Estado")
    def estado_visual(self, obj):
        colores = {
            "operativo": ("#2a9d5c", "#eef9f3"),
            "mantenimiento": ("#95570a", "#fcf7ee"),
            "baja": ("#6342c4", "#f6f3fd"),
        }
        fg, bg = colores.get(obj.estado, ("#1a1a1a", "#eeeeee"))
        return format_html(
            '<span style="color:{};background:{};padding:3px 10px;border-radius:100px;font-weight:600;">{}</span>',
            fg,
            bg,
            obj.get_estado_display(),
        )

    @admin.display(description="Dias desde mantenimiento")
    def dias_mantenimiento_col(self, obj):
        return f"{obj.dias_desde_mantenimiento} dias"

    @admin.action(description="Marcar como en mantenimiento")
    def marcar_en_mantenimiento(self, request, queryset):
        actualizados = queryset.update(
            estado="mantenimiento",
            fecha_ultimo_mantenimiento=timezone.localdate(),
        )
        self.message_user(request, f"{actualizados} equipo(s) marcados como en mantenimiento.")


@admin.register(Prestamo)
class PrestamoAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "docente",
        "equipo",
        "cantidad",
        "fecha_prestamo",
        "fecha_devolucion",
        "estado",
        "dias_retraso_col",
        "recordatorio_enviado",
    )
    list_filter = ("fecha_prestamo", "fecha_devolucion", "estado", "docente")
    search_fields = (
        "equipo__codigo_patrimonial",
        "equipo__nombre",
        "docente__username",
        "docente__first_name",
        "docente__last_name",
    )
    list_select_related = ("docente", "equipo", "equipo__laboratorio")
    actions = ["enviar_recordatorio_devolucion"]

    @admin.display(description="Dias de retraso")
    def dias_retraso_col(self, obj):
        return f"{obj.dias_retraso} dias"

    @admin.action(description="Enviar recordatorio de devolucion")
    def enviar_recordatorio_devolucion(self, request, queryset):
        actualizados = queryset.filter(estado__in=["activo", "vencido"]).update(recordatorio_enviado=True)
        self.message_user(request, f"Recordatorio de devolucion enviado a {actualizados} prestamo(s).")


@admin.register(LogAuditoria)
class LogAuditoriaAdmin(admin.ModelAdmin):
    list_display = ("fecha_hora", "username_snapshot", "ip", "accion", "es_intento_no_autorizado")
    list_filter = ("es_intento_no_autorizado", "fecha_hora")
    search_fields = ("username_snapshot", "accion", "detalle")
    list_select_related = ("usuario",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False