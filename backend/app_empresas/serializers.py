from rest_framework import serializers

from .models import Establecimiento, Plan


class PlanSerializer(serializers.ModelSerializer):
    politica_excedente_etiqueta = serializers.CharField(
        source="get_politica_excedente_display",
        read_only=True,
    )

    class Meta:
        model = Plan
        fields = (
            "id_plan",
            "nombre",
            "descripcion",
            "precio",
            "limite_usuarios",
            "cupo_residentes",
            "precio_excedente",
            "politica_excedente",
            "politica_excedente_etiqueta",
            "permite_ia",
            "estado",
            "fecha_creacion",
        )


class EstablecimientoSerializer(serializers.ModelSerializer):
    plan = PlanSerializer(source="id_plan", read_only=True)
    tipo_entidad_etiqueta = serializers.CharField(
        source="get_tipo_entidad_display",
        read_only=True,
    )
    uso_cupo = serializers.SerializerMethodField()

    class Meta:
        model = Establecimiento
        fields = (
            "id_establecimiento",
            "id_plan",
            "plan",
            "nombre",
            "direccion",
            "telefono",
            "tipo_entidad",
            "tipo_entidad_etiqueta",
            "permite_invitaciones_residente",
            "uso_cupo",
            "estado",
            "fecha_registro",
        )

    def get_uso_cupo(self, obj):
        from .quotas import estado_cupo

        return estado_cupo(obj)

    def validate_nombre(self, value):
        normalized = (value or "").strip()
        if not normalized:
            raise serializers.ValidationError("El nombre del establecimiento es obligatorio.")
        return normalized

    def validate_id_plan(self, plan):
        if plan is not None and not plan.estado:
            raise serializers.ValidationError("El plan seleccionado está inactivo.")
        return plan

    def validate(self, attrs):
        instance = self.instance
        tipo_entidad = attrs.get(
            "tipo_entidad",
            getattr(instance, "tipo_entidad", Establecimiento.TipoEntidad.RESIDENCIAL),
        )
        strict = tipo_entidad != Establecimiento.TipoEntidad.RESIDENCIAL
        tipo_cambio = instance is not None and tipo_entidad != instance.tipo_entidad

        # En contextos estrictos la capacidad nace deshabilitada. El Super Admin
        # puede volver a habilitarla explícitamente en el mismo formulario.
        if strict and "permite_invitaciones_residente" not in attrs and (
            instance is None or tipo_cambio
        ):
            attrs["permite_invitaciones_residente"] = False

        return attrs
