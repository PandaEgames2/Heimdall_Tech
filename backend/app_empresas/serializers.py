from rest_framework import serializers

from .models import Establecimiento, Plan


class PlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plan
        fields = (
            "id_plan",
            "nombre",
            "descripcion",
            "precio",
            "limite_usuarios",
            "permite_ia",
            "estado",
            "fecha_creacion",
        )


class EstablecimientoSerializer(serializers.ModelSerializer):
    plan = PlanSerializer(source="id_plan", read_only=True)

    class Meta:
        model = Establecimiento
        fields = (
            "id_establecimiento",
            "id_plan",
            "plan",
            "nombre",
            "direccion",
            "telefono",
            "estado",
            "fecha_registro",
        )
