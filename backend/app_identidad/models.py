from django.db import models

from app_empresas.models import Establecimiento


class Rol(models.Model):
    id_rol = models.AutoField(primary_key=True, db_column="id_rol")
    nombre = models.CharField(max_length=50, unique=True)
    descripcion = models.CharField(max_length=150, blank=True, null=True)

    class Meta:
        db_table = "ROL"
        managed = False

    def __str__(self):
        return self.nombre


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

    class Meta:
        db_table = "USUARIO"
        managed = False
        unique_together = (("id_establecimiento", "correo"),)

    def __str__(self):
        return self.correo
