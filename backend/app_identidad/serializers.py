from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Rol, Usuario

User = get_user_model()


class RolSerializer(serializers.ModelSerializer):
    permisos = serializers.SerializerMethodField()
    permisos_input = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        write_only=True,
    )

    class Meta:
        model = Rol
        fields = ("id_rol", "nombre", "descripcion", "permisos", "permisos_input")

    def get_permisos(self, obj):
        raw = obj.descripcion or ""
        if not raw:
            return ["dashboard"]
        try:
            import json

            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return parsed
        except (TypeError, ValueError):
            pass
        return [item.strip() for item in raw.split(",") if item.strip()] or ["dashboard"]

    def create(self, validated_data):
        permisos = validated_data.pop("permisos_input", None)
        if permisos is not None:
            validated_data["descripcion"] = __import__("json").dumps(permisos)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        permisos = validated_data.pop("permisos_input", None)
        if permisos is not None:
            validated_data["descripcion"] = __import__("json").dumps(permisos)
        return super().update(instance, validated_data)


class UsuarioResumenSerializer(serializers.ModelSerializer):
    """Vista anidada: no expone credenciales ni datos sensibles."""

    class Meta:
        model = Usuario
        fields = ("id_usuario", "nombre", "correo", "estado")


class UsuarioSerializer(serializers.ModelSerializer):
    rol = RolSerializer(source="id_rol", read_only=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=False)

    class Meta:
        model = Usuario
        fields = (
            "id_usuario",
            "id_establecimiento",
            "id_rol",
            "rol",
            "nombre",
            "correo",
            "password",
            "estado",
            "fecha_creacion",
        )

    def validate_correo(self, value):
        normalized = (value or "").strip().lower()
        if not normalized:
            raise serializers.ValidationError("El correo es obligatorio.")
        return normalized

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        usuario = super().create(validated_data)
        if password:
            usuario.password_hash = "pbkdf2_sha256$dev$" + str(password)
            usuario.save(update_fields=["password_hash"])

        django_user, _ = User.objects.get_or_create(
            username=(usuario.correo or "").strip().lower(),
            defaults={
                "email": (usuario.correo or "").strip().lower(),
                "first_name": usuario.nombre.split()[0] if usuario.nombre else "",
                "last_name": " ".join(usuario.nombre.split()[1:]) if usuario.nombre else "",
                "is_active": bool(usuario.estado),
                "is_staff": bool(usuario.id_rol_id == 1),
                "is_superuser": bool(usuario.id_rol_id == 1),
            },
        )
        django_user.email = (usuario.correo or "").strip().lower()
        django_user.first_name = usuario.nombre.split()[0] if usuario.nombre else ""
        django_user.last_name = " ".join(usuario.nombre.split()[1:]) if usuario.nombre else ""
        django_user.is_active = bool(usuario.estado)
        django_user.is_staff = bool(usuario.id_rol_id == 1)
        django_user.is_superuser = bool(usuario.id_rol_id == 1)
        if password:
            django_user.set_password(password)
        django_user.save(update_fields=[
            "email",
            "first_name",
            "last_name",
            "is_active",
            "is_staff",
            "is_superuser",
            "password",
        ])
        return usuario

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        usuario = super().update(instance, validated_data)
        if password:
            usuario.password_hash = "pbkdf2_sha256$dev$" + str(password)
            usuario.save(update_fields=["password_hash"])
            django_user = User.objects.filter(email__iexact=(usuario.correo or "").strip().lower()).first()
            if django_user is not None:
                django_user.set_password(password)
                django_user.save(update_fields=["password"])
        return usuario
