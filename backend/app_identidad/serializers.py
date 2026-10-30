from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

from config.rbac import (
    BASE_ROLE_NAMES,
    VALID_PERMISSIONS,
    get_role_permissions,
    resolve_effective_permissions,
    validate_role_permissions,
)
from config.tenant_utils import RESIDENTE_ROL_ID, SUPER_ADMIN_ROL_ID, get_usuario_perfil, is_platform_superadmin

from .models import Rol, Usuario

User = get_user_model()

MAX_PERMISSION_OVERRIDES = len(VALID_PERMISSIONS)


def _sync_django_password(django_user, usuario, password_hash=None):
    """Sincroniza `auth_user` sin repetir el hash PBKDF2 de USUARIO.

    El login de la API valida siempre ``USUARIO.password_hash``. Solo los
    Super Admin necesitan una contraseña usable en Django para el admin site;
    el resto conserva una contraseña inutilizable, lo que además impide que
    una cuenta desactivada pueda entrar por el fallback de `authenticate`.
    """

    if usuario.id_rol_id == SUPER_ADMIN_ROL_ID:
        if password_hash:
            django_user.password = password_hash
        return
    if password_hash or django_user.has_usable_password():
        django_user.set_unusable_password()


class RolSerializer(serializers.ModelSerializer):
    usuarios_count = serializers.SerializerMethodField()
    es_sistema = serializers.SerializerMethodField()

    class Meta:
        model = Rol
        fields = ("id_rol", "nombre", "descripcion", "permisos", "es_sistema", "usuarios_count")
        read_only_fields = ("id_rol", "es_sistema", "usuarios_count")

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["permisos"] = get_role_permissions(instance)
        data["es_sistema"] = instance.nombre in BASE_ROLE_NAMES
        return data

    def get_usuarios_count(self, obj):
        return obj.usuarios.count()

    def get_es_sistema(self, obj):
        return obj.nombre in BASE_ROLE_NAMES

    def validate_permisos(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Los permisos deben enviarse como una lista.")
        return value

    def validate(self, attrs):
        instance = self.instance
        role_name = attrs.get("nombre", getattr(instance, "nombre", "")) or ""
        permissions = attrs.get("permisos")

        if instance is not None and instance.nombre in BASE_ROLE_NAMES:
            if "nombre" in attrs and attrs["nombre"] != instance.nombre:
                raise serializers.ValidationError(
                    {"nombre": "Los roles base del sistema no se pueden renombrar."}
                )

        if "nombre" in attrs and not instance:
            if Rol.objects.filter(nombre__iexact=attrs["nombre"].strip()).exists():
                raise serializers.ValidationError({"nombre": "Ya existe un rol con ese nombre."})

        if permissions is not None:
            try:
                attrs["permisos"] = validate_role_permissions(permissions, role_name=role_name)
            except ValueError as exc:
                raise serializers.ValidationError({"permisos": str(exc)}) from exc

        if role_name == "Super Admin" and permissions is not None:
            required = {"dashboard", "usuarios", "roles"}
            if not required.issubset(set(attrs["permisos"])):
                raise serializers.ValidationError(
                    {"permisos": "Super Admin debe conservar dashboard, usuarios y roles."}
                )

        return attrs


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
    permisos_efectivos = serializers.SerializerMethodField()
    acciones = serializers.SerializerMethodField()

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
            "permisos_excepciones",
            "permisos_efectivos",
            "acciones",
        )

    def _request_user(self):
        request = self.context.get("request")
        return getattr(request, "user", None)

    def _platform_admin(self):
        return is_platform_superadmin(self._request_user())

    def get_permisos_efectivos(self, obj):
        access = resolve_effective_permissions(
            obj,
            is_superadmin=obj.id_rol_id == SUPER_ADMIN_ROL_ID,
        )
        return access["permisos"]

    def get_acciones(self, obj):
        access = resolve_effective_permissions(
            obj,
            is_superadmin=obj.id_rol_id == SUPER_ADMIN_ROL_ID,
        )
        return {
            "puede_editar": access["puede_editar"],
            "puede_eliminar": access["puede_eliminar"],
            "solo_lectura": access["solo_lectura"],
        }

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if not self._platform_admin():
            # Las excepciones individuales son información sensible del RBAC:
            # sólo el Super Admin puede consultarlas o modificarlas.
            data.pop("permisos_excepciones", None)
        return data

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
            django_users = django_users.exclude(pk__in=User.objects.filter(email__iexact=self.instance.correo).values("pk"))
        if django_users.exists():
            raise serializers.ValidationError("El correo ya está asociado a una cuenta de acceso.")
        return normalized

    def validate_permisos_excepciones(self, value):
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("Las excepciones deben ser un objeto JSON.")
        if len(value) > MAX_PERMISSION_OVERRIDES:
            raise serializers.ValidationError("Se enviaron demasiadas excepciones de permisos.")
        cleaned: dict[str, bool] = {}
        unknown: list[str] = []
        for key, raw in value.items():
            if key not in VALID_PERMISSIONS:
                unknown.append(str(key))
                continue
            if not isinstance(raw, bool):
                raise serializers.ValidationError(f"El permiso «{key}» debe ser verdadero o falso.")
            cleaned[key] = raw
        if unknown:
            raise serializers.ValidationError(f"Permisos desconocidos: {', '.join(sorted(unknown))}.")
        return cleaned

    def validate(self, attrs):
        request = self.context.get("request")
        request_user = self._request_user()
        password = attrs.get("password")
        if self.instance is None and not password:
            raise serializers.ValidationError({"password": "La contraseña es obligatoria."})
        if password:
            if len(password) < 8:
                raise serializers.ValidationError({"password": "Usa una contraseña de al menos 8 caracteres."})
            candidate = User(
                username=(attrs.get("correo") or getattr(self.instance, "correo", "") or "").lower(),
                email=(attrs.get("correo") or getattr(self.instance, "correo", "") or "").lower(),
                first_name=(attrs.get("nombre") or getattr(self.instance, "nombre", "") or "").split()[:1][0]
                if (attrs.get("nombre") or getattr(self.instance, "nombre", ""))
                else "",
            )
            try:
                validate_password(password, user=candidate)
            except DjangoValidationError as exc:
                raise serializers.ValidationError({"password": list(exc.messages)}) from exc

        id_rol = attrs.get("id_rol", getattr(self.instance, "id_rol", None))
        rol_id = getattr(id_rol, "id_rol", id_rol)
        platform_admin = self._platform_admin()
        if "permisos_excepciones" in attrs and not platform_admin:
            raise serializers.ValidationError(
                {"permisos_excepciones": "Solo un Super Admin puede asignar excepciones de permisos."}
            )
        role_is_unchanged = self.instance is not None and rol_id == self.instance.id_rol_id
        if not platform_admin and rol_id not in (2, 3, RESIDENTE_ROL_ID) and not role_is_unchanged:
            raise serializers.ValidationError(
                {"id_rol": "Solo un Super Admin puede asignar el rol Administrador o Super Admin. El administrador del establecimiento puede crear supervisores, vigilantes y residentes."}
            )
        if not platform_admin:
            profile = get_usuario_perfil(request_user)
            target_establishment = attrs.get("id_establecimiento", getattr(self.instance, "id_establecimiento", None))
            if profile and target_establishment and target_establishment.pk != profile.id_establecimiento_id:
                raise serializers.ValidationError({"id_establecimiento": "Solo puedes gestionar usuarios de tu establecimiento."})
            if self.instance is not None and self.instance.id_rol_id == SUPER_ADMIN_ROL_ID:
                raise serializers.ValidationError("Solo un Super Admin puede modificar una cuenta Super Admin.")
        if (
            rol_id == RESIDENTE_ROL_ID
            and (self.instance is None or self.instance.id_rol_id != RESIDENTE_ROL_ID)
            and not (attrs.get("residente_documento") or "").strip()
        ):
            raise serializers.ValidationError({"residente_documento": "El documento es obligatorio para registrar un residente."})

        # Protección del último Super Admin activo de la plataforma.
        if self.instance is not None and self.instance.id_rol_id == SUPER_ADMIN_ROL_ID:
            losing_superadmin = rol_id != SUPER_ADMIN_ROL_ID or attrs.get("estado") is False
            if losing_superadmin:
                other_active = Usuario.objects.filter(
                    id_rol_id=SUPER_ADMIN_ROL_ID,
                    estado=True,
                ).exclude(pk=self.instance.pk)
                if not other_active.exists():
                    raise serializers.ValidationError(
                        "No puedes desactivar o degradar al último Super Admin activo de la plataforma."
                    )

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
            _sync_django_password(
                django_user,
                usuario,
                usuario.password_hash if password else None,
            )
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
            _sync_django_password(
                django_user,
                usuario,
                usuario.password_hash if password else None,
            )
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
