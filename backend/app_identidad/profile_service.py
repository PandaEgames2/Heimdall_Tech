"""Construcción del perfil de acceso que consume el frontend."""

from __future__ import annotations

from typing import Any

from app_empresas.features import features_for_establecimiento
from app_empresas.quotas import estado_cupo
from app_identidad.models import Rol, Usuario, UsuarioHasRol
from config.rbac import (
    build_menu,
    catalogo_permisos,
    is_superadmin_profile,
    permissions_for_roles,
    profile_role_ids,
    profile_roles,
    resolve_effective_permissions,
    serialize_role,
)
from config.tenant_utils import RESIDENTE_ROL_ID, profile_has_role


def _serialize_roles(usuario_counts: dict[int, int] | None = None) -> list[dict[str, Any]]:
    counts = usuario_counts or {}
    return [
        serialize_role(role, counts.get(role.id_rol, 0))
        for role in Rol.objects.all().order_by("id_rol")
    ]


def role_user_counts() -> dict[int, int]:
    """Cuenta usuarios por rol usando la tabla puente USUARIO_HAS_ROL."""

    from django.db.models import Count

    try:
        rows = (
            UsuarioHasRol.objects.values("id_rol_id")
            .annotate(total=Count("id_usuario_id", distinct=True))
            .order_by()
        )
        counts = {row["id_rol_id"]: row["total"] for row in rows}
        if counts:
            return counts
    except Exception:
        pass

    try:
        return {
            row["id_rol"]: row["total"]
            for row in Usuario.objects.values("id_rol").annotate(total=Count("id_usuario"))
        }
    except Exception:
        return {}


def _roles_assigned_payload(perfil: Usuario) -> list[dict[str, Any]]:
    principal = perfil.id_rol_id
    payload: list[dict[str, Any]] = []
    seen: set[int] = set()
    for role in profile_roles(perfil):
        if role.id_rol in seen:
            continue
        seen.add(role.id_rol)
        payload.append(
            {
                "id_rol": role.id_rol,
                "nombre": role.nombre,
                "es_principal": role.id_rol == principal,
            }
        )
    return payload


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
        "roles_asignados": [],
        "funcionalidades": {"manual": True, "qr": False, "rfid": False, "lpr": False},
        "tipo_entidad": None,
        "tipo_entidad_etiqueta": "",
        "permite_invitaciones_residente": False,
        "puede_invitar": False,
        "cupo": None,
    }

    if perfil is None:
        return base

    is_superadmin = is_superadmin_profile(perfil, user)
    access = resolve_effective_permissions(perfil, is_superadmin=is_superadmin)
    roles = profile_roles(perfil)
    establecimiento = perfil.id_establecimiento
    features = features_for_establecimiento(establecimiento)
    cupo = estado_cupo(establecimiento)
    puede_invitar = bool(
        features.get("qr")
        and establecimiento.permite_invitaciones_residente
        and profile_has_role(perfil, RESIDENTE_ROL_ID)
    )

    base.update(
        {
            "nombre": perfil.nombre,
            "id_usuario": perfil.id_usuario,
            "id_establecimiento": perfil.id_establecimiento_id,
            "rol": perfil.id_rol.nombre if perfil.id_rol else "Sin rol",
            "rol_id": perfil.id_rol_id if perfil.id_rol else None,
            "roles_ids": profile_role_ids(perfil),
            "roles_asignados": _roles_assigned_payload(perfil),
            "permisos_rol": permissions_for_roles(roles),
            "permisos_excepciones": perfil.permisos_excepciones or {},
            "permisos_efectivos": access["permisos"],
            "acciones": {
                "puede_editar": access["puede_editar"],
                "puede_eliminar": access["puede_eliminar"],
                "solo_lectura": access["solo_lectura"],
            },
            "is_platform_superadmin": is_superadmin,
            "establecimiento": establecimiento.nombre,
            "tipo_entidad": establecimiento.tipo_entidad,
            "tipo_entidad_etiqueta": establecimiento.get_tipo_entidad_display(),
            "permite_invitaciones_residente": bool(
                establecimiento.permite_invitaciones_residente
            ),
            "puede_invitar": puede_invitar,
            "cupo": cupo,
            "plan": {
                "id": establecimiento.id_plan_id,
                "nombre": establecimiento.id_plan.nombre if establecimiento.id_plan else None,
                "cupo_residentes": getattr(establecimiento.id_plan, "cupo_residentes", None),
                "precio_excedente": str(
                    getattr(establecimiento.id_plan, "precio_excedente", "") or ""
                ),
                "politica_excedente": getattr(
                    establecimiento.id_plan, "politica_excedente", None
                ),
            },
            "funcionalidades": features,
            "menu": build_menu(access["permisos"], features, is_superadmin=is_superadmin),
        }
    )

    if is_superadmin:
        base["roles"] = _serialize_roles(role_user_counts())

    return base
