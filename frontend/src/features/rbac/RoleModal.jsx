import { useMemo, useState } from 'react';
import Modal from '../../components/Modal';
import { apiFetch } from '../../lib/api';

const FALLBACK_CATALOG = [
  { key: 'dashboard', label: 'Dashboard', group: 'General', description: 'Resumen operativo.', tipo: 'modulo' },
  { key: 'accesos', label: 'Control de acceso', group: 'Operación', description: 'Ingresos y salidas.', tipo: 'modulo' },
  { key: 'camaras', label: 'Cámaras', group: 'Operación', description: 'LPR/IA.', tipo: 'modulo' },
  { key: 'mi_qr', label: 'Mi QR e invitados', group: 'Operación', description: 'QR de residentes.', tipo: 'modulo' },
  { key: 'usuarios', label: 'Usuarios', group: 'Administración', description: 'Cuentas del establecimiento.', tipo: 'modulo' },
  { key: 'roles', label: 'Roles y permisos', group: 'Administración', description: 'RBAC global.', tipo: 'modulo' },
  { key: 'catalogos', label: 'Catálogo', group: 'Administración', description: 'Datos maestros.', tipo: 'modulo' },
  { key: 'reportes', label: 'Reportes', group: 'Administración', description: 'Historial.', tipo: 'modulo' },
  { key: 'seguridad', label: 'Seguridad', group: 'Sistema', description: 'Auditoría.', tipo: 'modulo' },
  { key: 'puede_editar', label: 'Permiso de edición', group: 'Políticas de escritura', description: 'Cambios administrativos.', tipo: 'accion' },
  { key: 'puede_eliminar', label: 'Permiso de eliminación', group: 'Políticas de escritura', description: 'Borrados.', tipo: 'accion' },
  { key: 'solo_lectura', label: 'Solo lectura', group: 'Políticas de escritura', description: 'Bloquea escrituras.', tipo: 'accion' },
];

const TABS = [
  { key: 'details', label: 'Detalles' },
  { key: 'permissions', label: 'Permisos' },
];

export default function RoleModal({ open, role, catalogo = [], onClose, onSaved }) {
  const isEditing = Boolean(role?.id_rol);
  const isSystem = Boolean(role?.es_sistema);
  const permissionCatalog = catalogo.length > 0 ? catalogo : FALLBACK_CATALOG;

  const [activeTab, setActiveTab] = useState('details');
  const [name, setName] = useState(role?.nombre || '');
  const [description, setDescription] = useState(role?.descripcion || '');
  const [permissions, setPermissions] = useState(() => new Set(role?.permisos || ['dashboard']));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const groupedCatalog = useMemo(() => {
    const groups = new Map();
    permissionCatalog.forEach((item) => {
      const group = item.group || 'General';
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(item);
    });
    return [...groups.entries()];
  }, [permissionCatalog]);

  const togglePermission = (key) => {
    setDirty(true);
    setPermissions((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const requestClose = () => {
    if (dirty && !window.confirm('Hay cambios sin guardar. ¿Deseas descartar los cambios?')) return;
    onClose();
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('El nombre del rol es obligatorio.');
      setActiveTab('details');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        nombre: name.trim(),
        descripcion: description.trim(),
        permisos: [...permissions],
      };
      const saved = await apiFetch(
        `/identidad/roles/${isEditing ? `${role.id_rol}/` : ''}`,
        {
          method: isEditing ? 'PATCH' : 'POST',
          body: JSON.stringify(payload),
        },
      );
      setDirty(false);
      onSaved?.(saved);
      onClose();
    } catch (saveError) {
      setError(saveError.message || 'No se pudo guardar el rol.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={requestClose}
      eyebrow={isEditing ? 'Editar rol' : 'Nuevo rol'}
      title={name || (isEditing ? 'Editar rol' : 'Nuevo rol')}
      description={isSystem
        ? `Rol base protegido. Los cambios afectan a ${role?.usuarios_count ?? 0} usuario(s); las excepciones individuales se mantienen.`
        : isEditing
          ? 'Los permisos del rol son la base; las excepciones por usuario se aplican encima.'
          : 'Define el nombre y la descripción. El rol se crea con acceso al Dashboard y podrás ajustar sus permisos después.'}
      size="lg"
      footer={(
        <>
          <button type="button" className="rbac-btn rbac-btn-ghost" onClick={requestClose} disabled={saving}>Cancelar</button>
          <button type="submit" form="role-form" className="rbac-btn rbac-btn-gold" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar Cambios'}
          </button>
        </>
      )}
    >
      {isEditing ? (
        <div className="rbac-tabs" role="tablist" aria-label="Secciones de rol">
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
      ) : null}

      {error ? <div className="rbac-alert" role="alert">{error}</div> : null}

      <form id="role-form" className="rbac-form" onSubmit={handleSave}>
        {activeTab === 'details' ? (
          <div className="rbac-tab-panel">
            <div className="rbac-field-grid">
              <label className="rbac-field">
                <span>Nombre del rol</span>
                <input
                  value={name}
                  onChange={(event) => { setName(event.target.value); setDirty(true); }}
                  disabled={isSystem}
                  maxLength={50}
                  aria-describedby={isSystem ? 'role-name-help' : undefined}
                />
                {isSystem ? <small id="role-name-help">Los roles base no se pueden renombrar.</small> : null}
              </label>
              <label className="rbac-field">
                <span>Descripción</span>
                <input value={description} onChange={(event) => { setDescription(event.target.value); setDirty(true); }} maxLength={150} />
              </label>
            </div>

            {isEditing ? (
              <div className="rbac-subcard">
                <div className="rbac-subcard-title">
                  <strong>Resumen del rol</strong>
                  <small>{permissions.size} permisos activos · {role?.usuarios_count ?? 0} usuario(s) asignados</small>
                </div>
                <div className="rbac-pill-list">
                  {[...permissions].map((key) => (
                    <span className="rbac-pill" key={key}>
                      {permissionCatalog.find((item) => item.key === key)?.label || key}
                    </span>
                  ))}
                  {permissions.size === 0 ? <span className="rbac-muted">Sin permisos activos</span> : null}
                </div>
              </div>
            ) : (
              <div className="rbac-alert rbac-alert-info">
                Se creará con acceso al Dashboard. Podrás activar módulos y políticas desde “Editar permisos” una vez creado el rol.
              </div>
            )}

            {isSystem ? (
              <div className="rbac-alert rbac-alert-info">
                Los cinco roles base están protegidos contra eliminación. Super Admin siempre conserva Dashboard, Usuarios y Roles.
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === 'permissions' ? (
          <div className="rbac-tab-panel">
            <p className="rbac-help">Activa los módulos y políticas que heredarán todos los usuarios con este rol.</p>
            {groupedCatalog.map(([group, items]) => (
              <section className="rbac-permission-group" key={group}>
                <h4>{group}</h4>
                <div className="rbac-permission-list">
                  {items.map((item) => {
                    const enabled = permissions.has(item.key);
                    return (
                      <div className={`rbac-permission-row ${enabled ? 'is-enabled' : ''}`} key={item.key}>
                        <div className="rbac-permission-label">
                          <strong>{item.label}</strong>
                          <small>{item.description}</small>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={enabled}
                          aria-label={`${enabled ? 'Quitar' : 'Activar'} ${item.label}`}
                          className={`rbac-switch ${enabled ? 'is-on' : ''}`}
                          onClick={() => togglePermission(item.key)}
                        >
                          <span />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
            {permissions.has('solo_lectura') ? (
              <div className="rbac-alert rbac-alert-warn">
                «Solo lectura» bloquea edición y eliminación para todo el rol, incluso si esos permisos están activos.
              </div>
            ) : null}
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
