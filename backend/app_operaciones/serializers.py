from rest_framework import serializers

from app_identidad.serializers import UsuarioResumenSerializer

from config.serializers import ChoiceLabelMixin

from .models import Incidencia, Movimiento, Responsable, Vehiculo


class ResponsableSerializer(serializers.ModelSerializer):
    class Meta:
        model = Responsable
        fields = (
            "id_responsable",
            "id_establecimiento",
            "nombre",
            "documento_identidad",
            "telefono",
            "correo",
            "departamento_unidad",
        )


class VehiculoResumenSerializer(serializers.ModelSerializer):
    tipo_autorizacion_etiqueta = serializers.SerializerMethodField()

    class Meta:
        model = Vehiculo
        fields = (
            "id_vehiculo",
            "placa",
            "marca",
            "modelo",
            "color",
            "tipo_autorizacion",
            "tipo_autorizacion_etiqueta",
        )

    def get_tipo_autorizacion_etiqueta(self, obj):
        return ChoiceLabelMixin.choice_display(obj, "tipo_autorizacion")


class VehiculoSerializer(VehiculoResumenSerializer):
    class Meta(VehiculoResumenSerializer.Meta):
        fields = VehiculoResumenSerializer.Meta.fields + (
            "id_establecimiento",
            "id_responsable",
            "fecha_registro",
        )


class MovimientoSerializer(serializers.ModelSerializer):
    tipo_movimiento_etiqueta = serializers.SerializerMethodField()
    estado_sincronizacion_etiqueta = serializers.SerializerMethodField()

    class Meta:
        model = Movimiento
        fields = (
            "id_movimiento",
            "id_establecimiento",
            "id_vehiculo",
            "id_usuario",
            "placa_leida",
            "tipo_movimiento",
            "tipo_movimiento_etiqueta",
            "fecha_evento",
            "id_dispositivo",
            "observacion",
            "estado_sincronizacion",
            "estado_sincronizacion_etiqueta",
            "fecha_sincronizacion",
        )

    def get_tipo_movimiento_etiqueta(self, obj):
        return ChoiceLabelMixin.choice_display(obj, "tipo_movimiento")

    def get_estado_sincronizacion_etiqueta(self, obj):
        return ChoiceLabelMixin.choice_display(obj, "estado_sincronizacion")


class MovimientoDetalleSerializer(MovimientoSerializer):
    vehiculo = VehiculoResumenSerializer(source="id_vehiculo", read_only=True)
    usuario = UsuarioResumenSerializer(source="id_usuario", read_only=True)

    class Meta(MovimientoSerializer.Meta):
        fields = MovimientoSerializer.Meta.fields + ("vehiculo", "usuario")


class IncidenciaSerializer(serializers.ModelSerializer):
    nivel_prioridad_etiqueta = serializers.SerializerMethodField()

    class Meta:
        model = Incidencia
        fields = (
            "id_incidencia",
            "id_establecimiento",
            "id_vehiculo",
            "id_usuario",
            "titulo",
            "descripcion",
            "nivel_prioridad",
            "nivel_prioridad_etiqueta",
            "fecha_incidencia",
        )

    def get_nivel_prioridad_etiqueta(self, obj):
        return ChoiceLabelMixin.choice_display(obj, "nivel_prioridad")


class IncidenciaDetalleSerializer(IncidenciaSerializer):
    vehiculo = VehiculoResumenSerializer(source="id_vehiculo", read_only=True)
    usuario = UsuarioResumenSerializer(source="id_usuario", read_only=True)

    class Meta(IncidenciaSerializer.Meta):
        fields = IncidenciaSerializer.Meta.fields + ("vehiculo", "usuario")
