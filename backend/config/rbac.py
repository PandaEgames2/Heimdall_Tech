"""Catálogo y resolución central de permisos RBAC de Heimdall Tech.

Las tablas puente son la fuente de verdad:

* ``ROL_HAS_RECURSO`` define los recursos de cada rol.
* ``USUARIO_HAS_ROL`` define todos los roles de cada usuario.
* ``ROL.permisos`` se conserva como caché de compatibilidad.

Si las tablas nuevas todavía no existen (por ejemplo, antes de ejecutar
``ensure_rbac_schema``), el módulo cae con elegancia al modelo antiguo basado en
``ROL.permisos`` para no romper el login ni el menú.
"""

from __future__ import annotations

import json
from typing import Any, Iterable

from config.tenant_utils import SUPER_ADMIN_ROL_ID

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
        "description": "Definir los recursos globales de los roles.",
    },
    {
        "key": "recursos",
        "label": "Recursos",
        "group": "Administración",
        "description": "Administrar el catálogo de módulos y acciones del RBAC.",
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

PERMISSION_CATALOG = tuple(
    {**item, "tipo": "modulo"} for item in MODULE_PERMISSIONS
) + tuple(
    {**item, "tipo": "accion"} for item in ACTION_PERMISSIONS
)
VALID_PERMISSIONS = {item["key"] for item in PERMISSION_CATALOG}
PERMISSION_KEYS = tuple(item["key"] for item in PERMISSION_CATALOG)
MODULE_KEYS = [item["key"] for item in MODULE_PERMISSIONS]
ACTION_KEYS = [item["key"] for item in ACTION_PERMISSIONS]

# Semilla del catálogo RECURSO. El orden se conserva al crear la base.
RESOURCE_SEEDS = tuple(
    {
        "clave": item["key"],
        "nombre": item["label"],
        "descripcion": item["description"],
        "grupo": item["group"],
        "tipo": item["tipo"],
        "orden": (index + 1) * 10,
        "es_sistema": True,
    }
    for index, item in enumerate(PERMISSION_CATALOG)
)

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

# Recursos mínimos que un Super Admin no puede perder para evitar bloqueos.
SUPERADMIN_REQUIRED_KEYS = {"dashboard", "usuarios", "roles", "recursos"}

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
        "key": "recursos",
        "label": "Recursos",
        "group": "Administración",
        "icon": "recursos",
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
    allowed = set(valid_permission_keys())
    cleaned: list[str] = []
    seen: set[str] = set()
    for raw in values:
        if not isinstance(raw, str):
            continue
        key = LEGACY_PERMISSION_ALIASES.get(raw.strip(), raw.strip())
        if key in allowed and key not in seen:
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


def _order_permissions(keys: Iterable[str]) -> list[str]:
    allowed = set(keys)
    ordered = [key for key in valid_permission_keys() if key in allowed]
    for key in keys:
        if key not in ordered:
            ordered.append(key)
    return ordered


def _stored_permissions(role) -> list[str]:
    """Permisos guardados en ROL.permisos, con respaldo canónico."""

    stored = getattr(role, "permisos", None)
    if isinstance(stored, (list, tuple, set)):
        # Una lista vacía es una decisión explícita del Super Admin.
        return _clean_permission_list(stored)
    legacy = _parse_legacy_description(getattr(role, "descripcion", None))
    if legacy:
        return legacy
    return canonical_role_permissions(getattr(role, "nombre", None))


def _active_resources() -> list[Any] | None:
    """Devuelve los recursos activos o None si la tabla aún no existe."""

    try:
        from app_identidad.models import Recurso

        return list(Recurso.objects.filter(estado=True).order_by("orden", "id_recurso"))
    except Exception:
        return None


def valid_permission_keys() -> list[str]:
    """Claves válidas: catálogo de RECURSO o semilla estática como respaldo."""

    resources = _active_resources()
    if resources:
        keys = [resource.clave for resource in resources]
        # El catálogo estático siempre es válido aunque un recurso del sistema
        # se haya desactivado por error.
        for key in PERMISSION_KEYS:
            if key not in keys:
                keys.append(key)
        return keys
    return list(PERMISSION_KEYS)


def _bridge_permissions(role_ids: Iterable[int]) -> dict[int, list[str]] | None:
    """Lee ROL_HAS_RECURSO. Devuelve None si la tabla no está disponible."""

    ids = sorted({int(role_id) for role_id in role_ids if role_id})
    if not ids:
        return {}
    try:
        from app_identidad.models import RolHasRecurso

        rows = list(
            RolHasRecurso.objects.filter(
                id_rol_id__in=ids,
                id_recurso__estado=True,
            ).values_list("id_rol_id", "id_recurso__clave", "id_recurso__orden")
        )
    except Exception:
        return None

    mapping: dict[int, list[str]] = {role_id: [] for role_id in ids}
    for role_id, clave, orden in sorted(rows, key=lambda item: (item[2] or 0, item[1])):
        if clave and clave not in mapping[role_id]:
            mapping[role_id].append(clave)
    return mapping


def _role_resource_ids(role_id: int) -> list[int]:
    try:
        from app_identidad.models import RolHasRecurso

        return list(
            RolHasRecurso.objects.filter(id_rol_id=role_id)
            .order_by("id_recurso__orden", "id_recurso_id")
            .values_list("id_recurso_id", flat=True)
        )
    except Exception:
        return []


def permissions_for_roles(roles: Iterable[Any]) -> list[str]:
    """Unión ordenada de los recursos de varios roles."""

    role_list = [role for role in roles if role is not None]
    if not role_list:
        return []
    mapping = _bridge_permissions([role.id_rol for role in role_list])
    union: set[str] = set()

    if mapping is None:
        for role in role_list:
            union.update(_stored_permissions(role))
        return _order_permissions(union)

    for role in role_list:
        keys = mapping.get(role.id_rol) or []
        if keys:
            union.update(keys)
            continue
        stored = getattr(role, "permisos", None)
        if isinstance(stored, (list, tuple, set)):
            # Rol vacío de forma explícita: no hereda módulos.
            union.update(_clean_permission_list(stored))
        else:
            union.update(canonical_role_permissions(getattr(role, "nombre", None)))
    return _order_permissions(union)


def get_role_permissions(role) -> list[str]:
    """Devuelve los permisos de un rol tolerando datos y esquemas antiguos."""

    if role is None:
        return []
    mapping = _bridge_permissions([role.id_rol])
    if mapping is not None:
        keys = mapping.get(role.id_rol) or []
        if keys:
            return _order_permissions(keys)
        return _stored_permissions(role)
    return _stored_permissions(role)


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


def profile_role_ids(perfil) -> list[int]:
    """IDs de todos los roles del usuario, con el principal primero."""

    if perfil is None:
        return []
    ids: list[int] = []
    principal = getattr(perfil, "id_rol_id", None)
    if principal:
        ids.append(principal)
    try:
        for assignment in perfil.roles_asignados.all():
            role_id = getattr(assignment, "id_rol_id", None)
            if role_id and role_id not in ids:
                ids.append(role_id)
    except Exception:
        pass
    return ids


def profile_roles(perfil) -> list[Any]:
    """Objetos Rol del usuario, sin duplicados y con el principal primero."""

    if perfil is None:
        return []
    roles: list[Any] = []
    principal = getattr(perfil, "id_rol", None)
    if principal is not None:
        roles.append(principal)
    try:
        for assignment in perfil.roles_asignados.all():
            role = getattr(assignment, "id_rol", None)
            if role is None:
                continue
            if all(getattr(item, "id_rol", None) != role.id_rol for item in roles):
                roles.append(role)
    except Exception:
        pass
    return roles


def is_superadmin_profile(perfil, user=None) -> bool:
    """Determina si el perfil corresponde al Super Admin de plataforma."""

    if SUPER_ADMIN_ROL_ID in profile_role_ids(perfil):
        return True
    return bool(getattr(user, "is_superuser", False))


def canonical_role_permissions(role_name: str | None) -> list[str]:
    return list(ROLE_DEFAULTS.get(str(role_name or "").strip(), ["dashboard"]))


def resolve_effective_permissions(perfil, is_superadmin: bool = False) -> dict[str, Any]:
    """Combina los recursos de todos los roles con las excepciones del usuario.

    Reglas:
    - Los recursos de todos los roles se suman (unión).
    - Las excepciones del usuario siempre sobreescriben el permiso del rol.
    - Un Super Admin conserva acceso total a los módulos de administración y a
      las acciones de escritura; puede limitar módulos opcionales desde su rol.
    - ``solo_lectura=True`` prevalece sobre ``puede_editar`` y ``puede_eliminar``.
    """

    roles = profile_roles(perfil)
    permissions = set(permissions_for_roles(roles))
    overrides = getattr(perfil, "permisos_excepciones", None) if perfil is not None else None
    if not isinstance(overrides, dict):
        overrides = {}

    allowed_keys = set(valid_permission_keys())
    module_like = allowed_keys - set(ACTION_KEYS)
    for key, value in overrides.items():
        normalized = LEGACY_PERMISSION_ALIASES.get(str(key), str(key))
        if normalized not in allowed_keys:
            continue
        if normalized in module_like or normalized in ACTION_KEYS:
            if _as_bool(value):
                permissions.add(normalized)
            else:
                permissions.discard(normalized)

    if is_superadmin:
        if not permissions:
            permissions = set(MODULE_KEYS)
        # El rol Super Admin puede limitar módulos, pero nunca perder los accesos
        # mínimos de administración ni la capacidad de reparar el RBAC.
        permissions.update(SUPERADMIN_REQUIRED_KEYS)
        permissions.update({"puede_editar", "puede_eliminar"})
        permissions.discard("solo_lectura")
        return {
            "permisos": _order_permissions(permissions),
            "puede_editar": True,
            "puede_eliminar": True,
            "solo_lectura": False,
        }

    solo_lectura = "solo_lectura" in permissions
    if solo_lectura:
        permissions.discard("puede_editar")
        permissions.discard("puede_eliminar")

    return {
        "permisos": _order_permissions(permissions),
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
    recursos_ids = _role_resource_ids(role.id_rol)
    return {
        "id_rol": getattr(role, "id_rol", None),
        "nombre": name,
        "descripcion": getattr(role, "descripcion", "") or "",
        "permisos": get_role_permissions(role),
        "recursos_ids": recursos_ids,
        "recursos_count": len(recursos_ids),
        "es_sistema": name in BASE_ROLE_NAMES,
        "usuarios_count": usuarios_count or 0,
    }


def catalogo_permisos() -> list[dict[str, Any]]:
    resources = _active_resources()
    if resources:
        return [
            {
                "id_recurso": resource.id_recurso,
                "key": resource.clave,
                "label": resource.nombre,
                "group": resource.grupo or "General",
                "description": resource.descripcion or "",
                "tipo": resource.tipo,
                "es_sistema": bool(resource.es_sistema),
                "orden": resource.orden,
            }
            for resource in resources
        ]
    return [
        {
            "key": item["key"],
            "label": item["label"],
            "group": item["group"],
            "description": item["description"],
            "tipo": item["tipo"],
            "es_sistema": True,
        }
        for item in PERMISSION_CATALOG
    ]


def validate_role_permissions(permissions: Any, role_name: str | None = None) -> list[str]:
    if not isinstance(permissions, (list, tuple, set)):
        raise ValueError("Los permisos deben enviarse como una lista.")
    allowed = set(valid_permission_keys())
    cleaned = _clean_permission_list(permissions)
    unknown = [
        str(item)
        for item in permissions
        if isinstance(item, str)
        and LEGACY_PERMISSION_ALIASES.get(item.strip(), item.strip()) not in allowed
    ]
    if unknown:
        raise ValueError(f"Permisos desconocidos: {', '.join(sorted(set(unknown)))}.")
    if role_name == "Super Admin":
        missing = SUPERADMIN_REQUIRED_KEYS - set(cleaned)
        if missing:
            raise ValueError(
                "El rol Super Admin debe conservar dashboard, usuarios, roles y recursos "
                "para evitar un bloqueo de plataforma."
            )
    return _order_permissions(cleaned)


def validate_resource_keys(keys: Any, role_name: str | None = None) -> list[str]:
    """Valida claves contra RECURSO y devuelve una lista ordenada."""

    if not isinstance(keys, (list, tuple, set)):
        raise ValueError("Los recursos deben enviarse como una lista.")
    allowed = set(valid_permission_keys())
    normalized = [LEGACY_PERMISSION_ALIASES.get(str(key), str(key)) for key in keys if isinstance(key, str)]
    unknown = sorted({key for key in normalized if key not in allowed})
    if unknown:
        raise ValueError(f"Recursos desconocidos: {', '.join(unknown)}.")
    if role_name == "Super Admin":
        missing = SUPERADMIN_REQUIRED_KEYS - set(normalized)
        if missing:
            raise ValueError(
                "El rol Super Admin debe conservar dashboard, usuarios, roles y recursos "
                "para evitar un bloqueo de plataforma."
            )
    ordered = [key for key in valid_permission_keys() if key in set(normalized)]
    return ordered


def sync_role_permissions_cache(role_id: int) -> list[str]:
    """Recalcula ROL.permisos desde ROL_HAS_RECURSO (caché de compatibilidad)."""

    try:
        from app_identidad.models import Rol

        role = Rol.objects.filter(pk=role_id).first()
        if role is None:
            return []
        mapping = _bridge_permissions([role_id])
        if mapping is None:
            return _stored_permissions(role)
        permissions = _order_permissions(mapping.get(role_id) or [])
        Rol.objects.filter(pk=role_id).update(permisos=permissions)
        return permissions
    except Exception:
        return []
