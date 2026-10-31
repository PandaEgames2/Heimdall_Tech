from django.contrib import admin

from .models import Establecimiento, Plan


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = (
        "id_plan",
        "nombre",
        "precio",
        "limite_usuarios",
        "cupo_residentes",
        "precio_excedente",
        "politica_excedente",
        "permite_ia",
        "estado",
    )
    search_fields = ("nombre",)
    list_filter = ("estado", "permite_ia", "politica_excedente")


@admin.register(Establecimiento)
class EstablecimientoAdmin(admin.ModelAdmin):
    list_display = (
        "id_establecimiento",
        "nombre",
        "id_plan",
        "tipo_entidad",
        "permite_invitaciones_residente",
        "estado",
        "fecha_registro",
    )
    search_fields = ("nombre", "direccion")
    list_filter = ("estado", "id_plan", "tipo_entidad", "permite_invitaciones_residente")
