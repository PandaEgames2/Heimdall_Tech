import mimetypes
import re
import statistics
import threading
import uuid

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.http import FileResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from config.mixins import EstablecimientoQueryParamMixin
from config.permissions import HasLprFeature, IsTenantStaff

from .models import ReconocimientoPlaca
from .serializers import ReconocimientoPlacaDetalleSerializer, ReconocimientoPlacaSerializer

MAX_IMAGE_BYTES = 8 * 1024 * 1024
_alpr_engine = None
_alpr_lock = threading.Lock()


class ReconocimientoPlacaViewSet(EstablecimientoQueryParamMixin, viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsTenantStaff, HasLprFeature]
    lookup_field = "id_reconocimiento"
    search_fields = ("placa_detectada", "id_dispositivo", "resultado_ia")
    ordering_fields = ("fecha_procesamiento", "nivel_confianza", "resultado_ia")

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ReconocimientoPlacaDetalleSerializer
        return ReconocimientoPlacaSerializer

    def get_base_queryset(self):
        return ReconocimientoPlaca.objects.select_related(
            "id_movimiento",
            "id_movimiento__id_vehiculo",
            "id_usuario",
            "id_usuario__id_rol",
        ).order_by("-fecha_procesamiento")

    @action(
        detail=False,
        methods=("post",),
        parser_classes=(MultiPartParser, FormParser),
        url_path="procesar",
    )
    def procesar(self, request):
        """Procesa una captura con FastALPR (YOLO DNN + OCR ONNX)."""
        from config.tenant_utils import get_usuario_perfil

        profile = get_usuario_perfil(request.user)
        if not profile:
            raise ValidationError({"usuario": "No se encontró el perfil del usuario."})

        uploaded = request.FILES.get("imagen")
        if not uploaded:
            raise ValidationError({"imagen": "Adjunta una imagen de la cámara."})
        if uploaded.size > MAX_IMAGE_BYTES:
            raise ValidationError({"imagen": "La imagen no puede superar los 8 MB."})
        if uploaded.content_type not in {"image/jpeg", "image/png", "image/webp"}:
            raise ValidationError({"imagen": "Usa una imagen JPG, PNG o WebP."})

        try:
            import cv2
            import numpy as np
        except ImportError:
            return Response(
                {"detail": "Faltan OpenCV y NumPy. Instala las dependencias con: pip install -r backend/requirements.txt"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        image_bytes = uploaded.read()
        image = cv2.imdecode(np.frombuffer(image_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
        if image is None:
            raise ValidationError({"imagen": "No se pudo abrir la imagen. Captura la placa nuevamente."})

        try:
            global _alpr_engine
            if _alpr_engine is None:
                with _alpr_lock:
                    if _alpr_engine is None:
                        from fast_alpr import ALPR

                        _alpr_engine = ALPR(
                            detector_model="yolo-v9-t-384-license-plate-end2end",
                            ocr_model="cct-xs-v2-global-model",
                            ocr_device="cpu",
                        )
            detections = _alpr_engine.predict(image)
        except ImportError:
            return Response(
                {"detail": "Falta FastALPR. Instala las dependencias con: pip install -r backend/requirements.txt"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except Exception:
            return Response(
                {"detail": "No se pudo cargar el modelo DNN. Revisa la conexión para la descarga inicial de modelos y vuelve a intentar."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        if not detections:
            return Response({"detectado": False, "mensaje": "No se encontró una placa. Ajusta el encuadre y vuelve a capturar."})

        extension = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[uploaded.content_type]
        image_name = default_storage.save(
            f"reconocimientos/{profile.id_establecimiento_id}/{uuid.uuid4().hex}.{extension}",
            ContentFile(image_bytes),
        )
        response_rows = []
        for result in detections:
            ocr = result.ocr
            plate = re.sub(r"[^A-Z0-9]", "", (ocr.text if ocr else "").upper())[:15]
            ocr_confidence = 0.0
            if ocr and ocr.confidence is not None:
                ocr_confidence = (
                    statistics.mean(ocr.confidence)
                    if isinstance(ocr.confidence, list)
                    else float(ocr.confidence)
                )
            confidence = round(max(0.0, min(1.0, min(float(result.detection.confidence), ocr_confidence))) * 100, 2)
            registered = bool(plate) and profile.id_establecimiento.vehiculos.filter(placa__iexact=plate).exists()
            record = ReconocimientoPlaca.objects.create(
                id_establecimiento=profile.id_establecimiento,
                id_usuario=profile,
                id_dispositivo=str(request.data.get("id_dispositivo") or "CAMARA-WEB-LPR")[:100],
                url_fotografia=image_name,
                placa_detectada=plate or "SIN_LECTURA",
                nivel_confianza=confidence,
                resultado_ia=(
                    ReconocimientoPlaca.ResultadoIA.COINCIDE
                    if registered and confidence >= 60
                    else ReconocimientoPlaca.ResultadoIA.NO_COINCIDE
                    if plate
                    else ReconocimientoPlaca.ResultadoIA.ALERTA
                ),
            )
            response_rows.append(ReconocimientoPlacaSerializer(record).data)

        return Response(
            {
                "detectado": True,
                "motor": "FastALPR DNN (YOLOv9 + ONNX OCR)",
                "requiere_confirmacion_vigilante": True,
                "resultados": response_rows,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=("get",), url_path="imagen")
    def imagen(self, request, id_reconocimiento=None):
        recognition = self.get_object()
        try:
            image_file = default_storage.open(recognition.url_fotografia, "rb")
        except OSError:
            return Response({"detail": "La imagen de este reconocimiento ya no está disponible."}, status=404)
        content_type, _ = mimetypes.guess_type(recognition.url_fotografia)
        return FileResponse(image_file, content_type=content_type or "application/octet-stream")
