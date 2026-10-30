"""Vistas de autenticación con access token en memoria y refresh en cookie HttpOnly."""

from __future__ import annotations

from django.conf import settings
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .auth_serializers import CustomTokenObtainPairSerializer


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
