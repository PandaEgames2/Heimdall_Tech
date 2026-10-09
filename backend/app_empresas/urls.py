from rest_framework.routers import DefaultRouter

from .views import EstablecimientoViewSet, PlanViewSet

router = DefaultRouter()
router.register("planes", PlanViewSet, basename="plan")
router.register("establecimientos", EstablecimientoViewSet, basename="establecimiento")

urlpatterns = router.urls
