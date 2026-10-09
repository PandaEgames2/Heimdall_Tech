from rest_framework import viewsets

from config.mixins import EstablecimientoQueryParamMixin

from .models import ReconocimientoPlaca
from .serializers import ReconocimientoPlacaDetalleSerializer, ReconocimientoPlacaSerializer


class ReconocimientoPlacaViewSet(EstablecimientoQueryParamMixin, viewsets.ReadOnlyModelViewSet):
    lookup_field = "id_reconocimiento"
    search_fields = ("placa_detectada", "id_dispositivo", "resultado_ia")
    ordering_fields = ("fecha_procesamiento", "nivel_confianza", "resultado_ia")

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ReconocimientoPlacaDetalleSerializer
        return ReconocimientoPlacaSerializer

    def get_base_queryset(self):
        return ReconocimientoPlaca.objects.select_related(
            "id_movimiento",
            "id_movimiento__id_vehiculo",
            "id_usuario",
            "id_usuario__id_rol",
        ).order_by("-fecha_procesamiento")
