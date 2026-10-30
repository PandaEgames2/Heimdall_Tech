from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import models, transaction
from rest_framework import serializers

from config.rbac import (
    BASE_ROLE_NAMES,
    LEGACY_PERMISSION_ALIASES,
    SUPERADMIN_REQUIRED_KEYS,
    get_role_permissions,
    resolve_effective_permissions,
    sync_role_permissions_cache,
    valid_permission_keys,
    validate_role_permissions,
)
from config.tenant_utils import RESIDENTE_ROL_ID, SUPER_ADMIN_ROL_ID, get_usuario_perfil, is_platform_superadmin

from .models import Recurso, Rol, RolHasRecurso, Usuario, UsuarioHasRol

User = get_user_model()


def _user_role_ids(usuario: Usuario | None) -> list[int]:
    """Roles del usuario desde la tabla puente, con el principal como respaldo."""

    if usuario is None:
        return []
    ids: list[int] = []
    if usuario.id_rol_id:
        ids.append(usuario.id_rol_id)
    try:
        for assignment in usuario.roles_asignados.all():
            role_id = getattr(assignment, "id_rol_id", None)
            if role_id and role_id not in ids:
                ids.append(role_id)
    except Exception:
        pass
    return ids


def _roles_by_ids(role_ids: list[int]) -> list[Rol]:
    normalized = list(dict.fromkeys(int(role_id) for role_id in role_ids))
    roles = list(Rol.objects.filter(pk__in=normalized))
    missing = sorted(set(normalized) - {role.id_rol for role in roles})
    if missing:
        raise serializers.ValidationError(
            {"roles_ids": f"No existen los roles: {', '.join(map(str, missing))}."}
        )
    by_id = {role.id_rol: role for role in roles}
    return [by_id[role_id] for role_id in normalized]


def _resources_by_ids(resource_ids: list[int]) -> list[Recurso]:
    normalized = list(dict.fromkeys(int(resource_id) for resource_id in resource_ids))
    resources = list(Recurso.objects.filter(pk__in=normalized).order_by("orden", "id_recurso"))
    missing = sorted(set(normalized) - {resource.id_recurso for resource in resources})
    if missing:
        raise serializers.ValidationError(
            {"recursos_ids": f"No existen los recursos: {', '.join(map(str, missing))}."}
        )
    by_id = {resource.id_recurso: resource for resource in resources}
    return [by_id[resource_id] for resource_id in normalized]


def _resources_by_keys(keys: list[str]) -> list[Recurso]:
    normalized = [LEGACY_PERMISSION_ALIASES.get(str(key), str(key)) for key in keys]
    resources = list(Recurso.objects.filter(clave__in=normalized).order_by("orden", "id_recurso"))
    by_key = {resource.clave: resource for resource in resources}
    missing = sorted({key for key in normalized if key not in by_key})
    if missing:
        raise serializers.ValidationError(
            {"permisos": f"No existen los recursos: {', '.join(missing)}."}
        )
    return [by_key[key] for key in dict.fromkeys(normalized)]


def _replace_role_resources(role: Rol, resources: list[Recurso] | None) -> None:
    if resources is None:
        return
    RolHasRecurso.objects.filter(id_rol_id=role.id_rol).delete()
    if resources:
        RolHasRecurso.objects.bulk_create(
            [RolHasRecurso(id_rol_id=role.id_rol, id_recurso_id=resource.id_recurso) for resource in resources],
            ignore_conflicts=True,
        )


def _replace_user_roles(usuario: Usuario, roles: list[Rol]) -> None:
    UsuarioHasRol.objects.filter(id_usuario_id=usuario.id_usuario).delete()
    if roles:
        UsuarioHasRol.objects.bulk_create(
            [UsuarioHasRol(id_usuario_id=usuario.id_usuario, id_rol_id=role.id_rol) for role in roles],
            ignore_conflicts=True,
        )
    # El objeto pudo llegar con `roles_asignados` precargado por el ViewSet.
    try:
        usuario._prefetched_objects_cache.pop("roles_asignados", None)
    except Exception:
        pass


def _sync_django_user(usuario: Usuario, password_hash: str | None = None, password_changed: bool = False):
    """Sincroniza auth_user sin duplicar el hash en cuentas no administrativas."""

    username = (usuario.correo or "").strip().lower()
    is_superadmin = SUPER_ADMIN_ROL_ID in set(_user_role_ids(usuario))
    django_user = User.objects.filter(username=username).first()
    if django_user is None:
        django_user = User(username=username)
        created = True
    else:
        created = False

    django_user.email = (usuario.correo or "").strip().lower()
    django_user.first_name = usuario.nombre.split()[0] if usuario.nombre else ""
    django_user.last_name = " ".join(usuario.nombre.split()[1:]) if usuario.nombre else ""
    django_user.is_active = bool(usuario.estado)
    django_user.is_staff = is_superadmin
    django_user.is_superuser = is_superadmin

    if is_superadmin:
        if password_changed and password_hash:
            django_user.password = password_hash
        elif created and not django_user.password:
            django_user.set_unusable_password()
    else:
        django_user.set_unusable_password()

    django_user.save()
    return django_user


class RecursoSerializer(serializers.ModelSerializer):
    roles_count = serializers.SerializerMethodField()

    class Meta:
        model = Recurso
        fields = (
            "id_recurso",
            "clave",
            "nombre",
            "descripcion",
            "grupo",
            "tipo",
            "estado",
            "orden",
            "es_sistema",
            "roles_count",
        )
        read_only_fields = ("id_recurso", "es_sistema", "roles_count")

    def get_roles_count(self, obj):
        try:
            return obj.roles_asignados.count()
        except Exception:
            return 0

    def validate_clave(self, value):
        normalized = (value or "").strip().lower()
        if not normalized:
            raise serializers.ValidationError("La clave es obligatoria.")
        if not all(char.isalnum() or char == "_" for char in normalized):
            raise serializers.ValidationError("Usa solo letras minúsculas, números y guion bajo.")
        queryset = Recurso.objects.filter(clave__iexact=normalized)
        if self.instance is not None:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("Ya existe un recurso con esa clave.")
        return normalized

    def validate(self, attrs):
        instance = self.instance
        if instance is not None and instance.es_sistema:
            if "clave" in attrs and attrs["clave"] != instance.clave:
                raise serializers.ValidationError(
                    {"clave": "Los recursos del sistema no pueden cambiar de clave."}
                )
            if "tipo" in attrs and attrs["tipo"] != instance.tipo:
                raise serializers.ValidationError(
                    {"tipo": "Los recursos del sistema no pueden cambiar de tipo."}
                )
            if attrs.get("estado") is False:
                raise serializers.ValidationError(
                    {"estado": "Los recursos del sistema no pueden desactivarse."}
                )
        return attrs

    def create(self, validated_data):
        if "orden" not in validated_data or validated_data.get("orden") is None:
            last = Recurso.objects.order_by("-orden").first()
            validated_data["orden"] = (last.orden if last else 0) + 10
        validated_data["es_sistema"] = False
        return super().create(validated_data)


class RolSerializer(serializers.ModelSerializer):
    usuarios_count = serializers.SerializerMethodField()
    recursos_count = serializers.SerializerMethodField()
    es_sistema = serializers.SerializerMethodField()
    recursos_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        allow_empty=True,
    )

    class Meta:
        model = Rol
        fields = (
            "id_rol",
            "nombre",
            "descripcion",
            "permisos",
            "recursos_ids",
            "recursos_count",
            "es_sistema",
            "usuarios_count",
        )
        read_only_fields = ("id_rol", "es_sistema", "usuarios_count", "recursos_count")

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["permisos"] = get_role_permissions(instance)
        resource_ids = list(
            RolHasRecurso.objects.filter(id_rol_id=instance.id_rol)
            .order_by("id_recurso__orden", "id_recurso_id")
            .values_list("id_recurso_id", flat=True)
        )
        data["recursos_ids"] = resource_ids
        data["recursos_count"] = len(resource_ids)
        data["es_sistema"] = instance.nombre in BASE_ROLE_NAMES
        return data

    def get_usuarios_count(self, obj):
        try:
            return obj.usuario_asignaciones.values("id_usuario_id").distinct().count()
        except Exception:
            return obj.usuarios.count()

    def get_recursos_count(self, obj):
        try:
            return obj.recursos_asignados.count()
        except Exception:
            return 0

    def get_es_sistema(self, obj):
        return obj.nombre in BASE_ROLE_NAMES

    def validate_permisos(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Los permisos deben enviarse como una lista.")
        return value

    def validate(self, attrs):
        instance = self.instance
        role_name = attrs.get("nombre", getattr(instance, "nombre", "")) or ""
        role_name = role_name.strip()

        if instance is not None and instance.nombre in BASE_ROLE_NAMES:
            if "nombre" in attrs and attrs["nombre"].strip() != instance.nombre:
                raise serializers.ValidationError(
                    {"nombre": "Los roles base del sistema no se pueden renombrar."}
                )

        if "nombre" in attrs:
            if not role_name:
                raise serializers.ValidationError({"nombre": "El nombre del rol es obligatorio."})
            duplicate = Rol.objects.filter(nombre__iexact=role_name)
            if instance is not None:
                duplicate = duplicate.exclude(pk=instance.pk)
            if duplicate.exists():
                raise serializers.ValidationError({"nombre": "Ya existe un rol con ese nombre."})
            attrs["nombre"] = role_name

        resources: list[Recurso] | None = None
        resource_keys: list[str] | None = None

        if "recursos_ids" in attrs:
            resources = _resources_by_ids(attrs.pop("recursos_ids"))
            resource_keys = [resource.clave for resource in resources]
        elif "permisos" in attrs:
            try:
                resource_keys = validate_role_permissions(attrs["permisos"], role_name=role_name)
            except ValueError as exc:
                raise serializers.ValidationError({"permisos": str(exc)}) from exc
            resources = _resources_by_keys(resource_keys)

        if instance is None and resources is None:
            # Un rol nuevo siempre nace con Dashboard para no quedar inaccesible.
            resources = _resources_by_keys(["dashboard"])
            resource_keys = [resource.clave for resource in resources]

        if resource_keys is None and instance is not None:
            resource_keys = get_role_permissions(instance)

        if role_name == "Super Admin":
            missing = SUPERADMIN_REQUIRED_KEYS - set(resource_keys or [])
            if missing:
                raise serializers.ValidationError(
                    {"recursos_ids": "Super Admin debe conservar dashboard, usuarios, roles y recursos."}
                )

        if resource_keys is not None:
            attrs["permisos"] = resource_keys
        if resources is not None:
            attrs["_recurso_objects"] = resources
        else:
            attrs["_recurso_objects"] = None

        return attrs

    def create(self, validated_data):
        resources = validated_data.pop("_recurso_objects", None)
        with transaction.atomic():
            role = super().create(validated_data)
            _replace_role_resources(role, resources)
            sync_role_permissions_cache(role.id_rol)
            role.refresh_from_db()
        return role

    def update(self, instance, validated_data):
        resources = validated_data.pop("_recurso_objects", None)
        with transaction.atomic():
            role = super().update(instance, validated_data)
            if resources is not None:
                _replace_role_resources(role, resources)
            sync_role_permissions_cache(role.id_rol)
            role.refresh_from_db()
        return role


class UsuarioResumenSerializer(serializers.ModelSerializer):
    """Vista anidada: no expone credenciales ni datos sensibles."""

    class Meta:
        model = Usuario
        fields = ("id_usuario", "nombre", "correo", "estado")


class UsuarioSerializer(serializers.ModelSerializer):
    rol = RolSerializer(source="id_rol", read_only=True)
    roles = serializers.SerializerMethodField()
    roles_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        required=False,
        allow_empty=False,
    )
    id_rol = serializers.PrimaryKeyRelatedField(queryset=Rol.objects.all(), required=False)
    password = serializers.CharField(write_only=True, required=False, allow_blank=False)
    residente_documento = serializers.CharField(write_only=True, required=False, allow_blank=True)
    residente_telefono = serializers.CharField(write_only=True, required=False, allow_blank=True)
    residente_unidad = serializers.CharField(write_only=True, required=False, allow_blank=True)
    permisos_efectivos = serializers.SerializerMethodField()
    acciones = serializers.SerializerMethodField()

    class Meta:
        model = Usuario
        fields = (
            "id_usuario",
            "id_establecimiento",
            "id_rol",
            "rol",
            "roles",
            "roles_ids",
            "nombre",
            "correo",
            "password",
            "residente_documento",
            "residente_telefono",
            "residente_unidad",
            "estado",
            "fecha_creacion",
            "permisos_excepciones",
            "permisos_efectivos",
            "acciones",
        )

    def _request_user(self):
        request = self.context.get("request")
        return getattr(request, "user", None)

    def _platform_admin(self):
        return is_platform_superadmin(self._request_user())

    def get_roles(self, obj):
        principal = obj.id_rol_id
        payload = []
        seen = set()
        try:
            assignments = list(obj.roles_asignados.all())
        except Exception:
            assignments = []
        for assignment in assignments:
            role = assignment.id_rol
            if role is None or role.id_rol in seen:
                continue
            seen.add(role.id_rol)
            payload.append(
                {
                    "id_rol": role.id_rol,
                    "nombre": role.nombre,
                    "descripcion": role.descripcion or "",
                    "es_principal": role.id_rol == principal,
                }
            )
        if obj.id_rol_id and obj.id_rol_id not in seen and obj.id_rol is not None:
            payload.insert(
                0,
                {
                    "id_rol": obj.id_rol_id,
                    "nombre": obj.id_rol.nombre,
                    "descripcion": obj.id_rol.descripcion or "",
                    "es_principal": True,
                },
            )
        return payload

    def get_permisos_efectivos(self, obj):
        access = resolve_effective_permissions(
            obj,
            is_superadmin=SUPER_ADMIN_ROL_ID in set(_user_role_ids(obj)),
        )
        return access["permisos"]

    def get_acciones(self, obj):
        access = resolve_effective_permissions(
            obj,
            is_superadmin=SUPER_ADMIN_ROL_ID in set(_user_role_ids(obj)),
        )
        return {
            "puede_editar": access["puede_editar"],
            "puede_eliminar": access["puede_eliminar"],
            "solo_lectura": access["solo_lectura"],
        }

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["roles_ids"] = _user_role_ids(instance)
        data["roles"] = self.get_roles(instance)
        if not self._platform_admin():
            # Las excepciones individuales son información sensible del RBAC:
            # sólo el Super Admin puede consultarlas o modificarlas.
            data.pop("permisos_excepciones", None)
        return data

    def validate_correo(self, value):
        normalized = (value or "").strip().lower()
        if not normalized:
            raise serializers.ValidationError("El correo es obligatorio.")
        profiles = Usuario.objects.filter(correo__iexact=normalized)
        if self.instance is not None:
            profiles = profiles.exclude(pk=self.instance.pk)
        if profiles.exists():
            raise serializers.ValidationError("El correo ya está asociado a otro usuario.")
        django_users = User.objects.filter(username__iexact=normalized)
        if self.instance is not None:
            django_users = django_users.exclude(pk__in=User.objects.filter(email__iexact=self.instance.correo).values("pk"))
        if django_users.exists():
            raise serializers.ValidationError("El correo ya está asociado a una cuenta de acceso.")
        return normalized

    def validate_permisos_excepciones(self, value):
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("Las excepciones deben ser un objeto JSON.")
        allowed = set(valid_permission_keys())
        if len(value) > max(1, len(allowed)):
            raise serializers.ValidationError("Se enviaron demasiadas excepciones de permisos.")
        cleaned: dict[str, bool] = {}
        unknown: list[str] = []
        for key, raw in value.items():
            normalized = LEGACY_PERMISSION_ALIASES.get(str(key), str(key))
            if normalized not in allowed:
                unknown.append(str(key))
                continue
            if not isinstance(raw, bool):
                raise serializers.ValidationError(f"El permiso «{key}» debe ser verdadero o falso.")
            cleaned[normalized] = raw
        if unknown:
            raise serializers.ValidationError(f"Permisos desconocidos: {', '.join(sorted(unknown))}.")
        return cleaned

    def validate(self, attrs):
        request_user = self._request_user()
        platform_admin = self._platform_admin()
        password = attrs.get("password")
        instance = self.instance

        if instance is None and not password:
            raise serializers.ValidationError({"password": "La contraseña es obligatoria."})
        if password:
            if len(password) < 8:
                raise serializers.ValidationError({"password": "Usa una contraseña de al menos 8 caracteres."})
            candidate = User(
                username=(attrs.get("correo") or getattr(instance, "correo", "") or "").lower(),
                email=(attrs.get("correo") or getattr(instance, "correo", "") or "").lower(),
                first_name=(attrs.get("nombre") or getattr(instance, "nombre", "") or "").split()[:1][0]
                if (attrs.get("nombre") or getattr(instance, "nombre", ""))
                else "",
            )
            try:
                validate_password(password, user=candidate)
            except DjangoValidationError as exc:
                raise serializers.ValidationError({"password": list(exc.messages)}) from exc

        current_role_ids = _user_role_ids(instance)
        principal = attrs.get("id_rol", getattr(instance, "id_rol", None))
        principal_id = getattr(principal, "id_rol", principal)

        roles: list[Rol] | None = None
        roles_provided = False
        if "roles_ids" in attrs:
            roles = _roles_by_ids(attrs.pop("roles_ids"))
            roles_provided = True
        elif instance is not None and principal_id and principal_id != instance.id_rol_id:
            # Cambiar el rol principal sin enviar roles_ids conserva los roles
            # secundarios y sustituye únicamente el principal anterior.
            secondary = [role_id for role_id in current_role_ids if role_id != instance.id_rol_id]
            roles = _roles_by_ids([int(principal_id)] + secondary)
            roles_provided = True
        elif instance is None:
            if not principal_id:
                raise serializers.ValidationError({"roles_ids": "Selecciona al menos un rol."})
            roles = _roles_by_ids([int(principal_id)])
            roles_provided = True

        if roles is not None:
            role_ids = [role.id_rol for role in roles]
            if principal_id is None:
                principal_id = role_ids[0]
            if principal_id not in role_ids:
                # El rol principal siempre forma parte del conjunto asignado.
                principal_role = Rol.objects.filter(pk=principal_id).first()
                if principal_role is None:
                    raise serializers.ValidationError({"id_rol": "El rol principal no existe."})
                roles = [principal_role] + roles
                role_ids = [role.id_rol for role in roles]
            if not role_ids:
                raise serializers.ValidationError({"roles_ids": "El usuario debe tener al menos un rol."})
            principal_id = role_ids[0]
            attrs["id_rol"] = roles[0]
            attrs["_roles"] = roles
        else:
            role_ids = current_role_ids or ([principal_id] if principal_id else [])

        attrs["_roles_provided"] = roles_provided
        final_role_ids = [role.id_rol for role in roles] if roles is not None else role_ids

        if "permisos_excepciones" in attrs and not platform_admin:
            raise serializers.ValidationError(
                {"permisos_excepciones": "Solo un Super Admin puede asignar excepciones de permisos."}
            )

        if instance is not None and attrs.get("estado") is False:
            perfil_solicitante = get_usuario_perfil(request_user)
            if perfil_solicitante and perfil_solicitante.id_usuario == instance.id_usuario:
                raise serializers.ValidationError(
                    {"estado": "No puedes desactivar tu propia cuenta."}
                )

        assignable_tenant_roles = {2, 3, RESIDENTE_ROL_ID}
        if not platform_admin:
            selecting_superadmin = SUPER_ADMIN_ROL_ID in final_role_ids
            if selecting_superadmin:
                raise serializers.ValidationError(
                    {"roles_ids": "Solo un Super Admin puede asignar el rol Super Admin."}
                )
            if roles_provided and set(final_role_ids) != set(current_role_ids):
                forbidden = [role_id for role_id in final_role_ids if role_id not in assignable_tenant_roles]
                if forbidden:
                    raise serializers.ValidationError(
                        {"roles_ids": "Solo puedes asignar Supervisor, Vigilante o Residente."}
                    )
            profile = get_usuario_perfil(request_user)
            target_establishment = attrs.get("id_establecimiento", getattr(instance, "id_establecimiento", None))
            if profile and target_establishment and target_establishment.pk != profile.id_establecimiento_id:
                raise serializers.ValidationError({"id_establecimiento": "Solo puedes gestionar usuarios de tu establecimiento."})
            if instance is not None and SUPER_ADMIN_ROL_ID in current_role_ids:
                raise serializers.ValidationError("Solo un Super Admin puede modificar una cuenta Super Admin.")

        is_resident_principal = principal_id == RESIDENTE_ROL_ID
        was_resident_principal = instance is not None and instance.id_rol_id == RESIDENTE_ROL_ID
        if (
            is_resident_principal
            and not was_resident_principal
            and not (attrs.get("residente_documento") or "").strip()
        ):
            raise serializers.ValidationError({"residente_documento": "El documento es obligatorio para registrar un residente."})

        # Protección del último Super Admin activo de la plataforma.
        if instance is not None and SUPER_ADMIN_ROL_ID in current_role_ids:
            will_remain_active = attrs.get("estado", instance.estado) is not False
            will_keep_superadmin = SUPER_ADMIN_ROL_ID in final_role_ids
            if not (will_remain_active and will_keep_superadmin):
                others = (
                    Usuario.objects.filter(estado=True)
                    .filter(
                        models.Q(id_rol_id=SUPER_ADMIN_ROL_ID)
                        | models.Q(roles_asignados__id_rol_id=SUPER_ADMIN_ROL_ID)
                    )
                    .exclude(pk=instance.pk)
                    .distinct()
                )
                if not others.exists():
                    raise serializers.ValidationError(
                        "No puedes desactivar o degradar al último Super Admin activo de la plataforma."
                    )

        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        roles = validated_data.pop("_roles", None) or []
        validated_data.pop("_roles_provided", None)
        resident_document = validated_data.pop("residente_documento", "").strip()
        resident_phone = validated_data.pop("residente_telefono", "").strip()
        resident_unit = validated_data.pop("residente_unidad", "").strip()
        with transaction.atomic():
            usuario = super().create(validated_data)
            if password:
                usuario.password_hash = make_password(password)
                usuario.save(update_fields=["password_hash"])
            if roles:
                _replace_user_roles(usuario, roles)
            else:
                _replace_user_roles(usuario, [usuario.id_rol])
            _sync_django_user(
                usuario,
                password_hash=usuario.password_hash,
                password_changed=bool(password),
            )
            if usuario.id_rol_id == RESIDENTE_ROL_ID:
                from app_operaciones.models import Responsable

                Responsable.objects.update_or_create(
                    id_establecimiento=usuario.id_establecimiento,
                    documento_identidad=resident_document,
                    defaults={
                        "nombre": usuario.nombre,
                        "telefono": resident_phone or None,
                        "correo": usuario.correo,
                        "departamento_unidad": resident_unit or None,
                    },
                )
        return usuario

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        roles = validated_data.pop("_roles", None)
        roles_provided = validated_data.pop("_roles_provided", False)
        validated_data.pop("residente_documento", None)
        validated_data.pop("residente_telefono", None)
        validated_data.pop("residente_unidad", None)
        previous_email = instance.correo
        with transaction.atomic():
            usuario = super().update(instance, validated_data)
            if roles_provided:
                _replace_user_roles(usuario, roles or [usuario.id_rol])
            if password:
                usuario.password_hash = make_password(password)
                usuario.save(update_fields=["password_hash"])
            _sync_django_user(
                usuario,
                password_hash=usuario.password_hash,
                password_changed=bool(password),
            )
            if usuario.id_rol_id == RESIDENTE_ROL_ID:
                from app_operaciones.models import Responsable

                Responsable.objects.filter(
                    id_establecimiento=usuario.id_establecimiento,
                    correo__iexact=previous_email,
                ).update(nombre=usuario.nombre, correo=usuario.correo)
        return usuario
