from rest_framework import viewsets

from config.mixins import EstablecimientoQueryParamMixin

from .models import Rol, Usuario
from .serializers import RolSerializer, UsuarioSerializer


class RolViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Rol.objects.all().order_by("nombre")
    serializer_class = RolSerializer
    lookup_field = "id_rol"
    search_fields = ("nombre", "descripcion")
    ordering_fields = ("nombre",)


class UsuarioViewSet(EstablecimientoQueryParamMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = UsuarioSerializer
    lookup_field = "id_usuario"
    search_fields = ("nombre", "correo")
    ordering_fields = ("nombre", "fecha_creacion")

    def get_base_queryset(self):
        return Usuario.objects.filter(estado=True).select_related("id_rol", "id_establecimiento")
