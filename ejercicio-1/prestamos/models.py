from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class Usuario(AbstractUser):
    ROL_CHOICES = [
        ("admin", "Administrador"),
        ("docente", "Docente"),
        ("asistente", "Asistente"),
        ("invitado", "Invitado"),
    ]
    rol = models.CharField(max_length=20, choices=ROL_CHOICES, default="invitado")
    codigo_uncp = models.CharField(max_length=20, blank=True)

    def __str__(self):
        nombre = self.get_full_name() or self.username
        return f"{nombre} ({self.get_rol_display()})"


class Laboratorio(models.Model):
    codigo = models.CharField(max_length=20, unique=True)
    nombre = models.CharField(max_length=100, unique=True)
    ubicacion = models.CharField(max_length=120, blank=True)

    def __str__(self):
        return f"{self.codigo} - {self.nombre}"


class Equipo(models.Model):
    ESTADO_CHOICES = [
        ("operativo", "Operativo"),
        ("mantenimiento", "En mantenimiento"),
        ("baja", "Dado de baja"),
    ]
    CATEGORIA_CHOICES = [
        ("Laptop", "Laptop"),
        ("Proyector", "Proyector"),
        ("Camara", "Camara"),
        ("Arduino", "Kit Arduino"),
        ("Router", "Router"),
        ("Switch", "Switch"),
    ]

    codigo_patrimonial = models.CharField(max_length=30, unique=True)
    nombre = models.CharField(max_length=120)
    marca = models.CharField(max_length=80)
    modelo = models.CharField(max_length=80)
    categoria = models.CharField(max_length=40, choices=CATEGORIA_CHOICES)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default="operativo")
    laboratorio = models.ForeignKey(Laboratorio, on_delete=models.PROTECT, related_name="equipos")
    stock_total = models.PositiveIntegerField(default=1)
    stock_disponible = models.PositiveIntegerField(default=1)
    fecha_ultimo_mantenimiento = models.DateField(default=timezone.localdate)
    imagen_url = models.URLField(blank=True)
    descripcion = models.TextField(default="Lorem ipsum dolor sit amet, consectetur adipiscing elit.")

    @property
    def dias_desde_mantenimiento(self):
        return max((timezone.localdate() - self.fecha_ultimo_mantenimiento).days, 0)

    def __str__(self):
        return f"{self.codigo_patrimonial} - {self.nombre}"


class Prestamo(models.Model):
    ESTADO_CHOICES = [
        ("activo", "Activo"),
        ("devuelto", "Devuelto"),
        ("vencido", "Vencido"),
    ]

    docente = models.ForeignKey(Usuario, on_delete=models.PROTECT, related_name="prestamos")
    equipo = models.ForeignKey(Equipo, on_delete=models.PROTECT, related_name="prestamos")
    registrado_por = models.ForeignKey(
        Usuario,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="prestamos_registrados",
    )
    cantidad = models.PositiveIntegerField(default=1)
    fecha_prestamo = models.DateField(default=timezone.localdate)
    fecha_devolucion = models.DateField()
    fecha_retorno_real = models.DateField(null=True, blank=True)
    estado = models.CharField(max_length=20, choices=ESTADO_CHOICES, default="activo")
    estado_retorno = models.CharField(max_length=20, choices=Equipo.ESTADO_CHOICES, blank=True)
    observaciones = models.TextField(blank=True)
    recordatorio_enviado = models.BooleanField(default=False)
    creado_en = models.DateTimeField(auto_now_add=True)

    @property
    def dias_retraso(self):
        if self.estado == "devuelto":
            if self.fecha_retorno_real and self.fecha_retorno_real > self.fecha_devolucion:
                return (self.fecha_retorno_real - self.fecha_devolucion).days
            return 0
        return max((timezone.localdate() - self.fecha_devolucion).days, 0)

    def __str__(self):
        return f"Prestamo #{self.id} - {self.docente.username} - {self.equipo.codigo_patrimonial}"


class LogAuditoria(models.Model):
    usuario = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True)
    username_snapshot = models.CharField(max_length=150, default="anonimo")
    fecha_hora = models.DateTimeField(auto_now_add=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    accion = models.CharField(max_length=120)
    detalle = models.TextField(blank=True)
    es_intento_no_autorizado = models.BooleanField(default=False)

    class Meta:
        ordering = ["-fecha_hora"]

    def __str__(self):
        return f"{self.fecha_hora} | {self.username_snapshot} | {self.accion}"