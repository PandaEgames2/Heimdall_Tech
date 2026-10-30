from django.urls import path
from rest_framework.routers import DefaultRouter

from .auth_views import CookieTokenObtainPairView, CookieTokenRefreshView, LogoutView
from .views import RolViewSet, UsuarioViewSet

router = DefaultRouter()
router.register("roles", RolViewSet, basename="rol")
router.register("usuarios", UsuarioViewSet, basename="usuario")

urlpatterns = [
    path("auth/login/", CookieTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/refresh/", CookieTokenRefreshView.as_view(), name="token_refresh"),
    path("auth/logout/", LogoutView.as_view(), name="token_logout"),
    *router.urls,
]
