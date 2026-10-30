"""Asegura roles y cuentas de demostración con hashes reales y permisos canónicos."""

import json
import os

from django.contrib.auth.hashers import identify_hasher, make_password
from django.core.management.base import BaseCommand
from django.db import connection

from config.rbac import ROLE_DEFAULTS
from config.tenant_utils import RESIDENTE_ROL_ID, SUPER_ADMIN_ROL_ID


def _is_valid_password_hash(value: str) -> bool:
    """Valida el formato completo del hash, no solo el prefijo del algoritmo.

    El antiguo backdoor de desarrollo guardaba ``pbkdf2_sha256$dev$...``. Ese
    valor empieza por un algoritmo conocido, pero no se puede decodificar, por
    lo que ``check_password`` falla. ``decode()`` es la comprobación real.
    """

    if not value:
        return False
    try:
        identify_hasher(value).decode(value)
        return True
    except Exception:
        return False


class Command(BaseCommand):
    help = "Asegura roles y cuentas demo. No imprime contraseñas salvo --show-credentials."

    def add_arguments(self, parser):
        parser.add_argument(
            "--show-credentials",
            action="store_true",
            help="Muestra las credenciales demo (solo para desarrollo local).",
        )
        parser.add_argument(
            "--reset-passwords",
            action="store_true",
            help="Restablece la contraseña demo en las cuentas seed (también migra el hasher).",
        )

    def handle(self, *args, **options):
        demo_password = os.getenv("HEIMDALL_DEMO_PASSWORD", "Heimdall#2026")
        password_hash = make_password(demo_password)

        # Todas las cuentas del seed comparten la contraseña demo. Incluimos
        # las cuentas de edificio para reparar los hashes legacy que quedaron
        # con el formato del backdoor eliminado.
        seed_users = [
            (1, SUPER_ADMIN_ROL_ID, "Super Admin", "admin@heimdall.tech"),
            (1, SUPER_ADMIN_ROL_ID, "Super Admin Respaldo", "rastor36@heimdall.tech"),
            (1, 1, "Carlos Admin Pinos", "admin@pinos.com"),
            (1, 2, "Jose Vigilante Pinos", "vigilante@pinos.com"),
            (1, 2, "Luis Vigilante Pinos", "vigilante2@pinos.com"),
            (1, RESIDENTE_ROL_ID, "Residente Demo Pinos", "residente@pinos.com"),
            (2, 1, "Ana Admin Norte", "admin@norte.com"),
            (2, 2, "Pedro Vigilante Norte", "vigilante@norte.com"),
            (3, 1, "Rector Admin Uniguajira", "admin@uniguajira.edu.co"),
            (3, 2, "Mario Vigilante Uniguajira", "porteria@uniguajira.edu.co"),
            (3, 3, "Sofia Supervisora", "supervision@uniguajira.edu.co"),
            (4, 1, "Juan Admin Logístico", "admin@logistico.com"),
            (4, 2, "Diego Vigilante Logístico", "porteria@logistico.com"),
        ]

        with connection.cursor() as cursor:
            role_seed = (
                (1, "Administrador"),
                (2, "Vigilante"),
                (3, "Supervisor"),
                (SUPER_ADMIN_ROL_ID, "Super Admin"),
                (RESIDENTE_ROL_ID, "Residente"),
            )

            for role_id, role_name in role_seed:
                cursor.execute(
                    """
                    INSERT INTO ROL (id_rol, nombre, descripcion, permisos)
                    VALUES (%s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                        nombre = VALUES(nombre),
                        permisos = COALESCE(permisos, VALUES(permisos))
                    """,
                    [
                        role_id,
                        role_name,
                        None,
                        json.dumps(ROLE_DEFAULTS[role_name]),
                    ],
                )

            for establecimiento_id, rol_id, nombre, correo in seed_users:
                cursor.execute(
                    "SELECT id_usuario, password_hash FROM USUARIO WHERE correo = %s LIMIT 1",
                    [correo],
                )
                row = cursor.fetchone()
                if row:
                    existing_hash = str(row[1] or "")
                    # Repara hashes inválidos o vacíos. Con --reset-passwords
                    # también migra los válidos al hasher preferido.
                    if options["reset_passwords"] or not _is_valid_password_hash(existing_hash):
                        cursor.execute(
                            "UPDATE USUARIO SET password_hash = %s WHERE id_usuario = %s",
                            [password_hash, row[0]],
                        )
                    continue
                cursor.execute(
                    """
                    INSERT INTO USUARIO (id_establecimiento, id_rol, nombre, correo, password_hash, estado)
                    VALUES (%s, %s, %s, %s, %s, TRUE)
                    """,
                    [establecimiento_id, rol_id, nombre, correo, password_hash],
                )

            # El anfitrión necesita un registro de responsable para que la unidad
            # aparezca en los flujos de residente/invitaciones.
            cursor.execute(
                """
                INSERT INTO RESPONSABLE
                    (id_establecimiento, nombre, documento_identidad, telefono, correo, departamento_unidad)
                SELECT 1, 'Residente Demo Pinos', 'DEMO-RES-001', '3000000000',
                       'residente@pinos.com', 'Casa 14, Torre B'
                WHERE EXISTS (SELECT 1 FROM USUARIO WHERE correo = 'residente@pinos.com')
                  AND NOT EXISTS (
                      SELECT 1 FROM RESPONSABLE
                      WHERE id_establecimiento = 1 AND documento_identidad = 'DEMO-RES-001'
                  )
                """
            )

        self.stdout.write(self.style.SUCCESS(
            "Cuentas demo verificadas con contraseñas hasheadas."
        ))
        if options.get("show_credentials"):
            self.stdout.write("\n".join(
                f"{correo} / {demo_password}" for _, _, _, correo in seed_users
            ))
