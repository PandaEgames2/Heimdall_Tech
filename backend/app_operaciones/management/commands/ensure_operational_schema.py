from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = "Crea de forma idempotente la tabla para invitaciones QR de visitantes."

    def handle(self, *args, **options):
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'USUARIO' AND COLUMN_NAME = 'permisos_excepciones'
                """,
                [connection.settings_dict["NAME"]],
            )
            if cursor.fetchone()[0] == 0:
                cursor.execute("ALTER TABLE USUARIO ADD COLUMN permisos_excepciones JSON NULL")

            cursor.execute(
                """
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'VEHICULO' AND COLUMN_NAME = 'codigo_rfid'
                """,
                [connection.settings_dict["NAME"]],
            )
            if cursor.fetchone()[0] == 0:
                cursor.execute("ALTER TABLE VEHICULO ADD COLUMN codigo_rfid VARCHAR(100) NULL")

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS INVITACION_VISITANTE (
                    id_invitacion BIGINT AUTO_INCREMENT PRIMARY KEY,
                    id_establecimiento INT NOT NULL,
                    id_residente INT NOT NULL,
                    nombre_visitante VARCHAR(100) NOT NULL,
                    documento_visitante VARCHAR(30) NULL,
                    placa_visitante VARCHAR(15) NULL,
                    motivo VARCHAR(255) NULL,
                    token_hash CHAR(64) NOT NULL UNIQUE,
                    vigente_desde DATETIME NOT NULL,
                    vigente_hasta DATETIME NOT NULL,
                    estado ENUM('PENDIENTE', 'EN_SITIO', 'FINALIZADA', 'REVOCADA')
                        NOT NULL DEFAULT 'PENDIENTE',
                    fecha_ingreso DATETIME NULL,
                    fecha_salida DATETIME NULL,
                    id_movimiento_ingreso INT NULL,
                    id_movimiento_salida INT NULL,
                    fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT fk_invitacion_establecimiento FOREIGN KEY (id_establecimiento)
                        REFERENCES ESTABLECIMIENTO (id_establecimiento) ON DELETE CASCADE ON UPDATE CASCADE,
                    CONSTRAINT fk_invitacion_residente FOREIGN KEY (id_residente)
                        REFERENCES USUARIO (id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE,
                    CONSTRAINT fk_invitacion_movimiento_ingreso FOREIGN KEY (id_movimiento_ingreso)
                        REFERENCES MOVIMIENTO (id_movimiento) ON DELETE SET NULL ON UPDATE CASCADE,
                    CONSTRAINT fk_invitacion_movimiento_salida FOREIGN KEY (id_movimiento_salida)
                        REFERENCES MOVIMIENTO (id_movimiento) ON DELETE SET NULL ON UPDATE CASCADE,
                    INDEX ix_invitacion_tenant_estado (id_establecimiento, estado),
                    INDEX ix_invitacion_residente (id_residente)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS CODIGO_ACCESO_RESIDENTE (
                    id_codigo INT AUTO_INCREMENT PRIMARY KEY,
                    id_establecimiento INT NOT NULL,
                    id_residente INT NOT NULL,
                    id_vehiculo INT NULL,
                    token_hash CHAR(64) NOT NULL UNIQUE,
                    codigo_hash CHAR(64) NOT NULL,
                    fecha_expiracion DATETIME NOT NULL,
                    fecha_uso DATETIME NULL,
                    CONSTRAINT fk_codigo_residente_establecimiento FOREIGN KEY (id_establecimiento)
                        REFERENCES ESTABLECIMIENTO (id_establecimiento) ON DELETE CASCADE ON UPDATE CASCADE,
                    CONSTRAINT fk_codigo_residente_usuario FOREIGN KEY (id_residente)
                        REFERENCES USUARIO (id_usuario) ON DELETE CASCADE ON UPDATE CASCADE,
                    CONSTRAINT fk_codigo_residente_vehiculo FOREIGN KEY (id_vehiculo)
                        REFERENCES VEHICULO (id_vehiculo) ON DELETE SET NULL ON UPDATE CASCADE,
                    UNIQUE KEY uk_codigo_residente_tenant (id_establecimiento, codigo_hash),
                    INDEX ix_codigo_residente_expiracion (fecha_expiracion)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            cursor.execute(
                """
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'INCIDENCIA' AND COLUMN_NAME = 'id_invitacion'
                """,
                [connection.settings_dict["NAME"]],
            )
            if cursor.fetchone()[0] == 0:
                cursor.execute("ALTER TABLE INCIDENCIA ADD COLUMN id_invitacion BIGINT NULL")
            cursor.execute(
                """
                SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'INCIDENCIA' AND CONSTRAINT_NAME = 'fk_incidencia_invitacion'
                """,
                [connection.settings_dict["NAME"]],
            )
            if cursor.fetchone()[0] == 0:
                cursor.execute(
                    "ALTER TABLE INCIDENCIA ADD CONSTRAINT fk_incidencia_invitacion "
                    "FOREIGN KEY (id_invitacion) REFERENCES INVITACION_VISITANTE (id_invitacion) "
                    "ON DELETE SET NULL ON UPDATE CASCADE"
                )
        self.stdout.write(self.style.SUCCESS(
            "Esquema operativo listo: RFID, invitaciones QR y códigos cortos de residente habilitados."
        ))
