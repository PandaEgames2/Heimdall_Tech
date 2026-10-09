from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        token["user_id"] = user.id
        token["username"] = user.username
        token["email"] = user.email
        token["is_staff"] = user.is_staff
        token["is_superuser"] = user.is_superuser

        # Si el usuario autenticado corresponde a un usuario de negocio, se agrega el contexto SaaS
        try:
            from app_identidad.models import Usuario as UsuarioNegocio

            perfil = UsuarioNegocio.objects.select_related("id_rol", "id_establecimiento").filter(
                correo=user.email.lower()
            ).first()
            if perfil:
                token["id_establecimiento"] = perfil.id_establecimiento_id
                token["rol"] = perfil.id_rol.nombre if perfil.id_rol else "Sin rol"
                token["rol_id"] = perfil.id_rol_id if perfil.id_rol else None
        except Exception:
            pass

        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user

        data["user"] = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "is_staff": user.is_staff,
            "is_superuser": user.is_superuser,
        }

        try:
            from app_identidad.models import Usuario as UsuarioNegocio

            perfil = UsuarioNegocio.objects.select_related("id_rol", "id_establecimiento").filter(
                correo=user.email.lower()
            ).first()
            if perfil:
                data["user"]["id_establecimiento"] = perfil.id_establecimiento_id
                data["user"]["rol"] = perfil.id_rol.nombre if perfil.id_rol else "Sin rol"
                data["user"]["rol_id"] = perfil.id_rol_id if perfil.id_rol else None
        except Exception:
            pass

        return data
