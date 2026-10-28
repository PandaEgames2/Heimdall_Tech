from rest_framework.permissions import BasePermission, SAFE_METHODS

from app_empresas.features import features_for_establecimiento
from .tenant_utils import (
    ADMIN_ROL_IDS,
    RESIDENTE_ROL_ID,
    STAFF_ROL_IDS,
    get_usuario_perfil,
    is_platform_superadmin,
)


def _module_for_view(view, profile=None, request=None):
    view_name = view.__class__.__name__
    module_name = view.__class__.__module__
    if module_name.endswith("app_identidad.views"):
        if view_name == "UsuarioViewSet":
            return "usuarios"
        if view_name == "RolViewSet":
            return "roles"
    if module_name.endswith("app_empresas.views"):
        return "catalogos"
    if module_name.endswith("app_inteligencia.views"):
        return "camaras" if getattr(view, "action", "") == "procesar" else "reportes"
    if module_name.endswith("app_operaciones.views"):
        if view_name == "VehiculoViewSet":
            return "accesos" if request and request.query_params.get("permiso") == "accesos" else "catalogos"
        if view_name == "ResponsableViewSet":
            return "catalogos"
        if view_name == "InvitacionVisitanteViewSet":
            return "mi_qr" if profile and profile.id_rol_id == RESIDENTE_ROL_ID else "accesos"
        if view_name in {"MisVehiculosView", "QRResidenteView"}:
            return "mi_qr"
        if view_name in {"MovimientoViewSet", "IncidenciaViewSet"} and getattr(view, "action", "") in {"list", "retrieve"}:
            if view_name == "IncidenciaViewSet" and request and request.query_params.get("permiso") == "seguridad":
                return "seguridad"
            return "reportes"
        return "accesos"
    return None


def _explicit_module_access(request, profile, module):
    """Return an explicit per-user module decision, or None to use role defaults."""
    if not profile:
        return None
    overrides = profile.permisos_excepciones or {}
    if not isinstance(overrides, dict):
        return None
    if request.method not in SAFE_METHODS and (
        overrides.get("solo_lectura") is True or overrides.get("puede_editar") is False
    ):
        return False
    if module in overrides:
        return bool(overrides[module])
    return None


class IsPlatformSuperAdmin(BasePermission):
    message = "Solo un Super Admin puede administrar los roles globales."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and is_platform_superadmin(request.user))


class IsPlatformSuperAdminOrRoleReader(BasePermission):
    """Keep global role writes Super Admin only; allow explicitly granted read access."""

    message = "Solo un Super Admin puede modificar roles globales."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if is_platform_superadmin(request.user):
            return True
        if request.method not in SAFE_METHODS:
            return False
        perfil = get_usuario_perfil(request.user)
        return _explicit_module_access(request, perfil, "roles") is True


class IsTenantAdmin(BasePermission):
    message = "Necesitas el rol de administrador para gestionar usuarios."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if is_platform_superadmin(request.user):
            return True
        perfil = get_usuario_perfil(request.user)
        decision = _explicit_module_access(request, perfil, "usuarios")
        if decision is not None:
            return decision
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
        decision = _explicit_module_access(request, perfil, _module_for_view(view, perfil, request))
        if decision is not None:
            return decision
        return bool(perfil and perfil.id_rol_id in STAFF_ROL_IDS)


class IsResident(BasePermission):
    message = "Esta operación requiere una cuenta de residente."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        perfil = get_usuario_perfil(request.user)
        if not perfil or perfil.id_rol_id != RESIDENTE_ROL_ID:
            return False
        decision = _explicit_module_access(request, perfil, _module_for_view(view, perfil, request))
        return decision is not False


class IsTenantStaffOrResident(BasePermission):
    message = "Necesitas una cuenta activa del establecimiento."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if is_platform_superadmin(request.user):
            return True
        perfil = get_usuario_perfil(request.user)
        decision = _explicit_module_access(request, perfil, _module_for_view(view, perfil, request))
        if decision is not None:
            return decision
        return bool(perfil and perfil.id_rol_id in STAFF_ROL_IDS | {RESIDENTE_ROL_ID})


class HasLprFeature(BasePermission):
    message = "El plan del establecimiento no incluye reconocimiento LPR/IA."

    def has_permission(self, request, view):
        if is_platform_superadmin(request.user):
            return True
        perfil = get_usuario_perfil(request.user)
        return bool(perfil and features_for_establecimiento(perfil.id_establecimiento).get("lpr"))
