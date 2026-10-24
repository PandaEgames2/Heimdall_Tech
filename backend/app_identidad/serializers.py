from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.db import transaction
from rest_framework import serializers

from config.tenant_utils import RESIDENTE_ROL_ID, SUPER_ADMIN_ROL_ID, get_usuario_perfil, is_platform_superadmin

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
    residente_documento = serializers.CharField(write_only=True, required=False, allow_blank=True)
    residente_telefono = serializers.CharField(write_only=True, required=False, allow_blank=True)
    residente_unidad = serializers.CharField(write_only=True, required=False, allow_blank=True)

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
            "residente_documento",
            "residente_telefono",
            "residente_unidad",
            "estado",
            "fecha_creacion",
        )

    def validate_correo(self, value):
        normalized = (value or "").strip().lower()
        if not normalized:
            raise serializers.ValidationError("El correo es obligatorio.")
        profiles = Usuario.objects.filter(correo__iexact=normalized)
        if self.instance is not None:
            profiles = profiles.exclude(pk=self.instance.pk)
        if profiles.exists():
            raise serializers.ValidationError("El correo ya está asociado a otro usuario.")
        django_users = User.objects.filter(username__iexact=normalized)
        if self.instance is not None:
            django_users = django_users.exclude(email__iexact=self.instance.correo)
        if django_users.exists():
            raise serializers.ValidationError("El correo ya está asociado a una cuenta de acceso.")
        return normalized

    def validate(self, attrs):
        request = self.context.get("request")
        password = attrs.get("password")
        if self.instance is None and not password:
            raise serializers.ValidationError({"password": "La contraseña es obligatoria."})
        if password and len(password) < 8:
            raise serializers.ValidationError({"password": "Usa una contraseña de al menos 8 caracteres."})
        id_rol = attrs.get("id_rol", getattr(self.instance, "id_rol", None))
        rol_id = getattr(id_rol, "id_rol", id_rol)
        platform_admin = is_platform_superadmin(request.user if request else None)
        role_is_unchanged = self.instance is not None and rol_id == self.instance.id_rol_id
        if not platform_admin and rol_id not in (2, 3, RESIDENTE_ROL_ID) and not role_is_unchanged:
            raise serializers.ValidationError(
                {"id_rol": "Solo un Super Admin puede asignar el rol Administrador o Super Admin. El administrador del establecimiento puede crear supervisores, vigilantes y residentes."}
            )
        if not platform_admin:
            profile = get_usuario_perfil(request.user if request else None)
            target_establishment = attrs.get("id_establecimiento", getattr(self.instance, "id_establecimiento", None))
            if profile and target_establishment and target_establishment.pk != profile.id_establecimiento_id:
                raise serializers.ValidationError({"id_establecimiento": "Solo puedes gestionar usuarios de tu establecimiento."})
        if (
            rol_id == RESIDENTE_ROL_ID
            and (self.instance is None or self.instance.id_rol_id != RESIDENTE_ROL_ID)
            and not (attrs.get("residente_documento") or "").strip()
        ):
            raise serializers.ValidationError({"residente_documento": "El documento es obligatorio para registrar un residente."})
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        resident_document = validated_data.pop("residente_documento", "").strip()
        resident_phone = validated_data.pop("residente_telefono", "").strip()
        resident_unit = validated_data.pop("residente_unidad", "").strip()
        with transaction.atomic():
            usuario = super().create(validated_data)
            if password:
                usuario.password_hash = make_password(password)
                usuario.save(update_fields=["password_hash"])

            django_user, _ = User.objects.get_or_create(
                username=(usuario.correo or "").strip().lower(),
                defaults={
                    "email": (usuario.correo or "").strip().lower(),
                    "first_name": usuario.nombre.split()[0] if usuario.nombre else "",
                    "last_name": " ".join(usuario.nombre.split()[1:]) if usuario.nombre else "",
                    "is_active": bool(usuario.estado),
                    "is_staff": bool(usuario.id_rol_id == SUPER_ADMIN_ROL_ID),
                    "is_superuser": bool(usuario.id_rol_id == SUPER_ADMIN_ROL_ID),
                },
            )
            django_user.email = (usuario.correo or "").strip().lower()
            django_user.first_name = usuario.nombre.split()[0] if usuario.nombre else ""
            django_user.last_name = " ".join(usuario.nombre.split()[1:]) if usuario.nombre else ""
            django_user.is_active = bool(usuario.estado)
            django_user.is_staff = bool(usuario.id_rol_id == SUPER_ADMIN_ROL_ID)
            django_user.is_superuser = bool(usuario.id_rol_id == SUPER_ADMIN_ROL_ID)
            if password:
                django_user.set_password(password)
            django_user.save(update_fields=[
                "email", "first_name", "last_name", "is_active", "is_staff", "is_superuser", "password",
            ])

            if usuario.id_rol_id == RESIDENTE_ROL_ID:
                from app_operaciones.models import Responsable

                Responsable.objects.update_or_create(
                    id_establecimiento=usuario.id_establecimiento,
                    documento_identidad=resident_document,
                    defaults={
                        "nombre": usuario.nombre,
                        "telefono": resident_phone or None,
                        "correo": usuario.correo,
                        "departamento_unidad": resident_unit or None,
                    },
                )
        return usuario

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        previous_email = instance.correo
        usuario = super().update(instance, validated_data)
        django_user = User.objects.filter(username__iexact=previous_email).first()
        if django_user is not None:
            django_user.username = usuario.correo.lower()
            django_user.email = usuario.correo.lower()
            django_user.first_name = usuario.nombre.split()[0] if usuario.nombre else ""
            django_user.last_name = " ".join(usuario.nombre.split()[1:]) if usuario.nombre else ""
            django_user.is_active = bool(usuario.estado)
            django_user.is_staff = bool(usuario.id_rol_id == SUPER_ADMIN_ROL_ID)
            django_user.is_superuser = bool(usuario.id_rol_id == SUPER_ADMIN_ROL_ID)
        if password:
            usuario.password_hash = make_password(password)
            usuario.save(update_fields=["password_hash"])
            if django_user is not None:
                django_user.set_password(password)
        if django_user is not None:
            django_user.save(update_fields=[
                "username", "email", "first_name", "last_name", "is_active",
                "is_staff", "is_superuser", "password",
            ])
        if usuario.id_rol_id == RESIDENTE_ROL_ID:
            from app_operaciones.models import Responsable

            Responsable.objects.filter(
                id_establecimiento=usuario.id_establecimiento,
                correo__iexact=previous_email,
            ).update(nombre=usuario.nombre, correo=usuario.correo)
        return usuario
