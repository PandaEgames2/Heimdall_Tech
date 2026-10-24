"""Utilidades multi-tenant: perfil de negocio y comprobación de acceso."""

from __future__ import annotations

SUPER_ADMIN_ROL_ID = 4
RESIDENTE_ROL_ID = 5
ADMIN_ROL_IDS = {1, SUPER_ADMIN_ROL_ID}
STAFF_ROL_IDS = {1, 2, 3, SUPER_ADMIN_ROL_ID}


def get_usuario_perfil(user):
    if user is None or not user.is_authenticated:
        return None
    from app_identidad.models import Usuario

    email = (getattr(user, "email", None) or getattr(user, "username", "") or "").strip().lower()
    if not email:
        return None
    return (
        Usuario.objects.select_related("id_rol", "id_establecimiento")
        .filter(correo__iexact=email, estado=True)
        .first()
    )


def is_platform_superadmin(user) -> bool:
    if user is None or not user.is_authenticated:
        return False
    perfil = get_usuario_perfil(user)
    if perfil and perfil.id_rol_id == SUPER_ADMIN_ROL_ID:
        return True
    return bool(getattr(user, "is_superuser", False))


def user_role_id(user) -> int | None:
    perfil = get_usuario_perfil(user)
    return perfil.id_rol_id if perfil else None


def user_establecimiento_id(user) -> int | None:
    perfil = get_usuario_perfil(user)
    if perfil:
        return perfil.id_establecimiento_id
    return None


def assert_establecimiento_access(request, establecimiento_id: int) -> None:
    from rest_framework.exceptions import PermissionDenied

    if is_platform_superadmin(request.user):
        return
    allowed = user_establecimiento_id(request.user)
    if allowed is None or int(allowed) != int(establecimiento_id):
        raise PermissionDenied("No tienes acceso a este establecimiento.")
