"""Cupos de residentes/empleados y facturación por excedente.

La capacidad contratada vive en ``PLAN`` y se aplica por establecimiento.
Un usuario consume cupo cuando tiene el rol Residente y está activo. El plan
decide qué ocurre al llegar al límite:

* ``COBRO``: permite el registro y calcula un valor extra mensual.
* ``BLOQUEO``: rechaza el registro y exige contratar un plan superior.

El frontend sólo muestra el estado; la validación real ocurre en los
serializers y en la API.
"""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from django.db.models import Q

from .models import Plan

RESIDENTE_ROL_ID = 5
CENTAVO = Decimal("0.01")


class CupoResidenteExcedido(Exception):
    """Se lanza cuando la política del plan impide una nueva plaza."""

    def __init__(self, message: str, estado: dict | None = None):
        super().__init__(message)
        self.estado = estado or {}


def _plan_de(establecimiento) -> Plan | None:
    plan = getattr(establecimiento, "id_plan", None)
    if plan is not None:
        return plan
    plan_id = getattr(establecimiento, "id_plan_id", None)
    return Plan.objects.filter(pk=plan_id).first() if plan_id else None


def contar_residentes_activos(
    establecimiento_id: int,
    excluir_usuario_id: int | None = None,
) -> int:
    """Cuenta plazas ocupadas por residentes/empleados activos.

    Se consulta la tabla puente para incluir usuarios con más de un rol. Si la
    base todavía no tiene ``USUARIO_HAS_ROL``, cae con elegancia al rol
    principal para no romper instalaciones antiguas.
    """

    from app_identidad.models import Usuario

    base = Usuario.objects.filter(
        id_establecimiento_id=establecimiento_id,
        estado=True,
    )
    if excluir_usuario_id:
        base = base.exclude(pk=excluir_usuario_id)

    try:
        return (
            base.filter(
                Q(id_rol_id=RESIDENTE_ROL_ID)
                | Q(roles_asignados__id_rol_id=RESIDENTE_ROL_ID)
            )
            .distinct()
            .count()
        )
    except Exception:
        return base.filter(id_rol_id=RESIDENTE_ROL_ID).count()


def _decimal(value) -> Decimal:
    try:
        return Decimal(str(value or 0)).quantize(CENTAVO, rounding=ROUND_HALF_UP)
    except Exception:
        return Decimal("0.00")


def estado_cupo(
    establecimiento,
    excluir_usuario_id: int | None = None,
) -> dict:
    """Devuelve el consumo, el cobro extra y si cabe una nueva plaza."""

    plan = _plan_de(establecimiento)
    if plan is None:
        return {
            "plan_id": None,
            "plan_nombre": None,
            "cupo_base": 0,
            "ocupados": 0,
            "disponibles": 0,
            "excedente": 0,
            "porcentaje_uso": 0,
            "precio_base": "0.00",
            "precio_excedente": "0.00",
            "cobro_extra": "0.00",
            "total_mensual": "0.00",
            "politica_excedente": Plan.PoliticaExcedente.COBRO,
            "politica_excedente_etiqueta": "Sin plan",
            "puede_registrar": True,
        }

    cupo_base = max(0, int(getattr(plan, "cupo_residentes", 0) or 0))
    ocupados = contar_residentes_activos(
        establecimiento.id_establecimiento,
        excluir_usuario_id=excluir_usuario_id,
    )
    excedente = max(0, ocupados - cupo_base)
    disponibles = max(0, cupo_base - ocupados)
    precio_base = _decimal(getattr(plan, "precio", 0))
    precio_excedente = _decimal(getattr(plan, "precio_excedente", 0))
    cobro_extra = (precio_excedente * excedente).quantize(CENTAVO, rounding=ROUND_HALF_UP)
    total_mensual = (precio_base + cobro_extra).quantize(CENTAVO, rounding=ROUND_HALF_UP)
    politica = getattr(plan, "politica_excedente", None) or Plan.PoliticaExcedente.COBRO
    puede_registrar = (
        politica == Plan.PoliticaExcedente.COBRO or ocupados < cupo_base
    )
    porcentaje = round((ocupados / cupo_base) * 100, 1) if cupo_base else 0

    return {
        "plan_id": plan.id_plan,
        "plan_nombre": plan.nombre,
        "cupo_base": cupo_base,
        "ocupados": ocupados,
        "disponibles": disponibles,
        "excedente": excedente,
        "porcentaje_uso": min(100, porcentaje),
        "precio_base": f"{precio_base:.2f}",
        "precio_excedente": f"{precio_excedente:.2f}",
        "cobro_extra": f"{cobro_extra:.2f}",
        "total_mensual": f"{total_mensual:.2f}",
        "politica_excedente": politica,
        "politica_excedente_etiqueta": plan.get_politica_excedente_display(),
        "puede_registrar": puede_registrar,
    }


def asegurar_cupo_disponible(
    establecimiento,
    excluir_usuario_id: int | None = None,
) -> dict:
    """Valida una nueva plaza y devuelve el estado de cupo resultante."""

    estado = estado_cupo(establecimiento, excluir_usuario_id=excluir_usuario_id)
    if not estado["puede_registrar"]:
        plan = estado["plan_nombre"] or "actual"
        raise CupoResidenteExcedido(
            (
                f"El plan {plan} alcanzó su cupo base de {estado['cupo_base']} "
                "residentes/empleados. Aumenta el plan para registrar más plazas "
                "o cambia la política del plan a cobro por excedente."
            ),
            estado,
        )
    return estado
