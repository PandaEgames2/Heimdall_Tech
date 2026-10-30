import { useMemo, useState } from 'react';
import Modal from '../../components/Modal';
import { apiFetch } from '../../lib/api';

const FALLBACK_CATALOG = [
  { key: 'dashboard', label: 'Dashboard', group: 'General', description: 'Resumen operativo y métricas.', tipo: 'modulo' },
  { key: 'accesos', label: 'Control de acceso', group: 'Operación', description: 'Ingresos, salidas e incidencias.', tipo: 'modulo' },
  { key: 'camaras', label: 'Cámaras', group: 'Operación', description: 'Captura y reconocimiento LPR/IA.', tipo: 'modulo' },
  { key: 'mi_qr', label: 'Mi QR e invitados', group: 'Operación', description: 'QR de residente e invitaciones.', tipo: 'modulo' },
  { key: 'usuarios', label: 'Usuarios', group: 'Administración', description: 'Gestión de cuentas.', tipo: 'modulo' },
  { key: 'roles', label: 'Roles y permisos', group: 'Administración', description: 'Permisos globales de los roles.', tipo: 'modulo' },
  { key: 'recursos', label: 'Recursos', group: 'Administración', description: 'Catálogo de módulos y acciones.', tipo: 'modulo' },
  { key: 'catalogos', label: 'Catálogo', group: 'Administración', description: 'Planes, sedes, vehículos y responsables.', tipo: 'modulo' },
  { key: 'reportes', label: 'Reportes', group: 'Administración', description: 'Historial y trazabilidad.', tipo: 'modulo' },
  { key: 'seguridad', label: 'Seguridad', group: 'Sistema', description: 'Auditoría y estado del sistema.', tipo: 'modulo' },
  { key: 'puede_editar', label: 'Permiso de edición', group: 'Políticas de escritura', description: 'Habilita cambios administrativos.', tipo: 'accion' },
  { key: 'puede_eliminar', label: 'Permiso de eliminación', group: 'Políticas de escritura', description: 'Habilita operaciones destructivas.', tipo: 'accion' },
  { key: 'solo_lectura', label: 'Solo lectura', group: 'Políticas de escritura', description: 'Prevalece y bloquea toda escritura.', tipo: 'accion' },
];

const FALLBACK_ROLES = [
  { id_rol: 4, nombre: 'Super Admin', descripcion: 'Administración global de la plataforma y del RBAC.', permisos: ['dashboard', 'accesos', 'camaras', 'mi_qr', 'usuarios', 'roles', 'recursos', 'catalogos', 'reportes', 'seguridad', 'puede_editar', 'puede_eliminar'] },
  { id_rol: 1, nombre: 'Administrador', descripcion: 'Control operativo y de usuarios de su establecimiento.', permisos: ['dashboard', 'usuarios', 'catalogos', 'reportes', 'camaras', 'accesos', 'puede_editar', 'puede_eliminar'] },
  { id_rol: 3, nombre: 'Supervisor', descripcion: 'Auditoría, reportes y supervisión de la operación.', permisos: ['dashboard', 'reportes', 'camaras', 'accesos'] },
  { id_rol: 2, nombre: 'Vigilante', descripcion: 'Operación de portería, accesos y novedades.', permisos: ['dashboard', 'camaras', 'accesos'] },
  { id_rol: 5, nombre: 'Residente', descripcion: 'Consulta su QR y administra invitaciones de visitantes.', permisos: ['mi_qr'] },
];

const TABS = [
  { key: 'general', label: 'Datos Generales' },
  { key: 'role', label: 'Roles' },
  { key: 'permissions', label: 'Permisos Especiales' },
];

const ASSIGNABLE_TENANT_ROLES = [2, 3, 5];

const normalizeCatalogItem = (item) => ({
  ...item,
  key: item.key || item.clave || '',
  label: item.label || item.nombre || item.clave || '',
  group: item.group || item.grupo || 'General',
  description: item.description || item.descripcion || '',
  tipo: item.tipo || 'modulo',
  estado: item.estado !== false,
});

const emptyForm = (defaultEstablishmentId, defaultRoleId) => ({
  nombre: '',
  correo: '',
  password: '',
  estado: true,
  id_establecimiento: defaultEstablishmentId || '',
  id_rol: defaultRoleId || 2,
  roles_ids: [Number(defaultRoleId || 2)],
  residente_documento: '',
  residente_telefono: '',
  residente_unidad: '',
});

export default function UserAccessModal({
  open,
  user,
  roles = [],
  catalogo = [],
  establecimientos = [],
  isSuperAdmin = false,
  defaultEstablishmentId,
  initialTab = 'general',
  onClose,
  onSaved,
}) {
  const isEditing = Boolean(user?.id);
  const permissionCatalog = useMemo(
    () => (catalogo.length > 0 ? catalogo : FALLBACK_CATALOG).map(normalizeCatalogItem),
    [catalogo],
  );

  const roleList = useMemo(() => {
    const source = roles.length > 0 ? roles : FALLBACK_ROLES;
    const seen = new Set();
    return source.filter((role) => {
      const id = Number(role.id_rol);
      if (!Number.isFinite(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    }).map((role) => ({
      ...role,
      id_rol: Number(role.id_rol),
      permisos: Array.isArray(role.permisos) ? role.permisos : [],
    }));
  }, [roles]);

  const initialRoleIds = useMemo(() => {
    if (!user) return null;
    if (Array.isArray(user.roles_ids) && user.roles_ids.length > 0) {
      return [...new Set(user.roles_ids.map(Number))];
    }
    if (Array.isArray(user.roles) && user.roles.length > 0) {
      return [...new Set(user.roles.map((role) => Number(role.id_rol)))];
    }
    return [Number(user.id_rol || user.rolId || 2)];
  }, [user]);

  const currentRoleIds = initialRoleIds || [];
  const initialPrincipal = Number(user?.id_rol || user?.rolId || currentRoleIds[0] || (isSuperAdmin ? 1 : 2));
  const rolesLocked = !isSuperAdmin
    && currentRoleIds.some((roleId) => !ASSIGNABLE_TENANT_ROLES.includes(roleId));

  const initial = useMemo(() => (user ? {
    nombre: user.nombre || '',
    correo: user.email || user.correo || '',
    password: '',
    estado: user.activo ?? (user.estado === 'Activo' || user.estado === true),
    id_establecimiento: user.id_establecimiento || defaultEstablishmentId || '',
    id_rol: initialPrincipal,
    roles_ids: initialRoleIds,
    residente_documento: '',
    residente_telefono: '',
    residente_unidad: '',
  } : emptyForm(defaultEstablishmentId, isSuperAdmin ? 1 : 2)), [
    user,
    defaultEstablishmentId,
    isSuperAdmin,
    initialPrincipal,
    initialRoleIds,
  ]);

  const wasResident = isEditing && Number(user?.id_rol || user?.rolId) === 5;
  const [activeTab, setActiveTab] = useState(initialTab);
  const [form, setForm] = useState(initial);
  const [overrides, setOverrides] = useState(user?.permisos_excepciones || {});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const assignableRoleIds = isSuperAdmin
    ? roleList.map((role) => role.id_rol)
    : [...ASSIGNABLE_TENANT_ROLES, ...currentRoleIds];

  const availableRoles = roleList.filter((role) => assignableRoleIds.includes(role.id_rol));
  const selectedRoles = form.roles_ids
    .map((roleId) => roleList.find((role) => role.id_rol === Number(roleId)))
    .filter(Boolean);
  const principalRole = roleList.find((role) => role.id_rol === Number(form.id_rol))
    || selectedRoles[0]
    || null;

  const inheritedPermissions = useMemo(() => {
    const union = new Set();
    selectedRoles.forEach((role) => role.permisos.forEach((key) => union.add(key)));
    return union;
  }, [selectedRoles]);

  const groupedCatalog = useMemo(() => {
    const groups = new Map();
    permissionCatalog.forEach((item) => {
      const group = item.group || 'General';
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(item);
    });
    return [...groups.entries()];
  }, [permissionCatalog]);

  const effectivePermission = (key) => {
    if (Object.prototype.hasOwnProperty.call(overrides, key)) return Boolean(overrides[key]);
    return inheritedPermissions.has(key);
  };

  const permissionMode = (key) => {
    if (!Object.prototype.hasOwnProperty.call(overrides, key)) return 'inherit';
    return overrides[key] ? 'allow' : 'deny';
  };

  const setPermissionMode = (key, mode) => {
    setDirty(true);
    setOverrides((current) => {
      const next = { ...current };
      if (mode === 'inherit') delete next[key];
      else next[key] = mode === 'allow';
      return next;
    });
  };

  const resetRow = (key) => setPermissionMode(key, 'inherit');

  const update = (patch) => {
    setDirty(true);
    setForm((current) => ({ ...current, ...patch }));
  };

  const toggleRole = (role) => {
    if (rolesLocked) return;
    const roleId = Number(role.id_rol);
    const selected = form.roles_ids.includes(roleId);
    if (selected && form.roles_ids.length <= 1) return;
    setDirty(true);
    setForm((current) => {
      const nextIds = selected
        ? current.roles_ids.filter((id) => id !== roleId)
        : [...current.roles_ids, roleId];
      let nextPrincipal = current.id_rol;
      if (!nextIds.includes(Number(nextPrincipal))) {
        nextPrincipal = nextIds[0];
      }
      return { ...current, roles_ids: nextIds, id_rol: Number(nextPrincipal) };
    });
  };

  const makePrincipal = (roleId) => {
    if (rolesLocked) return;
    if (!form.roles_ids.includes(Number(roleId))) return;
    setDirty(true);
    setForm((current) => ({ ...current, id_rol: Number(roleId) }));
  };

  const requestClose = () => {
    if (dirty && !window.confirm('Hay cambios sin guardar. ¿Deseas descartar los cambios?')) return;
    onClose();
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setError('');
    if (!form.nombre.trim() || !form.correo.trim()) {
      setError('Completa el nombre y el correo del usuario.');
      setActiveTab('general');
      return;
    }
    if (!isEditing && form.password.trim().length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      setActiveTab('general');
      return;
    }
    if (form.password.trim() && form.password.trim().length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      setActiveTab('general');
      return;
    }
    if (form.roles_ids.length === 0) {
      setError('Selecciona al menos un rol para el usuario.');
      setActiveTab('role');
      return;
    }
    if (Number(form.id_rol) === 5 && !wasResident && !form.residente_documento.trim()) {
      setError('El documento es obligatorio para registrar un residente.');
      setActiveTab('general');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nombre: form.nombre.trim(),
        correo: form.correo.trim(),
        id_rol: Number(form.id_rol),
        estado: Boolean(form.estado),
      };
      if (!rolesLocked || !isEditing) {
        payload.roles_ids = form.roles_ids.map(Number);
      }
      if (form.password.trim()) payload.password = form.password;
      if (isSuperAdmin) {
        payload.id_establecimiento = Number(form.id_establecimiento || defaultEstablishmentId);
        payload.permisos_excepciones = overrides;
      }
      if (Number(form.id_rol) === 5) {
        const residentDocument = form.residente_documento.trim();
        if (residentDocument) payload.residente_documento = residentDocument;
        if (form.residente_telefono.trim()) payload.residente_telefono = form.residente_telefono.trim();
        if (form.residente_unidad.trim()) payload.residente_unidad = form.residente_unidad.trim();
      }

      const establishmentId = Number(form.id_establecimiento || defaultEstablishmentId) || '';
      const query = establishmentId ? `?id_establecimiento=${establishmentId}` : '';
      const saved = await apiFetch(
        `/identidad/usuarios/${isEditing ? `${user.id}/` : ''}${query}`,
        {
          method: isEditing ? 'PATCH' : 'POST',
          body: JSON.stringify(payload),
        },
      );

      setDirty(false);
      onSaved?.(saved);
      onClose();
    } catch (saveError) {
      setError(saveError.message || 'No se pudo guardar el usuario.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={requestClose}
      eyebrow={isEditing ? 'Editar cuenta' : 'Nueva cuenta'}
      title={isEditing ? form.nombre || 'Editar usuario' : 'Crear usuario'}
      description="Los roles se suman en USUARIO_HAS_ROL. El rol principal define la etiqueta y los flujos de residente."
      size="lg"
      footer={(
        <>
          <button type="button" className="rbac-btn rbac-btn-ghost" onClick={requestClose} disabled={saving}>Cancelar</button>
          <button type="submit" form="user-access-form" className="rbac-btn rbac-btn-gold" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar Cambios'}
          </button>
        </>
      )}
    >
      <div className="rbac-tabs" role="tablist" aria-label="Secciones de usuario">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={`rbac-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error ? <div className="rbac-alert" role="alert">{error}</div> : null}

      <form id="user-access-form" className="rbac-form" onSubmit={handleSave}>
        {activeTab === 'general' ? (
          <div className="rbac-tab-panel">
            <div className="rbac-field-grid">
              <label className="rbac-field">
                <span>Nombre completo</span>
                <input value={form.nombre} onChange={(event) => update({ nombre: event.target.value })} autoComplete="name" required />
              </label>
              <label className="rbac-field">
                <span>Correo electrónico</span>
                <input type="email" value={form.correo} onChange={(event) => update({ correo: event.target.value })} autoComplete="email" required />
              </label>
              <label className="rbac-field">
                <span>{isEditing ? 'Nueva contraseña (opcional)' : 'Contraseña'}</span>
                <input type="password" value={form.password} onChange={(event) => update({ password: event.target.value })} autoComplete="new-password" minLength={8} placeholder={isEditing ? 'Dejar vacío para conservar' : 'Mínimo 8 caracteres'} />
              </label>
              <label className="rbac-field">
                <span>Establecimiento</span>
                {isSuperAdmin && establecimientos.length > 0 ? (
                  <select value={form.id_establecimiento} onChange={(event) => update({ id_establecimiento: event.target.value })}>
                    <option value="">Selecciona una sede</option>
                    {establecimientos.map((establishment) => (
                      <option key={establishment.id_establecimiento} value={establishment.id_establecimiento}>
                        {establishment.nombre}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input value={form.id_establecimiento || defaultEstablishmentId || ''} readOnly aria-readonly="true" />
                )}
              </label>
            </div>

            <div className="rbac-switch-row">
              <div>
                <strong>Cuenta activa</strong>
                <small>Las cuentas inactivas conservan su historial pero no pueden iniciar sesión.</small>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(form.estado)}
                className={`rbac-switch ${form.estado ? 'is-on' : ''}`}
                onClick={() => update({ estado: !form.estado })}
              >
                <span />
              </button>
            </div>

            <div className="rbac-subcard">
              <div className="rbac-subcard-title">
                <strong>Rol principal</strong>
                <small>{principalRole?.nombre || 'Sin rol principal'} · {form.roles_ids.length} rol(es) asignado(s)</small>
              </div>
              <div className="rbac-pill-list">
                <span className="rbac-role-chip is-primary">{principalRole?.nombre || 'Sin rol'}<em>Principal</em></span>
                {selectedRoles.filter((role) => role.id_rol !== Number(form.id_rol)).map((role) => (
                  <span className="rbac-role-chip" key={role.id_rol}>{role.nombre}</span>
                ))}
              </div>
            </div>

            {Number(form.id_rol) === 5 ? (
              <div className="rbac-subcard">
                <div className="rbac-subcard-title">
                  <strong>Datos del residente</strong>
                  <small>Se crea o actualiza el responsable asociado a la unidad.</small>
                </div>
                <div className="rbac-field-grid">
                  <label className="rbac-field">
                    <span>Documento de identidad</span>
                    <input value={form.residente_documento} onChange={(event) => update({ residente_documento: event.target.value })} />
                  </label>
                  <label className="rbac-field">
                    <span>Teléfono</span>
                    <input value={form.residente_telefono} onChange={(event) => update({ residente_telefono: event.target.value })} />
                  </label>
                  <label className="rbac-field">
                    <span>Unidad / apartamento</span>
                    <input value={form.residente_unidad} onChange={(event) => update({ residente_unidad: event.target.value })} />
                  </label>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === 'role' ? (
          <div className="rbac-tab-panel">
            <p className="rbac-help">
              Puedes asignar varios roles. Los permisos se suman; el rol principal solo define la etiqueta y los flujos de residente.
            </p>

            {rolesLocked ? (
              <div className="rbac-alert rbac-alert-info">
                Solo un Super Admin puede cambiar los roles de esta cuenta. Puedes editar sus datos generales.
              </div>
            ) : null}

            <div className="rbac-role-grid" role="group" aria-label="Roles asignados">
              {availableRoles.map((role) => {
                const checked = form.roles_ids.includes(role.id_rol);
                const isPrincipal = Number(form.id_rol) === role.id_rol;
                const onlySelected = checked && form.roles_ids.length === 1;
                return (
                  <div
                    key={role.id_rol}
                    className={`rbac-role-card rbac-role-card-selectable ${checked ? 'is-selected' : ''} ${rolesLocked ? 'is-locked' : ''}`}
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      className="rbac-role-select"
                      disabled={rolesLocked || onlySelected}
                      onClick={() => toggleRole(role)}
                    >
                      <span className="rbac-role-check" aria-hidden="true">{checked ? '✓' : ''}</span>
                      <span className="rbac-role-select-text">
                        <strong>{role.nombre}</strong>
                        <small>{role.descripcion || 'Rol del sistema'}</small>
                        <span className="rbac-role-meta">
                          {role.recursos_count ?? role.permisos?.length ?? 0} recurso(s)
                        </span>
                      </span>
                    </button>
                    <div className="rbac-role-card-footer">
                      {isPrincipal
                        ? <span className="rbac-badge rbac-badge-gold">Rol principal</span>
                        : (
                          <button
                            type="button"
                            className="rbac-btn rbac-btn-ghost rbac-btn-small"
                            disabled={!checked || rolesLocked}
                            onClick={() => makePrincipal(role.id_rol)}
                          >
                            Hacer principal
                          </button>
                        )}
                      {role.es_sistema ? <span className="rbac-badge">Base</span> : <span className="rbac-badge">Personalizado</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rbac-subcard">
              <div className="rbac-subcard-title">
                <strong>Rol principal</strong>
                <small>El backend usa este rol para JWT, etiqueta y flujos de residente.</small>
              </div>
              <label className="rbac-field">
                <span>Selecciona el rol principal</span>
                <select
                  value={form.id_rol}
                  disabled={rolesLocked}
                  onChange={(event) => makePrincipal(Number(event.target.value))}
                >
                  {selectedRoles.map((role) => (
                    <option key={role.id_rol} value={role.id_rol}>{role.nombre}</option>
                  ))}
                </select>
              </label>
            </div>

            {selectedRoles.length > 0 ? (
              <div className="rbac-subcard">
                <div className="rbac-subcard-title">
                  <strong>Permisos heredados (unión de roles)</strong>
                  <small>{inheritedPermissions.size} permiso(s) efectivos antes de excepciones.</small>
                </div>
                <div className="rbac-pill-list">
                  {[...inheritedPermissions].map((key) => (
                    <span className="rbac-pill" key={key}>
                      {permissionCatalog.find((item) => item.key === key)?.label || key}
                    </span>
                  ))}
                  {inheritedPermissions.size === 0 ? <span className="rbac-muted">Sin permisos heredados</span> : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === 'permissions' ? (
          <div className="rbac-tab-panel">
            <div className="rbac-permissions-head">
              <div>
                <strong>Permisos granulares</strong>
                <p>Heredado usa la unión de roles. Permitido y Denegado crean una excepción individual.</p>
              </div>
              <button type="button" className="rbac-btn rbac-btn-ghost rbac-btn-small" onClick={() => { setOverrides({}); setDirty(true); }}>
                Restablecer todo
              </button>
            </div>

            {!isSuperAdmin ? (
              <div className="rbac-alert rbac-alert-info">
                Solo un Super Admin puede modificar excepciones individuales. Puedes editar los datos y los roles permitidos.
              </div>
            ) : null}

            {groupedCatalog.map(([group, items]) => (
              <section className="rbac-permission-group" key={group}>
                <h4>{group}</h4>
                <div className="rbac-permission-list">
                  {items.map((item) => {
                    const mode = permissionMode(item.key);
                    const inherited = inheritedPermissions.has(item.key);
                    return (
                      <div className={`rbac-permission-row ${mode !== 'inherit' ? 'has-override' : ''}`} key={item.key}>
                        <div className="rbac-permission-label">
                          <strong>{item.label}</strong>
                          <small>{item.description}</small>
                          <span className={`rbac-inherited ${inherited ? 'is-on' : ''}`}>
                            Rol: {inherited ? 'permitido' : 'denegado'}
                          </span>
                        </div>
                        <div className="rbac-segmented" role="group" aria-label={`Permiso ${item.label}`}>
                          {[
                            ['inherit', 'Heredado'],
                            ['allow', 'Permitido'],
                            ['deny', 'Denegado'],
                          ].map(([value, label]) => (
                            <button
                              key={value}
                              type="button"
                              disabled={!isSuperAdmin}
                              className={`${mode === value ? 'active' : ''} ${value === 'allow' ? 'allow' : value === 'deny' ? 'deny' : ''}`}
                              onClick={() => setPermissionMode(item.key, value)}
                            >
                              {label}
                            </button>
                          ))}
                          {mode !== 'inherit' ? (
                            <button type="button" className="rbac-reset" disabled={!isSuperAdmin} onClick={() => resetRow(item.key)} title="Restablecer al rol">
                              ↺
                            </button>
                          ) : null}
                        </div>
                        <span className={`rbac-effective ${effectivePermission(item.key) ? 'is-on' : ''}`}>
                          {effectivePermission(item.key) ? 'Efectivo' : 'Sin acceso'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}

            {effectivePermission('solo_lectura') ? (
              <div className="rbac-alert rbac-alert-warn">
                «Solo lectura» está activo: el backend bloqueará cualquier escritura aunque otros permisos estén permitidos.
              </div>
            ) : null}
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
