from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from config.mixins import EstablecimientoQueryParamMixin
from config.permissions import IsPlatformSuperAdmin, IsPlatformSuperAdminOrRoleReader, IsTenantAdmin
from config.rbac import BASE_ROLE_NAMES, sync_role_permissions_cache
from config.tenant_utils import SUPER_ADMIN_ROL_ID, get_usuario_perfil, is_platform_superadmin

from .models import Recurso, Rol, RolHasRecurso, Usuario, UsuarioHasRol
from .profile_service import build_profile_payload
from .serializers import RecursoSerializer, RolSerializer, UsuarioSerializer

User = get_user_model()


def _profile_role_ids(usuario: Usuario) -> set[int]:
    ids = {usuario.id_rol_id} if usuario.id_rol_id else set()
    try:
        ids.update(usuario.roles_asignados.values_list("id_rol_id", flat=True))
    except Exception:
        pass
    return ids


class PerfilUsuarioView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        try:
            perfil = get_usuario_perfil(user)
        except Exception:
            perfil = None
        return Response(build_profile_payload(user, perfil), status=status.HTTP_200_OK)


class RolViewSet(viewsets.ModelViewSet):
    queryset = Rol.objects.all().order_by("id_rol")
    serializer_class = RolSerializer
    lookup_field = "id_rol"
    pagination_class = None
    search_fields = ("nombre", "descripcion")
    ordering_fields = ("nombre", "id_rol")
    permission_classes = [IsPlatformSuperAdminOrRoleReader]

    def get_queryset(self):
        return (
            Rol.objects.all()
            .prefetch_related("recursos_asignados", "usuario_asignaciones")
            .order_by("id_rol")
        )

    def destroy(self, request, *args, **kwargs):
        role = self.get_object()
        if role.nombre in BASE_ROLE_NAMES:
            raise ValidationError({"detail": "Los roles base del sistema no se pueden eliminar."})
        if UsuarioHasRol.objects.filter(id_rol_id=role.id_rol).exists():
            raise ValidationError({"detail": "No se puede eliminar un rol que tiene usuarios asignados."})
        if role.usuarios.exists():
            raise ValidationError({"detail": "No se puede eliminar un rol que tiene usuarios asignados."})
        return super().destroy(request, *args, **kwargs)


class RecursoViewSet(viewsets.ModelViewSet):
    serializer_class = RecursoSerializer
    lookup_field = "id_recurso"
    pagination_class = None
    search_fields = ("clave", "nombre", "descripcion", "grupo")
    ordering_fields = ("orden", "nombre", "clave")
    permission_classes = [IsPlatformSuperAdmin]

    def get_queryset(self):
        return Recurso.objects.all().order_by("orden", "id_recurso")

    def perform_update(self, serializer):
        instance = serializer.instance
        new_state = serializer.validated_data.get("estado", instance.estado)
        if new_state is False and RolHasRecurso.objects.filter(id_recurso_id=instance.id_recurso).exists():
            raise ValidationError(
                {"estado": "No puedes desactivar un recurso que está asignado a uno o más roles."}
            )
        recurso = serializer.save()
        # La clave puede cambiar: recalcula la caché JSON de los roles afectados.
        role_ids = set(
            RolHasRecurso.objects.filter(id_recurso_id=recurso.id_recurso)
            .values_list("id_rol_id", flat=True)
        )
        for role_id in role_ids:
            sync_role_permissions_cache(role_id)

    def destroy(self, request, *args, **kwargs):
        recurso = self.get_object()
        if recurso.es_sistema:
            raise ValidationError({"detail": "Los recursos del sistema no se pueden eliminar."})
        if RolHasRecurso.objects.filter(id_recurso_id=recurso.id_recurso).exists():
            raise ValidationError({"detail": "No se puede eliminar un recurso asignado a un rol."})
        return super().destroy(request, *args, **kwargs)


class UsuarioViewSet(EstablecimientoQueryParamMixin, viewsets.ModelViewSet):
    serializer_class = UsuarioSerializer
    lookup_field = "id_usuario"
    search_fields = ("nombre", "correo")
    ordering_fields = ("nombre", "fecha_creacion")
    ordering = ("-fecha_creacion", "-id_usuario")
    permission_classes = [IsTenantAdmin]

    def get_base_queryset(self):
        queryset = Usuario.objects.select_related(
            "id_rol", "id_establecimiento"
        ).prefetch_related("roles_asignados__id_rol")
        # Los administradores de establecimiento nunca deben ver cuentas de
        # Super Admin, incluso cuando esas cuentas comparten establecimiento.
        if not is_platform_superadmin(self.request.user):
            queryset = queryset.exclude(
                Q(id_rol_id=SUPER_ADMIN_ROL_ID)
                | Q(roles_asignados__id_rol_id=SUPER_ADMIN_ROL_ID)
            ).distinct()
        return queryset

    def _apply_filters(self, queryset):
        role_id = self.request.query_params.get("id_rol")
        if role_id:
            try:
                normalized_role = int(role_id)
            except (TypeError, ValueError):
                raise ValidationError({"id_rol": "Debe ser un entero válido."})
            queryset = queryset.filter(
                Q(id_rol_id=normalized_role)
                | Q(roles_asignados__id_rol_id=normalized_role)
            ).distinct()
        estado = self.request.query_params.get("estado")
        if estado is not None and estado != "":
            normalized = str(estado).strip().lower()
            if normalized in {"true", "1", "activo"}:
                queryset = queryset.filter(estado=True)
            elif normalized in {"false", "0", "inactivo"}:
                queryset = queryset.filter(estado=False)
        establecimiento = self.request.query_params.get("id_establecimiento")
        if establecimiento and is_platform_superadmin(self.request.user):
            try:
                queryset = queryset.filter(id_establecimiento_id=int(establecimiento))
            except (TypeError, ValueError):
                raise ValidationError({"id_establecimiento": "Debe ser un entero válido."})
        return queryset

    def get_queryset(self):
        if is_platform_superadmin(self.request.user):
            # La vista global de usuarios del Super Admin abarca todos los
            # establecimientos; los administradores siguen pasando por el
            # aislamiento estricto del mixin.
            return self._apply_filters(self.get_base_queryset())
        return self._apply_filters(super().get_queryset())

    def create(self, request, *args, **kwargs):
        payload = request.data.copy()
        if is_platform_superadmin(request.user):
            if not payload.get("id_establecimiento"):
                raise ValidationError({"id_establecimiento": "Selecciona el establecimiento del usuario."})
        else:
            perfil = get_usuario_perfil(request.user)
            if perfil is None:
                raise PermissionDenied("Tu cuenta no tiene un establecimiento asignado.")
            payload["id_establecimiento"] = perfil.id_establecimiento_id

        serializer = self.get_serializer(data=payload)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        payload = request.data.copy()
        if not is_platform_superadmin(request.user):
            payload["id_establecimiento"] = instance.id_establecimiento_id
        serializer = self.get_serializer(instance, data=payload, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        usuario = self.get_object()
        perfil_solicitante = get_usuario_perfil(request.user)
        if perfil_solicitante and perfil_solicitante.id_usuario == usuario.id_usuario:
            raise ValidationError("No puedes eliminar tu propia cuenta.")
        if SUPER_ADMIN_ROL_ID in _profile_role_ids(usuario):
            other_active = (
                Usuario.objects.filter(estado=True)
                .filter(
                    Q(id_rol_id=SUPER_ADMIN_ROL_ID)
                    | Q(roles_asignados__id_rol_id=SUPER_ADMIN_ROL_ID)
                )
                .exclude(pk=usuario.pk)
                .distinct()
            )
            if not other_active.exists():
                raise ValidationError(
                    "No puedes eliminar al último Super Admin activo de la plataforma."
                )
        # Desactivación lógica: conserva la trazabilidad de accesos e incidencias.
        usuario.estado = False
        usuario.save(update_fields=["estado"])
        django_user = User.objects.filter(username__iexact=usuario.correo).first()
        if django_user is not None:
            django_user.is_active = False
            django_user.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)
