from rest_framework.routers import DefaultRouter

from .views import IncidenciaViewSet, MovimientoViewSet, ResponsableViewSet, VehiculoViewSet

router = DefaultRouter()
router.register("responsables", ResponsableViewSet, basename="responsable")
router.register("vehiculos", VehiculoViewSet, basename="vehiculo")
router.register("movimientos", MovimientoViewSet, basename="movimiento")
router.register("incidencias", IncidenciaViewSet, basename="incidencia")

urlpatterns = router.urls
