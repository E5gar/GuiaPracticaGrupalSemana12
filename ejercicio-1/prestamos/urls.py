from django.urls import path
from . import views

app_name = "prestamos"

urlpatterns = [
    path("", views.catalogo_view, name="catalogo"),
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("prestamos/solicitar/", views.solicitar_prestamo_view, name="solicitar_prestamo"),
    path("prestamos/devolver/", views.registrar_devolucion_view, name="registrar_devolucion"),
    path("prestamos/listado/", views.mis_prestamos_view, name="mis_prestamos"),
    path("auditoria/", views.auditoria_view, name="auditoria"),
    path("equipos/<int:pk>/eliminar/", views.equipo_eliminar_view, name="equipo_eliminar"),
]