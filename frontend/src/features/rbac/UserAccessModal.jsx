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
  { key: 'catalogos', label: 'Catálogo', group: 'Administración', description: 'Planes, sedes, vehículos y responsables.', tipo: 'modulo' },
  { key: 'reportes', label: 'Reportes', group: 'Administración', description: 'Historial y trazabilidad.', tipo: 'modulo' },
  { key: 'seguridad', label: 'Seguridad', group: 'Sistema', description: 'Auditoría y estado del sistema.', tipo: 'modulo' },
  { key: 'puede_editar', label: 'Permiso de edición', group: 'Políticas de escritura', description: 'Habilita cambios administrativos.', tipo: 'accion' },
  { key: 'puede_eliminar', label: 'Permiso de eliminación', group: 'Políticas de escritura', description: 'Habilita operaciones destructivas.', tipo: 'accion' },
  { key: 'solo_lectura', label: 'Solo lectura', group: 'Políticas de escritura', description: 'Prevalece y bloquea toda escritura.', tipo: 'accion' },
];

const FALLBACK_ROLES = [
  { id_rol: 4, nombre: 'Super Admin', descripcion: 'Administración global de la plataforma y del RBAC.', permisos: ['dashboard', 'accesos', 'camaras', 'mi_qr', 'usuarios', 'roles', 'catalogos', 'reportes', 'seguridad', 'puede_editar', 'puede_eliminar'] },
  { id_rol: 1, nombre: 'Administrador', descripcion: 'Control operativo y de usuarios de su establecimiento.', permisos: ['dashboard', 'usuarios', 'catalogos', 'reportes', 'camaras', 'accesos', 'puede_editar', 'puede_eliminar'] },
  { id_rol: 3, nombre: 'Supervisor', descripcion: 'Auditoría, reportes y supervisión de la operación.', permisos: ['dashboard', 'reportes', 'camaras', 'accesos'] },
  { id_rol: 2, nombre: 'Vigilante', descripcion: 'Operación de portería, accesos y novedades.', permisos: ['dashboard', 'camaras', 'accesos'] },
  { id_rol: 5, nombre: 'Residente', descripcion: 'Consulta su QR y administra invitaciones de visitantes.', permisos: ['mi_qr'] },
];

const TABS = [
  { key: 'general', label: 'Datos Generales' },
  { key: 'role', label: 'Asignar Rol' },
  { key: 'permissions', label: 'Permisos Especiales' },
];

const emptyForm = (defaultEstablishmentId, defaultRoleId) => ({
  nombre: '',
  correo: '',
  password: '',
  estado: true,
  id_establecimiento: defaultEstablishmentId || '',
  id_rol: defaultRoleId || 2,
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
  const wasResident = isEditing && Number(user?.id_rol || user?.rolId) === 5;
  const permissionCatalog = catalogo.length > 0 ? catalogo : FALLBACK_CATALOG;
  const roleList = isSuperAdmin && roles.length > 0 ? roles : (roles.length > 0 ? roles : FALLBACK_ROLES);
  const assignableRoleIds = [2, 3, 5];
  const currentRoleId = user ? Number(user.id_rol || user.rolId || 0) : null;
  const availableRoles = isSuperAdmin
    ? roleList
    : roleList.filter((role) => (
      assignableRoleIds.includes(Number(role.id_rol)) || Number(role.id_rol) === currentRoleId
    ));

  const initial = useMemo(() => (user ? {
    nombre: user.nombre || '',
    correo: user.email || user.correo || '',
    password: '',
    estado: user.activo ?? (user.estado === 'Activo' || user.estado === true),
    id_establecimiento: user.id_establecimiento || defaultEstablishmentId || '',
    id_rol: Number(user.id_rol || user.rolId || 2),
    residente_documento: '',
    residente_telefono: '',
    residente_unidad: '',
  } : emptyForm(defaultEstablishmentId, isSuperAdmin ? 1 : 2)), [user, defaultEstablishmentId, isSuperAdmin]);

  const [activeTab, setActiveTab] = useState(initialTab);
  const [form, setForm] = useState(initial);
  const [overrides, setOverrides] = useState(user?.permisos_excepciones || {});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const selectedRole = roleList.find((role) => Number(role.id_rol) === Number(form.id_rol))
    || availableRoles[0]
    || FALLBACK_ROLES[1];
  const rolePermissions = new Set(selectedRole?.permisos || []);

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
    return rolePermissions.has(key);
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

  const requestClose = () => {
    if (dirty && !window.confirm('Hay cambios sin guardar. ¿Deseas descartar los cambios?')) return;
    onClose();
  };

  const update = (patch) => {
    setDirty(true);
    setForm((current) => ({ ...current, ...patch }));
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
      description="Los permisos especiales sobreescriben el rol. El backend valida cada acceso."
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
            <p className="rbac-help">El rol define los permisos heredados. Las excepciones de la pestaña siguiente se aplican encima.</p>
            <div className="rbac-role-grid" role="radiogroup" aria-label="Rol principal">
              {availableRoles.map((role) => {
                const checked = Number(role.id_rol) === Number(form.id_rol);
                const assignable = isSuperAdmin || assignableRoleIds.includes(Number(role.id_rol));
                return (
                  <button
                    key={role.id_rol}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    disabled={!assignable}
                    className={`rbac-role-card ${checked ? 'is-selected' : ''} ${!assignable ? 'is-locked' : ''}`}
                    onClick={() => update({ id_rol: Number(role.id_rol) })}
                  >
                    <span className="rbac-role-radio" aria-hidden="true" />
                    <strong>{role.nombre}</strong>
                    <small>{role.descripcion || 'Rol del sistema'}</small>
                    <span className="rbac-role-meta">{role.permisos?.length || 0} permisos</span>
                    {role.es_sistema ? <span className="rbac-badge">Rol base</span> : null}
                  </button>
                );
              })}
            </div>
            {selectedRole ? (
              <div className="rbac-subcard">
                <div className="rbac-subcard-title">
                  <strong>Permisos heredados de {selectedRole.nombre}</strong>
                  <small>Puedes permitir o denegar excepciones en la siguiente pestaña.</small>
                </div>
                <div className="rbac-pill-list">
                  {selectedRole.permisos?.map((key) => (
                    <span className="rbac-pill" key={key}>
                      {permissionCatalog.find((item) => item.key === key)?.label || key}
                    </span>
                  ))}
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
                <p>Heredado usa el rol. Permitido y Denegado crean una excepción individual.</p>
              </div>
              <button type="button" className="rbac-btn rbac-btn-ghost rbac-btn-small" onClick={() => { setOverrides({}); setDirty(true); }}>
                Restablecer todo
              </button>
            </div>

            {!isSuperAdmin ? (
              <div className="rbac-alert rbac-alert-info">
                Solo un Super Admin puede modificar excepciones individuales. Puedes editar los datos y el rol.
              </div>
            ) : null}

            {groupedCatalog.map(([group, items]) => (
              <section className="rbac-permission-group" key={group}>
                <h4>{group}</h4>
                <div className="rbac-permission-list">
                  {items.map((item) => {
                    const mode = permissionMode(item.key);
                    const inherited = rolePermissions.has(item.key);
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
