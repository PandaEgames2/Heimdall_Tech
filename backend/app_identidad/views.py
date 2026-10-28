from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from config.mixins import EstablecimientoQueryParamMixin
from config.tenant_utils import SUPER_ADMIN_ROL_ID, get_usuario_perfil, is_platform_superadmin
from config.permissions import IsPlatformSuperAdminOrRoleReader, IsTenantAdmin
from app_empresas.features import features_for_establecimiento

from .models import Rol, Usuario
from .serializers import RolSerializer, UsuarioSerializer


class PerfilUsuarioView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        perfil = None

        try:
            perfil = Usuario.objects.select_related("id_rol", "id_establecimiento", "id_establecimiento__id_plan").filter(
                correo__iexact=user.email, estado=True
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
            establecimiento = perfil.id_establecimiento
            payload["nombre"] = perfil.nombre
            payload["id_usuario"] = perfil.id_usuario
            payload["id_establecimiento"] = perfil.id_establecimiento_id
            payload["rol"] = perfil.id_rol.nombre if perfil.id_rol else "Sin rol"
            payload["rol_id"] = perfil.id_rol_id if perfil.id_rol else None
            payload["permisos_excepciones"] = perfil.permisos_excepciones or {}
            payload["is_platform_superadmin"] = perfil.id_rol_id == SUPER_ADMIN_ROL_ID
            payload["establecimiento"] = establecimiento.nombre
            payload["plan"] = {
                "id": establecimiento.id_plan_id,
                "nombre": establecimiento.id_plan.nombre,
            }
            payload["funcionalidades"] = features_for_establecimiento(establecimiento)

        return Response(payload, status=status.HTTP_200_OK)


class RolViewSet(EstablecimientoQueryParamMixin, viewsets.ModelViewSet):
    queryset = Rol.objects.all().order_by("nombre")
    serializer_class = RolSerializer
    lookup_field = "id_rol"
    search_fields = ("nombre", "descripcion")
    ordering_fields = ("nombre",)
    permission_classes = [IsPlatformSuperAdminOrRoleReader]

    def get_base_queryset(self):
        return Rol.objects.all().order_by("nombre")


class UsuarioViewSet(EstablecimientoQueryParamMixin, viewsets.ModelViewSet):
    serializer_class = UsuarioSerializer
    lookup_field = "id_usuario"
    search_fields = ("nombre", "correo")
    ordering_fields = ("nombre", "fecha_creacion")
    permission_classes = [IsTenantAdmin]

    def get_base_queryset(self):
        queryset = Usuario.objects.select_related("id_rol", "id_establecimiento")
        # Los administradores de establecimiento nunca deben ver cuentas de
        # Super Admin, incluso cuando esas cuentas comparten establecimiento.
        if not is_platform_superadmin(self.request.user):
            queryset = queryset.exclude(id_rol_id=SUPER_ADMIN_ROL_ID)
        return queryset

    def get_queryset(self):
        if is_platform_superadmin(self.request.user):
            # La vista global de usuarios del Super Admin abarca todos los
            # establecimientos; los administradores siguen pasando por el
            # aislamiento estricto del mixin.
            return self.get_base_queryset()
        return super().get_queryset()

    def create(self, request, *args, **kwargs):
        payload = request.data.copy()
        if "id_establecimiento" not in payload and request.user.is_authenticated:
            perfil = get_usuario_perfil(request.user)
            if perfil:
                payload["id_establecimiento"] = perfil.id_establecimiento_id
        if not is_platform_superadmin(request.user):
            rol_id = payload.get("id_rol")
            if int(rol_id or 0) == SUPER_ADMIN_ROL_ID:
                return Response(
                    {"id_rol": "Solo un Super Admin puede asignar ese rol."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        serializer = self.get_serializer(data=payload)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
