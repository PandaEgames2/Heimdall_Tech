from rest_framework import serializers

from app_identidad.serializers import UsuarioResumenSerializer
from app_operaciones.serializers import MovimientoSerializer

from config.serializers import ChoiceLabelMixin, validate_tenant_relations

from .models import ReconocimientoPlaca


class ReconocimientoPlacaSerializer(serializers.ModelSerializer):
    resultado_ia_etiqueta = serializers.SerializerMethodField()

    class Meta:
        model = ReconocimientoPlaca
        fields = (
            "id_reconocimiento",
            "id_establecimiento",
            "id_movimiento",
            "id_dispositivo",
            "id_usuario",
            "url_fotografia",
            "placa_detectada",
            "nivel_confianza",
            "resultado_ia",
            "resultado_ia_etiqueta",
            "fecha_procesamiento",
        )

    def get_resultado_ia_etiqueta(self, obj):
        return ChoiceLabelMixin.choice_display(obj, "resultado_ia")

    def validate(self, attrs):
        return validate_tenant_relations(self, attrs, ("id_movimiento", "id_usuario"))


class ReconocimientoPlacaDetalleSerializer(ReconocimientoPlacaSerializer):
    movimiento = MovimientoSerializer(source="id_movimiento", read_only=True)
    usuario = UsuarioResumenSerializer(source="id_usuario", read_only=True)

    class Meta(ReconocimientoPlacaSerializer.Meta):
        fields = ReconocimientoPlacaSerializer.Meta.fields + ("movimiento", "usuario")
