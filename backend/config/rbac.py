"""Catálogo y resolución central de permisos RBAC de Heimdall Tech.

El backend es la única fuente de verdad. El frontend consume `permisos_efectivos`,
`acciones`, `menu` y `catalogo_permisos` desde /api/profile/ para construir la
navegación y los interruptores de permisos.
"""

from __future__ import annotations

import json
from typing import Any, Iterable

MODULE_PERMISSIONS = (
    {
        "key": "dashboard",
        "label": "Dashboard",
        "group": "General",
        "description": "Resumen operativo y métricas del establecimiento.",
    },
    {
        "key": "accesos",
        "label": "Control de acceso",
        "group": "Operación",
        "description": "Registrar y consultar ingresos, salidas e incidencias.",
    },
    {
        "key": "camaras",
        "label": "Cámaras",
        "group": "Operación",
        "description": "Captura y reconocimiento de placas con LPR/IA.",
    },
    {
        "key": "mi_qr",
        "label": "Mi QR e invitados",
        "group": "Operación",
        "description": "QR temporal de residente e invitaciones de visitantes.",
    },
    {
        "key": "usuarios",
        "label": "Usuarios",
        "group": "Administración",
        "description": "Consultar, crear y actualizar las cuentas del establecimiento.",
    },
    {
        "key": "roles",
        "label": "Roles y permisos",
        "group": "Administración",
        "description": "Definir los permisos globales de los roles.",
    },
    {
        "key": "catalogos",
        "label": "Catálogo",
        "group": "Administración",
        "description": "Planes, establecimientos, vehículos y responsables.",
    },
    {
        "key": "reportes",
        "label": "Reportes",
        "group": "Administración",
        "description": "Historial de movimientos, incidencias y reconocimientos.",
    },
    {
        "key": "seguridad",
        "label": "Seguridad",
        "group": "Sistema",
        "description": "Panel de seguridad, auditoría y estado del sistema.",
    },
)

ACTION_PERMISSIONS = (
    {
        "key": "puede_editar",
        "label": "Permiso de edición",
        "group": "Políticas de escritura",
        "description": "Habilita cambios sobre la configuración y los registros administrativos.",
    },
    {
        "key": "puede_eliminar",
        "label": "Permiso de eliminación",
        "group": "Políticas de escritura",
        "description": "Habilita operaciones destructivas sobre registros.",
    },
    {
        "key": "solo_lectura",
        "label": "Solo lectura",
        "group": "Políticas de escritura",
        "description": "Prevalece sobre edición y eliminación; bloquea toda escritura.",
    },
)

PERMISSION_CATALOG = MODULE_PERMISSIONS + ACTION_PERMISSIONS
VALID_PERMISSIONS = {item["key"] for item in PERMISSION_CATALOG}
MODULE_KEYS = [item["key"] for item in MODULE_PERMISSIONS]
ACTION_KEYS = [item["key"] for item in ACTION_PERMISSIONS]

BASE_ROLE_NAMES = (
    "Super Admin",
    "Administrador",
    "Supervisor",
    "Vigilante",
    "Residente",
)

PROTECTED_ROLE_NAMES = BASE_ROLE_NAMES

ROLE_DESCRIPTIONS = {
    "Super Admin": "Administración global de la plataforma y del RBAC.",
    "Administrador": "Control operativo y de usuarios de su establecimiento.",
    "Supervisor": "Auditoría, reportes y supervisión de la operación.",
    "Vigilante": "Operación de portería, accesos y novedades.",
    "Residente": "Consulta su QR y administra invitaciones de visitantes.",
}

ROLE_DEFAULTS: dict[str, list[str]] = {
    "Super Admin": MODULE_KEYS + ["puede_editar", "puede_eliminar"],
    "Administrador": [
        "dashboard",
        "usuarios",
        "catalogos",
        "reportes",
        "camaras",
        "accesos",
        "puede_editar",
        "puede_eliminar",
    ],
    "Supervisor": ["dashboard", "reportes", "camaras", "accesos"],
    "Vigilante": ["dashboard", "camaras", "accesos"],
    "Residente": ["mi_qr"],
}

# Aliases de la primera versión del frontend/seed, que no deben romper el menú.
LEGACY_PERMISSION_ALIASES = {
    "qr_residente": "mi_qr",
    "invitaciones_visitante": "mi_qr",
    "qr": "mi_qr",
}

MENU_DEFINITIONS = (
    {
        "key": "dashboard",
        "label": "Dashboard",
        "group": "General",
        "icon": "dashboard",
        "superadmin_only": False,
    },
    {
        "key": "accesos",
        "label": "Control de acceso",
        "group": "Operación",
        "icon": "accesos",
        "superadmin_only": False,
    },
    {
        "key": "camaras",
        "label": "Cámaras",
        "group": "Operación",
        "icon": "camaras",
        "superadmin_only": False,
    },
    {
        "key": "mi_qr",
        "label": "Mi QR e invitados",
        "group": "Operación",
        "icon": "mi_qr",
        "superadmin_only": False,
    },
    {
        "key": "usuarios",
        "label": "Usuarios",
        "group": "Administración",
        "icon": "usuarios",
        "superadmin_only": False,
    },
    {
        "key": "roles",
        "label": "Roles y permisos",
        "group": "Administración",
        "icon": "roles",
        "superadmin_only": True,
    },
    {
        "key": "catalogos",
        "label": "Catálogo",
        "group": "Administración",
        "icon": "catalogos",
        "superadmin_only": False,
    },
    {
        "key": "reportes",
        "label": "Reportes",
        "group": "Administración",
        "icon": "reportes",
        "superadmin_only": False,
    },
    {
        "key": "seguridad",
        "label": "Seguridad",
        "group": "Sistema",
        "icon": "seguridad",
        "superadmin_only": False,
    },
)


def _clean_permission_list(values: Any) -> list[str]:
    """Normaliza una lista de permisos y descarta claves desconocidas."""

    if not isinstance(values, (list, tuple, set)):
        return []
    cleaned: list[str] = []
    seen: set[str] = set()
    for raw in values:
        if not isinstance(raw, str):
            continue
        key = LEGACY_PERMISSION_ALIASES.get(raw.strip(), raw.strip())
        if key in VALID_PERMISSIONS and key not in seen:
            seen.add(key)
            cleaned.append(key)
    return cleaned


def _parse_legacy_description(description: str | None) -> list[str]:
    if not description:
        return []
    text = str(description).strip()
    if not text:
        return []
    if text.startswith("["):
        try:
            parsed = json.loads(text)
        except (TypeError, ValueError):
            parsed = None
        if isinstance(parsed, list):
            return _clean_permission_list(parsed)
    # La descripción humana no es una lista de permisos; se ignora.
    return []


def is_superadmin_profile(perfil, user=None) -> bool:
    """Determina si el perfil corresponde al Super Admin de plataforma."""

    if perfil is not None:
        role_name = str(getattr(getattr(perfil, "id_rol", None), "nombre", "") or "").strip()
        if role_name == "Super Admin":
            return True
        if getattr(perfil, "id_rol_id", None) == 4:
            return True
    return bool(getattr(user, "is_superuser", False))


def canonical_role_permissions(role_name: str | None) -> list[str]:
    return list(ROLE_DEFAULTS.get(str(role_name or "").strip(), ["dashboard"]))


def get_role_permissions(role) -> list[str]:
    """Devuelve los permisos por defecto de un rol, tolerando datos antiguos."""

    if role is None:
        return []
    stored = getattr(role, "permisos", None)
    if isinstance(stored, (list, tuple, set)):
        # Una lista vacía es una decisión explícita del Super Admin: el rol no
        # hereda módulos. Solo NULL/formatos antiguos usan la descripción legada.
        return _clean_permission_list(stored)
    legacy = _parse_legacy_description(getattr(role, "descripcion", None))
    if legacy:
        return legacy
    return canonical_role_permissions(getattr(role, "nombre", None))


def get_role_action_defaults(role_name: str | None) -> dict[str, bool]:
    permissions = set(canonical_role_permissions(role_name))
    return {
        "puede_editar": "puede_editar" in permissions,
        "puede_eliminar": "puede_eliminar" in permissions,
        "solo_lectura": "solo_lectura" in permissions,
    }


def _as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "si", "sí"}
    return False


def resolve_effective_permissions(perfil, is_superadmin: bool = False) -> dict[str, Any]:
    """Combina permisos del rol con las excepciones individuales del usuario.

    Reglas:
    - Las excepciones del usuario siempre sobreescriben el permiso del rol.
    - Un Super Admin conserva acceso total a los módulos de administración y a
      las acciones de escritura; puede limitar módulos opcionales desde su rol.
    - `solo_lectura=True` prevalece sobre `puede_editar` y `puede_eliminar`.
    """

    if is_superadmin:
        role = getattr(perfil, "id_rol", None) if perfil is not None else None
        permissions = set(get_role_permissions(role))
        if not permissions:
            permissions = set(MODULE_KEYS)
        overrides = getattr(perfil, "permisos_excepciones", None) if perfil is not None else None
        if isinstance(overrides, dict):
            for key, value in overrides.items():
                normalized = LEGACY_PERMISSION_ALIASES.get(str(key), str(key))
                if normalized in MODULE_KEYS or normalized in ACTION_KEYS:
                    if _as_bool(value):
                        permissions.add(normalized)
                    else:
                        permissions.discard(normalized)
        # El rol Super Admin puede limitar módulos, pero nunca perder los accesos
        # mínimos de administración ni la capacidad de reparar el RBAC.
        permissions.update({"dashboard", "usuarios", "roles", "puede_editar", "puede_eliminar"})
        permissions.discard("solo_lectura")
        return {
            "permisos": [key for key in VALID_PERMISSIONS if key in permissions],
            "puede_editar": True,
            "puede_eliminar": True,
            "solo_lectura": False,
        }

    role = getattr(perfil, "id_rol", None) if perfil is not None else None
    permissions = set(get_role_permissions(role))
    overrides = getattr(perfil, "permisos_excepciones", None) if perfil is not None else None
    if not isinstance(overrides, dict):
        overrides = {}

    for key, value in overrides.items():
        normalized = LEGACY_PERMISSION_ALIASES.get(str(key), str(key))
        if normalized in MODULE_KEYS:
            if _as_bool(value):
                permissions.add(normalized)
            else:
                permissions.discard(normalized)
        elif normalized in ACTION_KEYS:
            if _as_bool(value):
                permissions.add(normalized)
            else:
                permissions.discard(normalized)

    solo_lectura = "solo_lectura" in permissions
    if solo_lectura:
        permissions.discard("puede_editar")
        permissions.discard("puede_eliminar")

    ordered = [key for key in VALID_PERMISSIONS if key in permissions]
    return {
        "permisos": ordered,
        "puede_editar": "puede_editar" in permissions,
        "puede_eliminar": "puede_eliminar" in permissions,
        "solo_lectura": solo_lectura,
    }


def has_permission(access: dict[str, Any], key: str) -> bool:
    return key in access.get("permisos", [])


def build_menu(
    permissions: Iterable[str],
    funcionalidades: dict[str, bool] | None,
    is_superadmin: bool = False,
) -> list[dict[str, Any]]:
    allowed = set(permissions)
    features = funcionalidades or {}
    menu: list[dict[str, Any]] = []
    for item in MENU_DEFINITIONS:
        if item["key"] not in allowed:
            continue
        locked_by_plan = bool(
            item["key"] == "camaras"
            and not is_superadmin
            and not features.get("lpr")
        )
        menu.append(
            {
                "key": item["key"],
                "label": item["label"],
                "group": item["group"],
                "icon": item["icon"],
                "visible": True,
                "locked_by_plan": locked_by_plan,
                "superadmin_only": item["superadmin_only"],
            }
        )
    return menu


def serialize_role(role, usuarios_count: int | None = None) -> dict[str, Any]:
    name = str(getattr(role, "nombre", "") or "")
    return {
        "id_rol": getattr(role, "id_rol", None),
        "nombre": name,
        "descripcion": getattr(role, "descripcion", "") or "",
        "permisos": get_role_permissions(role),
        "es_sistema": name in BASE_ROLE_NAMES,
        "usuarios_count": usuarios_count or 0,
    }


def catalogo_permisos() -> list[dict[str, Any]]:
    return [
        {
            "key": item["key"],
            "label": item["label"],
            "group": item["group"],
            "description": item["description"],
            "tipo": "accion" if item["key"] in ACTION_KEYS else "modulo",
        }
        for item in PERMISSION_CATALOG
    ]


def validate_role_permissions(permissions: Any, role_name: str | None = None) -> list[str]:
    if not isinstance(permissions, (list, tuple, set)):
        raise ValueError("Los permisos deben enviarse como una lista.")
    cleaned = _clean_permission_list(permissions)
    unknown = [
        str(item)
        for item in permissions
        if isinstance(item, str)
        and LEGACY_PERMISSION_ALIASES.get(item.strip(), item.strip()) not in VALID_PERMISSIONS
    ]
    if unknown:
        raise ValueError(f"Permisos desconocidos: {', '.join(sorted(set(unknown)))}.")
    if role_name == "Super Admin":
        missing = {"dashboard", "usuarios", "roles"} - set(cleaned)
        if missing:
            raise ValueError(
                "El rol Super Admin debe conservar dashboard, usuarios y roles para evitar un bloqueo de plataforma."
            )
    return cleaned
