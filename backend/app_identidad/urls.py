from django.urls import path
from rest_framework.routers import DefaultRouter

from .auth_views import CookieTokenObtainPairView, CookieTokenRefreshView, ChangePasswordView, LogoutView
from .views import RecursoViewSet, RolViewSet, UsuarioViewSet, AuditLogViewSet

router = DefaultRouter()
router.register("roles", RolViewSet, basename="rol")
router.register("recursos", RecursoViewSet, basename="recurso")
router.register("usuarios", UsuarioViewSet, basename="usuario")
router.register("auditoria", AuditLogViewSet, basename="auditoria")

urlpatterns = [
    path("auth/login/", CookieTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/refresh/", CookieTokenRefreshView.as_view(), name="token_refresh"),
    path("auth/logout/", LogoutView.as_view(), name="token_logout"),
    path("auth/change-password/", ChangePasswordView.as_view(), name="change_password"),
    *router.urls,
]
