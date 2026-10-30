import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../lib/api';
import RoleModal from './RoleModal';

export default function RoleManagement({ catalogo = [], isSuperAdmin = false, onRolesChanged }) {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRole, setSelectedRole] = useState(null);
  const [creatingRole, setCreatingRole] = useState(false);
  const [search, setSearch] = useState('');

  const loadRoles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await apiFetch('/identidad/roles/');
      const list = Array.isArray(payload) ? payload : (payload.results || []);
      setRoles(list);
    } catch (loadError) {
      setError(loadError.message || 'No se pudieron cargar los roles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSuperAdmin) return undefined;
    const timer = window.setTimeout(loadRoles, 0);
    return () => window.clearTimeout(timer);
  }, [isSuperAdmin, loadRoles]);

  const filteredRoles = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return roles;
    return roles.filter((role) => (
      role.nombre.toLowerCase().includes(term)
      || (role.descripcion || '').toLowerCase().includes(term)
    ));
  }, [roles, search]);

  const totalUsers = roles.reduce((sum, role) => sum + (role.usuarios_count || 0), 0);
  const totalPermissions = roles.reduce((sum, role) => sum + (role.permisos?.length || 0), 0);
  const baseRoleCount = roles.filter((role) => role.es_sistema).length;

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
          <p>Administra los cinco roles base y crea roles personalizados. Las excepciones individuales se aplican encima de estos valores.</p>
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
        <div className="rbac-stat"><span>Usuarios</span><strong>{totalUsers}</strong><small>asignados en total</small></div>
        <div className="rbac-stat"><span>Permisos</span><strong>{totalPermissions}</strong><small>heredados por rol</small></div>
        <div className="rbac-stat"><span>Excepciones</span><strong>Granular</strong><small>por usuario</small></div>
      </div>

      <div className="rbac-toolbar">
        <label className="rbac-search">
          <span aria-hidden="true">⌕</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar rol por nombre o descripción"
            aria-label="Buscar rol"
          />
        </label>
        <button type="button" className="rbac-btn rbac-btn-ghost rbac-btn-small" onClick={loadRoles} disabled={loading}>
          {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
      </div>

      {error ? <div className="rbac-alert" role="alert">{error}</div> : null}

      <div className="rbac-role-grid rbac-role-grid-wide">
        {filteredRoles.map((role) => (
          <article className="rbac-role-card rbac-role-card-static" key={role.id_rol}>
            <div className="rbac-role-card-top">
              <span className="rbac-role-radio is-static" aria-hidden="true" />
              <div>
                <strong>{role.nombre}</strong>
                <small>{role.descripcion || 'Sin descripción'}</small>
              </div>
              {role.es_sistema ? <span className="rbac-badge">Base</span> : <span className="rbac-badge rbac-badge-gold">Personalizado</span>}
            </div>
            <div className="rbac-pill-list">
              {role.permisos?.slice(0, 6).map((key) => (
                <span className="rbac-pill" key={key}>
                  {catalogo.find((item) => item.key === key)?.label || key}
                </span>
              ))}
              {(role.permisos?.length || 0) > 6 ? <span className="rbac-pill rbac-pill-more">+{(role.permisos?.length || 0) - 6}</span> : null}
              {!role.permisos?.length ? <span className="rbac-muted">Sin permisos</span> : null}
            </div>
            <div className="rbac-role-card-footer">
              <span>{role.usuarios_count || 0} usuario(s)</span>
              <button type="button" className="rbac-btn rbac-btn-gold rbac-btn-small" onClick={() => setSelectedRole(role)}>
                Editar permisos
              </button>
            </div>
          </article>
        ))}
        {!loading && filteredRoles.length === 0 ? (
          <div className="rbac-empty">
            <strong>Sin resultados</strong>
            <p>No hay roles que coincidan con la búsqueda.</p>
          </div>
        ) : null}
      </div>

      {creatingRole ? (
        <RoleModal
          key="new-role"
          open
          role={null}
          catalogo={catalogo}
          onClose={() => setCreatingRole(false)}
          onSaved={() => {
            setCreatingRole(false);
            loadRoles();
            onRolesChanged?.();
          }}
        />
      ) : null}

      {selectedRole ? (
        <RoleModal
          key={selectedRole.id_rol}
          open
          role={selectedRole}
          catalogo={catalogo}
          onClose={() => setSelectedRole(null)}
          onSaved={() => {
            setSelectedRole(null);
            loadRoles();
            onRolesChanged?.();
          }}
        />
      ) : null}
    </div>
  );
}
