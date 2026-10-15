from django.contrib import admin
from django.urls import include, path

from app_identidad.views import PerfilUsuarioView
from .views import ApiHealthView, ApiIndexView, CatalogoEnumsView, IdiomasMetaView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", ApiHealthView.as_view(), name="api-health"),
    path("api/", ApiIndexView.as_view(), name="api-index"),
    path("api/profile/", PerfilUsuarioView.as_view(), name="api-profile"),
    path("api/meta/idiomas/", IdiomasMetaView.as_view(), name="api-meta-idiomas"),
    path("api/meta/catalogo-enums/", CatalogoEnumsView.as_view(), name="api-meta-enums"),
    path("api/empresas/", include("app_empresas.urls")),
    path("api/identidad/", include("app_identidad.urls")),
    path("api/operaciones/", include("app_operaciones.urls")),
    path("api/inteligencia/", include("app_inteligencia.urls")),
]
