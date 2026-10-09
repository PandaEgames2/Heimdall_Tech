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
