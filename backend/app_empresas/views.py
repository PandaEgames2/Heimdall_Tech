from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from config.tenant_utils import get_usuario_perfil, is_platform_superadmin, user_establecimiento_id

from .models import Establecimiento, Plan
from .serializers import EstablecimientoSerializer, PlanSerializer


class PlanViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Plan.objects.filter(estado=True).order_by("precio")
    serializer_class = PlanSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = "id_plan"
    search_fields = ("nombre", "descripcion")
    ordering_fields = ("precio", "nombre", "limite_usuarios")

    def get_queryset(self):
        queryset = super().get_queryset()
        if is_platform_superadmin(self.request.user):
            return queryset
        profile = get_usuario_perfil(self.request.user)
        if not profile or not profile.id_establecimiento_id:
            return queryset.none()
        plan_id = profile.id_establecimiento.id_plan_id
        return queryset.filter(id_plan=plan_id)


class EstablecimientoViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Establecimiento.objects.filter(estado=True).select_related("id_plan")
    serializer_class = EstablecimientoSerializer
    lookup_field = "id_establecimiento"
    search_fields = ("nombre", "direccion", "telefono")
    ordering_fields = ("nombre", "fecha_registro")

    def get_queryset(self):
        queryset = super().get_queryset()
        if is_platform_superadmin(self.request.user):
            return queryset
        establecimiento_id = user_establecimiento_id(self.request.user)
        if establecimiento_id is None:
            return queryset.none()
        return queryset.filter(id_establecimiento=establecimiento_id)
