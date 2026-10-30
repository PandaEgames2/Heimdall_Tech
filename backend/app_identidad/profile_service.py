"""Construcción del perfil de acceso que consume el frontend."""

from __future__ import annotations

from typing import Any

from app_empresas.features import features_for_establecimiento
from app_identidad.models import Rol, Usuario
from config.rbac import (
    build_menu,
    catalogo_permisos,
    get_role_permissions,
    is_superadmin_profile,
    resolve_effective_permissions,
    serialize_role,
)


def _serialize_roles(usuario_counts: dict[int, int] | None = None) -> list[dict[str, Any]]:
    counts = usuario_counts or {}
    return [
        serialize_role(role, counts.get(role.id_rol, 0))
        for role in Rol.objects.all().order_by("id_rol")
    ]


def role_user_counts() -> dict[int, int]:
    from django.db.models import Count

    return {
        row["id_rol"]: row["total"]
        for row in Usuario.objects.values("id_rol").annotate(total=Count("id_usuario"))
    }


def build_profile_payload(user, perfil: Usuario | None) -> dict[str, Any]:
    """Devuelve el contrato RBAC que usa el frontend.

    El backend sigue siendo la autoridad: el menú y los toggles son sólo una
    representación de los permisos efectivos que aplica `config.permissions`.
    """

    base: dict[str, Any] = {
        "id": getattr(user, "id", None),
        "username": getattr(user, "username", ""),
        "email": getattr(user, "email", ""),
        "is_staff": bool(getattr(user, "is_staff", False)),
        "is_superuser": bool(getattr(user, "is_superuser", False)),
        "is_platform_superadmin": False,
        "permisos_rol": [],
        "permisos_excepciones": {},
        "permisos_efectivos": [],
        "acciones": {
            "puede_editar": False,
            "puede_eliminar": False,
            "solo_lectura": True,
        },
        "menu": [{"key": "dashboard", "label": "Dashboard", "group": "General", "icon": "dashboard", "visible": True, "locked_by_plan": False, "superadmin_only": False}],
        "catalogo_permisos": catalogo_permisos(),
        "roles": [],
        "funcionalidades": {"manual": True, "qr": False, "rfid": False, "lpr": False},
    }

    if perfil is None:
        return base

    is_superadmin = is_superadmin_profile(perfil, user)
    access = resolve_effective_permissions(perfil, is_superadmin=is_superadmin)
    establecimiento = perfil.id_establecimiento
    features = features_for_establecimiento(establecimiento)

    base.update(
        {
            "nombre": perfil.nombre,
            "id_usuario": perfil.id_usuario,
            "id_establecimiento": perfil.id_establecimiento_id,
            "rol": perfil.id_rol.nombre if perfil.id_rol else "Sin rol",
            "rol_id": perfil.id_rol_id if perfil.id_rol else None,
            "permisos_rol": get_role_permissions(perfil.id_rol),
            "permisos_excepciones": perfil.permisos_excepciones or {},
            "permisos_efectivos": access["permisos"],
            "acciones": {
                "puede_editar": access["puede_editar"],
                "puede_eliminar": access["puede_eliminar"],
                "solo_lectura": access["solo_lectura"],
            },
            "is_platform_superadmin": is_superadmin,
            "establecimiento": establecimiento.nombre,
            "plan": {
                "id": establecimiento.id_plan_id,
                "nombre": establecimiento.id_plan.nombre if establecimiento.id_plan else None,
            },
            "funcionalidades": features,
            "menu": build_menu(access["permisos"], features, is_superadmin=is_superadmin),
        }
    )

    if is_superadmin:
        base["roles"] = _serialize_roles(role_user_counts())

    return base
