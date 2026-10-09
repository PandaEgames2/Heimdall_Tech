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
