from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError


class EstablecimientoQueryParamMixin:
    """
    Aísla datos por establecimiento (SaaS multi-cliente).

    Se exige sólo cuando el modelo usa id_establecimiento, evitando barreras para
    recursos globales como roles.
    """

    establecimiento_param = "id_establecimiento"

    def get_establecimiento_id(self):
        raw = self.request.query_params.get(self.establecimiento_param)
        if not raw:
            raise ValidationError(
                {
                    self.establecimiento_param: _(
                        "Required for multi-tenant queries (SaaS)."
                    )
                }
            )
        try:
            return int(raw)
        except (TypeError, ValueError) as exc:
            raise ValidationError(
                {self.establecimiento_param: _("Must be a valid integer.")}
            ) from exc

    def get_base_queryset(self):
        raise NotImplementedError

    def get_queryset(self):
        qs = self.get_base_queryset()
        model = getattr(qs.model, "_meta", None)
        if model is not None and hasattr(model, "get_field"):
            try:
                model._meta.get_field("id_establecimiento")
            except Exception:
                return qs
        if self.action in ("list", "retrieve"):
            est_id = self.get_establecimiento_id()
            qs = qs.filter(id_establecimiento_id=est_id)
        return qs
