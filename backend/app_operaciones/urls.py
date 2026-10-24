from rest_framework.routers import DefaultRouter

from django.urls import path

from .views import (
    EscanearQRResidenteView,
    EscanearQRVisitanteView,
    IncidenciaViewSet,
    InvitacionVisitanteViewSet,
    MovimientoViewSet,
    MisVehiculosView,
    QRResidenteView,
    ResponsableViewSet,
    VehiculoViewSet,
)

router = DefaultRouter()
router.register("responsables", ResponsableViewSet, basename="responsable")
router.register("vehiculos", VehiculoViewSet, basename="vehiculo")
router.register("movimientos", MovimientoViewSet, basename="movimiento")
router.register("incidencias", IncidenciaViewSet, basename="incidencia")
router.register("invitaciones-visitantes", InvitacionVisitanteViewSet, basename="invitacion-visitante")

urlpatterns = [
    path("qr/residente/", QRResidenteView.as_view(), name="qr-residente"),
    path("qr/residente/validar/", EscanearQRResidenteView.as_view(), name="qr-residente-validar"),
    path("qr/visitante/validar/", EscanearQRVisitanteView.as_view(), name="qr-visitante-validar"),
    path("vehiculos/mios/", MisVehiculosView.as_view(), name="mis-vehiculos"),
    *router.urls,
]
