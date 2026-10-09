from django.contrib import admin
from django.urls import include, path

from .views import ApiIndexView, CatalogoEnumsView, IdiomasMetaView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", ApiIndexView.as_view(), name="api-index"),
    path("api/meta/idiomas/", IdiomasMetaView.as_view(), name="api-meta-idiomas"),
    path("api/meta/catalogo-enums/", CatalogoEnumsView.as_view(), name="api-meta-enums"),
    path("api/empresas/", include("app_empresas.urls")),
    path("api/identidad/", include("app_identidad.urls")),
    path("api/operaciones/", include("app_operaciones.urls")),
    path("api/inteligencia/", include("app_inteligencia.urls")),
]
