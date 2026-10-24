from rest_framework import serializers


class ChoiceLabelMixin(serializers.Serializer):
    """Expone etiquetas traducidas de campos choice (según Accept-Language)."""

    @staticmethod
    def choice_display(source, field_name):
        field = source._meta.get_field(field_name)
        value = getattr(source, field_name)
        if value is None:
            return None
        return dict(field.flatchoices).get(value, value)


def validate_tenant_relations(serializer, attrs, relation_fields):
    """Reject foreign-key links that cross the parent record's establishment."""
    establishment = attrs.get("id_establecimiento")
    expected_id = getattr(establishment, "pk", None)
    if expected_id is None and serializer.instance is not None:
        expected_id = serializer.instance.id_establecimiento_id

    if expected_id is None:
        return attrs

    errors = {}
    for field_name in relation_fields:
        related = attrs.get(field_name)
        if related is None and serializer.instance is not None:
            related = getattr(serializer.instance, field_name, None)
        related_establishment_id = getattr(related, "id_establecimiento_id", None)
        if related_establishment_id is not None and related_establishment_id != expected_id:
            errors[field_name] = "El recurso relacionado debe pertenecer al mismo establecimiento."
    if errors:
        raise serializers.ValidationError(errors)
    return attrs
