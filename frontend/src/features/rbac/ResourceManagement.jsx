import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import ConfirmModal from './ConfirmModal';
import ResourceModal from './ResourceModal';

const PAGE_SIZE = 10;

const normalizeResources = (payload) => {
  const list = Array.isArray(payload) ? payload : (payload.results || []);
  return list.map((resource) => ({
    ...resource,
    estado: resource.estado !== false,
    roles_count: Number(resource.roles_count || 0),
  }));
};

export default function ResourceManagement({ isSuperAdmin = false, onResourcesChanged }) {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [modalState, setModalState] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadResources = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await apiFetch('/identidad/recursos/');
      setResources(normalizeResources(payload));
    } catch (loadError) {
      setError(loadError.message || 'No se pudieron cargar los recursos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) return undefined;
    const timer = window.setTimeout(loadResources, 0);
    return () => window.clearTimeout(timer);
  }, [isSuperAdmin, loadResources]);

  const filteredResources = useMemo(() => {
    const term = search.trim().toLowerCase();
    return resources.filter((resource) => {
      const matchesTerm = !term
        || (resource.clave || '').toLowerCase().includes(term)
        || (resource.nombre || '').toLowerCase().includes(term)
        || (resource.grupo || '').toLowerCase().includes(term)
        || (resource.descripcion || '').toLowerCase().includes(term);
      const matchesType = typeFilter === 'all' || resource.tipo === typeFilter;
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' && resource.estado)
        || (statusFilter === 'inactive' && !resource.estado);
      return matchesTerm && matchesType && matchesStatus;
    });
  }, [resources, search, typeFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredResources.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageResources = filteredResources.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const moduleCount = resources.filter((resource) => resource.tipo === 'modulo').length;
  const actionCount = resources.filter((resource) => resource.tipo === 'accion').length;
  const assignedCount = resources.filter((resource) => resource.roles_count > 0).length;
  const systemCount = resources.filter((resource) => resource.es_sistema).length;

  const resetPage = () => setPage(1);

  const handleSaved = () => {
    loadResources();
    onResourcesChanged?.();
  };

  const requestDelete = (resource) => {
    if (resource.es_sistema || resource.roles_count > 0) return;
    setDeleteTarget(resource);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      await apiFetch(`/identidad/recursos/${deleteTarget.id_recurso}/`, { method: 'DELETE' });
      setDeleteTarget(null);
      await loadResources();
      onResourcesChanged?.();
    } catch (deleteError) {
      setError(deleteError.message || 'No se pudo eliminar el recurso.');
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
          <p>La administración del catálogo de recursos es exclusiva del Super Admin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rbac-card">
      <header className="rbac-card-header">
        <div>
          <span className="rbac-eyebrow">RBAC · Catálogo de recursos</span>
          <h3>Recursos</h3>
          <p>Administra los módulos y las acciones que pueden asignarse a los roles. Las claves del sistema están protegidas para no romper sesiones activas.</p>
        </div>
        <div className="rbac-header-actions">
          <span className="rbac-badge rbac-badge-gold">Solo Super Admin</span>
          <button type="button" className="rbac-btn rbac-btn-gold" onClick={() => setModalState({ resource: null })}>
            + Nuevo recurso
          </button>
        </div>
      </header>

      <div className="rbac-stats">
        <div className="rbac-stat"><span>Total</span><strong>{resources.length}</strong><small>en el catálogo</small></div>
        <div className="rbac-stat"><span>Módulos</span><strong>{moduleCount}</strong><small>navegación y pantallas</small></div>
        <div className="rbac-stat"><span>Acciones</span><strong>{actionCount}</strong><small>políticas de escritura</small></div>
        <div className="rbac-stat"><span>Asignados</span><strong>{assignedCount}</strong><small>{systemCount} protegidos por sistema</small></div>
      </div>

      <div className="rbac-toolbar">
        <label className="rbac-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={search}
            onChange={(event) => { setSearch(event.target.value); resetPage(); }}
            placeholder="Buscar por clave, nombre, grupo o descripción"
            aria-label="Buscar recurso"
          />
        </label>
        <label className="rbac-filter">
          <span>Tipo</span>
          <select value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); resetPage(); }}>
            <option value="all">Todos</option>
            <option value="modulo">Módulos</option>
            <option value="accion">Acciones</option>
          </select>
        </label>
        <label className="rbac-filter">
          <span>Estado</span>
          <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); resetPage(); }}>
            <option value="all">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </label>
        <button type="button" className="rbac-btn rbac-btn-ghost rbac-btn-small" onClick={loadResources} disabled={loading}>
          {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {error ? <div className="rbac-alert" role="alert">{error}</div> : null}

      <div className="rbac-table-wrap">
        <table className="rbac-table">
          <thead>
            <tr>
              <th>Recurso</th>
              <th>Grupo</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Roles</th>
              <th className="rbac-table-actions-col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pageResources.map((resource) => {
              const locked = resource.es_sistema || resource.roles_count > 0;
              return (
                <tr key={resource.id_recurso}>
                  <td>
                    <div className="rbac-resource-cell">
                      <span className={`rbac-resource-glyph ${resource.tipo === 'accion' ? 'is-action' : ''}`} aria-hidden="true">
                        {resource.tipo === 'accion' ? 'ϟ' : '▦'}
                      </span>
                      <div>
                        <strong>{resource.nombre}</strong>
                        <small><code>{resource.clave}</code>{resource.descripcion ? ` · ${resource.descripcion}` : ''}</small>
                      </div>
                    </div>
                  </td>
                  <td><span className="rbac-pill">{resource.grupo || 'General'}</span></td>
                  <td>
                    <span className={`rbac-type-badge ${resource.tipo === 'accion' ? 'is-action' : ''}`}>
                      {resource.tipo === 'accion' ? 'Acción' : 'Módulo'}
                    </span>
                  </td>
                  <td>
                    <span className={`rbac-status ${resource.estado ? 'is-active' : 'is-inactive'}`}>
                      <span aria-hidden="true" />{resource.estado ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    {resource.roles_count > 0
                      ? <span className="rbac-badge rbac-badge-gold">{resource.roles_count} rol(es)</span>
                      : <span className="rbac-muted">Sin asignar</span>}
                  </td>
                  <td>
                    <div className="rbac-row-actions">
                      <button type="button" className="rbac-btn rbac-btn-ghost rbac-btn-small" onClick={() => setModalState({ resource })}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="rbac-btn rbac-btn-danger rbac-btn-small"
                        onClick={() => requestDelete(resource)}
                        disabled={locked}
                        title={resource.es_sistema
                          ? 'Los recursos del sistema no se pueden eliminar'
                          : resource.roles_count > 0
                            ? 'Quita el recurso de todos los roles antes de eliminarlo'
                            : 'Eliminar recurso'}
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

        {!loading && pageResources.length === 0 ? (
          <div className="rbac-empty">
            <strong>{resources.length === 0 ? 'Aún no hay recursos' : 'Sin resultados'}</strong>
            <p>{resources.length === 0 ? 'Crea el primer recurso del catálogo.' : 'Ajusta la búsqueda o los filtros.'}</p>
          </div>
        ) : null}
        {loading ? <div className="rbac-loading">Cargando recursos…</div> : null}
      </div>

      <footer className="rbac-pagination">
        <span>{filteredResources.length} recurso(s) · página {safePage} de {totalPages}</span>
        <div>
          <button type="button" className="rbac-btn rbac-btn-ghost rbac-btn-small" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={safePage <= 1}>Anterior</button>
          <button type="button" className="rbac-btn rbac-btn-ghost rbac-btn-small" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={safePage >= totalPages}>Siguiente</button>
        </div>
      </footer>

      {modalState ? (
        <ResourceModal
          key={modalState.resource?.id_recurso || 'new-resource'}
          open
          resource={modalState.resource}
          onClose={() => setModalState(null)}
          onSaved={handleSaved}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmModal
          open
          eyebrow="Eliminar recurso"
          title={`¿Eliminar “${deleteTarget.nombre}”?`}
          description="El recurso se borrará del catálogo RBAC de forma permanente."
          details={(
            <ul>
              <li><strong>Clave:</strong> <code>{deleteTarget.clave}</code></li>
              <li><strong>Tipo:</strong> {deleteTarget.tipo === 'accion' ? 'Acción' : 'Módulo'}</li>
              <li><strong>Asignaciones:</strong> {deleteTarget.roles_count} rol(es)</li>
            </ul>
          )}
          confirmLabel="Eliminar recurso"
          loading={deleting}
          onConfirm={confirmDelete}
          onClose={() => setDeleteTarget(null)}
        />
      ) : null}
    </div>
  );
}
