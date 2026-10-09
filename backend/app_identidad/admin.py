from django.contrib import admin

from .models import Rol, Usuario


@admin.register(Rol)
class RolAdmin(admin.ModelAdmin):
    list_display = ("id_rol", "nombre", "descripcion")
    search_fields = ("nombre",)


@admin.register(Usuario)
class UsuarioAdmin(admin.ModelAdmin):
    list_display = ("id_usuario", "nombre", "correo", "id_establecimiento", "id_rol", "estado")
    search_fields = ("nombre", "correo")
    list_filter = ("estado", "id_rol")
