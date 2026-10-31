from django.db import models


class Plan(models.Model):
    class PoliticaExcedente(models.TextChoices):
        COBRO = "COBRO", "Cobro extra automático"
        BLOQUEO = "BLOQUEO", "Bloquear y exigir upgrade"

    id_plan = models.AutoField(primary_key=True, db_column="id_plan")
    nombre = models.CharField(max_length=50, unique=True)
    descripcion = models.TextField(blank=True, null=True)
    precio = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    limite_usuarios = models.IntegerField(default=5)
    cupo_residentes = models.IntegerField(default=170)
    precio_excedente = models.DecimalField(max_digits=10, decimal_places=2, default=0.75)
    politica_excedente = models.CharField(
        max_length=10,
        choices=PoliticaExcedente.choices,
        default=PoliticaExcedente.COBRO,
    )
    permite_ia = models.BooleanField(default=False)
    estado = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "PLAN"
        managed = False

    def __str__(self):
        return self.nombre


class Establecimiento(models.Model):
    class TipoEntidad(models.TextChoices):
        RESIDENCIAL = "RESIDENCIAL", "Conjunto residencial"
        GUBERNAMENTAL = "GUBERNAMENTAL", "Oficina de gobierno"
        EMPRESA_ALTA_SEGURIDAD = "EMPRESA_ALTA_SEGURIDAD", "Empresa de alta seguridad"

    id_establecimiento = models.AutoField(primary_key=True, db_column="id_establecimiento")
    id_plan = models.ForeignKey(
        Plan,
        on_delete=models.RESTRICT,
        db_column="id_plan",
        related_name="establecimientos",
    )
    nombre = models.CharField(max_length=100)
    direccion = models.CharField(max_length=200)
    telefono = models.CharField(max_length=20, blank=True, null=True)
    tipo_entidad = models.CharField(
        max_length=30,
        choices=TipoEntidad.choices,
        default=TipoEntidad.RESIDENCIAL,
    )
    permite_invitaciones_residente = models.BooleanField(default=True)
    estado = models.BooleanField(default=True)
    fecha_registro = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ESTABLECIMIENTO"
        managed = False
        ordering = ["id_establecimiento"]

    def __str__(self):
        return self.nombre
