import re
from django import forms
from django.core.exceptions import ValidationError
from django.utils.html import strip_tags
from .models import Equipo, Prestamo, Usuario


def sanitizar_texto(valor):
    sin_scripts = re.sub(r"<script[\s\S]*?>[\s\S]*?</script>", "", valor or "", flags=re.IGNORECASE)
    return strip_tags(sin_scripts).strip()


class LoginInstitucionalForm(forms.Form):
    username = forms.CharField(
        label="Usuario o correo institucional",
        max_length=150,
        widget=forms.TextInput(attrs={"class": "field-input", "placeholder": "usuario@uncp.edu.pe"}),
    )
    password = forms.CharField(
        label="Contrasena",
        widget=forms.PasswordInput(attrs={"class": "field-input", "placeholder": "Ingrese contrasena"}),
    )

    def clean_username(self):
        username = sanitizar_texto(self.cleaned_data.get("username", ""))
        if not username:
            raise ValidationError("Ingrese su usuario o correo institucional.")
        return username


class EquipoForm(forms.ModelForm):
    class Meta:
        model = Equipo
        fields = [
            "codigo_patrimonial",
            "nombre",
            "marca",
            "modelo",
            "categoria",
            "estado",
            "laboratorio",
            "stock_total",
            "stock_disponible",
            "fecha_ultimo_mantenimiento",
            "imagen_url",
            "descripcion",
        ]
        widgets = {
            "codigo_patrimonial": forms.TextInput(attrs={"class": "field-input"}),
            "nombre": forms.TextInput(attrs={"class": "field-input"}),
            "marca": forms.TextInput(attrs={"class": "field-input"}),
            "modelo": forms.TextInput(attrs={"class": "field-input"}),
            "categoria": forms.Select(attrs={"class": "field-select"}),
            "estado": forms.Select(attrs={"class": "field-select"}),
            "laboratorio": forms.Select(attrs={"class": "field-select"}),
            "stock_total": forms.NumberInput(attrs={"class": "field-input", "min": 1}),
            "stock_disponible": forms.NumberInput(attrs={"class": "field-input", "min": 0}),
            "fecha_ultimo_mantenimiento": forms.DateInput(attrs={"class": "field-input", "type": "date"}),
            "imagen_url": forms.URLInput(attrs={"class": "field-input"}),
            "descripcion": forms.Textarea(attrs={"class": "field-textarea", "rows": 3}),
        }

    def clean_codigo_patrimonial(self):
        return sanitizar_texto(self.cleaned_data["codigo_patrimonial"]).upper()

    def clean_descripcion(self):
        return sanitizar_texto(self.cleaned_data.get("descripcion", ""))

    def clean(self):
        cleaned = super().clean()
        total = cleaned.get("stock_total")
        disponible = cleaned.get("stock_disponible")
        if total is not None and disponible is not None and disponible > total:
            raise ValidationError("El stock disponible no puede superar al stock total.")
        return cleaned


class PrestamoSolicitudForm(forms.ModelForm):
    class Meta:
        model = Prestamo
        fields = [
            "docente",
            "equipo",
            "cantidad",
            "fecha_prestamo",
            "fecha_devolucion",
            "observaciones",
        ]
        widgets = {
            "docente": forms.Select(attrs={"class": "field-select"}),
            "equipo": forms.Select(attrs={"class": "field-select"}),
            "cantidad": forms.NumberInput(attrs={"class": "field-input", "min": 1}),
            "fecha_prestamo": forms.DateInput(attrs={"class": "field-input", "type": "date"}),
            "fecha_devolucion": forms.DateInput(attrs={"class": "field-input", "type": "date"}),
            "observaciones": forms.Textarea(attrs={"class": "field-textarea", "rows": 3}),
        }

    def __init__(self, *args, user=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["docente"].queryset = Usuario.objects.filter(rol="docente")
        self.fields["equipo"].queryset = Equipo.objects.select_related("laboratorio").all()
        if user and getattr(user, "rol", None) == "docente":
            self.fields["docente"].queryset = Usuario.objects.filter(pk=user.pk)
            self.fields["docente"].initial = user

    def clean_observaciones(self):
        return sanitizar_texto(self.cleaned_data.get("observaciones", ""))

    def clean(self):
        cleaned = super().clean()
        docente = cleaned.get("docente")
        equipo = cleaned.get("equipo")
        cantidad = cleaned.get("cantidad")
        fecha_prestamo = cleaned.get("fecha_prestamo")
        fecha_devolucion = cleaned.get("fecha_devolucion")

        if docente:
            activos = Prestamo.objects.filter(
                docente=docente,
                estado__in=["activo", "vencido"],
            ).count()
            if activos >= 3:
                raise ValidationError("El docente no puede tener mas de 3 prestamos activos simultaneamente.")

        if fecha_prestamo and fecha_devolucion and fecha_devolucion <= fecha_prestamo:
            raise ValidationError("La fecha de devolucion debe ser posterior a la fecha de prestamo.")

        if equipo:
            if equipo.estado != "operativo":
                raise ValidationError(f"El equipo {equipo.codigo_patrimonial} debe estar en estado operativo.")
            if cantidad is not None:
                if cantidad < 1:
                    raise ValidationError("La cantidad solicitada debe ser al menos 1.")
                if cantidad > equipo.stock_disponible:
                    raise ValidationError(
                        f"Stock insuficiente: solicito {cantidad} y hay {equipo.stock_disponible} disponible(s)."
                    )

        return cleaned


class DevolucionForm(forms.Form):
    prestamo = forms.ModelChoiceField(
        label="Prestamo activo o vencido",
        queryset=Prestamo.objects.none(),
        widget=forms.Select(attrs={"class": "field-select"}),
    )
    estado_retorno = forms.ChoiceField(
        label="Estado del equipo al retornar",
        choices=Equipo.ESTADO_CHOICES,
        widget=forms.Select(attrs={"class": "field-select"}),
    )
    observaciones = forms.CharField(
        label="Observaciones de devolucion",
        required=False,
        widget=forms.Textarea(attrs={"class": "field-textarea", "rows": 3}),
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["prestamo"].queryset = Prestamo.objects.filter(
            estado__in=["activo", "vencido"]
        ).select_related("docente", "equipo")

    def clean_observaciones(self):
        return sanitizar_texto(self.cleaned_data.get("observaciones", ""))