from rest_framework.routers import DefaultRouter

from .views import ReconocimientoPlacaViewSet

router = DefaultRouter()
router.register("reconocimientos", ReconocimientoPlacaViewSet, basename="reconocimiento")

urlpatterns = router.urls
