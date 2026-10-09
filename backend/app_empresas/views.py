from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from .models import Establecimiento, Plan
from .serializers import EstablecimientoSerializer, PlanSerializer


class PlanViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Plan.objects.filter(estado=True).order_by("precio")
    serializer_class = PlanSerializer
    permission_classes = [AllowAny]
    lookup_field = "id_plan"
    search_fields = ("nombre", "descripcion")
    ordering_fields = ("precio", "nombre", "limite_usuarios")


class EstablecimientoViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Establecimiento.objects.filter(estado=True).select_related("id_plan")
    serializer_class = EstablecimientoSerializer
    lookup_field = "id_establecimiento"
    search_fields = ("nombre", "direccion", "telefono")
    ordering_fields = ("nombre", "fecha_registro")
