from django.contrib import admin

from .models import Incidencia, InvitacionVisitante, Movimiento, Responsable, Vehiculo


@admin.register(Responsable)
class ResponsableAdmin(admin.ModelAdmin):
    list_display = ("id_responsable", "nombre", "documento_identidad", "id_establecimiento")
    search_fields = ("nombre", "documento_identidad")


@admin.register(Vehiculo)
class VehiculoAdmin(admin.ModelAdmin):
    list_display = ("id_vehiculo", "placa", "tipo_autorizacion", "id_establecimiento")
    search_fields = ("placa", "marca", "modelo")
    list_filter = ("tipo_autorizacion",)


@admin.register(Movimiento)
class MovimientoAdmin(admin.ModelAdmin):
    list_display = (
        "id_movimiento",
        "placa_leida",
        "tipo_movimiento",
        "fecha_evento",
        "estado_sincronizacion",
    )
    search_fields = ("placa_leida", "id_dispositivo")
    list_filter = ("tipo_movimiento", "estado_sincronizacion")


@admin.register(Incidencia)
class IncidenciaAdmin(admin.ModelAdmin):
    list_display = ("id_incidencia", "titulo", "nivel_prioridad", "fecha_incidencia")
    search_fields = ("titulo",)
    list_filter = ("nivel_prioridad",)


@admin.register(InvitacionVisitante)
class InvitacionVisitanteAdmin(admin.ModelAdmin):
    list_display = (
        "id_invitacion",
        "nombre_visitante",
        "id_residente",
        "id_establecimiento",
        "estado",
        "vigente_desde",
        "vigente_hasta",
    )
    list_filter = ("estado", "id_establecimiento")
    search_fields = ("nombre_visitante", "documento_visitante", "placa_visitante", "id_residente__correo")
    readonly_fields = ("token_hash", "fecha_creacion", "fecha_ingreso", "fecha_salida")
