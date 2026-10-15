from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsAuthenticatedWithTenant(BasePermission):
    """Requires authenticated user and a valid tenant context when the request is tenant-scoped."""

    message = "Debes autenticarte y proporcionar un contexto válido de establecimiento."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.method in SAFE_METHODS:
            return True

        tenant_id = request.query_params.get("id_establecimiento")
        if tenant_id:
            return True

        payload = getattr(getattr(request, "auth", None), "payload", {})
        token_tenant = payload.get("id_establecimiento") if isinstance(payload, dict) else None
        return bool(token_tenant)
