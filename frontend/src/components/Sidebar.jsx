import { HeimdallMark, NavigationIcon } from './Brand';

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

  const grouped = GROUP_ORDER.map((group) => ({
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
                      {lockedByPlan ? <span className="nav-lock" aria-hidden="true">⌁</span> : <NavigationIcon name={item.icon || item.key} />}
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
