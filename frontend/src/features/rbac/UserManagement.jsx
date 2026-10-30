import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import UserAccessModal from './UserAccessModal';

const BASE_ROLES = [
  { id_rol: 4, nombre: 'Super Admin', descripcion: 'Administración global de la plataforma.', permisos: ['dashboard', 'accesos', 'camaras', 'mi_qr', 'usuarios', 'roles', 'catalogos', 'reportes', 'seguridad', 'puede_editar', 'puede_eliminar'] },
  { id_rol: 1, nombre: 'Administrador', descripcion: 'Control del establecimiento.', permisos: ['dashboard', 'usuarios', 'catalogos', 'reportes', 'camaras', 'accesos', 'puede_editar', 'puede_eliminar'] },
  { id_rol: 3, nombre: 'Supervisor', descripcion: 'Auditoría y reportes.', permisos: ['dashboard', 'reportes', 'camaras', 'accesos'] },
  { id_rol: 2, nombre: 'Vigilante', descripcion: 'Operación de portería.', permisos: ['dashboard', 'camaras', 'accesos'] },
  { id_rol: 5, nombre: 'Residente', descripcion: 'QR e invitaciones.', permisos: ['mi_qr'] },
];

const PAGE_SIZE = 10;

const normalizeUsers = (payload) => {
  const list = Array.isArray(payload) ? payload : (payload.results || []);
  return list.map((user) => ({
    id: user.id_usuario,
    id_usuario: user.id_usuario,
    nombre: user.nombre,
    email: user.correo,
    correo: user.correo,
    id_rol: user.id_rol,
    rolId: user.id_rol,
    rol: user.rol?.nombre || BASE_ROLES.find((role) => Number(role.id_rol) === Number(user.id_rol))?.nombre || `Rol ${user.id_rol}`,
    activo: Boolean(user.estado),
    estado: user.estado ? 'Activo' : 'Inactivo',
    id_establecimiento: user.id_establecimiento,
    permisos_excepciones: user.permisos_excepciones || {},
    permisos_efectivos: user.permisos_efectivos || [],
  }));
};

export default function UserManagement({
  profile,
  isSuperAdmin = false,
  catalogo = [],
  onSelfChanged,
}) {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState(BASE_ROLES);
  const [establishments, setEstablishments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [modalState, setModalState] = useState(null);

  const currentEstablishmentId = profile?.id_establecimiento || '';

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ page_size: '200' });
      if (!isSuperAdmin && currentEstablishmentId) query.set('id_establecimiento', String(currentEstablishmentId));
      const requests = [apiFetch(`/identidad/usuarios/?${query.toString()}`)];
      if (isSuperAdmin) {
        requests.push(apiFetch('/identidad/roles/'));
        requests.push(apiFetch('/empresas/establecimientos/?page_size=200'));
      }
      const [usersPayload, rolesPayload, establishmentsPayload] = await Promise.all(requests);
      setUsers(normalizeUsers(usersPayload));
      if (rolesPayload) {
        const roleList = Array.isArray(rolesPayload) ? rolesPayload : (rolesPayload.results || []);
        setRoles(roleList.length > 0 ? roleList : BASE_ROLES);
      }
      if (establishmentsPayload) {
        setEstablishments(Array.isArray(establishmentsPayload)
          ? establishmentsPayload
          : (establishmentsPayload.results || []));
      }
    } catch (loadError) {
      setError(loadError.message || 'No se pudieron cargar los usuarios.');
    } finally {
      setLoading(false);
    }
  }, [currentEstablishmentId, isSuperAdmin]);

  useEffect(() => {
    const timer = window.setTimeout(loadData, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const resetPage = () => setPage(1);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesTerm = !term
        || user.nombre.toLowerCase().includes(term)
        || user.email.toLowerCase().includes(term)
        || user.rol.toLowerCase().includes(term);
      const matchesRole = roleFilter === 'all' || Number(user.id_rol) === Number(roleFilter);
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' && user.activo)
        || (statusFilter === 'inactive' && !user.activo);
      return matchesTerm && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageUsers = filteredUsers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const activeCount = users.filter((user) => user.activo).length;
  const exceptionCount = users.filter((user) => Object.keys(user.permisos_excepciones || {}).length > 0).length;

  const openNew = () => setModalState({ user: null, tab: 'general' });
  const openEdit = (user) => setModalState({ user, tab: 'general' });
  const openPermissions = (user) => setModalState({ user, tab: 'permissions' });

  const handleSaved = (saved) => {
    resetPage();
    loadData();
    if (saved?.id_usuario === profile?.id_usuario) onSelfChanged?.();
  };

  return (
    <div className="rbac-card rbac-card-dark">
      <header className="rbac-card-header">
        <div>
          <span className="rbac-eyebrow">RBAC · Gestión de cuentas</span>
          <h3>Usuarios</h3>
          <p>Asigna un rol principal y excepciones granulares. Los cambios se validan en Django y se reflejan en el menú dinámico.</p>
        </div>
        <div className="rbac-header-actions">
          <span className="rbac-badge rbac-badge-gold">Permisos backend</span>
          <button type="button" className="rbac-btn rbac-btn-gold" onClick={openNew}>+ Nuevo usuario</button>
        </div>
      </header>

      <div className="rbac-stats">
        <div className="rbac-stat"><span>Total</span><strong>{users.length}</strong><small>cuentas visibles</small></div>
        <div className="rbac-stat"><span>Activos</span><strong>{activeCount}</strong><small>pueden iniciar sesión</small></div>
        <div className="rbac-stat"><span>Excepciones</span><strong>{exceptionCount}</strong><small>permisos personalizados</small></div>
        <div className="rbac-stat"><span>Roles</span><strong>{roles.length}</strong><small>disponibles</small></div>
      </div>

      <div className="rbac-toolbar">
        <label className="rbac-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={search}
            onChange={(event) => { setSearch(event.target.value); resetPage(); }}
            placeholder="Buscar por nombre, correo o rol"
            aria-label="Buscar usuario"
          />
        </label>
        <label className="rbac-filter">
          <span>Rol</span>
          <select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); resetPage(); }}>
            <option value="all">Todos</option>
            {roles.map((role) => <option key={role.id_rol} value={role.id_rol}>{role.nombre}</option>)}
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
        <button type="button" className="rbac-btn rbac-btn-ghost rbac-btn-small" onClick={loadData} disabled={loading}>
          {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {error ? <div className="rbac-alert" role="alert">{error}</div> : null}

      <div className="rbac-table-wrap">
        <table className="rbac-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol principal</th>
              <th>Estado</th>
              <th>Excepciones</th>
              <th className="rbac-table-actions-col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {pageUsers.map((user) => {
              const exceptions = Object.keys(user.permisos_excepciones || {}).length;
              return (
                <tr key={user.id}>
                  <td>
                    <div className="rbac-user-cell">
                      <span className="rbac-avatar" aria-hidden="true">{(user.nombre || '?').slice(0, 1).toUpperCase()}</span>
                      <div>
                        <strong>{user.nombre}</strong>
                        <small>{user.email}</small>
                      </div>
                    </div>
                  </td>
                  <td><span className="rbac-role-chip">{user.rol}</span></td>
                  <td>
                    <span className={`rbac-status ${user.activo ? 'is-active' : 'is-inactive'}`}>
                      <span aria-hidden="true" />{user.estado}
                    </span>
                  </td>
                  <td>
                    {exceptions > 0
                      ? <span className="rbac-badge rbac-badge-gold">{exceptions} personalizado(s)</span>
                      : <span className="rbac-muted">Heredados del rol</span>}
                  </td>
                  <td>
                    <div className="rbac-row-actions">
                      <button type="button" className="rbac-btn rbac-btn-ghost rbac-btn-small" onClick={() => openEdit(user)}>Editar usuario</button>
                      <button type="button" className="rbac-btn rbac-btn-gold rbac-btn-small" onClick={() => openPermissions(user)}>Permisos</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!loading && pageUsers.length === 0 ? (
          <div className="rbac-empty">
            <strong>{users.length === 0 ? 'Aún no hay usuarios' : 'Sin resultados'}</strong>
            <p>{users.length === 0 ? 'Crea la primera cuenta para comenzar.' : 'Ajusta la búsqueda o los filtros.'}</p>
          </div>
        ) : null}
        {loading ? <div className="rbac-loading">Cargando usuarios…</div> : null}
      </div>

      <footer className="rbac-pagination">
        <span>{filteredUsers.length} usuario(s) · página {safePage} de {totalPages}</span>
        <div>
          <button type="button" className="rbac-btn rbac-btn-ghost rbac-btn-small" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={safePage <= 1}>Anterior</button>
          <button type="button" className="rbac-btn rbac-btn-ghost rbac-btn-small" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={safePage >= totalPages}>Siguiente</button>
        </div>
      </footer>

      {modalState ? (
        <UserAccessModal
          key={`${modalState.user?.id || 'new'}-${modalState.tab}`}
          open
          user={modalState.user}
          initialTab={modalState.tab}
          roles={roles}
          catalogo={catalogo}
          establecimientos={establishments}
          isSuperAdmin={isSuperAdmin}
          defaultEstablishmentId={currentEstablishmentId}
          onClose={() => setModalState(null)}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  );
}
