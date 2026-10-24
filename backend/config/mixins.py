from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import ValidationError

from config.tenant_utils import assert_establecimiento_access


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
                model.get_field("id_establecimiento")
            except Exception:
                return qs
        if self.action in ("list", "retrieve", "create", "update", "partial_update", "destroy"):
            est_id = self.get_establecimiento_id()
            assert_establecimiento_access(self.request, est_id)
            # Scope object lookup for every action. This prevents a valid tenant
            # query parameter from being used to mutate another tenant's object.
            qs = qs.filter(id_establecimiento_id=est_id)
        return qs

    def _validate_tenant_payload(self, serializer):
        model = getattr(serializer.Meta, "model", None)
        if model is None:
            return
        try:
            model._meta.get_field("id_establecimiento")
        except Exception:
            return

        expected_id = self.get_establecimiento_id()
        establecimiento = serializer.validated_data.get("id_establecimiento")
        actual_id = getattr(establecimiento, "pk", None)
        if actual_id is None and serializer.instance is not None:
            actual_id = serializer.instance.id_establecimiento_id
        if actual_id is not None and int(actual_id) != expected_id:
            from rest_framework.exceptions import ValidationError

            raise ValidationError({self.establecimiento_param: "No puede cambiarse el establecimiento del recurso."})

    def perform_create(self, serializer):
        self._validate_tenant_payload(serializer)
        serializer.save()

    def perform_update(self, serializer):
        self._validate_tenant_payload(serializer)
        serializer.save()
