from django.db import models

from app_empresas.models import Establecimiento


class Rol(models.Model):
    id_rol = models.AutoField(primary_key=True, db_column="id_rol")
    nombre = models.CharField(max_length=50, unique=True)
    descripcion = models.CharField(max_length=150, blank=True, null=True)
    permisos = models.JSONField(default=list, blank=True, null=True)

    class Meta:
        db_table = "ROL"
        managed = False

    def __str__(self):
        return self.nombre


class Recurso(models.Model):
    class Tipo(models.TextChoices):
        MODULO = "modulo", "Módulo"
        ACCION = "accion", "Acción"

    id_recurso = models.AutoField(primary_key=True, db_column="id_recurso")
    clave = models.CharField(max_length=50, unique=True)
    nombre = models.CharField(max_length=100)
    descripcion = models.CharField(max_length=200, blank=True, null=True)
    grupo = models.CharField(max_length=50, default="General")
    tipo = models.CharField(
        max_length=10,
        choices=Tipo.choices,
        default=Tipo.MODULO,
    )
    estado = models.BooleanField(default=True)
    orden = models.IntegerField(default=0)
    es_sistema = models.BooleanField(default=False)

    class Meta:
        db_table = "RECURSO"
        managed = False
        ordering = ["orden", "id_recurso"]

    def __str__(self):
        return f"{self.clave} · {self.nombre}"


class UsuarioHasRol(models.Model):
    id_usuario_has_rol = models.BigAutoField(primary_key=True, db_column="id_usuario_has_rol")
    id_usuario = models.ForeignKey(
        "Usuario",
        on_delete=models.CASCADE,
        db_column="id_usuario",
        related_name="roles_asignados",
    )
    id_rol = models.ForeignKey(
        Rol,
        on_delete=models.CASCADE,
        db_column="id_rol",
        related_name="usuario_asignaciones",
    )
    fecha_asignacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "USUARIO_HAS_ROL"
        managed = False
        unique_together = (("id_usuario", "id_rol"),)
        ordering = ["id_usuario_has_rol"]

    def __str__(self):
        return f"Usuario {self.id_usuario_id} → Rol {self.id_rol_id}"


class RolHasRecurso(models.Model):
    id_rol_has_recurso = models.BigAutoField(primary_key=True, db_column="id_rol_has_recurso")
    id_rol = models.ForeignKey(
        Rol,
        on_delete=models.CASCADE,
        db_column="id_rol",
        related_name="recursos_asignados",
    )
    id_recurso = models.ForeignKey(
        Recurso,
        on_delete=models.CASCADE,
        db_column="id_recurso",
        related_name="roles_asignados",
    )

    class Meta:
        db_table = "ROL_HAS_RECURSO"
        managed = False
        unique_together = (("id_rol", "id_recurso"),)
        ordering = ["id_rol_has_recurso"]

    def __str__(self):
        return f"Rol {self.id_rol_id} → Recurso {self.id_recurso_id}"


class Usuario(models.Model):
    id_usuario = models.AutoField(primary_key=True, db_column="id_usuario")
    id_establecimiento = models.ForeignKey(
        Establecimiento,
        on_delete=models.CASCADE,
        db_column="id_establecimiento",
        related_name="usuarios",
    )
    id_rol = models.ForeignKey(Rol, on_delete=models.RESTRICT, db_column="id_rol", related_name="usuarios")
    nombre = models.CharField(max_length=100)
    correo = models.EmailField(max_length=100)
    password_hash = models.CharField(max_length=255)
    estado = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    permisos_excepciones = models.JSONField(default=dict, blank=True, null=True)

    class Meta:
        db_table = "USUARIO"
        managed = False
        unique_together = (("id_establecimiento", "correo"),)
        ordering = ["id_usuario"]

    def __str__(self):
        return self.correo


class AuditLog(models.Model):
    """Registro de auditoría de acciones de usuarios en el sistema.

    El Super Admin puede consultar qué hace cada usuario (admin de
    establecimiento, supervisor, vigilante, residente/trabajador) y tener
    una constancia de la actividad en el sistema.
    """

    class Accion(models.TextChoices):
        LOGIN = "LOGIN", "Inicio de sesión"
        LOGOUT = "LOGOUT", "Cierre de sesión"
        CREATE = "CREATE", "Creación"
        UPDATE = "UPDATE", "Actualización"
        DELETE = "DELETE", "Eliminación"
        INVITE = "INVITE", "Invitación de visitante"
        QR_GENERATE = "QR_GENERATE", "Generación de QR"
        PASSWORD_CHANGE = "PASSWORD_CHANGE", "Cambio de contraseña"
        ROLE_ASSIGN = "ROLE_ASSIGN", "Asignación de rol"

    id_auditoria = models.BigAutoField(primary_key=True, db_column="id_auditoria")
    id_usuario = models.ForeignKey(
        "Usuario",
        on_delete=models.SET_NULL,
        db_column="id_usuario",
        related_name="audit_logs",
        null=True,
        blank=True,
    )
    accion = models.CharField(max_length=20, choices=Accion.choices)
    recurso_afectado = models.CharField(max_length=100, blank=True, null=True)
    descripcion = models.TextField(blank=True, null=True)
    ip_origen = models.GenericIPAddressField(null=True, blank=True)
    fecha = models.DateTimeField(auto_now_add=True)
    origen_permiso = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        help_text="Módulo o acción que originó el evento (ej. 'recursos', 'roles', 'excepcion').",
    )

    class Meta:
        db_table = "AUDIT_LOG"
        managed = False
        ordering = ["-fecha"]
        indexes = [
            models.Index(fields=["-fecha"], name="audit_fecha_idx"),
            models.Index(fields=["id_usuario_id", "-fecha"], name="audit_usuario_fecha_idx"),
        ]

    def __str__(self):
        return f"{self.accion} · {self.id_usuario_id or 'sistema'} · {self.fecha}"
