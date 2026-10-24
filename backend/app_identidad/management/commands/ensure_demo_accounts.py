"""Asegura roles y cuentas de demostración para probar el sistema localmente."""

from django.core.management.base import BaseCommand
from django.db import connection

from config.tenant_utils import RESIDENTE_ROL_ID, SUPER_ADMIN_ROL_ID


class Command(BaseCommand):
    help = "Asegura roles y cuentas Super Admin, vigilante y residente de demostración."

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO ROL (id_rol, nombre, descripcion)
                VALUES (%s, 'Super Admin', %s)
                ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), descripcion = VALUES(descripcion)
                """,
                [
                    SUPER_ADMIN_ROL_ID,
                    '["dashboard","usuarios","roles","catalogos","reportes","camaras","seguridad","config"]',
                ],
            )
            cursor.execute(
                """
                INSERT INTO ROL (id_rol, nombre, descripcion)
                VALUES (%s, 'Residente', %s)
                ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), descripcion = VALUES(descripcion)
                """,
                [RESIDENTE_ROL_ID, '["qr_residente","invitaciones_visitante"]'],
            )

            demo_users = [
                (1, SUPER_ADMIN_ROL_ID, "admin", "admin@heimdall.tech", "pbkdf2_sha256$dev$miacarola"),
                (1, SUPER_ADMIN_ROL_ID, "rastor36", "rastor36@heimdall.tech", "pbkdf2_sha256$dev$miacarola"),
                (1, 2, "Jose Vigilante Pinos", "vigilante@pinos.com", "pbkdf2_sha256$dev$hash_pass_123"),
                (1, RESIDENTE_ROL_ID, "Residente Demo Pinos", "residente@pinos.com", "pbkdf2_sha256$dev$hash_pass_123"),
            ]
            for establecimiento_id, rol_id, nombre, correo, password_hash in demo_users:
                cursor.execute(
                    "SELECT 1 FROM USUARIO WHERE correo = %s LIMIT 1",
                    [correo],
                )
                if cursor.fetchone():
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
            "Cuentas demo listas: Super Admin, vigilante@pinos.com y residente@pinos.com."
        ))
