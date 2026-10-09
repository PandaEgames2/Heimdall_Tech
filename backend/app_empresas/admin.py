from django.contrib import admin

from .models import Establecimiento, Plan


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ("id_plan", "nombre", "precio", "limite_usuarios", "permite_ia", "estado")
    search_fields = ("nombre",)
    list_filter = ("estado", "permite_ia")


@admin.register(Establecimiento)
class EstablecimientoAdmin(admin.ModelAdmin):
    list_display = ("id_establecimiento", "nombre", "id_plan", "estado", "fecha_registro")
    search_fields = ("nombre", "direccion")
    list_filter = ("estado", "id_plan")
