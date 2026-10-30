from rest_framework.permissions import BasePermission, SAFE_METHODS

from app_empresas.features import features_for_establecimiento
from .rbac import resolve_effective_permissions
from .tenant_utils import (
    RESIDENTE_ROL_ID,
    get_usuario_perfil,
    is_platform_superadmin,
    profile_has_role,
)

# Módulos administrativos: crear exige `puede_editar`. En módulos operativos
# (accesos, mi_qr) el personal puede crear registros sin ser administrador.
ADMIN_MODULES = {"usuarios", "roles", "recursos", "catalogos", "seguridad", "config"}


def _module_for_view(view, profile=None, request=None):
    view_name = view.__class__.__name__
    module_name = view.__class__.__module__
    if module_name.endswith("app_identidad.views"):
        if view_name == "UsuarioViewSet":
            return "usuarios"
        if view_name == "RolViewSet":
            return "roles"
        if view_name == "RecursoViewSet":
            return "recursos"
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
            return "mi_qr" if profile and profile_has_role(profile, RESIDENTE_ROL_ID) else "accesos"
        if view_name in {"MisVehiculosView", "QRResidenteView"}:
            return "mi_qr"
        if view_name in {"MovimientoViewSet", "IncidenciaViewSet"} and getattr(view, "action", "") in {"list", "retrieve"}:
            if view_name == "IncidenciaViewSet" and request and request.query_params.get("permiso") == "seguridad":
                return "seguridad"
            return "reportes"
        return "accesos"
    return None


def _access_for(request):
    perfil = get_usuario_perfil(request.user)
    access = resolve_effective_permissions(
        perfil,
        is_superadmin=is_platform_superadmin(request.user),
    )
    return perfil, access


def _allows_write(request, access, module):
    """Aplica solo_lectura, puede_editar y puede_eliminar de forma coherente."""

    if request.method in SAFE_METHODS:
        return True
    if access.get("solo_lectura"):
        return False
    if request.method == "DELETE":
        return bool(access.get("puede_eliminar"))
    if request.method in ("PUT", "PATCH"):
        return bool(access.get("puede_editar"))
    if module in ADMIN_MODULES:
        return bool(access.get("puede_editar"))
    return True


class IsPlatformSuperAdmin(BasePermission):
    message = "Solo un Super Admin puede administrar roles y recursos globales."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and is_platform_superadmin(request.user))


class IsPlatformSuperAdminOrRoleReader(BasePermission):
    """Escrituras globales Super Admin; lectura para quien tenga el módulo roles."""

    message = "Solo un Super Admin puede modificar roles globales."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if is_platform_superadmin(request.user):
            return True
        if request.method not in SAFE_METHODS:
            return False
        _, access = _access_for(request)
        return "roles" in access["permisos"]


class IsTenantAdmin(BasePermission):
    message = "Necesitas permiso de administración para esta operación."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if is_platform_superadmin(request.user):
            return True
        perfil, access = _access_for(request)
        if perfil is None:
            return False
        module = _module_for_view(view, perfil, request)
        if module is not None and module not in access["permisos"]:
            return False
        return _allows_write(request, access, module)


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
    """Permite operar a quien tenga el módulo efectivo y respeta solo_lectura."""

    message = "Esta operación requiere un permiso operativo o administrativo."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if is_platform_superadmin(request.user):
            return True
        perfil, access = _access_for(request)
        if perfil is None:
            return False
        module = _module_for_view(view, perfil, request)
        if module is not None and module not in access["permisos"]:
            return False
        return _allows_write(request, access, module)


class IsResident(BasePermission):
    message = "Esta operación requiere una cuenta de residente."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        perfil, access = _access_for(request)
        if not perfil or not profile_has_role(perfil, RESIDENTE_ROL_ID):
            return False
        module = _module_for_view(view, perfil, request)
        if module is not None and module not in access["permisos"]:
            return False
        return _allows_write(request, access, module)


class IsTenantStaffOrResident(BasePermission):
    message = "Necesitas una cuenta activa del establecimiento."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if is_platform_superadmin(request.user):
            return True
        perfil, access = _access_for(request)
        if perfil is None:
            return False
        module = _module_for_view(view, perfil, request)
        if module is not None and module not in access["permisos"]:
            return False
        return _allows_write(request, access, module)


class HasLprFeature(BasePermission):
    message = "El plan del establecimiento no incluye reconocimiento LPR/IA."

    def has_permission(self, request, view):
        if is_platform_superadmin(request.user):
            return True
        perfil = get_usuario_perfil(request.user)
        return bool(perfil and features_for_establecimiento(perfil.id_establecimiento).get("lpr"))
