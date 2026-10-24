from rest_framework import serializers

from app_identidad.serializers import UsuarioResumenSerializer
from app_empresas.features import features_for_establecimiento
from config.tenant_utils import get_usuario_perfil, is_platform_superadmin

from config.serializers import ChoiceLabelMixin, validate_tenant_relations

from .models import Incidencia, InvitacionVisitante, Movimiento, Responsable, Vehiculo


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


class ResponsableResumenSerializer(serializers.ModelSerializer):
    class Meta:
        model = Responsable
        fields = ("id_responsable", "nombre", "documento_identidad", "telefono", "correo")


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
            "codigo_rfid",
            "tipo_autorizacion",
            "tipo_autorizacion_etiqueta",
        )

    def get_tipo_autorizacion_etiqueta(self, obj):
        return ChoiceLabelMixin.choice_display(obj, "tipo_autorizacion")


class VehiculoSerializer(VehiculoResumenSerializer):
    responsable = ResponsableResumenSerializer(source="id_responsable", read_only=True)

    class Meta(VehiculoResumenSerializer.Meta):
        fields = VehiculoResumenSerializer.Meta.fields + (
            "id_establecimiento",
            "id_responsable",
            "responsable",
            "fecha_registro",
        )

    def validate(self, attrs):
        attrs = validate_tenant_relations(self, attrs, ("id_responsable",))
        rfid_code = attrs.get("codigo_rfid")
        establishment = attrs.get("id_establecimiento") or getattr(self.instance, "id_establecimiento", None)
        if rfid_code and establishment and not features_for_establecimiento(establishment)["rfid"]:
            raise serializers.ValidationError({"codigo_rfid": "El plan actual no incluye integración RFID."})
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        if request and request.user.is_authenticated and not is_platform_superadmin(request.user):
            profile = get_usuario_perfil(request.user)
            if profile and not features_for_establecimiento(profile.id_establecimiento)["rfid"]:
                data["codigo_rfid"] = None
        return data


class MovimientoSerializer(serializers.ModelSerializer):
    vehiculo = VehiculoResumenSerializer(source="id_vehiculo", read_only=True)
    tipo_movimiento_etiqueta = serializers.SerializerMethodField()
    estado_sincronizacion_etiqueta = serializers.SerializerMethodField()

    class Meta:
        model = Movimiento
        fields = (
            "id_movimiento",
            "id_establecimiento",
            "id_vehiculo",
            "vehiculo",
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

    def validate(self, attrs):
        return validate_tenant_relations(self, attrs, ("id_vehiculo", "id_usuario"))


class MovimientoDetalleSerializer(MovimientoSerializer):
    vehiculo = VehiculoResumenSerializer(source="id_vehiculo", read_only=True)
    usuario = UsuarioResumenSerializer(source="id_usuario", read_only=True)

    class Meta(MovimientoSerializer.Meta):
        fields = MovimientoSerializer.Meta.fields + ("vehiculo", "usuario")


class InvitacionVisitanteResumenSerializer(serializers.ModelSerializer):
    residente = UsuarioResumenSerializer(source="id_residente", read_only=True)

    class Meta:
        model = InvitacionVisitante
        fields = ("id_invitacion", "nombre_visitante", "placa_visitante", "motivo", "estado", "id_residente", "residente")


class IncidenciaSerializer(serializers.ModelSerializer):
    vehiculo = VehiculoResumenSerializer(source="id_vehiculo", read_only=True)
    invitacion = InvitacionVisitanteResumenSerializer(source="id_invitacion", read_only=True)
    nivel_prioridad_etiqueta = serializers.SerializerMethodField()

    class Meta:
        model = Incidencia
        fields = (
            "id_incidencia",
            "id_establecimiento",
            "id_vehiculo",
            "vehiculo",
            "id_usuario",
            "id_invitacion",
            "invitacion",
            "titulo",
            "descripcion",
            "nivel_prioridad",
            "nivel_prioridad_etiqueta",
            "fecha_incidencia",
        )

    def get_nivel_prioridad_etiqueta(self, obj):
        return ChoiceLabelMixin.choice_display(obj, "nivel_prioridad")

    def validate(self, attrs):
        return validate_tenant_relations(self, attrs, ("id_vehiculo", "id_usuario", "id_invitacion"))


class IncidenciaDetalleSerializer(IncidenciaSerializer):
    vehiculo = VehiculoResumenSerializer(source="id_vehiculo", read_only=True)
    usuario = UsuarioResumenSerializer(source="id_usuario", read_only=True)

    class Meta(IncidenciaSerializer.Meta):
        fields = IncidenciaSerializer.Meta.fields + ("vehiculo", "usuario")


class InvitacionVisitanteSerializer(serializers.ModelSerializer):
    residente = UsuarioResumenSerializer(source="id_residente", read_only=True)

    class Meta:
        model = InvitacionVisitante
        fields = (
            "id_invitacion",
            "id_establecimiento",
            "id_residente",
            "residente",
            "nombre_visitante",
            "documento_visitante",
            "placa_visitante",
            "motivo",
            "vigente_desde",
            "vigente_hasta",
            "estado",
            "fecha_ingreso",
            "fecha_salida",
            "id_movimiento_ingreso",
            "id_movimiento_salida",
            "fecha_creacion",
        )
        read_only_fields = (
            "id_establecimiento",
            "id_residente",
            "estado",
            "fecha_ingreso",
            "fecha_salida",
            "id_movimiento_ingreso",
            "id_movimiento_salida",
            "fecha_creacion",
        )

    def validate(self, attrs):
        start = attrs.get("vigente_desde")
        end = attrs.get("vigente_hasta")
        if start and end:
            if end <= start:
                raise serializers.ValidationError({"vigente_hasta": "Debe ser posterior al inicio de la invitación."})
            if (end - start).total_seconds() > 24 * 60 * 60:
                raise serializers.ValidationError({"vigente_hasta": "Una invitación no puede superar 24 horas."})
        return attrs
