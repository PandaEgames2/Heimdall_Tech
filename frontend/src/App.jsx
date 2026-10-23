import { useEffect, useMemo, useState } from 'react';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

const permissionsByRole = {
  superadmin: ['dashboard', 'usuarios', 'roles', 'catalogos', 'reportes', 'camaras', 'seguridad', 'config'],
  admin: ['dashboard', 'usuarios', 'catalogos', 'reportes', 'camaras'],
  supervisor: ['dashboard', 'reportes', 'camaras'],
  vigilante: ['dashboard', 'camaras'],
  administrador: ['dashboard', 'usuarios', 'roles', 'catalogos', 'reportes', 'camaras', 'seguridad', 'config'],
  'sin rol': ['dashboard'],
};

const normalizeRole = (value) => {
  const str = String(value || '').trim().toLowerCase();
  if (str.includes('super')) return 'superadmin';
  if (str.includes('admin')) return 'admin';
  if (str.includes('supervisor')) return 'supervisor';
  if (str.includes('vigilante')) return 'vigilante';
  return str || 'admin';
};

const initialUsers = [
  { id: 1, nombre: 'Ian de Jesús', rol: 'Administrador', email: 'admin@heimdall.test', estado: 'Activo' },
  { id: 2, nombre: 'María López', rol: 'Administrador', email: 'admin2@heimdall.test', estado: 'Activo' },
  { id: 3, nombre: 'Carlos Ruiz', rol: 'Supervisor', email: 'supervisor@heimdall.test', estado: 'Activo' },
  { id: 4, nombre: 'Pedro Silva', rol: 'Vigilante', email: 'vigilante@heimdall.test', estado: 'Activo' },
];

const initialRoles = [
  { nombre: 'Super Admin', permisos: ['dashboard', 'usuarios', 'roles', 'catalogos', 'reportes', 'camaras', 'seguridad', 'config'] },
  { nombre: 'Administrador', permisos: ['dashboard', 'usuarios', 'catalogos', 'reportes', 'camaras'] },
  { nombre: 'Supervisor', permisos: ['dashboard', 'reportes', 'camaras'] },
  { nombre: 'Vigilante', permisos: ['dashboard', 'camaras'] },
];

const menuBase = [
  { key: 'dashboard', label: 'Dashboard', icon: '⌂' },
  { key: 'camaras', label: 'Cámaras', icon: '◉' },
  { key: 'usuarios', label: 'Usuarios', icon: '◌' },
  { key: 'roles', label: 'Roles', icon: '⚙' },
  { key: 'catalogos', label: 'Catálogo', icon: '▣' },
  { key: 'reportes', label: 'Reportes', icon: '◫' },
  { key: 'seguridad', label: 'Seguridad', icon: '⛨' },
];

const readSession = () => {
  try {
    const raw = localStorage.getItem('heimdall_session');
    if (!raw) return { loggedIn: false, user: null, accessToken: '', refreshToken: '' };
    const parsed = JSON.parse(raw);
    return {
      loggedIn: Boolean(parsed.accessToken),
      user: parsed.user || null,
      accessToken: parsed.accessToken || '',
      refreshToken: parsed.refreshToken || '',
    };
  } catch {
    return { loggedIn: false, user: null, accessToken: '', refreshToken: '' };
  }
};

const saveSession = (session) => {
  localStorage.setItem('heimdall_session', JSON.stringify(session));
};

const clearSession = () => {
  localStorage.removeItem('heimdall_session');
};

const normalizeListResponse = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};

const apiFetch = async (path, options = {}) => {
  const headers = { ...(options.headers || {}) };
  const token = readSession().accessToken || localStorage.getItem('heimdall_session');
  if (!headers.Authorization && token) {
    const parsed = JSON.parse(token || '{}');
    if (parsed.accessToken) {
      headers.Authorization = `Bearer ${parsed.accessToken}`;
    }
  }
  if (!headers['Content-Type'] && options.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  let payload = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }

  if (!response.ok) {
    const details = payload?.detail || payload?.non_field_errors?.[0] || payload?.error || 'Error de API';
    throw new Error(details);
  }

  return payload;
};

const roleIdMap = {
  superadmin: 1,
  admin: 1,
  administrador: 1,
  supervisor: 3,
  vigilante: 2,
};

const listRoleNames = {
  1: 'Administrador',
  2: 'Vigilante',
  3: 'Supervisor',
};

const defaultUserForm = {
  nombre: '',
  email: '',
  rol: 'vigilante',
};

const defaultRoleForm = {
  nombre: '',
  permisos: ['dashboard'],
};

const permissionCatalog = {
  dashboard: 'Dashboard',
  usuarios: 'Usuarios',
  roles: 'Roles',
  catalogos: 'Catálogo',
  reportes: 'Reportes',
  camaras: 'Cámaras',
  seguridad: 'Seguridad',
  config: 'Configuración',
};

function App() {
  const initialSession = readSession();
  const [role, setRole] = useState(normalizeRole(initialSession.user?.rol || 'administrador'));
  const [session, setSession] = useState(initialSession);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [users, setUsers] = useState(initialUsers);
  const [roles, setRoles] = useState(initialRoles);
  const [offlineMode, setOfflineMode] = useState(!navigator.onLine);
  const [loading, setLoading] = useState(Boolean(initialSession.accessToken));
  const [error, setError] = useState('');
  const [showUserForm, setShowUserForm] = useState(false);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [userForm, setUserForm] = useState(defaultUserForm);
  const [roleForm, setRoleForm] = useState(defaultRoleForm);
  const [reportData, setReportData] = useState({
    movimientos: [],
    incidencias: [],
    reconocimientos: [],
  });

  const permissions = useMemo(() => permissionsByRole[role] || ['dashboard'], [role]);

  useEffect(() => {
    const handleOnline = () => setOfflineMode(false);
    const handleOffline = () => setOfflineMode(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!session.accessToken) {
      setLoading(false);
      return undefined;
    }

    let isMounted = true;
    const hydrateProfile = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/profile/`, {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) throw new Error('Token inválido');

        const payload = await response.json();
        const nextSession = {
          ...session,
          loggedIn: true,
          user: {
            ...session.user,
            ...payload,
            nombre: payload.username || payload.nombre || session.user?.username || 'Usuario',
          },
        };

        if (isMounted) {
          setSession(nextSession);
          const nextRole = normalizeRole(payload.rol || session.user?.rol || 'administrador');
          setRole(nextRole);
          saveSession(nextSession);
        }
      } catch {
        clearSession();
        if (isMounted) {
          setSession({ loggedIn: false, user: null, accessToken: '', refreshToken: '' });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    hydrateProfile();
    return () => {
      isMounted = false;
    };
  }, [session.accessToken]);

  useEffect(() => {
    if (!session.loggedIn || !session.accessToken) return;

    const establecimientoId = session.user?.id_establecimiento || 1;
    const options = {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
    };

    const loadDashboardData = async () => {
      try {
        const [usuariosRes, rolesRes, movimientosRes, incidenciasRes, reconocimientosRes] = await Promise.all([
          fetch(`${API_BASE_URL}/identidad/usuarios/?id_establecimiento=${establecimientoId}`, options),
          fetch(`${API_BASE_URL}/identidad/roles/`, options),
          fetch(`${API_BASE_URL}/operaciones/movimientos/?id_establecimiento=${establecimientoId}`, options),
          fetch(`${API_BASE_URL}/operaciones/incidencias/?id_establecimiento=${establecimientoId}`, options),
          fetch(`${API_BASE_URL}/inteligencia/reconocimientos/?id_establecimiento=${establecimientoId}`, options),
        ]);

        const [usuariosData, rolesData, movimientosData, incidenciasData, reconocimientosData] = await Promise.all([
          usuariosRes.ok ? usuariosRes.json() : Promise.resolve({ results: [] }),
          rolesRes.ok ? rolesRes.json() : Promise.resolve({ results: [] }),
          movimientosRes.ok ? movimientosRes.json() : Promise.resolve({ results: [] }),
          incidenciasRes.ok ? incidenciasRes.json() : Promise.resolve({ results: [] }),
          reconocimientosRes.ok ? reconocimientosRes.json() : Promise.resolve({ results: [] }),
        ]);

        const usuarios = normalizeListResponse(usuariosData).map((u) => ({
          id: u.id_usuario,
          nombre: u.nombre,
          rol: u.rol?.nombre || u.id_rol || 'Sin rol',
          email: u.correo,
          estado: u.estado ? 'Activo' : 'Inactivo',
        }));

        const rolesList = normalizeListResponse(rolesData).map((roleItem) => ({
          nombre: roleItem.nombre,
          permisos: Array.isArray(roleItem.permisos)
            ? roleItem.permisos
            : ['dashboard', 'reportes', 'camaras'],
        }));

        setUsers(usuarios.length ? usuarios : initialUsers);
        setRoles(rolesList.length ? rolesList : initialRoles);
        setReportData({
          movimientos: normalizeListResponse(movimientosData),
          incidencias: normalizeListResponse(incidenciasData),
          reconocimientos: normalizeListResponse(reconocimientosData),
        });
      } catch {
        setUsers(initialUsers);
        setRoles(initialRoles);
        setReportData({ movimientos: [], incidencias: [], reconocimientos: [] });
      }
    };

    loadDashboardData();
  }, [session.loggedIn, session.accessToken, session.user?.id_establecimiento]);

  const canAccess = (key) => permissions.includes(key);

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    const form = new FormData(event.currentTarget);
    const username = String(form.get('username') || '').trim();
    const password = String(form.get('password') || '').trim();

    if (!username || !password) {
      setLoading(false);
      setError('Debes ingresar usuario y contraseña.');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/identidad/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const responseText = await response.text();
      let payload = {};

      if (responseText) {
        try {
          payload = JSON.parse(responseText);
        } catch {
          throw new Error('La API respondió con contenido HTML. Verifica que el backend esté levantado y accesible en la red local.');
        }
      }

      if (!response.ok) {
        throw new Error(payload.detail || payload.non_field_errors?.[0] || 'Credenciales inválidas');
      }

      const nextSession = {
        loggedIn: true,
        user: payload.user,
        accessToken: payload.access,
        refreshToken: payload.refresh,
      };

      setSession(nextSession);
      setRole(normalizeRole(payload.user?.rol || 'administrador'));
      saveSession(nextSession);
      setActiveTab('dashboard');
    } catch (loginError) {
      setError(loginError.message || 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearSession();
    setSession({ loggedIn: false, user: null, accessToken: '', refreshToken: '' });
    setRole('administrador');
    setActiveTab('dashboard');
    setError('');
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    if (!userForm.nombre || !userForm.email) {
      setError('Completa nombre y correo para crear el usuario.');
      return;
    }

    try {
      const establecimientoId = session.user?.id_establecimiento || 1;
      const payload = {
        id_establecimiento: establecimientoId,
        id_rol: roleIdMap[userForm.rol] || 2,
        nombre: userForm.nombre,
        correo: userForm.email,
        password: 'hash_pass_123',
        estado: true,
      };

      const created = await apiFetch(`/identidad/usuarios/?id_establecimiento=${establecimientoId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const nextUser = {
        id: created.id_usuario,
        nombre: created.nombre,
        rol: created.rol?.nombre || listRoleNames[created.id_rol] || userForm.rol,
        email: created.correo,
        estado: created.estado ? 'Activo' : 'Inactivo',
      };

      setUsers((prev) => [nextUser, ...prev]);
      setUserForm(defaultUserForm);
      setShowUserForm(false);
      setError('');
    } catch (createError) {
      setError(createError.message || 'No se pudo crear el usuario.');
    }
  };

  const handleCreateRole = async (event) => {
    event.preventDefault();
    if (!roleForm.nombre) {
      setError('Debes poner un nombre para el rol.');
      return;
    }

    try {
      const created = await apiFetch('/identidad/roles/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nombre: roleForm.nombre,
          permisos_input: roleForm.permisos,
        }),
      });

      const nextRole = {
        nombre: created.nombre,
        permisos: created.permisos || roleForm.permisos,
      };

      setRoles((prev) => [nextRole, ...prev]);
      setRoleForm(defaultRoleForm);
      setShowRoleForm(false);
      setError('');
    } catch (createError) {
      setError(createError.message || 'No se pudo crear el rol.');
    }
  };

  const togglePermission = (perm) => {
    setRoleForm((prev) => {
      const current = new Set(prev.permisos);
      if (current.has(perm)) current.delete(perm);
      else current.add(perm);
      return { ...prev, permisos: [...current] };
    });
  };

  const totalMovimientos = reportData.movimientos.length || 1248;
  const totalIncidencias = reportData.incidencias.length || 31;
  const totalReconocimientos = reportData.reconocimientos.length || 972;
  const aprobados = reportData.reconocimientos.filter((item) => String(item.resultado_ia || item.resultado || '').toUpperCase() === 'AUTORIZADO').length || 846;

  const renderDashboard = () => (
    <div className="dashboard-grid">
      <div className="hero-panel">
        <div className="hero-header-row">
          <div className="hero-left">
            <span className="live-dot" />
            <span>Modo reconocimiento</span>
          </div>
          <button className="chip active">LPR</button>
        </div>

        <div className="camera-layout">
          <div className="camera-stage">
            <div className="camera-mask" />
            <div className="plate-box">ABC-1245</div>
          </div>

          <div className="panels-right">
            <div className="info-box">
              <span>Placa</span>
              <strong>ABC-1245</strong>
            </div>
            <div className="info-box success">
              <span>Estado</span>
              <strong>Autorizado</strong>
            </div>
            <div className="info-box warning">
              <span>Confianza</span>
              <strong>96.8%</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="metrics-grid">
        {[
          { label: 'Vehículos detectados', value: totalMovimientos.toLocaleString(), tone: 'green' },
          { label: 'Autorizados', value: aprobados.toLocaleString(), tone: 'cyan' },
          { label: 'Incidencias', value: totalIncidencias.toLocaleString(), tone: 'orange' },
          { label: 'Sincronizados', value: `${Math.min(100, Math.max(70, Math.round((totalReconocimientos / Math.max(1, totalMovimientos)) * 100)))}%`, tone: 'red' },
        ].map((m) => (
          <div className={`metric-card ${m.tone}`} key={m.label}>
            <div className="metric-label">{m.label}</div>
            <div className="metric-value">{m.value}</div>
            <div className="bar" />
          </div>
        ))}
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="panel-card">
      <div className="section-header">
        <h3>Usuarios</h3>
        <button className="primary-btn" onClick={() => setShowUserForm((v) => !v)}>
          {showUserForm ? 'Cerrar' : '+ Nuevo usuario'}
        </button>
      </div>

      {showUserForm && (
        <form className="form-panel" onSubmit={handleCreateUser}>
          <div className="field-grid">
            <label>
              <span>Nombre</span>
              <input value={userForm.nombre} onChange={(e) => setUserForm((p) => ({ ...p, nombre: e.target.value }))} />
            </label>
            <label>
              <span>Email</span>
              <input type="email" value={userForm.email} onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))} />
            </label>
            <label>
              <span>Rol</span>
              <select value={userForm.rol} onChange={(e) => setUserForm((p) => ({ ...p, rol: e.target.value }))}>
                <option value="superadmin">Super Admin</option>
                <option value="admin">Administrador</option>
                <option value="supervisor">Supervisor</option>
                <option value="vigilante">Vigilante</option>
              </select>
            </label>
          </div>
          <div className="form-actions">
            <button type="submit" className="primary-btn">Guardar</button>
            <button type="button" className="ghost-btn" onClick={() => setShowUserForm(false)}>Cancelar</button>
          </div>
        </form>
      )}

      <table className="data-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Email</th>
            <th>Rol</th>
            <th>Estado</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.nombre}</td>
              <td>{user.email}</td>
              <td>{user.rol}</td>
              <td><span className="badge ok">{user.estado}</span></td>
              <td><button className="ghost-btn">Editar</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderRoles = () => (
    <div className="panel-card">
      <div className="section-header">
        <h3>Roles y permisos</h3>
        <button className="primary-btn" onClick={() => setShowRoleForm((v) => !v)}>
          {showRoleForm ? 'Cerrar' : '+ Crear rol'}
        </button>
      </div>

      {showRoleForm && (
        <form className="form-panel" onSubmit={handleCreateRole}>
          <div className="field-grid">
            <label>
              <span>Nombre del rol</span>
              <input value={roleForm.nombre} onChange={(e) => setRoleForm((p) => ({ ...p, nombre: e.target.value }))} />
            </label>
          </div>

          <div className="permission-grid">
            {Object.entries(permissionCatalog).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`permission-chip ${roleForm.permisos.includes(key) ? 'active' : ''}`}
                onClick={() => togglePermission(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="form-actions">
            <button type="submit" className="primary-btn">Guardar rol</button>
            <button type="button" className="ghost-btn" onClick={() => setShowRoleForm(false)}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="role-list">
        {roles.map((roleItem) => (
          <div key={`${roleItem.nombre}-${roleItem.permisos.join('-')}`} className="role-box">
            <div className="role-title">{roleItem.nombre}</div>
            <div className="pill-wrap">
              {roleItem.permisos.map((perm) => (
                <span key={`${roleItem.nombre}-${perm}`} className="perm-pill">{permissionCatalog[perm] || perm}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderCatalogos = () => {
    const catalogItems = [
      { label: 'Planes', value: '3', icon: 'P', tone: 'green' },
      { label: 'Establecimientos', value: session.user?.id_establecimiento || 1, icon: 'E', tone: 'cyan' },
      { label: 'Vehículos', value: totalMovimientos.toLocaleString(), icon: 'V', tone: 'orange' },
      { label: 'Incidencias', value: totalIncidencias.toLocaleString(), icon: 'I', tone: 'red' },
    ];

    return (
      <div className="catalog-panel">
        <div className="section-header">
          <h3>Catálogo y gestión</h3>
        </div>
        <div className="catalog-grid">
          {catalogItems.map((item) => (
            <div key={item.label} className={`catalog-card ${item.tone}`}>
              <div className="catalog-icon">{item.icon}</div>
              <strong>{item.label}</strong>
              <span>{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCamaras = () => (
    <div className="panel-card">
      <div className="section-header">
        <h3>Cámaras / LPR</h3>
        <div className="toggle-wrap">
          <span>Offline</span>
          <button className={`switch ${offlineMode ? 'on' : ''}`} onClick={() => setOfflineMode((v) => !v)}>
            <span />
          </button>
        </div>
      </div>

      <div className="camera-monitor">
        <div className="camera-feed">
          <div className="scan-box" />
        </div>
        <div className="camera-side">
          <div className="mini-card">OCR: ABC-1245</div>
          <div className="mini-card success">Resultado: Autorizado</div>
          <div className="mini-card warning">Confianza: 96.8%</div>
          <div className="mini-card neutral">Queue offline: {offlineMode ? 12 : 3}</div>
        </div>
      </div>
    </div>
  );

  const renderReportes = () => (
    <div className="panel-card">
      <div className="section-header">
        <h3>Reportes y analítica</h3>
      </div>
      <div className="report-stack">
        <div className="report-summary">
          <div className="mini-card"><span>Movimientos</span><strong>{totalMovimientos}</strong></div>
          <div className="mini-card warning"><span>Incidencias</span><strong>{totalIncidencias}</strong></div>
          <div className="mini-card success"><span>Reconocimientos</span><strong>{totalReconocimientos}</strong></div>
        </div>
        <div className="chart-box">
          <ul>
            <li>Instalación: {session.user?.id_establecimiento || 1}</li>
            <li>Autorizados: {aprobados}</li>
            <li>Estados sincronizados: {Math.min(100, totalMovimientos || 0)}%</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const renderSeguridad = () => (
    <div className="panel-card">
      <div className="section-header">
        <h3>Seguridad y auditoría</h3>
      </div>
      <div className="security-stack">
        <div className="security-item">RBAC activo</div>
        <div className="security-item">JWT con tenant y rol</div>
        <div className="security-item">Logs de acceso</div>
        <div className="security-item">Multi-tenant por establecimiento</div>
        <div className="security-item">Modo offline habilitado con caché local</div>
      </div>
    </div>
  );

  const contentMap = {
    dashboard: renderDashboard(),
    usuarios: canAccess('usuarios') ? renderUsers() : <div className="panel-card warn">No tienes permisos para ver usuarios.</div>,
    roles: canAccess('roles') ? renderRoles() : <div className="panel-card warn">No tienes permisos para ver roles.</div>,
    catalogos: canAccess('catalogos') ? renderCatalogos() : <div className="panel-card warn">No tienes permisos para ver catálogo.</div>,
    camaras: canAccess('camaras') ? renderCamaras() : <div className="panel-card warn">No tienes permisos para ver cámaras.</div>,
    reportes: canAccess('reportes') ? renderReportes() : <div className="panel-card warn">No tienes permisos para ver reportes.</div>,
    seguridad: canAccess('seguridad') ? renderSeguridad() : <div className="panel-card warn">No tienes permisos para seguridad.</div>,
  };

  if (!session.loggedIn) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-brand">HEIMDALL</div>
          <h2>Acceso al sistema</h2>
          <form onSubmit={handleLogin} className="login-form">
            <input name="username" type="text" placeholder="Usuario o correo" defaultValue="admin@pinos.com" />
            <input name="password" type="password" placeholder="Contraseña" defaultValue="hash_pass_123" />
            <button type="submit" className="primary-btn login-btn" disabled={loading}>
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
            {error ? <div className="error-box">{error}</div> : null}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">H</div>
        <nav className="side-menu">
          {menuBase.filter((item) => canAccess(item.key) || item.key === 'dashboard').map((item) => (
            <button
              key={item.key}
              className={`nav-btn ${activeTab === item.key ? 'active' : ''}`}
              onClick={() => setActiveTab(item.key)}
            >
              <span>{item.icon}</span>
              <small>{item.label}</small>
            </button>
          ))}
        </nav>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <div className="status-pill">{offlineMode ? 'Modo offline' : 'Online'}</div>
          </div>

          <div className="topbar-right">
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="superadmin">Super Admin</option>
              <option value="admin">Administrador</option>
              <option value="supervisor">Supervisor</option>
              <option value="vigilante">Vigilante</option>
            </select>
            <div className="user-box">
              <span>{session.user?.nombre || session.user?.username || 'Usuario'}</span>
              <button className="ghost-btn" onClick={handleLogout}>Salir</button>
            </div>
          </div>
        </header>

        <section className="content-area">
          {contentMap[activeTab] || contentMap.dashboard}
        </section>
      </main>
    </div>
  );
}

export default App;
