"""Vistas de autenticación con access token en memoria y refresh en cookie HttpOnly."""

from __future__ import annotations

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .auth_serializers import CustomTokenObtainPairSerializer
from .models import AuditLog, Usuario
from .serializers import _sync_django_user
from config.tenant_utils import get_usuario_perfil

User = get_user_model()


def _cookie_settings():
    return {
        "httponly": True,
        "secure": not settings.DEBUG,
        "samesite": "Strict",
        "path": "/api/identidad/auth/",
    }


def _refresh_max_age() -> int:
    return int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds())


def _set_refresh_cookie(response, refresh_token: str) -> None:
    response.set_cookie(
        settings.REFRESH_TOKEN_COOKIE_NAME,
        refresh_token,
        max_age=_refresh_max_age(),
        **_cookie_settings(),
    )


def _clear_refresh_cookie(response) -> None:
    response.delete_cookie(settings.REFRESH_TOKEN_COOKIE_NAME, path="/api/identidad/auth/")


def _get_client_ip(request) -> str | None:
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        return x_forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _audit_log(action, usuario, recurso_afectado=None, descripcion=None, request=None, origen_permiso=None):
    ip = _get_client_ip(request) if request else None
    AuditLog.objects.create(
        id_usuario=usuario,
        accion=action,
        recurso_afectado=recurso_afectado,
        descripcion=descripcion,
        ip_origen=ip,
        origen_permiso=origen_permiso,
    )


def log_rbac_action(request, action, modulo, recurso_id, recurso_nombre, descripcion=None):
    """
    Registra una acción de RBAC (crear, actualizar, eliminar rol/recurso).
    
    Args:
        request: Request HTTP para obtener IP y usuario autenticado
        action: AuditLog.Accion (CREATE, UPDATE, DELETE)
        modulo: 'roles' o 'recursos'
        recurso_id: ID del rol/recurso afectado
        recurso_nombre: Nombre del rol/recurso afectado
        descripcion: Descripción opcional
    """
    from config.tenant_utils import get_usuario_perfil
    otorgante_perfil = get_usuario_perfil(request.user)
    if otorgante_perfil is None:
        return
    
    _audit_log(
        action,
        otorgante_perfil,
        recurso_afectado=f"{modulo}:{recurso_id}",
        descripcion=descripcion or f"{action.label} de {modulo[:-1]} '{recurso_nombre}' (ID: {recurso_id})",
        request=request,
        origen_permiso=modulo,
    )


def log_permission_grant(usuario, modulo, otorgado_por=None, descripcion=None):
    """Registra la concesión o revocación de un permiso de módulo (excepciones de usuario).

    Args:
        usuario: Usuario cuya excepción se está modificando.
        modulo: Clave del módulo (ej. 'recursos', 'roles', 'auditoria').
        otorgado_por: Usuario que realizó el cambio (Super Admin), o None.
        descripcion: Texto descriptivo del cambio.
    """
    _audit_log(
        AuditLog.Accion.ROLE_ASSIGN,
        usuario,
        recurso_afectado=modulo,
        descripcion=descripcion or f"Permiso de módulo {modulo} {'otorgado' if otorgado_por else 'revocado'}",
        origen_permiso="excepcion",
    )


class CookieTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        refresh = response.data.pop("refresh", None)
        if refresh:
            _set_refresh_cookie(response, refresh)
        # Auditar inicio de sesión exitoso
        try:
            email = request.data.get("email") or request.data.get("username")
            if email:
                usuario = Usuario.objects.filter(correo__iexact=email).first()
                if usuario:
                    _audit_log(AuditLog.Accion.LOGIN, usuario, request=request)
        except Exception:
            pass
        return response


class CookieTokenRefreshView(TokenRefreshView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        refresh_token = request.data.get("refresh") or request.COOKIES.get(
            settings.REFRESH_TOKEN_COOKIE_NAME
        )
        if not refresh_token:
            return Response(
                {"detail": "No hay una sesión activa para renovar.", "code": "refresh_required"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        serializer = self.get_serializer(data={"refresh": refresh_token})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError:
            response = Response(
                {"detail": "La sesión expiró. Inicia sesión de nuevo.", "code": "token_not_valid"},
                status=status.HTTP_401_UNAUTHORIZED,
            )
            _clear_refresh_cookie(response)
            return response
        data = dict(serializer.validated_data)
        rotated = data.pop("refresh", None)
        response = Response(data)
        if rotated:
            _set_refresh_cookie(response, rotated)
        return response


class LogoutView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get("refresh") or request.COOKIES.get(
            settings.REFRESH_TOKEN_COOKIE_NAME
        )
        # Auditar cierre de sesión
        try:
            email = request.data.get("email") or request.data.get("username")
            if email:
                usuario = Usuario.objects.filter(correo__iexact=email).first()
                if usuario:
                    _audit_log(AuditLog.Accion.LOGOUT, usuario, request=request)
        except Exception:
            pass
        if token:
            try:
                RefreshToken(token).blacklist()
            except TokenError:
                pass
            except Exception:
                pass
        response = Response({"detail": "Sesión cerrada."}, status=status.HTTP_200_OK)
        _clear_refresh_cookie(response)
        return response


class ChangePasswordView(APIView):
    """Permite al usuario autenticado cambiar su propia contraseña."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        usuario = get_usuario_perfil(request.user)
        if not usuario:
            return Response(
                {"detail": "No se pudo resolver el perfil del usuario."},
                status=status.HTTP_404_NOT_FOUND,
            )

        current_password = request.data.get("current_password")
        new_password = request.data.get("new_password")
        confirm_password = request.data.get("confirm_password")

        if not current_password or not new_password or not confirm_password:
            return Response(
                {"detail": "Se requieren current_password, new_password y confirm_password."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if new_password != confirm_password:
            return Response(
                {"detail": "La nueva contraseña y su confirmación no coinciden."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(new_password) < 8:
            return Response(
                {"detail": "La contraseña debe tener al menos 8 caracteres."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        import re
        if not re.search(r"[A-Z]", new_password):
            return Response(
                {"detail": "La contraseña debe contener al menos una mayúscula."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not re.search(r"[a-z]", new_password):
            return Response(
                {"detail": "La contraseña debe contener al menos una minúscula."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not re.search(r"[0-9]", new_password):
            return Response(
                {"detail": "La contraseña debe contener al menos un número."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verificar contraseña actual contra el hash almacenado
        from django.contrib.auth.hashers import check_password
        if not check_password(current_password, usuario.password_hash):
            return Response(
                {"detail": "La contraseña actual es incorrecta."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # No permitir contraseñas recientes (últimas 3)
        historial = usuario.permisos_excepciones.get("password_historial", []) if isinstance(usuario.permisos_excepciones, dict) else []
        if new_password in historial:
            return Response(
                {"detail": "No puedes reutilizar una de tus últimas 3 contraseñas."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            usuario.password_hash = make_password(new_password)
            usuario.save(update_fields=["password_hash"])

            # Guardar en historial (máximo 3)
            historial = historial[-2:] + [new_password]
            if not isinstance(usuario.permisos_excepciones, dict):
                usuario.permisos_excepciones = {}
            usuario.permisos_excepciones["password_historial"] = historial
            usuario.save(update_fields=["permisos_excepciones"])

            # Sincronizar con django auth_user
            _sync_django_user(usuario, password_hash=usuario.password_hash, password_changed=True)

        _audit_log(
            AuditLog.Accion.PASSWORD_CHANGE,
            usuario,
            descripcion="Cambio de contraseña por el usuario",
            request=request,
        )

        return Response({"detail": "Contraseña actualizada correctamente."})
