from rest_framework import serializers

from .models import Rol, Usuario


class RolSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rol
        fields = ("id_rol", "nombre", "descripcion")


class UsuarioResumenSerializer(serializers.ModelSerializer):
    """Vista anidada: no expone credenciales ni datos sensibles."""

    class Meta:
        model = Usuario
        fields = ("id_usuario", "nombre", "correo", "estado")


class UsuarioSerializer(serializers.ModelSerializer):
    rol = RolSerializer(source="id_rol", read_only=True)

    class Meta:
        model = Usuario
        fields = (
            "id_usuario",
            "id_establecimiento",
            "id_rol",
            "rol",
            "nombre",
            "correo",
            "estado",
            "fecha_creacion",
        )
        # password_hash nunca se serializa hacia el cliente (seguridad).
