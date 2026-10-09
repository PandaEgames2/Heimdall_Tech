from django.contrib import admin

from .models import ReconocimientoPlaca


@admin.register(ReconocimientoPlaca)
class ReconocimientoPlacaAdmin(admin.ModelAdmin):
    list_display = (
        "id_reconocimiento",
        "placa_detectada",
        "resultado_ia",
        "nivel_confianza",
        "fecha_procesamiento",
    )
    search_fields = ("placa_detectada", "id_dispositivo")
    list_filter = ("resultado_ia",)
