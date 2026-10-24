from django.db import models
from django.utils.translation import gettext_lazy as _

from app_empresas.models import Establecimiento
from app_identidad.models import Usuario


class Responsable(models.Model):
    id_responsable = models.AutoField(primary_key=True, db_column="id_responsable")
    id_establecimiento = models.ForeignKey(
        Establecimiento,
        on_delete=models.CASCADE,
        db_column="id_establecimiento",
        related_name="responsables",
    )
    nombre = models.CharField(max_length=100)
    documento_identidad = models.CharField(max_length=20)
    telefono = models.CharField(max_length=20, blank=True, null=True)
    correo = models.EmailField(max_length=100, blank=True, null=True)
    departamento_unidad = models.CharField(max_length=50, blank=True, null=True)

    class Meta:
        db_table = "RESPONSABLE"
        managed = False
        unique_together = (("id_establecimiento", "documento_identidad"),)


class Vehiculo(models.Model):
    class TipoAutorizacion(models.TextChoices):
        AUTORIZADO = "AUTORIZADO", _("Authorized")
        VISITANTE = "VISITANTE", _("Visitor")
        RESTRINGIDO = "RESTRINGIDO", _("Restricted")

    id_vehiculo = models.AutoField(primary_key=True, db_column="id_vehiculo")
    id_establecimiento = models.ForeignKey(
        Establecimiento,
        on_delete=models.CASCADE,
        db_column="id_establecimiento",
        related_name="vehiculos",
    )
    id_responsable = models.ForeignKey(
        Responsable,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column="id_responsable",
        related_name="vehiculos",
    )
    placa = models.CharField(max_length=15)
    marca = models.CharField(max_length=50, blank=True, null=True)
    modelo = models.CharField(max_length=50, blank=True, null=True)
    color = models.CharField(max_length=30, blank=True, null=True)
    codigo_rfid = models.CharField(max_length=100, blank=True, null=True)
    tipo_autorizacion = models.CharField(
        max_length=20,
        choices=TipoAutorizacion.choices,
        default=TipoAutorizacion.VISITANTE,
    )
    fecha_registro = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "VEHICULO"
        managed = False
        unique_together = (("id_establecimiento", "placa"),)
        verbose_name = _("Vehicle")
        verbose_name_plural = _("Vehicles")


class Movimiento(models.Model):
    class TipoMovimiento(models.TextChoices):
        INGRESO = "INGRESO", _("Entry")
        SALIDA = "SALIDA", _("Exit")

    class EstadoSync(models.TextChoices):
        PENDIENTE = "PENDIENTE", _("Pending")
        SINCRONIZADO = "SINCRONIZADO", _("Synchronized")

    id_movimiento = models.AutoField(primary_key=True, db_column="id_movimiento")
    id_establecimiento = models.ForeignKey(
        Establecimiento,
        on_delete=models.CASCADE,
        db_column="id_establecimiento",
        related_name="movimientos",
    )
    id_vehiculo = models.ForeignKey(
        Vehiculo,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column="id_vehiculo",
        related_name="movimientos",
    )
    id_usuario = models.ForeignKey(
        Usuario,
        on_delete=models.RESTRICT,
        db_column="id_usuario",
        related_name="movimientos",
    )
    placa_leida = models.CharField(max_length=15)
    tipo_movimiento = models.CharField(max_length=10, choices=TipoMovimiento.choices)
    fecha_evento = models.DateTimeField()
    id_dispositivo = models.CharField(max_length=100)
    observacion = models.CharField(max_length=255, blank=True, null=True)
    estado_sincronizacion = models.CharField(
        max_length=15,
        choices=EstadoSync.choices,
        default=EstadoSync.SINCRONIZADO,
    )
    fecha_sincronizacion = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = "MOVIMIENTO"
        managed = False


class Incidencia(models.Model):
    class Prioridad(models.TextChoices):
        BAJA = "BAJA", _("Low")
        MEDIA = "MEDIA", _("Medium")
        ALTA = "ALTA", _("High")
        CRITICA = "CRITICA", _("Critical")

    id_incidencia = models.AutoField(primary_key=True, db_column="id_incidencia")
    id_establecimiento = models.ForeignKey(
        Establecimiento,
        on_delete=models.CASCADE,
        db_column="id_establecimiento",
        related_name="incidencias",
    )
    id_vehiculo = models.ForeignKey(
        Vehiculo,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column="id_vehiculo",
        related_name="incidencias",
    )
    id_usuario = models.ForeignKey(
        Usuario,
        on_delete=models.RESTRICT,
        db_column="id_usuario",
        related_name="incidencias",
    )
    id_invitacion = models.ForeignKey(
        "InvitacionVisitante",
        on_delete=models.SET_NULL,
        db_column="id_invitacion",
        related_name="incidencias",
        blank=True,
        null=True,
    )
    titulo = models.CharField(max_length=100)
    descripcion = models.TextField()
    nivel_prioridad = models.CharField(
        max_length=10,
        choices=Prioridad.choices,
        default=Prioridad.MEDIA,
    )
    fecha_incidencia = models.DateTimeField()

    class Meta:
        db_table = "INCIDENCIA"
        managed = False


class InvitacionVisitante(models.Model):
    class Estado(models.TextChoices):
        PENDIENTE = "PENDIENTE", _("Pending")
        EN_SITIO = "EN_SITIO", _("On site")
        FINALIZADA = "FINALIZADA", _("Completed")
        REVOCADA = "REVOCADA", _("Revoked")

    id_invitacion = models.BigAutoField(primary_key=True, db_column="id_invitacion")
    id_establecimiento = models.ForeignKey(
        Establecimiento,
        on_delete=models.CASCADE,
        db_column="id_establecimiento",
        related_name="invitaciones_visitantes",
    )
    id_residente = models.ForeignKey(
        Usuario,
        on_delete=models.RESTRICT,
        db_column="id_residente",
        related_name="invitaciones_visitantes",
    )
    nombre_visitante = models.CharField(max_length=100)
    documento_visitante = models.CharField(max_length=30, blank=True, null=True)
    placa_visitante = models.CharField(max_length=15, blank=True, null=True)
    motivo = models.CharField(max_length=255, blank=True, null=True)
    token_hash = models.CharField(max_length=64, unique=True)
    vigente_desde = models.DateTimeField()
    vigente_hasta = models.DateTimeField()
    estado = models.CharField(max_length=12, choices=Estado.choices, default=Estado.PENDIENTE)
    fecha_ingreso = models.DateTimeField(blank=True, null=True)
    fecha_salida = models.DateTimeField(blank=True, null=True)
    id_movimiento_ingreso = models.ForeignKey(
        Movimiento,
        on_delete=models.SET_NULL,
        db_column="id_movimiento_ingreso",
        related_name="invitaciones_ingreso",
        blank=True,
        null=True,
    )
    id_movimiento_salida = models.ForeignKey(
        Movimiento,
        on_delete=models.SET_NULL,
        db_column="id_movimiento_salida",
        related_name="invitaciones_salida",
        blank=True,
        null=True,
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "INVITACION_VISITANTE"
        managed = False
        ordering = ("-fecha_creacion",)

    def __str__(self):
        return f"{self.nombre_visitante} · {self.id_establecimiento_id} · {self.estado}"


class CodigoAccesoResidente(models.Model):
    """Código numérico temporal vinculado al mismo QR de acceso del residente."""

    id_codigo = models.AutoField(primary_key=True, db_column="id_codigo")
    id_establecimiento = models.ForeignKey(
        Establecimiento,
        on_delete=models.CASCADE,
        db_column="id_establecimiento",
    )
    id_residente = models.ForeignKey(
        Usuario,
        on_delete=models.CASCADE,
        db_column="id_residente",
    )
    id_vehiculo = models.ForeignKey(
        Vehiculo,
        on_delete=models.SET_NULL,
        db_column="id_vehiculo",
        blank=True,
        null=True,
    )
    token_hash = models.CharField(max_length=64, unique=True)
    codigo_hash = models.CharField(max_length=64)
    fecha_expiracion = models.DateTimeField()
    fecha_uso = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = "CODIGO_ACCESO_RESIDENTE"
        managed = False
