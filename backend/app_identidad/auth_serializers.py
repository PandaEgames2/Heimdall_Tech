from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.hashers import make_password, verify_password
from django.contrib.auth.models import AnonymousUser
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from config.rbac import profile_role_ids
from config.tenant_utils import SUPER_ADMIN_ROL_ID

from .models import Usuario
from .profile_service import build_profile_payload

User = get_user_model()

LOGIN_ALIASES = {
    "admin": "admin@heimdall.tech",
    "rastor36": "rastor36@heimdall.tech",
}


def _ensure_django_user_from_usuario(usuario, password):
    """Sincroniza el usuario de Django que SimpleJWT usa para firmar tokens.

    La contraseña real vive en ``USUARIO.password_hash`` y se valida antes de
    llegar aquí. Para las cuentas que no son staff no duplicamos el hash
    PBKDF2 (costoso) en ``auth_user``; el login siempre pasa por USUARIO.
    """

    username = (usuario.correo or "").strip().lower()
    is_staff = SUPER_ADMIN_ROL_ID in set(profile_role_ids(usuario))
    user = User.objects.filter(username=username).first()
    created = user is None
    if created:
        user = User(username=username)

    first_name = usuario.nombre.split()[0] if usuario.nombre else ""
    last_name = " ".join(usuario.nombre.split()[1:]) if usuario.nombre else ""
    email = (usuario.correo or "").lower()

    changed = []
    for field, value in (
        ("email", email),
        ("first_name", first_name),
        ("last_name", last_name),
        ("is_active", bool(usuario.estado)),
        ("is_staff", is_staff),
        ("is_superuser", is_staff),
    ):
        if getattr(user, field) != value:
            setattr(user, field, value)
            changed.append(field)

    if created:
        if is_staff:
            user.set_password(password)
        else:
            user.set_unusable_password()
        changed.append("password")
    elif is_staff:
        if not user.has_usable_password():
            user.set_password(password)
            changed.append("password")
    elif user.has_usable_password():
        # Una cuenta no-staff no debe poder autenticarse por el fallback de
        # Django si su registro en USUARIO está desactivado.
        user.set_unusable_password()
        changed.append("password")

    if created:
        user.save()
    elif changed:
        user.save(update_fields=changed)

    user._heimdall_perfil = usuario
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
            perfil = getattr(user, "_heimdall_perfil", None)
            if perfil is None:
                perfil = Usuario.objects.select_related(
                    "id_rol", "id_establecimiento", "id_establecimiento__id_plan"
                ).prefetch_related("roles_asignados__id_rol").filter(correo__iexact=user.email.lower()).first()
            if perfil:
                token["id_establecimiento"] = perfil.id_establecimiento_id
                token["rol"] = perfil.id_rol.nombre if perfil.id_rol else "Sin rol"
                token["rol_id"] = perfil.id_rol_id if perfil.id_rol else None
                token["roles_ids"] = profile_role_ids(perfil)
        except Exception:
            pass

        return token

    def _lookup_usuario(self, username: str):
        key = (username or "").strip().lower()
        if not key:
            return None
        correo = LOGIN_ALIASES.get(key, key)
        usuario = Usuario.objects.select_related(
            "id_rol", "id_establecimiento", "id_establecimiento__id_plan"
        ).prefetch_related("roles_asignados__id_rol").filter(correo__iexact=correo).first()
        if usuario is not None:
            return usuario
        return Usuario.objects.select_related(
            "id_rol", "id_establecimiento", "id_establecimiento__id_plan"
        ).prefetch_related("roles_asignados__id_rol").filter(nombre__iexact=username.strip()).first()

    def validate(self, attrs):
        username = (attrs.get("username") or "").strip()
        password = attrs.get("password") or ""

        if not username or not password:
            raise AuthenticationFailed("Usuario y contraseña son obligatorios.")

        request = self.context.get("request")
        user = None
        usuario = self._lookup_usuario(username)

        if usuario is not None:
            if not usuario.estado:
                raise AuthenticationFailed("La cuenta está desactivada.")
            password_hash = str(usuario.password_hash or "").strip()
            matches = False
            must_update = False
            if password_hash:
                try:
                    # verify_password devuelve (coincide, debe_rehashear) y
                    # compara también los parámetros del hasher (scrypt p=5
                    # antiguo → scrypt p=1 rápido).
                    matches, must_update = verify_password(password, password_hash)
                except Exception:
                    matches = False
            if not matches:
                raise AuthenticationFailed("Credenciales inválidas.")
            if must_update:
                # Migra PBKDF2, scrypt p=5 y otros costes antiguos al hasher
                # preferido en el primer login exitoso.
                usuario.password_hash = make_password(password)
                usuario.save(update_fields=["password_hash"])
            user = _ensure_django_user_from_usuario(usuario, password)
        else:
            user = authenticate(request=request, username=username, password=password)

        if user is None or isinstance(user, AnonymousUser):
            raise AuthenticationFailed("Credenciales inválidas.")
        if not user.is_active:
            raise AuthenticationFailed("La cuenta está desactivada.")

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

        perfil = getattr(user, "_heimdall_perfil", None)
        if perfil is None:
            try:
                perfil = Usuario.objects.select_related(
                    "id_rol", "id_establecimiento", "id_establecimiento__id_plan"
                ).prefetch_related("roles_asignados__id_rol").filter(correo__iexact=user.email.lower()).first()
            except Exception:
                perfil = None

        if perfil is not None:
            profile_payload = build_profile_payload(user, perfil)
            data["profile"] = profile_payload
            for key in (
                "nombre",
                "id_establecimiento",
                "rol",
                "rol_id",
                "is_platform_superadmin",
                "permisos_rol",
                "permisos_excepciones",
                "permisos_efectivos",
                "acciones",
                "menu",
                "catalogo_permisos",
                "roles",
                "roles_asignados",
                "roles_ids",
                "funcionalidades",
                "tipo_entidad",
                "tipo_entidad_etiqueta",
                "permite_invitaciones_residente",
                "puede_invitar",
                "cupo",
            ):
                if key in profile_payload:
                    data["user"][key] = profile_payload[key]
        else:
            data["profile"] = build_profile_payload(user, None)

        return data
