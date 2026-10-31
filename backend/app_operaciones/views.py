import hashlib
import secrets
from datetime import timedelta

from django.core import signing
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from app_empresas.features import features_for_establecimiento
from app_identidad.models import Usuario
from config.permissions import IsResident, IsTenantAdmin, IsTenantStaff, IsTenantStaffOrResident
from config.tenant_utils import (
    RESIDENTE_ROL_ID,
    get_usuario_perfil,
    is_platform_superadmin,
    profile_has_role,
)

from app_empresas.models import Establecimiento

from .models import CodigoAccesoResidente, Incidencia, InvitacionVisitante, Movimiento, Responsable, Vehiculo
from .serializers import (
    IncidenciaDetalleSerializer,
    IncidenciaSerializer,
    InvitacionVisitanteSerializer,
    MovimientoDetalleSerializer,
    MovimientoSerializer,
    ResponsableSerializer,
    VehiculoSerializer,
)
from config.mixins import EstablecimientoQueryParamMixin


class ResponsableViewSet(EstablecimientoQueryParamMixin, viewsets.ModelViewSet):
    serializer_class = ResponsableSerializer
    lookup_field = "id_responsable"
    search_fields = ("nombre", "documento_identidad", "correo")
    ordering_fields = ("nombre", "documento_identidad")

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsTenantAdmin()]
        return [IsTenantStaff()]

    def get_base_queryset(self):
        return Responsable.objects.all().order_by("nombre")


class VehiculoViewSet(EstablecimientoQueryParamMixin, viewsets.ModelViewSet):
    serializer_class = VehiculoSerializer
    lookup_field = "id_vehiculo"
    search_fields = ("placa", "marca", "modelo", "color")
    ordering_fields = ("placa", "fecha_registro", "tipo_autorizacion")

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsTenantAdmin()]
        return [IsTenantStaff()]

    def get_base_queryset(self):
        return Vehiculo.objects.select_related("id_responsable").order_by("placa")


class MovimientoViewSet(EstablecimientoQueryParamMixin, viewsets.ModelViewSet):
    lookup_field = "id_movimiento"
    search_fields = ("placa_leida", "id_dispositivo", "observacion")
    ordering_fields = ("fecha_evento", "tipo_movimiento", "estado_sincronizacion")

    def get_permissions(self):
        if self.action in ("update", "partial_update", "destroy"):
            return [IsTenantAdmin()]
        return [IsTenantStaff()]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return MovimientoDetalleSerializer
        return MovimientoSerializer

    def get_base_queryset(self):
        return Movimiento.objects.select_related(
            "id_vehiculo", "id_usuario", "id_usuario__id_rol"
        ).order_by("-fecha_evento")

    def perform_create(self, serializer):
        device = str(serializer.validated_data.get("id_dispositivo", "")).upper()
        if "RFID" in device:
            establishment = serializer.validated_data.get("id_establecimiento")
            if establishment and not features_for_establecimiento(establishment)["rfid"]:
                raise PermissionDenied("El plan actual no incluye integración RFID; registra el acceso manualmente o con QR.")
        super().perform_create(serializer)


class IncidenciaViewSet(EstablecimientoQueryParamMixin, viewsets.ModelViewSet):
    lookup_field = "id_incidencia"
    search_fields = ("titulo", "descripcion", "nivel_prioridad")
    ordering_fields = ("fecha_incidencia", "nivel_prioridad")

    def get_permissions(self):
        if self.action in ("update", "partial_update", "destroy"):
            return [IsTenantAdmin()]
        return [IsTenantStaff()]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return IncidenciaDetalleSerializer
        return IncidenciaSerializer

    def get_base_queryset(self):
        return Incidencia.objects.select_related(
            "id_vehiculo", "id_usuario", "id_usuario__id_rol"
        ).order_by("-fecha_incidencia")


def _require_qr_feature(establishment):
    if not features_for_establecimiento(establishment).get("qr"):
        raise PermissionDenied("El plan de este establecimiento no incluye acceso mediante QR.")


def _is_staff(profile):
    return bool(profile and profile.id_rol_id in (1, 2, 3, 4))


class MisVehiculosView(APIView):
    permission_classes = [IsResident]

    def get(self, request):
        profile = get_usuario_perfil(request.user)
        _require_qr_feature(profile.id_establecimiento)
        owner = Responsable.objects.filter(
            id_establecimiento=profile.id_establecimiento_id,
            correo__iexact=profile.correo,
        ).first()
        vehicles = Vehiculo.objects.filter(
            id_establecimiento=profile.id_establecimiento_id,
            id_responsable=owner,
        ).order_by("placa") if owner else Vehiculo.objects.none()
        return Response(VehiculoSerializer(vehicles, many=True).data)


class QRResidenteView(APIView):
    permission_classes = [IsTenantStaffOrResident]

    def post(self, request):
        profile = get_usuario_perfil(request.user)
        if not profile or not profile_has_role(profile, RESIDENTE_ROL_ID):
            raise PermissionDenied("Solo un residente puede generar su QR de acceso.")
        _require_qr_feature(profile.id_establecimiento)

        vehicle = None
        vehicle_id = request.data.get("id_vehiculo")
        if vehicle_id:
            owner = Responsable.objects.filter(
                id_establecimiento=profile.id_establecimiento_id,
                correo__iexact=profile.correo,
            ).first()
            vehicle = Vehiculo.objects.filter(
                id_vehiculo=vehicle_id,
                id_establecimiento=profile.id_establecimiento_id,
                id_responsable=owner,
            ).first()
            if not vehicle:
                raise ValidationError({"id_vehiculo": "El vehículo no está asociado a tu cuenta."})

        now = timezone.now()
        expires_at = now + timedelta(seconds=90)
        payload = {
            "kind": "heimdall-resident-access",
            "resident_id": profile.id_usuario,
            "establishment_id": profile.id_establecimiento_id,
            "vehicle_id": vehicle.id_vehiculo if vehicle else None,
            "nonce": secrets.token_urlsafe(18),
        }
        token = signing.dumps(payload, salt="heimdall.resident.qr.v1")
        token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        CodigoAccesoResidente.objects.filter(fecha_expiracion__lte=now).delete()
        codigo = None
        for _ in range(10):
            candidate = f"{secrets.randbelow(1_000_000):06d}"
            codigo_hash = hashlib.sha256(
                f"{profile.id_establecimiento_id}:{candidate}".encode("utf-8")
            ).hexdigest()
            try:
                with transaction.atomic():
                    CodigoAccesoResidente.objects.create(
                        id_establecimiento_id=profile.id_establecimiento_id,
                        id_residente=profile,
                        id_vehiculo=vehicle,
                        token_hash=token_hash,
                        codigo_hash=codigo_hash,
                        fecha_expiracion=expires_at,
                    )
                codigo = candidate
                break
            except IntegrityError:
                # A duplicate six-digit code is exceedingly rare; retry only
                # uniqueness conflicts and surface unrelated database failures.
                continue
        if codigo is None:
            raise ValidationError({"codigo": "No se pudo generar el código temporal. Intenta de nuevo."})
        return Response({
            "token": token,
            "codigo_respaldo": codigo,
            "expires_at": expires_at.isoformat(),
            "residente": profile.nombre,
            "vehiculo": vehicle.placa if vehicle else "Acceso peatonal",
            "expires_in_seconds": 90,
        })


class EscanearQRResidenteView(APIView):
    permission_classes = [IsTenantStaff]

    @transaction.atomic
    def post(self, request):
        operator = get_usuario_perfil(request.user)
        if not _is_staff(operator):
            raise PermissionDenied("Solo vigilancia o administración puede validar residentes.")
        action_type = str(request.data.get("tipo_movimiento", "")).upper()
        if action_type not in ("INGRESO", "SALIDA"):
            raise ValidationError({"tipo_movimiento": "Usa INGRESO o SALIDA."})
        now = timezone.now()
        codigo = str(request.data.get("codigo", "")).strip()
        token = str(request.data.get("token", "")).strip()
        if codigo:
            if len(codigo) != 6 or not codigo.isdigit():
                raise ValidationError({"codigo": "Escribe los 6 dígitos que muestra el residente."})
            attempt_key = f"resident-qr-code-attempts:{operator.id_usuario}:{int(now.timestamp()) // 60}"
            cache.add(attempt_key, 0, timeout=120)
            if cache.incr(attempt_key) > 10:
                raise ValidationError({"codigo": "Se alcanzó el límite de intentos. Espera un minuto y vuelve a intentar."})
            codigo_hash = hashlib.sha256(
                f"{operator.id_establecimiento_id}:{codigo}".encode("utf-8")
            ).hexdigest()
            code_record = CodigoAccesoResidente.objects.select_for_update().filter(
                id_establecimiento_id=operator.id_establecimiento_id,
                codigo_hash=codigo_hash,
                fecha_expiracion__gt=now,
                fecha_uso__isnull=True,
            ).first()
            if not code_record:
                raise ValidationError({"codigo": "El código es incorrecto, venció o ya fue utilizado."})
            resident = code_record.id_residente
            vehicle = code_record.id_vehiculo
            establishment_id = code_record.id_establecimiento_id
        else:
            if not token:
                raise ValidationError({"token": "Escanea el QR o escribe el código de 6 dígitos del residente."})
            try:
                payload = signing.loads(token, salt="heimdall.resident.qr.v1", max_age=90)
            except signing.SignatureExpired as exc:
                raise ValidationError({"token": "El QR venció; pide al residente que actualice el código."}) from exc
            except signing.BadSignature as exc:
                raise ValidationError({"token": "El QR no es válido."}) from exc
            if payload.get("kind") != "heimdall-resident-access":
                raise ValidationError({"token": "El QR no corresponde a un acceso de residente."})

            establishment_id = int(payload.get("establishment_id", 0))
            if operator.id_establecimiento_id != establishment_id:
                raise PermissionDenied("El QR pertenece a otro establecimiento.")
            token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
            code_record = CodigoAccesoResidente.objects.select_for_update().filter(
                token_hash=token_hash,
                fecha_expiracion__gt=now,
                fecha_uso__isnull=True,
            ).first()
            if not code_record:
                raise ValidationError({"token": "Este QR ya venció o fue utilizado; solicita uno nuevo."})
            resident = code_record.id_residente
            vehicle = code_record.id_vehiculo
            if (
                resident.id_usuario != payload.get("resident_id")
                or code_record.id_establecimiento_id != establishment_id
                or code_record.id_vehiculo_id != payload.get("vehicle_id")
            ):
                raise ValidationError({"token": "El QR no corresponde a este residente o establecimiento."})

        establishment = Establecimiento.objects.select_related("id_plan").get(
            id_establecimiento=establishment_id,
        )
        _require_qr_feature(establishment)
        resident = Usuario.objects.select_related("id_rol", "id_establecimiento").filter(
            id_usuario=resident.id_usuario,
            id_establecimiento_id=establishment_id,
            id_rol_id=RESIDENTE_ROL_ID,
            estado=True,
        ).first()
        if not resident:
            raise ValidationError({"token": "El residente no está activo en este establecimiento."})
        if vehicle and not Vehiculo.objects.filter(
            id_vehiculo=vehicle.id_vehiculo,
            id_establecimiento_id=establishment_id,
            id_responsable__correo__iexact=resident.correo,
        ).exists():
            raise ValidationError({"token": "El vehículo asociado al QR ya no está autorizado."})

        movement = Movimiento.objects.create(
            id_establecimiento_id=establishment_id,
            id_vehiculo=vehicle,
            id_usuario=operator,
            placa_leida=vehicle.placa if vehicle else "QR-RESIDENTE",
            tipo_movimiento=action_type,
            fecha_evento=now,
            id_dispositivo=str(request.data.get("id_dispositivo") or "PORTERIA-QR")[:100],
            observacion=f"Acceso QR residente: {resident.nombre} ({resident.correo})",
            estado_sincronizacion=Movimiento.EstadoSync.SINCRONIZADO,
            fecha_sincronizacion=now,
        )
        code_record.fecha_uso = now
        code_record.save(update_fields=("fecha_uso",))
        return Response({
            "residente": {"id_usuario": resident.id_usuario, "nombre": resident.nombre},
            "movimiento": MovimientoDetalleSerializer(movement).data,
        }, status=status.HTTP_201_CREATED)


class InvitacionVisitanteViewSet(EstablecimientoQueryParamMixin, viewsets.ModelViewSet):
    serializer_class = InvitacionVisitanteSerializer
    lookup_field = "id_invitacion"
    http_method_names = ("get", "post", "head", "options")
    permission_classes = [IsTenantStaffOrResident]

    def get_base_queryset(self):
        return InvitacionVisitante.objects.select_related(
            "id_residente", "id_establecimiento", "id_movimiento_ingreso", "id_movimiento_salida"
        ).order_by("-fecha_creacion")

    def get_queryset(self):
        queryset = super().get_queryset()
        profile = get_usuario_perfil(self.request.user)
        if profile and profile_has_role(profile, RESIDENTE_ROL_ID):
            queryset = queryset.filter(id_residente_id=profile.id_usuario)
        return queryset

    def create(self, request, *args, **kwargs):
        profile = get_usuario_perfil(request.user)
        if not profile or not profile_has_role(profile, RESIDENTE_ROL_ID):
            raise PermissionDenied("Las invitaciones QR las crea el residente anfitrión.")
        _require_qr_feature(profile.id_establecimiento)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        raw_token = secrets.token_urlsafe(32)
        invitation = serializer.save(
            id_establecimiento=profile.id_establecimiento,
            id_residente=profile,
            token_hash=hashlib.sha256(raw_token.encode("utf-8")).hexdigest(),
        )
        response_data = self.get_serializer(invitation).data
        response_data["qr_token"] = raw_token
        return Response(response_data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=("post",))
    def revocar(self, request, id_invitacion=None):
        profile = get_usuario_perfil(request.user)
        invitation = self.get_object()
        is_resident = bool(profile and profile_has_role(profile, RESIDENTE_ROL_ID))
        if is_resident and invitation.id_residente_id != profile.id_usuario:
            raise PermissionDenied("Solo puedes revocar tus propias invitaciones.")
        if not _is_staff(profile) and not is_resident:
            raise PermissionDenied("No tienes permiso para revocar invitaciones.")
        if invitation.estado != InvitacionVisitante.Estado.PENDIENTE:
            raise ValidationError({"estado": "Solo se pueden revocar invitaciones pendientes."})
        invitation.estado = InvitacionVisitante.Estado.REVOCADA
        invitation.save(update_fields=("estado",))
        return Response(self.get_serializer(invitation).data)


class EscanearQRVisitanteView(APIView):
    permission_classes = [IsTenantStaff]

    @transaction.atomic
    def post(self, request):
        operator = get_usuario_perfil(request.user)
        if not _is_staff(operator):
            raise PermissionDenied("Solo vigilancia o administración puede validar visitantes.")
        raw_token = str(request.data.get("token", ""))
        action_type = str(request.data.get("tipo_movimiento", "")).upper()
        if not raw_token:
            raise ValidationError({"token": "Escanea el QR de la invitación."})
        if action_type not in ("INGRESO", "SALIDA"):
            raise ValidationError({"tipo_movimiento": "Usa INGRESO o SALIDA."})
        digest = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        invitation = InvitacionVisitante.objects.select_for_update().select_related(
            "id_residente", "id_establecimiento"
        ).filter(token_hash=digest).first()
        if not invitation:
            raise ValidationError({"token": "La invitación no existe o el QR fue alterado."})
        if invitation.id_establecimiento_id != operator.id_establecimiento_id:
            raise PermissionDenied("La invitación pertenece a otro establecimiento.")
        _require_qr_feature(invitation.id_establecimiento)

        now = timezone.now()
        if action_type == "INGRESO":
            if invitation.estado != InvitacionVisitante.Estado.PENDIENTE:
                raise ValidationError({"estado": "La invitación ya fue utilizada, revocada o finalizada."})
            if now < invitation.vigente_desde or now > invitation.vigente_hasta:
                raise ValidationError({"vigencia": "La invitación está fuera de su horario autorizado."})
        elif invitation.estado != InvitacionVisitante.Estado.EN_SITIO:
            raise ValidationError({"estado": "Solo un visitante que ya ingresó puede registrar su salida."})

        vehicle = None
        if invitation.placa_visitante:
            vehicle = Vehiculo.objects.filter(
                id_establecimiento_id=invitation.id_establecimiento_id,
                placa__iexact=invitation.placa_visitante,
            ).first()
        movement = Movimiento.objects.create(
            id_establecimiento_id=invitation.id_establecimiento_id,
            id_vehiculo=vehicle,
            id_usuario=operator,
            placa_leida=invitation.placa_visitante or "VISITANTE",
            tipo_movimiento=action_type,
            fecha_evento=now,
            id_dispositivo=str(request.data.get("id_dispositivo") or "PORTERIA-QR")[:100],
            observacion=(
                f"Invitado: {invitation.nombre_visitante}; residente anfitrión: "
                f"{invitation.id_residente.nombre} ({invitation.id_residente.correo}); "
                f"invitación #{invitation.id_invitacion}; motivo: {invitation.motivo or '—'}"
            )[:255],
            estado_sincronizacion=Movimiento.EstadoSync.SINCRONIZADO,
            fecha_sincronizacion=now,
        )
        if action_type == "INGRESO":
            invitation.estado = InvitacionVisitante.Estado.EN_SITIO
            invitation.fecha_ingreso = now
            invitation.id_movimiento_ingreso = movement
            invitation.save(update_fields=("estado", "fecha_ingreso", "id_movimiento_ingreso"))
        else:
            invitation.estado = InvitacionVisitante.Estado.FINALIZADA
            invitation.fecha_salida = now
            invitation.id_movimiento_salida = movement
            invitation.save(update_fields=("estado", "fecha_salida", "id_movimiento_salida"))

        return Response({
            "invitacion": InvitacionVisitanteSerializer(invitation).data,
            "movimiento": MovimientoDetalleSerializer(movement).data,
            "responsable_anfitrion": invitation.id_residente.nombre,
        }, status=status.HTTP_201_CREATED)
