-- =============================================================================
-- HEIMDALL TECH — Esquema MySQL 8+ (SaaS multi-establecimiento)
-- Ejecutar como usuario con permisos CREATE DATABASE.
-- =============================================================================

CREATE DATABASE IF NOT EXISTS heimdall_tech
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE heimdall_tech;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- ELIMINACIÓN (orden inverso a las dependencias)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS USUARIO_HAS_ROL;
DROP TABLE IF EXISTS ROL_HAS_RECURSO;
DROP TABLE IF EXISTS RECURSO;
DROP TABLE IF EXISTS INVITACION_VISITANTE;
DROP TABLE IF EXISTS INCIDENCIA;
DROP TABLE IF EXISTS RECONOCIMIENTO_PLACA;
DROP TABLE IF EXISTS MOVIMIENTO;
DROP TABLE IF EXISTS VEHICULO;
DROP TABLE IF EXISTS RESPONSABLE;
DROP TABLE IF EXISTS USUARIO;
DROP TABLE IF EXISTS ROL;
DROP TABLE IF EXISTS ESTABLECIMIENTO;
DROP TABLE IF EXISTS PLAN;

CREATE TABLE PLAN (
    id_plan INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    precio DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    limite_usuarios INT NOT NULL DEFAULT 5,
    cupo_residentes INT NOT NULL DEFAULT 170,
    precio_excedente DECIMAL(10, 2) NOT NULL DEFAULT 0.75,
    politica_excedente VARCHAR(10) NOT NULL DEFAULT 'COBRO',
    permite_ia BOOLEAN NOT NULL DEFAULT FALSE,
    estado BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- TABLA: ESTABLECIMIENTO
-- -----------------------------------------------------------------------------
CREATE TABLE ESTABLECIMIENTO (
    id_establecimiento INT AUTO_INCREMENT PRIMARY KEY,
    id_plan INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    direccion VARCHAR(200) NOT NULL,
    telefono VARCHAR(20),
    tipo_entidad VARCHAR(30) NOT NULL DEFAULT 'RESIDENCIAL',
    permite_invitaciones_residente BOOLEAN NOT NULL DEFAULT TRUE,
    estado BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_establecimiento_plan FOREIGN KEY (id_plan)
        REFERENCES PLAN (id_plan) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- TABLA: ROL
-- -----------------------------------------------------------------------------
CREATE TABLE ROL (
    id_rol INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion VARCHAR(150),
    permisos JSON NULL
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- TABLA: RECURSO (catálogo RBAC de módulos y acciones)
-- -----------------------------------------------------------------------------
CREATE TABLE RECURSO (
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
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- TABLA: USUARIO
-- -----------------------------------------------------------------------------
CREATE TABLE USUARIO (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    id_establecimiento INT NOT NULL,
    id_rol INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    correo VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    estado BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    permisos_excepciones JSON NULL,
    CONSTRAINT fk_usuario_establecimiento FOREIGN KEY (id_establecimiento)
        REFERENCES ESTABLECIMIENTO (id_establecimiento) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_usuario_rol FOREIGN KEY (id_rol)
        REFERENCES ROL (id_rol) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT uk_usuario_correo_est UNIQUE (id_establecimiento, correo)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- TABLA: USUARIO_HAS_ROL (un usuario puede desempeñar varios roles)
-- -----------------------------------------------------------------------------
CREATE TABLE USUARIO_HAS_ROL (
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
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- TABLA: ROL_HAS_RECURSO (recursos habilitados por rol)
-- -----------------------------------------------------------------------------
CREATE TABLE ROL_HAS_RECURSO (
    id_rol_has_recurso BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_rol INT NOT NULL,
    id_recurso INT NOT NULL,
    CONSTRAINT fk_rhr_rol FOREIGN KEY (id_rol)
        REFERENCES ROL (id_rol) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_rhr_recurso FOREIGN KEY (id_recurso)
        REFERENCES RECURSO (id_recurso) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uk_rhr_rol_recurso UNIQUE (id_rol, id_recurso),
    INDEX ix_rhr_recurso (id_recurso)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- TABLA: RESPONSABLE
-- -----------------------------------------------------------------------------
CREATE TABLE RESPONSABLE (
    id_responsable INT AUTO_INCREMENT PRIMARY KEY,
    id_establecimiento INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    documento_identidad VARCHAR(20) NOT NULL,
    telefono VARCHAR(20),
    correo VARCHAR(100),
    departamento_unidad VARCHAR(50),
    CONSTRAINT fk_responsable_establecimiento FOREIGN KEY (id_establecimiento)
        REFERENCES ESTABLECIMIENTO (id_establecimiento) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT uk_responsable_doc_est UNIQUE (id_establecimiento, documento_identidad)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- TABLA: VEHICULO
-- -----------------------------------------------------------------------------
CREATE TABLE VEHICULO (
    id_vehiculo INT AUTO_INCREMENT PRIMARY KEY,
    id_establecimiento INT NOT NULL,
    id_responsable INT NULL,
    placa VARCHAR(15) NOT NULL,
    marca VARCHAR(50),
    modelo VARCHAR(50),
    color VARCHAR(30),
    codigo_rfid VARCHAR(100) NULL,
    tipo_autorizacion ENUM('AUTORIZADO', 'VISITANTE', 'RESTRINGIDO') NOT NULL DEFAULT 'VISITANTE',
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_vehiculo_establecimiento FOREIGN KEY (id_establecimiento)
        REFERENCES ESTABLECIMIENTO (id_establecimiento) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_vehiculo_responsable FOREIGN KEY (id_responsable)
        REFERENCES RESPONSABLE (id_responsable) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT uk_vehiculo_establecimiento_placa UNIQUE (id_establecimiento, placa)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- TABLA: MOVIMIENTO
-- -----------------------------------------------------------------------------
CREATE TABLE MOVIMIENTO (
    id_movimiento INT AUTO_INCREMENT PRIMARY KEY,
    id_establecimiento INT NOT NULL,
    id_vehiculo INT NULL,
    id_usuario INT NOT NULL,
    placa_leida VARCHAR(15) NOT NULL,
    tipo_movimiento ENUM('INGRESO', 'SALIDA') NOT NULL,
    fecha_evento DATETIME NOT NULL,
    id_dispositivo VARCHAR(100) NOT NULL,
    observacion VARCHAR(255) NULL,
    estado_sincronizacion ENUM('PENDIENTE', 'SINCRONIZADO') NOT NULL DEFAULT 'SINCRONIZADO',
    fecha_sincronizacion DATETIME NULL,
    CONSTRAINT fk_movimiento_establecimiento FOREIGN KEY (id_establecimiento)
        REFERENCES ESTABLECIMIENTO (id_establecimiento) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_movimiento_vehiculo FOREIGN KEY (id_vehiculo)
        REFERENCES VEHICULO (id_vehiculo) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_movimiento_usuario FOREIGN KEY (id_usuario)
        REFERENCES USUARIO (id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- TABLA: INVITACION_VISITANTE (QR de visitante y trazabilidad del residente anfitrión)
-- -----------------------------------------------------------------------------
CREATE TABLE INVITACION_VISITANTE (
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
    estado ENUM('PENDIENTE', 'EN_SITIO', 'FINALIZADA', 'REVOCADA') NOT NULL DEFAULT 'PENDIENTE',
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
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- TABLA: RECONOCIMIENTO_PLACA
-- -----------------------------------------------------------------------------
CREATE TABLE RECONOCIMIENTO_PLACA (
    id_reconocimiento INT AUTO_INCREMENT PRIMARY KEY,
    id_establecimiento INT NOT NULL,
    id_movimiento INT NULL,
    id_dispositivo VARCHAR(100) NOT NULL,
    id_usuario INT NOT NULL,
    url_fotografia VARCHAR(255) NOT NULL,
    placa_detectada VARCHAR(15) NOT NULL,
    nivel_confianza DECIMAL(5, 2) NOT NULL,
    resultado_ia ENUM('COINCIDE', 'NO_COINCIDE', 'ALERTA') NOT NULL,
    fecha_procesamiento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reconocimiento_establecimiento FOREIGN KEY (id_establecimiento)
        REFERENCES ESTABLECIMIENTO (id_establecimiento) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_reconocimiento_movimiento FOREIGN KEY (id_movimiento)
        REFERENCES MOVIMIENTO (id_movimiento) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_reconocimiento_usuario FOREIGN KEY (id_usuario)
        REFERENCES USUARIO (id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- TABLA: INCIDENCIA
-- -----------------------------------------------------------------------------
CREATE TABLE INCIDENCIA (
    id_incidencia INT AUTO_INCREMENT PRIMARY KEY,
    id_establecimiento INT NOT NULL,
    id_vehiculo INT NULL,
    id_invitacion BIGINT NULL,
    id_usuario INT NOT NULL,
    titulo VARCHAR(100) NOT NULL,
    descripcion TEXT NOT NULL,
    nivel_prioridad ENUM('BAJA', 'MEDIA', 'ALTA', 'CRITICA') NOT NULL DEFAULT 'MEDIA',
    fecha_incidencia DATETIME NOT NULL,
    CONSTRAINT fk_incidencia_establecimiento FOREIGN KEY (id_establecimiento)
        REFERENCES ESTABLECIMIENTO (id_establecimiento) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_incidencia_vehiculo FOREIGN KEY (id_vehiculo)
        REFERENCES VEHICULO (id_vehiculo) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_incidencia_invitacion FOREIGN KEY (id_invitacion)
        REFERENCES INVITACION_VISITANTE (id_invitacion) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT fk_incidencia_usuario FOREIGN KEY (id_usuario)
        REFERENCES USUARIO (id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Índices para reportes y sincronización offline (venta / escala)
CREATE INDEX idx_movimiento_est_fecha ON MOVIMIENTO (id_establecimiento, fecha_evento);
CREATE INDEX idx_movimiento_placa ON MOVIMIENTO (id_establecimiento, placa_leida);
CREATE INDEX idx_movimiento_sync ON MOVIMIENTO (id_establecimiento, estado_sincronizacion);
CREATE INDEX idx_vehiculo_placa ON VEHICULO (id_establecimiento, placa);
CREATE INDEX idx_incidencia_est_fecha ON INCIDENCIA (id_establecimiento, fecha_incidencia);

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- DATOS DE PRUEBA (100+ registros distribuidos — entorno demo comercial)
-- password_hash: solo desarrollo; reemplazar con hash Argon2/bcrypt en producción.
-- =============================================================================

INSERT INTO PLAN (id_plan, nombre, descripcion, precio, limite_usuarios, cupo_residentes, precio_excedente, politica_excedente, permite_ia) VALUES
(1, 'Basico', 'Gestión manual y códigos QR', 49.99, 5, 170, 0.75, 'COBRO', FALSE),
(2, 'Medio', 'Integración con etiquetas RFID y antenas', 129.99, 15, 400, 0.50, 'COBRO', FALSE),
(3, 'Avanzado', 'Cámaras LPR e IA de reconocimiento de placas', 299.99, 50, 900, 0.35, 'COBRO', TRUE);

INSERT INTO ESTABLECIMIENTO (id_establecimiento, id_plan, nombre, direccion, telefono, tipo_entidad, permite_invitaciones_residente, estado) VALUES
(1, 1, 'Conjunto Residencial Los Pinos', 'Calle 1 #2-3, Riohacha', '3001000001', 'RESIDENCIAL', TRUE, TRUE),
(2, 2, 'Edificio Empresarial Norte', 'Cra 15 #4-5, Maicao', '3102000002', 'EMPRESA_ALTA_SEGURIDAD', FALSE, TRUE),
(3, 3, 'Universidad de La Guajira', 'Km 5 Vía Maicao', '3203000003', 'GUBERNAMENTAL', FALSE, TRUE),
(4, 1, 'Centro Logístico Manaure', 'Zona Industrial, Manaure', '3154000004', 'EMPRESA_ALTA_SEGURIDAD', FALSE, TRUE);

INSERT INTO ROL (id_rol, nombre, descripcion, permisos) VALUES
(1, 'Administrador', 'Control total del establecimiento', '["dashboard","usuarios","catalogos","reportes","camaras","accesos","puede_editar","puede_eliminar"]'),
(2, 'Vigilante', 'Operador de garita o portería', '["dashboard","camaras","accesos"]'),
(3, 'Supervisor', 'Auditoría y reportes', '["dashboard","reportes","camaras","accesos"]'),
(4, 'Super Admin', 'Administración global de la plataforma y del RBAC', '["dashboard","accesos","camaras","mi_qr","usuarios","roles","recursos","catalogos","reportes","seguridad","puede_editar","puede_eliminar"]'),
(5, 'Residente', 'Consulta su QR y administra invitaciones de visitantes', '["mi_qr"]');

-- Catálogo RBAC: 10 módulos + 3 acciones. `es_sistema` protege las claves base.
INSERT INTO RECURSO (id_recurso, clave, nombre, descripcion, grupo, tipo, estado, orden, es_sistema) VALUES
(1, 'dashboard', 'Dashboard', 'Resumen operativo y métricas del establecimiento.', 'General', 'modulo', TRUE, 10, TRUE),
(2, 'accesos', 'Control de acceso', 'Registrar y consultar ingresos, salidas e incidencias.', 'Operación', 'modulo', TRUE, 20, TRUE),
(3, 'camaras', 'Cámaras', 'Captura y reconocimiento de placas con LPR/IA.', 'Operación', 'modulo', TRUE, 30, TRUE),
(4, 'mi_qr', 'Mi QR e invitados', 'QR temporal de residente e invitaciones de visitantes.', 'Operación', 'modulo', TRUE, 40, TRUE),
(5, 'usuarios', 'Usuarios', 'Consultar, crear y actualizar las cuentas del establecimiento.', 'Administración', 'modulo', TRUE, 50, TRUE),
(6, 'roles', 'Roles y permisos', 'Definir los recursos globales de los roles.', 'Administración', 'modulo', TRUE, 60, TRUE),
(7, 'recursos', 'Recursos', 'Administrar el catálogo de módulos y acciones del RBAC.', 'Administración', 'modulo', TRUE, 70, TRUE),
(8, 'catalogos', 'Catálogo', 'Planes, establecimientos, vehículos y responsables.', 'Administración', 'modulo', TRUE, 80, TRUE),
(9, 'reportes', 'Reportes', 'Historial de movimientos, incidencias y reconocimientos.', 'Administración', 'modulo', TRUE, 90, TRUE),
(10, 'seguridad', 'Seguridad', 'Panel de seguridad, auditoría y estado del sistema.', 'Sistema', 'modulo', TRUE, 100, TRUE),
(11, 'puede_editar', 'Permiso de edición', 'Habilita cambios sobre la configuración y los registros administrativos.', 'Políticas de escritura', 'accion', TRUE, 110, TRUE),
(12, 'puede_eliminar', 'Permiso de eliminación', 'Habilita operaciones destructivas sobre registros.', 'Políticas de escritura', 'accion', TRUE, 120, TRUE),
(13, 'solo_lectura', 'Solo lectura', 'Prevalece sobre edición y eliminación; bloquea toda escritura.', 'Políticas de escritura', 'accion', TRUE, 130, TRUE);

-- Super Admin = 12 recursos (todos los módulos + edición/eliminación).
-- Administrador = 8 · Supervisor = 4 · Vigilante = 3 · Residente = 1.
INSERT INTO ROL_HAS_RECURSO (id_rol, id_recurso) VALUES
(4, 1), (4, 2), (4, 3), (4, 4), (4, 5), (4, 6), (4, 7), (4, 8), (4, 9), (4, 10), (4, 11), (4, 12),
(1, 1), (1, 2), (1, 3), (1, 5), (1, 8), (1, 9), (1, 11), (1, 12),
(3, 1), (3, 2), (3, 3), (3, 9),
(2, 1), (2, 2), (2, 3),
(5, 4);

INSERT INTO USUARIO (id_usuario, id_establecimiento, id_rol, nombre, correo, password_hash) VALUES
(1, 1, 1, 'Carlos Admin Pinos', 'admin@pinos.com', 'pbkdf2_sha256$1000000$d4UZo1hiDlHsWRKAoa6xGs$p8IU4ad5WqrDWP8aFlpalpXGjJBJJ07NaXPI8p0Gk4I='),
(2, 1, 2, 'Jose Vigilante Pinos', 'vigilante@pinos.com', 'pbkdf2_sha256$1000000$d4UZo1hiDlHsWRKAoa6xGs$p8IU4ad5WqrDWP8aFlpalpXGjJBJJ07NaXPI8p0Gk4I='),
(3, 1, 2, 'Luis Vigilante Pinos', 'vigilante2@pinos.com', 'pbkdf2_sha256$1000000$d4UZo1hiDlHsWRKAoa6xGs$p8IU4ad5WqrDWP8aFlpalpXGjJBJJ07NaXPI8p0Gk4I='),
(4, 2, 1, 'Ana Admin Norte', 'admin@norte.com', 'pbkdf2_sha256$1000000$d4UZo1hiDlHsWRKAoa6xGs$p8IU4ad5WqrDWP8aFlpalpXGjJBJJ07NaXPI8p0Gk4I='),
(5, 2, 2, 'Pedro Vigilante Norte', 'vigilante@norte.com', 'pbkdf2_sha256$1000000$d4UZo1hiDlHsWRKAoa6xGs$p8IU4ad5WqrDWP8aFlpalpXGjJBJJ07NaXPI8p0Gk4I='),
(6, 3, 1, 'Rector Admin Uniguajira', 'admin@uniguajira.edu.co', 'pbkdf2_sha256$1000000$d4UZo1hiDlHsWRKAoa6xGs$p8IU4ad5WqrDWP8aFlpalpXGjJBJJ07NaXPI8p0Gk4I='),
(7, 3, 2, 'Mario Vigilante Uniguajira', 'porteria@uniguajira.edu.co', 'pbkdf2_sha256$1000000$d4UZo1hiDlHsWRKAoa6xGs$p8IU4ad5WqrDWP8aFlpalpXGjJBJJ07NaXPI8p0Gk4I='),
(8, 3, 3, 'Sofia Supervisora', 'supervision@uniguajira.edu.co', 'pbkdf2_sha256$1000000$d4UZo1hiDlHsWRKAoa6xGs$p8IU4ad5WqrDWP8aFlpalpXGjJBJJ07NaXPI8p0Gk4I='),
(9, 4, 1, 'Juan Admin Logístico', 'admin@logistico.com', 'pbkdf2_sha256$1000000$d4UZo1hiDlHsWRKAoa6xGs$p8IU4ad5WqrDWP8aFlpalpXGjJBJJ07NaXPI8p0Gk4I='),
(10, 4, 2, 'Diego Vigilante Logístico', 'porteria@logistico.com', 'pbkdf2_sha256$1000000$d4UZo1hiDlHsWRKAoa6xGs$p8IU4ad5WqrDWP8aFlpalpXGjJBJJ07NaXPI8p0Gk4I='),
(11, 1, 4, 'admin', 'admin@heimdall.tech', 'pbkdf2_sha256$1000000$d4UZo1hiDlHsWRKAoa6xGs$p8IU4ad5WqrDWP8aFlpalpXGjJBJJ07NaXPI8p0Gk4I='),
(12, 1, 4, 'rastor36', 'rastor36@heimdall.tech', 'pbkdf2_sha256$1000000$d4UZo1hiDlHsWRKAoa6xGs$p8IU4ad5WqrDWP8aFlpalpXGjJBJJ07NaXPI8p0Gk4I=');

-- Cada usuario conserva su rol principal como primera asignación de la tabla puente.
INSERT INTO USUARIO_HAS_ROL (id_usuario, id_rol) VALUES
(1, 1), (2, 2), (3, 2), (4, 1), (5, 2), (6, 1),
(7, 2), (8, 3), (9, 1), (10, 2), (11, 4), (12, 4);

INSERT INTO RESPONSABLE (id_responsable, id_establecimiento, documento_identidad, nombre, telefono) VALUES
(1, 1, '1001001', 'Maria Gomez', '3001112233'),
(2, 1, '1001002', 'Alberto Ruiz', '3001112234'),
(3, 1, '1001003', 'Carmen Lopez', '3001112235'),
(4, 1, '1001004', 'Jorge Perez', '3001112236'),
(5, 1, '1001005', 'Luisa Martinez', '3001112237'),
(6, 2, '2002001', 'Roberto Sanchez', '3102223344'),
(7, 2, '2002002', 'Diana Torres', '3102223345'),
(8, 2, '2002003', 'Andres Ramirez', '3102223346'),
(9, 2, '2002004', 'Patricia Diaz', '3102223347'),
(10, 2, '2002005', 'Fernando Castro', '3102223348'),
(11, 3, '3003001', 'Docente Manuel', '3203334455'),
(12, 3, '3003002', 'Docente Sara', '3203334456'),
(13, 3, '3003003', 'Estudiante Juan', '3203334457'),
(14, 3, '3003004', 'Estudiante Kevin', '3203334458'),
(15, 3, '3003005', 'Administrativo Rosa', '3203334459'),
(16, 4, '4004001', 'Conductor Hector', '3154445566'),
(17, 4, '4004002', 'Conductor Ivan', '3154445567'),
(18, 4, '4004003', 'Proveedor Laura', '3154445568'),
(19, 4, '4004004', 'Gerente Martin', '3154445569'),
(20, 4, '4004005', 'Asistente Paola', '3154445570');

INSERT INTO VEHICULO (id_vehiculo, id_establecimiento, id_responsable, placa, marca, color, tipo_autorizacion) VALUES
(1, 1, 1, 'AAA-111', 'Toyota', 'Blanco', 'AUTORIZADO'),
(2, 1, 2, 'BBB-222', 'Mazda', 'Rojo', 'AUTORIZADO'),
(3, 1, 3, 'CCC-333', 'Chevrolet', 'Negro', 'AUTORIZADO'),
(4, 1, 4, 'DDD-444', 'Renault', 'Gris', 'RESTRINGIDO'),
(5, 1, 5, 'EEE-555', 'Kia', 'Azul', 'AUTORIZADO'),
(6, 2, 6, 'FFF-666', 'Ford', 'Plata', 'AUTORIZADO'),
(7, 2, 7, 'GGG-777', 'Nissan', 'Blanco', 'AUTORIZADO'),
(8, 2, 8, 'HHH-888', 'Hyundai', 'Negro', 'VISITANTE'),
(9, 2, 9, 'III-999', 'Volkswagen', 'Rojo', 'AUTORIZADO'),
(10, 2, 10, 'JJJ-000', 'Honda', 'Gris', 'AUTORIZADO'),
(11, 3, 11, 'KKK-111', 'BMW', 'Negro', 'AUTORIZADO'),
(12, 3, 12, 'LLL-222', 'Audi', 'Blanco', 'AUTORIZADO'),
(13, 3, 13, 'MMM-333', 'Suzuki', 'Rojo', 'AUTORIZADO'),
(14, 3, 14, 'NNN-444', 'Yamaha', 'Azul', 'AUTORIZADO'),
(15, 3, 15, 'OOO-555', 'Ducati', 'Rojo', 'RESTRINGIDO'),
(16, 4, 16, 'PPP-666', 'Hino', 'Blanco', 'AUTORIZADO'),
(17, 4, 17, 'QQQ-777', 'Kenworth', 'Rojo', 'AUTORIZADO'),
(18, 4, 18, 'RRR-888', 'Freightliner', 'Azul', 'VISITANTE'),
(19, 4, 19, 'SSS-999', 'Volvo', 'Gris', 'AUTORIZADO'),
(20, 4, 20, 'TTT-000', 'Mercedes', 'Plata', 'AUTORIZADO');

INSERT INTO MOVIMIENTO (
    id_movimiento, id_establecimiento, id_vehiculo, id_usuario, placa_leida,
    tipo_movimiento, fecha_evento, id_dispositivo, observacion,
    estado_sincronizacion, fecha_sincronizacion
) VALUES
(1, 1, 1, 2, 'AAA-111', 'INGRESO', '2026-10-02 08:00:00', 'MOVIL-01', 'Ingreso normal', 'SINCRONIZADO', '2026-10-02 08:00:05'),
(2, 1, 2, 2, 'BBB-222', 'INGRESO', '2026-10-02 08:15:00', 'MOVIL-01', 'Ingreso normal', 'SINCRONIZADO', '2026-10-02 08:15:05'),
(3, 1, 1, 2, 'AAA-111', 'SALIDA', '2026-10-02 09:30:00', 'MOVIL-01', 'Salida normal', 'SINCRONIZADO', '2026-10-02 09:30:05'),
(4, 1, NULL, 3, 'XYZ-123', 'INGRESO', '2026-10-02 10:00:00', 'MOVIL-02', 'Visitante sin registro previo', 'SINCRONIZADO', '2026-10-02 10:00:05'),
(5, 2, 6, 5, 'FFF-666', 'INGRESO', '2026-10-02 07:45:00', 'MOVIL-03', 'Ingreso empleado', 'SINCRONIZADO', '2026-10-02 07:45:05'),
(6, 2, 7, 5, 'GGG-777', 'INGRESO', '2026-10-02 07:50:00', 'MOVIL-03', 'Ingreso empleado', 'SINCRONIZADO', '2026-10-02 07:50:05'),
(7, 2, 8, 5, 'HHH-888', 'INGRESO', '2026-10-02 11:00:00', 'MOVIL-03', 'Ingreso visitante edificio', 'SINCRONIZADO', '2026-10-02 11:00:05'),
(8, 2, 6, 5, 'FFF-666', 'SALIDA', '2026-10-02 17:00:00', 'MOVIL-03', 'Salida turno', 'PENDIENTE', NULL),
(9, 3, 11, 7, 'KKK-111', 'INGRESO', '2026-10-02 06:30:00', 'CAM-01', 'Ingreso docente', 'SINCRONIZADO', '2026-10-02 06:30:05'),
(10, 3, 12, 7, 'LLL-222', 'INGRESO', '2026-10-02 06:45:00', 'CAM-01', 'Ingreso docente', 'SINCRONIZADO', '2026-10-02 06:45:05'),
(11, 3, 13, 7, 'MMM-333', 'INGRESO', '2026-10-02 07:15:00', 'CAM-01', 'Ingreso estudiante', 'SINCRONIZADO', '2026-10-02 07:15:05'),
(12, 3, 14, 7, 'NNN-444', 'INGRESO', '2026-10-02 07:20:00', 'CAM-01', 'Ingreso estudiante', 'SINCRONIZADO', '2026-10-02 07:20:05'),
(13, 3, 11, 7, 'KKK-111', 'SALIDA', '2026-10-02 12:00:00', 'CAM-01', 'Salida docente', 'SINCRONIZADO', '2026-10-02 12:00:05'),
(14, 3, NULL, 7, 'WWW-999', 'INGRESO', '2026-10-02 14:00:00', 'MOVIL-04', 'Taxi dejando pasajero', 'PENDIENTE', NULL),
(15, 3, NULL, 7, 'WWW-999', 'SALIDA', '2026-10-02 14:05:00', 'MOVIL-04', 'Salida de taxi', 'PENDIENTE', NULL),
(16, 4, 16, 10, 'PPP-666', 'INGRESO', '2026-10-02 05:00:00', 'MOVIL-05', 'Ingreso carga', 'SINCRONIZADO', '2026-10-02 05:00:05'),
(17, 4, 17, 10, 'QQQ-777', 'INGRESO', '2026-10-02 05:30:00', 'MOVIL-05', 'Ingreso carga', 'SINCRONIZADO', '2026-10-02 05:30:05'),
(18, 4, 16, 10, 'PPP-666', 'SALIDA', '2026-10-02 10:00:00', 'MOVIL-05', 'Carga descargada', 'SINCRONIZADO', '2026-10-02 10:00:05'),
(19, 4, 18, 10, 'RRR-888', 'INGRESO', '2026-10-02 11:30:00', 'MOVIL-05', 'Proveedor logístico', 'SINCRONIZADO', '2026-10-02 11:30:05'),
(20, 4, 19, 10, 'SSS-999', 'INGRESO', '2026-10-02 08:00:00', 'MOVIL-05', 'Gerencia', 'SINCRONIZADO', '2026-10-02 08:00:05'),
(21, 1, 3, 3, 'CCC-333', 'INGRESO', '2026-10-02 15:00:00', 'MOVIL-02', 'Ingreso normal', 'SINCRONIZADO', '2026-10-02 15:00:05'),
(22, 1, 5, 2, 'EEE-555', 'INGRESO', '2026-10-02 15:30:00', 'MOVIL-01', 'App offline temporal', 'PENDIENTE', NULL),
(23, 2, 9, 5, 'III-999', 'INGRESO', '2026-10-02 13:00:00', 'MOVIL-03', 'Ingreso tarde', 'SINCRONIZADO', '2026-10-02 13:00:05'),
(24, 2, 10, 5, 'JJJ-000', 'INGRESO', '2026-10-02 13:15:00', 'MOVIL-03', 'Ingreso tarde', 'SINCRONIZADO', '2026-10-02 13:15:05'),
(25, 2, 9, 5, 'III-999', 'SALIDA', '2026-10-02 18:00:00', 'MOVIL-03', 'Sin internet en salida', 'PENDIENTE', NULL),
(26, 4, 17, 10, 'QQQ-777', 'SALIDA', '2026-10-02 16:00:00', 'MOVIL-05', 'Carga lista', 'SINCRONIZADO', '2026-10-02 16:00:05'),
(27, 4, 20, 10, 'TTT-000', 'INGRESO', '2026-10-02 09:00:00', 'MOVIL-05', 'Asistente ingreso', 'SINCRONIZADO', '2026-10-02 09:00:05'),
(28, 4, 20, 10, 'TTT-000', 'SALIDA', '2026-10-02 17:30:00', 'MOVIL-05', 'Asistente salida', 'SINCRONIZADO', '2026-10-02 17:30:05'),
(29, 1, 2, 2, 'BBB-222', 'SALIDA', '2026-10-02 19:00:00', 'MOVIL-01', 'Salida noche', 'SINCRONIZADO', '2026-10-02 19:00:05'),
(30, 3, 13, 7, 'MMM-333', 'SALIDA', '2026-10-02 18:30:00', 'CAM-01', 'Estudiante sale', 'SINCRONIZADO', '2026-10-02 18:30:05');

INSERT INTO RECONOCIMIENTO_PLACA (
    id_reconocimiento, id_establecimiento, id_movimiento, id_usuario, id_dispositivo,
    url_fotografia, placa_detectada, nivel_confianza, resultado_ia, fecha_procesamiento
) VALUES
(1, 3, 9, 7, 'CAM-01', '/img/placas/foto_001.jpg', 'KKK-111', 98.50, 'COINCIDE', '2026-10-02 06:29:55'),
(2, 3, 10, 7, 'CAM-01', '/img/placas/foto_002.jpg', 'LLL-222', 95.00, 'COINCIDE', '2026-10-02 06:44:55'),
(3, 3, 11, 7, 'CAM-01', '/img/placas/foto_003.jpg', 'MMM-333', 99.10, 'COINCIDE', '2026-10-02 07:14:58'),
(4, 3, 12, 7, 'CAM-01', '/img/placas/foto_004.jpg', 'NNN-444', 97.20, 'COINCIDE', '2026-10-02 07:19:50'),
(5, 3, NULL, 7, 'CAM-01', '/img/placas/foto_err.jpg', 'OOO-555', 85.00, 'ALERTA', '2026-10-02 09:00:00');

INSERT INTO INCIDENCIA (
    id_incidencia, id_establecimiento, id_vehiculo, id_usuario,
    titulo, descripcion, nivel_prioridad, fecha_incidencia
) VALUES
(1, 1, 4, 2, 'Intento acceso restringido', 'El vehículo DDD-444 intentó ingresar pero está bloqueado por administración.', 'ALTA', '2026-10-02 08:30:00'),
(2, 3, 15, 7, 'Alerta LPR', 'La cámara detectó la placa OOO-555 con reporte de restricción en la universidad.', 'CRITICA', '2026-10-02 09:00:05'),
(3, 2, NULL, 5, 'Falla de talanquera', 'La talanquera de salida quedó atascada; operación manual temporal.', 'MEDIA', '2026-10-02 12:00:00'),
(4, 2, 8, 5, 'Visitante excedió tiempo', 'El vehículo HHH-888 lleva más de 6 horas en parqueadero de visitantes.', 'MEDIA', '2026-10-02 17:00:00'),
(5, 4, NULL, 10, 'Corte de internet', 'Pérdida de conexión en el centro logístico; modo offline activo.', 'ALTA', '2026-10-02 14:00:00');
