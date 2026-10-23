from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from config.mixins import EstablecimientoQueryParamMixin

from .models import Rol, Usuario
from .serializers import RolSerializer, UsuarioSerializer


class PerfilUsuarioView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        perfil = None

        try:
            perfil = Usuario.objects.select_related("id_rol", "id_establecimiento").filter(
                correo=user.email.lower()
            ).first()
        except Exception:
            perfil = None

        payload = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "is_staff": user.is_staff,
            "is_superuser": user.is_superuser,
        }

        if perfil:
            payload["id_establecimiento"] = perfil.id_establecimiento_id
            payload["rol"] = perfil.id_rol.nombre if perfil.id_rol else "Sin rol"
            payload["rol_id"] = perfil.id_rol_id if perfil.id_rol else None

        return Response(payload, status=status.HTTP_200_OK)


class RolViewSet(EstablecimientoQueryParamMixin, viewsets.ModelViewSet):
    queryset = Rol.objects.all().order_by("nombre")
    serializer_class = RolSerializer
    lookup_field = "id_rol"
    search_fields = ("nombre", "descripcion")
    ordering_fields = ("nombre",)

    def get_base_queryset(self):
        return Rol.objects.all().order_by("nombre")


class UsuarioViewSet(EstablecimientoQueryParamMixin, viewsets.ModelViewSet):
    serializer_class = UsuarioSerializer
    lookup_field = "id_usuario"
    search_fields = ("nombre", "correo")
    ordering_fields = ("nombre", "fecha_creacion")

    def get_base_queryset(self):
        return Usuario.objects.filter(estado=True).select_related("id_rol", "id_establecimiento")

    def create(self, request, *args, **kwargs):
        payload = request.data.copy()
        if "id_establecimiento" not in payload and request.user.is_authenticated:
            perfil = Usuario.objects.filter(correo__iexact=request.user.email.lower()).first()
            if perfil:
                payload["id_establecimiento"] = perfil.id_establecimiento_id
        return super().create(request, *args, **kwargs)
