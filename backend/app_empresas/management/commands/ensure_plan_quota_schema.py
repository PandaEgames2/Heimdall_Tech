"""Sincroniza de forma idempotente cupos de plan y tipo de establecimiento.

Las tablas funcionales de Heimdall son ``managed = False`` y se instalan desde
``Heimdall_Tech.sql``. En bases creadas antes de esta versión faltan las
columnas de cupos y de restricción contextual. Este comando las añade sin
borrar datos y completa los planes/demostraciones conocidos una sola vez.
"""

from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import connection


PLAN_SEEDS = {
    "Basico": (170, "0.75"),
    "Medio": (400, "0.50"),
    "Avanzado": (900, "0.35"),
}

DEMO_ESTABLISHMENTS = {
    1: ("RESIDENCIAL", True),
    2: ("EMPRESA_ALTA_SEGURIDAD", False),
    3: ("GUBERNAMENTAL", False),
    4: ("EMPRESA_ALTA_SEGURIDAD", False),
}


def _column_exists(cursor, table: str, column: str) -> bool:
    cursor.execute(
        """
        SELECT COUNT(*) FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = %s
          AND COLUMN_NAME = %s
        """,
        [table, column],
    )
    return cursor.fetchone()[0] > 0


def _add_column(cursor, table: str, column: str, definition: str) -> bool:
    if _column_exists(cursor, table, column):
        return False
    cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
    return True


class Command(BaseCommand):
    help = "Añade cupos de residentes, facturación por excedente y tipo de establecimiento."

    def handle(self, *args, **options):
        if connection.vendor != "mysql":
            self.stdout.write(
                self.style.WARNING(
                    "ensure_plan_quota_schema sólo aplica a MySQL; se omite."
                )
            )
            return

        with connection.cursor() as cursor:
            added_cupo = _add_column(
                cursor,
                "PLAN",
                "cupo_residentes",
                "INT NOT NULL DEFAULT 170 AFTER limite_usuarios",
            )
            added_precio = _add_column(
                cursor,
                "PLAN",
                "precio_excedente",
                "DECIMAL(10,2) NOT NULL DEFAULT 0.75 AFTER cupo_residentes",
            )
            added_politica = _add_column(
                cursor,
                "PLAN",
                "politica_excedente",
                "VARCHAR(10) NOT NULL DEFAULT 'COBRO' AFTER precio_excedente",
            )
            added_tipo = _add_column(
                cursor,
                "ESTABLECIMIENTO",
                "tipo_entidad",
                "VARCHAR(30) NOT NULL DEFAULT 'RESIDENCIAL' AFTER telefono",
            )
            _add_column(
                cursor,
                "ESTABLECIMIENTO",
                "permite_invitaciones_residente",
                "BOOLEAN NOT NULL DEFAULT TRUE AFTER tipo_entidad",
            )

            if added_cupo or added_precio or added_politica:
                for nombre, (cupo, precio) in PLAN_SEEDS.items():
                    cursor.execute(
                        """
                        UPDATE PLAN
                        SET cupo_residentes = %s,
                            precio_excedente = %s,
                            politica_excedente = 'COBRO'
                        WHERE nombre = %s
                        """,
                        [cupo, precio, nombre],
                    )

            if added_tipo:
                for establecimiento_id, (tipo, permite) in DEMO_ESTABLISHMENTS.items():
                    cursor.execute(
                        """
                        UPDATE ESTABLECIMIENTO
                        SET tipo_entidad = %s,
                            permite_invitaciones_residente = %s
                        WHERE id_establecimiento = %s
                        """,
                        [tipo, permite, establecimiento_id],
                    )

        self.stdout.write(
            self.style.SUCCESS(
                "Esquema de cupos y restricciones contextuales sincronizado."
            )
        )
