from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import Usuario

User = get_user_model()


def _resolve_dev_password(hash_value):
    if not hash_value:
        return ""
    value = str(hash_value).strip()
    if "$" in value:
        return value.rsplit("$", 1)[-1]
    return value


def _ensure_django_user_from_usuario(usuario, password):
    username = (usuario.correo or "").strip().lower()
    user, created = User.objects.get_or_create(
        username=username,
        defaults={
            "email": usuario.correo.lower(),
            "first_name": usuario.nombre.split()[0] if usuario.nombre else "",
            "last_name": " ".join(usuario.nombre.split()[1:]) if usuario.nombre else "",
            "is_active": bool(usuario.estado),
            "is_staff": bool(usuario.id_rol_id == 1),
            "is_superuser": bool(usuario.id_rol_id == 1),
        },
    )

    if created or not user.has_usable_password():
        user.email = usuario.correo.lower()
        user.first_name = usuario.nombre.split()[0] if usuario.nombre else ""
        user.last_name = " ".join(usuario.nombre.split()[1:]) if usuario.nombre else ""
        user.is_active = bool(usuario.estado)
        user.is_staff = bool(usuario.id_rol_id == 1)
        user.is_superuser = bool(usuario.id_rol_id == 1)
        user.set_password(password)
        user.save(update_fields=[
            "email",
            "first_name",
            "last_name",
            "is_active",
            "is_staff",
            "is_superuser",
            "password",
        ])

    return user


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        token["user_id"] = user.id
        token["username"] = user.username
        token["email"] = user.email
        token["is_staff"] = user.is_staff
        token["is_superuser"] = user.is_superuser

        try:
            perfil = Usuario.objects.select_related("id_rol", "id_establecimiento").filter(
                correo__iexact=user.email.lower()
            ).first()
            if perfil:
                token["id_establecimiento"] = perfil.id_establecimiento_id
                token["rol"] = perfil.id_rol.nombre if perfil.id_rol else "Sin rol"
                token["rol_id"] = perfil.id_rol_id if perfil.id_rol else None
        except Exception:
            pass

        return token

    def validate(self, attrs):
        username = (attrs.get("username") or "").strip()
        password = (attrs.get("password") or "").strip()

        if not username or not password:
            raise AuthenticationFailed("Usuario y contraseña son obligatorios.")

        request = self.context.get("request")
        user = authenticate(request=request, username=username, password=password)

        if user is None or isinstance(user, AnonymousUser):
            usuario = Usuario.objects.select_related("id_rol", "id_establecimiento").filter(
                correo__iexact=username
            ).first()
            if usuario is None:
                usuario = Usuario.objects.select_related("id_rol", "id_establecimiento").filter(
                    nombre__iexact=username
                ).first()

            if usuario is not None:
                password_hash = str(usuario.password_hash or "").strip()
                allowed = _resolve_dev_password(password_hash)
                if password == allowed or password == password_hash:
                    user = _ensure_django_user_from_usuario(usuario, password)
                else:
                    raise AuthenticationFailed("Credenciales inválidas.")

        if user is None or isinstance(user, AnonymousUser):
            raise AuthenticationFailed("Credenciales inválidas.")

        refresh = self.get_token(user)
        data = {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "is_staff": user.is_staff,
                "is_superuser": user.is_superuser,
            },
        }

        try:
            perfil = Usuario.objects.select_related("id_rol", "id_establecimiento").filter(
                correo__iexact=user.email.lower()
            ).first()
            if perfil:
                data["user"]["id_establecimiento"] = perfil.id_establecimiento_id
                data["user"]["rol"] = perfil.id_rol.nombre if perfil.id_rol else "Sin rol"
                data["user"]["rol_id"] = perfil.id_rol_id if perfil.id_rol else None
        except Exception:
            pass

        return data
