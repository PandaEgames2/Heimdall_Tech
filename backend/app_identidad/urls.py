from rest_framework.routers import DefaultRouter

from .views import RolViewSet, UsuarioViewSet

router = DefaultRouter()
router.register("roles", RolViewSet, basename="rol")
router.register("usuarios", UsuarioViewSet, basename="usuario")

urlpatterns = router.urls
