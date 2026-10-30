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
  { key: 'recursos', label: 'Recursos', group: 'Administración', description: 'Catálogo de módulos y acciones.', tipo: 'modulo' },
  { key: 'catalogos', label: 'Catálogo', group: 'Administración', description: 'Datos maestros.', tipo: 'modulo' },
  { key: 'reportes', label: 'Reportes', group: 'Administración', description: 'Historial.', tipo: 'modulo' },
  { key: 'seguridad', label: 'Seguridad', group: 'Sistema', description: 'Auditoría.', tipo: 'modulo' },
  { key: 'puede_editar', label: 'Permiso de edición', group: 'Políticas de escritura', description: 'Cambios administrativos.', tipo: 'accion' },
  { key: 'puede_eliminar', label: 'Permiso de eliminación', group: 'Políticas de escritura', description: 'Borrados.', tipo: 'accion' },
  { key: 'solo_lectura', label: 'Solo lectura', group: 'Políticas de escritura', description: 'Bloquea escrituras.', tipo: 'accion' },
];

const REQUIRED_SUPERADMIN_KEYS = ['dashboard', 'usuarios', 'roles', 'recursos'];

const TABS = [
  { key: 'details', label: 'Detalles' },
  { key: 'resources', label: 'Recursos' },
];

const normalizeCatalogItem = (item) => ({
  ...item,
  key: item.key || item.clave || '',
  label: item.label || item.nombre || item.clave || '',
  group: item.group || item.grupo || 'General',
  description: item.description || item.descripcion || '',
  tipo: item.tipo || 'modulo',
  estado: item.estado !== false,
});

export default function RoleModal({ open, role, catalogo = [], onClose, onSaved }) {
  const isEditing = Boolean(role?.id_rol);
  const isSystem = Boolean(role?.es_sistema);
  const isSuperAdminRole = role?.nombre === 'Super Admin';
  const permissionCatalog = useMemo(
    () => (catalogo.length > 0 ? catalogo : FALLBACK_CATALOG).map(normalizeCatalogItem),
    [catalogo],
  );

  const [activeTab, setActiveTab] = useState('details');
  const [name, setName] = useState(role?.nombre || '');
  const [description, setDescription] = useState(role?.descripcion || '');
  const [selectedIds, setSelectedIds] = useState(() => {
    if (Array.isArray(role?.recursos_ids) && role.recursos_ids.length > 0) {
      return new Set(role.recursos_ids.map(Number));
    }
    if (Array.isArray(role?.permisos) && role.permisos.length > 0) {
      return new Set(
        permissionCatalog
          .filter((item) => role.permisos.includes(item.key))
          .map((item) => Number(item.id_recurso))
          .filter((id) => Number.isFinite(id)),
      );
    }
    const dashboard = permissionCatalog.find((item) => item.key === 'dashboard');
    return new Set(dashboard?.id_recurso ? [Number(dashboard.id_recurso)] : []);
  });
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

  const isSelected = (item) => {
    if (item.id_recurso) return selectedIds.has(Number(item.id_recurso));
    return false;
  };

  const toggleResource = (item) => {
    if (!item.id_recurso) return;
    const id = Number(item.id_recurso);
    if (isSuperAdminRole && REQUIRED_SUPERADMIN_KEYS.includes(item.key) && selectedIds.has(id)) return;
    setDirty(true);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedItems = permissionCatalog.filter((item) => isSelected(item));
  const selectedByType = selectedItems.reduce(
    (acc, item) => {
      if (item.tipo === 'accion') acc.actions += 1;
      else acc.modules += 1;
      return acc;
    },
    { modules: 0, actions: 0 },
  );

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
    if (selectedIds.size === 0) {
      setError('Selecciona al menos un recurso para el rol.');
      setActiveTab('resources');
      return;
    }
    if (isSuperAdminRole) {
      const missing = REQUIRED_SUPERADMIN_KEYS.filter((key) => {
        const item = permissionCatalog.find((candidate) => candidate.key === key);
        return !item || !isSelected(item);
      });
      if (missing.length > 0) {
        setError(`Super Admin debe conservar: ${missing.join(', ')}.`);
        setActiveTab('resources');
        return;
      }
    }

    const withIds = permissionCatalog.some((item) => item.id_recurso);
    const payload = {
      nombre: name.trim(),
      descripcion: description.trim(),
    };
    if (withIds) {
      payload.recursos_ids = [...selectedIds];
    } else {
      payload.permisos = selectedItems.map((item) => item.key);
    }

    setSaving(true);
    try {
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
          ? 'Los recursos del rol son la base; las excepciones por usuario se aplican encima.'
          : 'Define el nombre, la descripción y los recursos heredados. El rol se crea con Dashboard por defecto.'}
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

            <div className="rbac-subcard">
              <div className="rbac-subcard-title">
                <strong>Resumen del rol</strong>
                <small>
                  {selectedItems.length} recurso(s) · {selectedByType.modules} módulo(s) · {selectedByType.actions} acción(es)
                  {isEditing ? ` · ${role?.usuarios_count ?? 0} usuario(s) asignados` : ''}
                </small>
              </div>
              <div className="rbac-pill-list">
                {selectedItems.slice(0, 10).map((item) => (
                  <span className="rbac-pill" key={item.id_recurso || item.key}>{item.label}</span>
                ))}
                {selectedItems.length > 10 ? <span className="rbac-pill rbac-pill-more">+{selectedItems.length - 10}</span> : null}
                {selectedItems.length === 0 ? <span className="rbac-muted">Sin recursos activos</span> : null}
              </div>
            </div>

            {isSystem ? (
              <div className="rbac-alert rbac-alert-info">
                Los cinco roles base están protegidos contra eliminación. Super Admin siempre conserva Dashboard, Usuarios, Roles y Recursos.
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === 'resources' ? (
          <div className="rbac-tab-panel">
            <p className="rbac-help">Activa los módulos y políticas que heredarán todos los usuarios con este rol. La asignación se guarda en ROL_HAS_RECURSO.</p>

            {isSuperAdminRole ? (
              <div className="rbac-alert rbac-alert-warn">
                Super Admin conserva obligatoriamente Dashboard, Usuarios, Roles y Recursos para evitar un bloqueo de plataforma.
              </div>
            ) : null}

            {groupedCatalog.map(([group, items]) => {
              const activeItems = items.filter((item) => item.estado !== false || isSelected(item));
              if (activeItems.length === 0) return null;
              return (
                <section className="rbac-permission-group" key={group}>
                  <h4>{group}</h4>
                  <div className="rbac-permission-list">
                    {activeItems.map((item) => {
                      const enabled = isSelected(item);
                      const locked = isSuperAdminRole
                        && REQUIRED_SUPERADMIN_KEYS.includes(item.key)
                        && enabled;
                      return (
                        <div className={`rbac-permission-row ${enabled ? 'is-enabled' : ''}`} key={item.id_recurso || item.key}>
                          <div className="rbac-permission-label">
                            <strong>
                              {item.label}
                              <span className={`rbac-type-badge ${item.tipo === 'accion' ? 'is-action' : ''}`}>
                                {item.tipo === 'accion' ? 'Acción' : 'Módulo'}
                              </span>
                            </strong>
                            <small>{item.description || item.key}</small>
                            <code className="rbac-resource-key">{item.key}</code>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={enabled}
                            aria-label={`${enabled ? 'Quitar' : 'Activar'} ${item.label}`}
                            className={`rbac-switch ${enabled ? 'is-on' : ''}`}
                            disabled={locked}
                            title={locked ? 'Super Admin debe conservar este recurso' : undefined}
                            onClick={() => toggleResource(item)}
                          >
                            <span />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            {selectedIds.size === 0 ? (
              <div className="rbac-alert rbac-alert-warn">Selecciona al menos un recurso para guardar el rol.</div>
            ) : null}
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
