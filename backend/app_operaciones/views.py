from rest_framework import viewsets

from .mixins import EstablecimientoQueryParamMixin
from .models import Incidencia, Movimiento, Responsable, Vehiculo
from .serializers import (
    IncidenciaDetalleSerializer,
    IncidenciaSerializer,
    MovimientoDetalleSerializer,
    MovimientoSerializer,
    ResponsableSerializer,
    VehiculoSerializer,
)


class ResponsableViewSet(EstablecimientoQueryParamMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = ResponsableSerializer
    lookup_field = "id_responsable"
    search_fields = ("nombre", "documento_identidad", "correo")
    ordering_fields = ("nombre", "documento_identidad")

    def get_base_queryset(self):
        return Responsable.objects.all().order_by("nombre")


class VehiculoViewSet(EstablecimientoQueryParamMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = VehiculoSerializer
    lookup_field = "id_vehiculo"
    search_fields = ("placa", "marca", "modelo", "color")
    ordering_fields = ("placa", "fecha_registro", "tipo_autorizacion")

    def get_base_queryset(self):
        return Vehiculo.objects.select_related("id_responsable").order_by("placa")


class MovimientoViewSet(EstablecimientoQueryParamMixin, viewsets.ReadOnlyModelViewSet):
    lookup_field = "id_movimiento"
    search_fields = ("placa_leida", "id_dispositivo", "observacion")
    ordering_fields = ("fecha_evento", "tipo_movimiento", "estado_sincronizacion")

    def get_serializer_class(self):
        if self.action == "retrieve":
            return MovimientoDetalleSerializer
        return MovimientoSerializer

    def get_base_queryset(self):
        return Movimiento.objects.select_related(
            "id_vehiculo", "id_usuario", "id_usuario__id_rol"
        ).order_by("-fecha_evento")


class IncidenciaViewSet(EstablecimientoQueryParamMixin, viewsets.ReadOnlyModelViewSet):
    lookup_field = "id_incidencia"
    search_fields = ("titulo", "descripcion", "nivel_prioridad")
    ordering_fields = ("fecha_incidencia", "nivel_prioridad")

    def get_serializer_class(self):
        if self.action == "retrieve":
            return IncidenciaDetalleSerializer
        return IncidenciaSerializer

    def get_base_queryset(self):
        return Incidencia.objects.select_related(
            "id_vehiculo", "id_usuario", "id_usuario__id_rol"
        ).order_by("-fecha_incidencia")
