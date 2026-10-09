from django.conf import settings
from django.utils.translation import get_language, gettext as _
from rest_framework.response import Response
from rest_framework.views import APIView


class ApiIndexView(APIView):
    """Mapa JSON de rutas para el frontend y revisión académica."""

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        lang = get_language()
        return Response(
            {
                "proyecto": "Heimdall Tech API",
                "idioma_activo": lang,
                "idiomas_disponibles": [code for code, _ in settings.LANGUAGES],
                "documentacion": {
                    "modelos": "backend/app_*/models.py (tablas MySQL, managed=False)",
                    "serializers": "backend/app_*/serializers.py",
                    "views": "backend/app_*/views.py (ViewSets JSON)",
                    "urls": "backend/app_*/urls.py + config/urls.py",
                },
                "endpoints": {
                    "empresas": {
                        "planes": "/api/empresas/planes/",
                        "establecimientos": "/api/empresas/establecimientos/",
                    },
                    "identidad": {
                        "roles": "/api/identidad/roles/",
                        "usuarios": "/api/identidad/usuarios/?id_establecimiento={id}",
                    },
                    "operaciones": {
                        "responsables": "/api/operaciones/responsables/?id_establecimiento={id}",
                        "vehiculos": "/api/operaciones/vehiculos/?id_establecimiento={id}",
                        "movimientos": "/api/operaciones/movimientos/?id_establecimiento={id}",
                        "incidencias": "/api/operaciones/incidencias/?id_establecimiento={id}",
                    },
                    "inteligencia": {
                        "reconocimientos": (
                            "/api/inteligencia/reconocimientos/?id_establecimiento={id}"
                        ),
                    },
                    "meta": {
                        "idiomas": "/api/meta/idiomas/",
                        "catalogo_enums": "/api/meta/catalogo-enums/",
                    },
                },
                "nota_saas": _(
                    "Operational lists require query param id_establecimiento."
                ),
            }
        )


class IdiomasMetaView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response(
            {
                "activo": get_language(),
                "soportados": [
                    {"codigo": code, "nombre": str(label)}
                    for code, label in settings.LANGUAGES
                ],
                "cabecera": "Accept-Language: es | en",
            }
        )


class CatalogoEnumsView(APIView):
    """Valores de ENUM/choices con etiquetas traducidas para el UI multilingüe."""

    authentication_classes = []
    permission_classes = []

    def get(self, request):
        from app_inteligencia.models import ReconocimientoPlaca
        from app_operaciones.models import Incidencia, Movimiento, Vehiculo

        def choices(model, field_name):
            field = model._meta.get_field(field_name)
            return [
                {"valor": value, "etiqueta": str(label)}
                for value, label in field.flatchoices
            ]

        return Response(
            {
                "vehiculo.tipo_autorizacion": choices(Vehiculo, "tipo_autorizacion"),
                "movimiento.tipo_movimiento": choices(Movimiento, "tipo_movimiento"),
                "movimiento.estado_sincronizacion": choices(
                    Movimiento, "estado_sincronizacion"
                ),
                "incidencia.nivel_prioridad": choices(Incidencia, "nivel_prioridad"),
                "reconocimiento.resultado_ia": choices(
                    ReconocimientoPlaca, "resultado_ia"
                ),
            }
        )
