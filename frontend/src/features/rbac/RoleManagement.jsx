import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import ConfirmModal from './ConfirmModal';
import RoleModal from './RoleModal';

const PAGE_SIZE = 10;

export default function RoleManagement({ catalogo = [], isSuperAdmin = false, onRolesChanged }) {
  const [roles, setRoles] = useState([]);
  const [resourceCatalog, setResourceCatalog] = useState(catalogo);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRole, setSelectedRole] = useState(null);
  const [creatingRole, setCreatingRole] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState('all');
  const [page, setPage] = useState(1);

  const loadRoles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await apiFetch('/identidad/roles/');
      const list = Array.isArray(payload) ? payload : (payload.results || []);
      setRoles(list);
      try {
        const resourcesPayload = await apiFetch('/identidad/recursos/');
        const resources = Array.isArray(resourcesPayload) ? resourcesPayload : (resourcesPayload.results || []);
        setResourceCatalog(resources);
      } catch {
        setResourceCatalog((current) => (current.length > 0 ? current : catalogo));
      }
    } catch (loadError) {
      setError(loadError.message || 'No se pudieron cargar los roles.');
    } finally {
      setLoading(false);
    }
  }, [catalogo]);

  useEffect(() => {
    if (!isSuperAdmin) return undefined;
    const timer = window.setTimeout(loadRoles, 0);
    return () => window.clearTimeout(timer);
  }, [isSuperAdmin, loadRoles]);

  const filteredRoles = useMemo(() => {
    const term = search.trim().toLowerCase();
    return roles.filter((role) => {
      const matchesTerm = !term
        || (role.nombre || '').toLowerCase().includes(term)
        || (role.descripcion || '').toLowerCase().includes(term);
      const matchesKind = kindFilter === 'all'
        || (kindFilter === 'system' && role.es_sistema)
        || (kindFilter === 'custom' && !role.es_sistema);
      return matchesTerm && matchesKind;
    });
  }, [roles, search, kindFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRoles.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRoles = filteredRoles.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const resourceLabel = (key) => {
    const item = resourceCatalog.find((candidate) => (candidate.key || candidate.clave) === key);
    return item?.label || item?.nombre || key;
  };
  const totalAssignments = roles.reduce((sum, role) => sum + (role.usuarios_count || 0), 0);
  const baseRoleCount = roles.filter((role) => role.es_sistema).length;
  const totalResources = roles.reduce((sum, role) => sum + (role.recursos_count || role.permisos?.length || 0), 0);

  const resetPage = () => setPage(1);

  const handleSaved = () => {
    setCreatingRole(false);
    setSelectedRole(null);
    loadRoles();
    onRolesChanged?.();
  };

  const requestDelete = (role) => {
    if (role.es_sistema || role.usuarios_count > 0) return;
    setDeleteTarget(role);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      await apiFetch(`/identidad/roles/${deleteTarget.id_rol}/`, { method: 'DELETE' });
      setDeleteTarget(null);
      await loadRoles();
      onRolesChanged?.();
    } catch (deleteError) {
      setError(deleteError.message || 'No se pudo eliminar el rol.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="rbac-card">
        <div className="rbac-empty">
          <strong>Acceso restringido</strong>
          <p>La gestión de roles globales es exclusiva del Super Admin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rbac-card">
      <header className="rbac-card-header">
        <div>
          <span className="rbac-eyebrow">RBAC · Acceso restringido</span>
          <h3>Roles y permisos</h3>
          <p>Administra los cinco roles base y crea roles personalizados. Los recursos se guardan en ROL_HAS_RECURSO y las excepciones individuales se aplican encima.</p>
        </div>
        <div className="rbac-header-actions">
          <span className="rbac-badge rbac-badge-gold">Solo Super Admin</span>
          <button type="button" className="rbac-btn rbac-btn-gold" onClick={() => setCreatingRole(true)}>
            + Nuevo Rol
          </button>
        </div>
      </header>

      <div className="rbac-stats">
        <div className="rbac-stat"><span>Roles</span><strong>{roles.length}</strong><small>{baseRoleCount} base protegidos</small></div>
        <div className="rbac-stat"><span>Asignaciones</span><strong>{totalAssignments}</strong><small>usuario-rol</small></div>
        <div className="rbac-stat"><span>Recursos</span><strong>{totalResources}</strong><small>relaciones rol-recurso</small></div>
        <div className="rbac-stat"><span>Catálogo</span><strong>{resourceCatalog.length}</strong><small>recursos disponibles</small></div>
      </div>

      <div className="rbac-toolbar">
        <label className="rbac-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={search}
            onChange={(event) => { setSearch(event.target.value); resetPage(); }}
            placeholder="Buscar rol por nombre o descripción"
            aria-label="Buscar rol"
          />
        </label>
        <label className="rbac-filter">
          <span>Tipo</span>
          <select value={kindFilter} onChange={(event) => { setKindFilter(event.target.value); resetPage(); }}>
            <option value="all">Todos</option>
            <option value="system">Base</option>
            <option value="custom">Personalizados</option>
          </select>
        </label>
        <button type="button" className="rbac-btn rbac-btn-ghost rbac-btn-small" onClick={loadRoles} disabled={loading}>
          {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {error ? <div className="rbac-alert" role="alert">{error}</div> : null}

      <div className="rbac-table-wrap">
        <table className="rbac-table">
          <thead>
            <tr>
              <th>Rol</th>
              <th>Descripción</th>
              <th>Recursos</th>
              <th>Usuarios</th>
              <th>Tipo</th>
              <th className="rbac-table-actions-col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pageRoles.map((role) => {
              const resourceKeys = role.permisos || [];
              const locked = role.es_sistema || role.usuarios_count > 0;
              return (
                <tr key={role.id_rol}>
                  <td>
                    <div className="rbac-role-title">
                      <strong>{role.nombre}</strong>
                      <small>ID {role.id_rol}</small>
                    </div>
                  </td>
                  <td><span className="rbac-muted">{role.descripcion || 'Sin descripción'}</span></td>
                  <td>
                    <div className="rbac-pill-list">
                      {resourceKeys.slice(0, 3).map((key) => (
                        <span className="rbac-pill" key={key}>{resourceLabel(key)}</span>
                      ))}
                      {resourceKeys.length > 3 ? <span className="rbac-pill rbac-pill-more">+{resourceKeys.length - 3}</span> : null}
                      {resourceKeys.length === 0 ? <span className="rbac-muted">Sin recursos</span> : null}
                    </div>
                  </td>
                  <td>
                    <span className={`rbac-badge ${role.usuarios_count > 0 ? 'rbac-badge-gold' : ''}`}>
                      {role.usuarios_count || 0} usuario(s)
                    </span>
                  </td>
                  <td>
                    <span className={`rbac-type-badge ${role.es_sistema ? '' : 'is-custom'}`}>
                      {role.es_sistema ? 'Base' : 'Personalizado'}
                    </span>
                  </td>
                  <td>
                    <div className="rbac-row-actions">
                      <button type="button" className="rbac-btn rbac-btn-ghost rbac-btn-small" onClick={() => setSelectedRole(role)}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="rbac-btn rbac-btn-danger rbac-btn-small"
                        onClick={() => requestDelete(role)}
                        disabled={locked}
                        title={role.es_sistema
                          ? 'Los roles base no se pueden eliminar'
                          : role.usuarios_count > 0
                            ? 'Reasigna a los usuarios antes de eliminar el rol'
                            : 'Eliminar rol'}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!loading && pageRoles.length === 0 ? (
          <div className="rbac-empty">
            <strong>{roles.length === 0 ? 'Aún no hay roles' : 'Sin resultados'}</strong>
            <p>{roles.length === 0 ? 'Crea el primer rol personalizado.' : 'Ajusta la búsqueda o el filtro.'}</p>
          </div>
        ) : null}
        {loading ? <div className="rbac-loading">Cargando roles…</div> : null}
      </div>

      <footer className="rbac-pagination">
        <span>{filteredRoles.length} rol(es) · página {safePage} de {totalPages}</span>
        <div>
          <button type="button" className="rbac-btn rbac-btn-ghost rbac-btn-small" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={safePage <= 1}>Anterior</button>
          <button type="button" className="rbac-btn rbac-btn-ghost rbac-btn-small" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={safePage >= totalPages}>Siguiente</button>
        </div>
      </footer>

      {creatingRole ? (
        <RoleModal
          key="new-role"
          open
          role={null}
          catalogo={resourceCatalog}
          onClose={() => setCreatingRole(false)}
          onSaved={handleSaved}
        />
      ) : null}

      {selectedRole ? (
        <RoleModal
          key={selectedRole.id_rol}
          open
          role={selectedRole}
          catalogo={resourceCatalog}
          onClose={() => setSelectedRole(null)}
          onSaved={handleSaved}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmModal
          open
          eyebrow="Eliminar rol"
          title={`¿Eliminar “${deleteTarget.nombre}”?`}
          description="El rol personalizado se borrará de forma permanente junto con sus relaciones rol-recurso."
          details={(
            <ul>
              <li><strong>Usuarios asignados:</strong> {deleteTarget.usuarios_count || 0}</li>
              <li><strong>Recursos asignados:</strong> {deleteTarget.recursos_count ?? deleteTarget.permisos?.length ?? 0}</li>
              <li><strong>Tipo:</strong> Personalizado</li>
            </ul>
          )}
          confirmLabel="Eliminar rol"
          loading={deleting}
          onConfirm={confirmDelete}
          onClose={() => setDeleteTarget(null)}
        />
      ) : null}
    </div>
  );
}
