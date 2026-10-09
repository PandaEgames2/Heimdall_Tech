from django.db import models
from django.utils.translation import gettext_lazy as _

from app_empresas.models import Establecimiento
from app_identidad.models import Usuario
from app_operaciones.models import Movimiento


class ReconocimientoPlaca(models.Model):
    class ResultadoIA(models.TextChoices):
        COINCIDE = "COINCIDE", _("Match")
        NO_COINCIDE = "NO_COINCIDE", _("No match")
        ALERTA = "ALERTA", _("Alert")

    id_reconocimiento = models.AutoField(primary_key=True, db_column="id_reconocimiento")
    id_establecimiento = models.ForeignKey(
        Establecimiento,
        on_delete=models.CASCADE,
        db_column="id_establecimiento",
        related_name="reconocimientos",
    )
    id_movimiento = models.ForeignKey(
        Movimiento,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column="id_movimiento",
        related_name="reconocimientos",
    )
    id_dispositivo = models.CharField(max_length=100)
    id_usuario = models.ForeignKey(
        Usuario,
        on_delete=models.RESTRICT,
        db_column="id_usuario",
        related_name="reconocimientos",
    )
    url_fotografia = models.CharField(max_length=255)
    placa_detectada = models.CharField(max_length=15)
    nivel_confianza = models.DecimalField(max_digits=5, decimal_places=2)
    resultado_ia = models.CharField(max_length=15, choices=ResultadoIA.choices)
    fecha_procesamiento = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "RECONOCIMIENTO_PLACA"
        managed = False
