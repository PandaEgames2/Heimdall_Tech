from rest_framework.permissions import BasePermission, SAFE_METHODS

from app_empresas.features import features_for_establecimiento
from .tenant_utils import (
    ADMIN_ROL_IDS,
    RESIDENTE_ROL_ID,
    STAFF_ROL_IDS,
    get_usuario_perfil,
    is_platform_superadmin,
)


class IsPlatformSuperAdmin(BasePermission):
    message = "Solo un Super Admin puede administrar los roles globales."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and is_platform_superadmin(request.user))


class IsTenantAdmin(BasePermission):
    message = "Necesitas el rol de administrador para gestionar usuarios."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if is_platform_superadmin(request.user):
            return True
        perfil = get_usuario_perfil(request.user)
        return bool(perfil and perfil.id_rol_id in ADMIN_ROL_IDS)


class IsAuthenticatedWithTenant(BasePermission):
    """Requires authenticated user and a valid tenant context when the request is tenant-scoped."""

    message = "Debes autenticarte y proporcionar un contexto válido de establecimiento."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.method in SAFE_METHODS:
            return True

        tenant_id = request.query_params.get("id_establecimiento")
        if tenant_id:
            return True

        payload = getattr(getattr(request, "auth", None), "payload", {})
        token_tenant = payload.get("id_establecimiento") if isinstance(payload, dict) else None
        return bool(token_tenant)


class IsTenantStaff(BasePermission):
    """Allows establishment staff roles and the platform super admin."""

    message = "Esta operación requiere una cuenta de administración o vigilancia."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if is_platform_superadmin(request.user):
            return True
        perfil = get_usuario_perfil(request.user)
        return bool(perfil and perfil.id_rol_id in STAFF_ROL_IDS)


class IsResident(BasePermission):
    message = "Esta operación requiere una cuenta de residente."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        perfil = get_usuario_perfil(request.user)
        return bool(perfil and perfil.id_rol_id == RESIDENTE_ROL_ID)


class IsTenantStaffOrResident(BasePermission):
    message = "Necesitas una cuenta activa del establecimiento."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if is_platform_superadmin(request.user):
            return True
        perfil = get_usuario_perfil(request.user)
        return bool(perfil and perfil.id_rol_id in STAFF_ROL_IDS | {RESIDENTE_ROL_ID})


class HasLprFeature(BasePermission):
    message = "El plan del establecimiento no incluye reconocimiento LPR/IA."

    def has_permission(self, request, view):
        if is_platform_superadmin(request.user):
            return True
        perfil = get_usuario_perfil(request.user)
        return bool(perfil and features_for_establecimiento(perfil.id_establecimiento).get("lpr"))
