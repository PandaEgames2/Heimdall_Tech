import { HeimdallMark } from './Brand';

const SIDEBAR_ICONS = {
  dashboard: (
    <>
      <path d="M2 21V10l3-3V4h3l4-2 4 2h3v3l3 3v11" />
      <path d="M7 21v-7a5 5 0 0 1 10 0v7" />
      <path d="M12 7v14" />
      <path d="M2 21h20" />
    </>
  ),
  accesos: (
    <>
      <path d="M2 19a10 10 0 0 1 20 0" />
      <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
      <path d="M2 19h20" />
      <path d="M7 19v-4.2M12 19v-6.5M17 19v-4.2" />
    </>
  ),
  camaras: (
    <>
      <path d="M2 12c2.8-4.4 6.2-6.5 10-6.5s7.2 2.1 10 6.5c-2.8 4.4-6.2 6.5-10 6.5S4.8 16.4 2 12Z" />
      <path d="m12 8.5 3.5 3.5-3.5 3.5L8.5 12 12 8.5Z" />
      <path d="M12 2.5V4M4.5 4.5 5.8 5.8M19.5 4.5l-1.3 1.3" />
    </>
  ),
  mi_qr: (
    <>
      <path d="M12 2.5 20 5.2v6.4c0 4.6-3.2 7.9-8 9.9-4.8-2-8-5.3-8-9.9V5.2L12 2.5Z" />
      <path d="M8 8h2.5v2.5H8zM13.5 8H16v2.5h-2.5M8 13.5h2.5V16H8" />
      <path d="m14.75 13.25 1.5 1.5-1.5 1.5-1.5-1.5 1.5-1.5Z" />
    </>
  ),
  usuarios: (
    <>
      <circle cx="8.2" cy="8" r="2.3" />
      <path d="M3.5 20v-1.4c0-2.9 2-4.6 4.7-4.6 1.2 0 2.2.3 3 .9" />
      <path d="M6.1 5.9 8.2 3.8l2.1 2.1" />
      <circle cx="16.2" cy="8.8" r="2.1" />
      <path d="M12.4 20v-1.1c0-2.6 1.7-4.1 3.8-4.1s3.8 1.5 3.8 4.1V20" />
      <path d="M14.3 6.9 16.2 5l1.9 1.9" />
      <path d="M3.5 20h17" />
    </>
  ),
  roles: (
    <>
      <path d="M12 2 9.5 5v10h5V5L12 2Z" />
      <path d="M12 5v8M8 15h8M12 15v4" />
      <path d="m10 20 2 1.5 2-1.5" />
    </>
  ),
  recursos: (
    <>
      <path
        d="M8 19a4 4 0 0 1-2.24-7.32A3.5 3.5 0 0 1 9 6.03V6a3 3 0 1 1 6 0v.04a3.5 3.5 0 0 1 3.24 5.65A4 4 0 0 1 16 19Z"
        transform="translate(2.4 2.2) scale(0.8)"
        vectorEffect="non-scaling-stroke"
      />
      <path d="M12 17.4V19.2" />
      <path d="M12 19.2c-1.8.6-3.2 1.1-4.6 1.5M12 19.2c1.8.6 3.2 1.1 4.6 1.5M12 19.2v2" />
    </>
  ),
  reportes: (
    <>
      <path d="M6 2.8h8.5l4.5 4.5v13.9H6a2.3 2.3 0 0 1-2.3-2.3V5.1A2.3 2.3 0 0 1 6 2.8Z" />
      <path d="M14.2 2.8v5h5" />
      <path d="M7.8 17.2v-2.8M11.4 17.2v-5.4M15 17.2v-3.7" />
    </>
  ),
  catalogos: (
    <>
      <path d="M5.5 21V6.6a6.5 6.5 0 0 1 13 0V21h-13Z" />
      <path d="M8.2 9.1h7.6M8.2 12.1h7.6" />
      <path d="m9.7 18 2.3-3 2.3 3M12 15v-1.6" />
    </>
  ),
  seguridad: (
    <>
      <path d="M12 2.4 20 5.3v6.3c0 4.7-3.2 8-8 10.1-4.8-2.1-8-5.4-8-10.1V5.3l8-2.9Z" />
      <path d="m8.4 12 2.4 2.4 4.8-5" />
    </>
  ),
};

function SidebarIcon({ name }) {
  return (
    <svg
      className="nav-icon w-5 h-5 stroke-current fill-none stroke-2"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {SIDEBAR_ICONS[name] || SIDEBAR_ICONS.recursos}
    </svg>
  );
}

const FALLBACK_MENU = [
  { key: 'dashboard', label: 'Dashboard', group: 'General' },
  { key: 'accesos', label: 'Control de acceso', group: 'Operación' },
  { key: 'camaras', label: 'Cámaras', group: 'Operación' },
  { key: 'mi_qr', label: 'Mi QR e invitados', group: 'Operación' },
  { key: 'usuarios', label: 'Usuarios', group: 'Administración' },
  { key: 'roles', label: 'Roles y permisos', group: 'Administración' },
  { key: 'recursos', label: 'Recursos', group: 'Administración' },
  { key: 'catalogos', label: 'Catálogo', group: 'Administración' },
  { key: 'reportes', label: 'Reportes', group: 'Administración' },
  { key: 'seguridad', label: 'Seguridad', group: 'Sistema' },
];

const GROUP_ORDER = ['General', 'Operación', 'Administración', 'Sistema'];

function resolveMenu(profile) {
  if (Array.isArray(profile?.menu) && profile.menu.length > 0) {
    return profile.menu.filter((item) => item.visible !== false);
  }
  const permissions = new Set(profile?.permisos_efectivos || []);
  return FALLBACK_MENU.filter((item) => permissions.has(item.key));
}

export default function Sidebar({
  profile,
  activeTab,
  onNavigate,
  mobileOpen = false,
  onClose = () => {},
}) {
  const isSuperAdmin = Boolean(profile?.is_platform_superadmin);
  const items = resolveMenu(profile).filter(
    (item) => !item.superadmin_only || isSuperAdmin,
  );

  const groupNames = [];
  items.forEach((item) => {
    const group = item.group || 'General';
    if (!groupNames.includes(group)) groupNames.push(group);
  });
  groupNames.sort((a, b) => {
    const indexA = GROUP_ORDER.indexOf(a);
    const indexB = GROUP_ORDER.indexOf(b);
    if (indexA === -1 && indexB === -1) return 0;
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  const grouped = groupNames.map((group) => ({
    group,
    items: items.filter((item) => (item.group || 'General') === group),
  })).filter((section) => section.items.length > 0);

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="mobile-nav-backdrop"
          aria-label="Cerrar menú de navegación"
          onClick={onClose}
        />
      ) : null}
      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-mobile-header">
          <span>MENÚ PRINCIPAL</span>
          <button type="button" aria-label="Cerrar menú" onClick={onClose}>×</button>
        </div>
        <div className="brand" title="Heimdall · Guardián de Bifröst"><HeimdallMark /></div>

        <nav className="side-menu" id="primary-navigation" aria-label="Navegación principal">
          {grouped.map((section) => (
            <div className="side-menu-group" key={section.group}>
              <span className="side-menu-label">{section.group}</span>
              {section.items.map((item) => {
                const lockedByPlan = Boolean(item.locked_by_plan);
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`nav-btn ${activeTab === item.key ? 'active' : ''} ${lockedByPlan ? 'locked' : ''}`}
                    aria-current={activeTab === item.key ? 'page' : undefined}
                    aria-disabled={lockedByPlan || undefined}
                    onClick={() => {
                      if (lockedByPlan) return;
                      onNavigate(item.key);
                      onClose();
                    }}
                    title={lockedByPlan
                      ? `${item.label}: mejora el plan ${profile?.plan?.nombre || 'actual'} para habilitarlo`
                      : item.label}
                  >
                    <span className="nav-icon-wrap">
                      {lockedByPlan ? <span className="nav-lock" aria-hidden="true">⌁</span> : <SidebarIcon name={item.icon || item.key} />}
                    </span>
                    <small>{item.label}</small>
                    {lockedByPlan ? <span className="nav-plan-badge">Plan</span> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-guard">
          <span><HeimdallMark /></span>
          <strong>Himinbjörg Guard</strong>
          <small>SISTEMA ACTIVO</small>
        </div>
      </aside>
    </>
  );
}
