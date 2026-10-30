"""Crea y sincroniza de forma idempotente el RBAC de cinco tablas.

Tablas administradas por este comando (todas ``managed = False`` en Django):

* ``RECURSO``: catálogo de módulos y acciones.
* ``ROL_HAS_RECURSO``: recursos asignados a cada rol.
* ``USUARIO_HAS_ROL``: todos los roles de cada usuario.

El comando no elimina roles, usuarios, permisos ni historial. Convierte el
modelo antiguo (``ROL.permisos`` + ``USUARIO.id_rol``) en relaciones y conserva
esas columnas como caché de compatibilidad.
"""

from __future__ import annotations

import json

from django.core.management.base import BaseCommand, CommandError
from django.db import connection

from config.rbac import (
    BASE_ROLE_NAMES,
    RESOURCE_SEEDS,
    ROLE_DEFAULTS,
    ROLE_DESCRIPTIONS,
    get_role_permissions,
    sync_role_permissions_cache,
)

CREATE_RECURSO = """
CREATE TABLE IF NOT EXISTS RECURSO (
    id_recurso INT AUTO_INCREMENT PRIMARY KEY,
    clave VARCHAR(50) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(200) NULL,
    grupo VARCHAR(50) NOT NULL DEFAULT 'General',
    tipo ENUM('modulo', 'accion') NOT NULL DEFAULT 'modulo',
    estado BOOLEAN NOT NULL DEFAULT TRUE,
    orden INT NOT NULL DEFAULT 0,
    es_sistema BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT uk_recurso_clave UNIQUE (clave),
    INDEX ix_recurso_orden (orden),
    INDEX ix_recurso_tipo (tipo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
"""

CREATE_USUARIO_HAS_ROL = """
CREATE TABLE IF NOT EXISTS USUARIO_HAS_ROL (
    id_usuario_has_rol BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_rol INT NOT NULL,
    fecha_asignacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_uhr_usuario FOREIGN KEY (id_usuario)
        REFERENCES USUARIO (id_usuario) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_uhr_rol FOREIGN KEY (id_rol)
        REFERENCES ROL (id_rol) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uk_uhr_usuario_rol UNIQUE (id_usuario, id_rol),
    INDEX ix_uhr_rol (id_rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
"""

CREATE_ROL_HAS_RECURSO = """
CREATE TABLE IF NOT EXISTS ROL_HAS_RECURSO (
    id_rol_has_recurso BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_rol INT NOT NULL,
    id_recurso INT NOT NULL,
    CONSTRAINT fk_rhr_rol FOREIGN KEY (id_rol)
        REFERENCES ROL (id_rol) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_rhr_recurso FOREIGN KEY (id_recurso)
        REFERENCES RECURSO (id_recurso) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uk_rhr_rol_recurso UNIQUE (id_rol, id_recurso),
    INDEX ix_rhr_recurso (id_recurso)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
"""


class _RoleRow:
    """Adaptador mínimo para reutilizar get_role_permissions en el backfill."""

    def __init__(self, role_id, nombre, descripcion, permisos):
        self.id_rol = role_id
        self.nombre = nombre
        self.descripcion = descripcion
        self.permisos = permisos


class Command(BaseCommand):
    help = (
        "Crea RECURSO, USUARIO_HAS_ROL y ROL_HAS_RECURSO; siembra recursos y "
        "convierte los permisos antiguos en relaciones sin borrar datos."
    )

    def handle(self, *args, **options):
        database = connection.settings_dict["NAME"]
        with connection.cursor() as cursor:
            missing = [
                table
                for table in ("PLAN", "ESTABLECIMIENTO", "ROL", "USUARIO")
                if not self._table_exists(cursor, database, table)
            ]
            if missing:
                raise CommandError(
                    "Faltan tablas base: "
                    + ", ".join(missing)
                    + ". Importa el esquema primero con "
                    + "`python backend/bootstrap_db.py --execute` "
                    + "o ejecuta Heimdall_Tech.sql en MySQL Workbench."
                )

            self._ensure_role_permissions_column(cursor, database)
            self._ensure_tables(cursor)
            self._seed_resources(cursor)
            self._seed_base_roles(cursor)
            role_count = self._backfill_role_resources(cursor)
            user_count = self._backfill_user_roles(cursor)
            self._ensure_superadmin_minimum(cursor)
            self._sync_role_cache()

            resource_total = self._count(cursor, "RECURSO")
            role_resource_total = self._count(cursor, "ROL_HAS_RECURSO")
            user_role_total = self._count(cursor, "USUARIO_HAS_ROL")

        self.stdout.write(self.style.SUCCESS(
            "RBAC de 5 tablas listo: "
            f"{resource_total} recursos, {role_resource_total} relaciones rol-recurso, "
            f"{user_role_total} relaciones usuario-rol "
            f"({role_count} roles y {user_count} usuarios convertidos desde el modelo antiguo)."
        ))

    # ------------------------------------------------------------------
    # Esquema
    # ------------------------------------------------------------------
    @staticmethod
    def _table_exists(cursor, database, table):
        cursor.execute(
            """
            SELECT COUNT(*) FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s
            """,
            [database, table],
        )
        return cursor.fetchone()[0] > 0

    @staticmethod
    def _count(cursor, table):
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        return cursor.fetchone()[0]

    def _ensure_role_permissions_column(self, cursor, database):
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

    def _ensure_tables(self, cursor):
        cursor.execute(CREATE_RECURSO)
        cursor.execute(CREATE_USUARIO_HAS_ROL)
        cursor.execute(CREATE_ROL_HAS_RECURSO)

    # ------------------------------------------------------------------
    # Semillas
    # ------------------------------------------------------------------
    def _seed_resources(self, cursor):
        for resource in RESOURCE_SEEDS:
            cursor.execute(
                """
                INSERT INTO RECURSO
                    (clave, nombre, descripcion, grupo, tipo, estado, orden, es_sistema)
                VALUES (%s, %s, %s, %s, %s, TRUE, %s, TRUE)
                ON DUPLICATE KEY UPDATE
                    nombre = VALUES(nombre),
                    descripcion = VALUES(descripcion),
                    grupo = VALUES(grupo),
                    tipo = VALUES(tipo),
                    estado = TRUE,
                    orden = VALUES(orden),
                    es_sistema = TRUE
                """,
                [
                    resource["clave"],
                    resource["nombre"],
                    resource["descripcion"],
                    resource["grupo"],
                    resource["tipo"],
                    resource["orden"],
                ],
            )

    def _seed_base_roles(self, cursor):
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

    # ------------------------------------------------------------------
    # Backfill desde el modelo antiguo
    # ------------------------------------------------------------------
    def _backfill_role_resources(self, cursor) -> int:
        cursor.execute("SELECT id_rol, nombre, descripcion, permisos FROM ROL")
        converted = 0
        for role_id, role_name, description, stored_permissions in cursor.fetchall():
            cursor.execute(
                "SELECT COUNT(*) FROM ROL_HAS_RECURSO WHERE id_rol = %s",
                [role_id],
            )
            if cursor.fetchone()[0] > 0:
                continue
            permissions = get_role_permissions(
                _RoleRow(role_id, role_name, description, stored_permissions)
            )
            for key in permissions:
                self._insert_role_resource(cursor, role_id, key)
            converted += 1
        return converted

    def _backfill_user_roles(self, cursor) -> int:
        cursor.execute("SELECT COUNT(*) FROM USUARIO_HAS_ROL")
        before = cursor.fetchone()[0]
        cursor.execute(
            """
            INSERT IGNORE INTO USUARIO_HAS_ROL (id_usuario, id_rol)
            SELECT id_usuario, id_rol FROM USUARIO WHERE id_rol IS NOT NULL
            """
        )
        cursor.execute("SELECT COUNT(*) FROM USUARIO_HAS_ROL")
        return max(0, cursor.fetchone()[0] - before)

    def _ensure_superadmin_minimum(self, cursor):
        cursor.execute("SELECT id_rol FROM ROL WHERE nombre = 'Super Admin' LIMIT 1")
        row = cursor.fetchone()
        if not row:
            return
        for key in ("dashboard", "usuarios", "roles", "recursos"):
            self._insert_role_resource(cursor, row[0], key)

    def _insert_role_resource(self, cursor, role_id: int, key: str):
        cursor.execute(
            """
            INSERT IGNORE INTO ROL_HAS_RECURSO (id_rol, id_recurso)
            SELECT %s, id_recurso FROM RECURSO WHERE clave = %s LIMIT 1
            """,
            [role_id, key],
        )

    def _sync_role_cache(self):
        cursor = connection.cursor()
        try:
            cursor.execute("SELECT id_rol FROM ROL")
            role_ids = [row[0] for row in cursor.fetchall()]
        finally:
            cursor.close()
        for role_id in role_ids:
            sync_role_permissions_cache(role_id)

    @staticmethod
    def _json(value):
        return json.dumps(value, ensure_ascii=False)
