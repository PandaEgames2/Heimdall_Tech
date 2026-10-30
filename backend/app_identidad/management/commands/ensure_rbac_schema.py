"""Actualiza de forma idempotente el esquema RBAC (ROL.permisos y roles base)."""

from django.core.management.base import BaseCommand
from django.db import connection

from config.rbac import (
    BASE_ROLE_NAMES,
    ROLE_DEFAULTS,
    ROLE_DESCRIPTIONS,
    get_role_permissions,
)


class Command(BaseCommand):
    help = "Agrega ROL.permisos si no existe y normaliza los permisos de los roles base."

    def handle(self, *args, **options):
        database = connection.settings_dict["NAME"]
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'ROL' AND COLUMN_NAME = 'permisos'
                """,
                [database],
            )
            if cursor.fetchone()[0] == 0:
                cursor.execute("ALTER TABLE ROL ADD COLUMN permisos JSON NULL")
                self.stdout.write("Columna ROL.permisos creada.")

            # Normaliza los cinco roles base sin tocar roles personalizados.
            for role_name in BASE_ROLE_NAMES:
                permissions = ROLE_DEFAULTS[role_name]
                description = ROLE_DESCRIPTIONS[role_name]
                cursor.execute(
                    """
                    INSERT INTO ROL (nombre, descripcion, permisos)
                    VALUES (%s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                        descripcion = COALESCE(descripcion, VALUES(descripcion)),
                        permisos = COALESCE(permisos, VALUES(permisos))
                    """,
                    [role_name, description, self._json(permissions)],
                )

            cursor.execute("SELECT id_rol, nombre, descripcion, permisos FROM ROL")
            for role_id, role_name, description, stored_permissions in cursor.fetchall():
                if role_name in BASE_ROLE_NAMES:
                    continue
                permissions = get_role_permissions(
                    type("RoleRow", (), {
                        "nombre": role_name,
                        "descripcion": description,
                        "permisos": stored_permissions,
                    })()
                )
                cursor.execute(
                    "UPDATE ROL SET permisos = %s WHERE id_rol = %s",
                    [self._json(permissions), role_id],
                )

        self.stdout.write(self.style.SUCCESS(
            "Esquema RBAC listo: ROL.permisos y roles base normalizados."
        ))

    @staticmethod
    def _json(value):
        import json

        return json.dumps(value, ensure_ascii=False)
