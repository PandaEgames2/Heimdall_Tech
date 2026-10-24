const menuItems = [
  { key: 'dashboard', label: 'Dashboard', icon: '⌂', active: true },
  { key: 'camaras', label: 'Cámaras', icon: '◉' },
  { key: 'usuarios', label: 'Usuarios', icon: '◌' },
  { key: 'roles', label: 'Roles', icon: '⚙' },
  { key: 'catalogos', label: 'Catálogo', icon: '▣' },
  { key: 'reportes', label: 'Reportes', icon: '◫' }
];

const cards = [
  { title: 'Vehículos detectados', value: '1,248', accent: 'green' },
  { title: 'Autorizados', value: '972', accent: 'cyan' },
  { title: 'Incidencias', value: '31', accent: 'orange' },
  { title: 'Sincronizados', value: '94%', accent: 'red' }
];

const rolePermissions = {
  superadmin: ['dashboard', 'camaras', 'usuarios', 'roles', 'catalogos', 'reportes', 'security'],
  admin: ['dashboard', 'camaras', 'usuarios', 'catalogos', 'reportes'],
  supervisor: ['dashboard', 'camaras', 'reportes'],
  vigilante: ['dashboard', 'camaras']
};

const state = {
  role: 'superadmin',
  offline: false,
  syncQueue: 12
};

function renderMenu() {
  const menuEl = document.getElementById('mainMenu');
  menuEl.innerHTML = menuItems.map((item) => {
    const isActive = item.key === 'dashboard';
    return `<button class="nav-icon ${isActive ? 'active' : ''}" data-section="${item.key}" title="${item.label}">${item.icon}</button>`;
  }).join('');
}

function renderDashboard() {
  const content = document.getElementById('contentArea');
  content.innerHTML = cards.map((card) => `
    <article class="metric-card accent-${card.accent}">
      <div class="title">${card.title}</div>
      <div class="big">${card.value}</div>
      <div class="spark"></div>
    </article>
  `).join('');
}

function renderUsersView() {
  const content = document.getElementById('contentArea');
  content.innerHTML = `
    <article class="metric-card" style="grid-column: 1 / -1; min-height: 300px;">
      <div class="title">Gestión de usuarios y RBAC</div>
      <div style="display:grid; grid-template-columns: repeat(3, minmax(150px,1fr)); gap:12px; margin-top:14px;">
        ${['Super Admin','Administrador','Supervisor','Vigilante'].map((r) => `
          <div style="background: rgba(255,255,255,0.04); border-radius: 14px; padding: 14px; color: #dfeff6; border:1px solid rgba(255,255,255,0.08);">
            <strong>${r}</strong>
            <ul style="padding-left:18px; margin:10px 0 0; color:#b5d1d9; line-height:1.8;">
              ${r === 'Super Admin' ? '<li>Editar roles</li><li>Ver catálogo</li><li>Acceso total</li>' : ''}
              ${r === 'Administrador' ? '<li>Gestión usuarios</li><li>Control accesos</li><li>Reportes</li>' : ''}
              ${r === 'Supervisor' ? '<li>Monitoreo</li><li>Auditoría</li>' : ''}
              ${r === 'Vigilante' ? '<li>Escaneo QR</li><li>Validación</li>' : ''}
            </ul>
          </div>
        `).join('')}
      </div>
    </article>
  `;
}

function renderRolesView() {
  const content = document.getElementById('contentArea');
  content.innerHTML = `
    <article class="metric-card" style="grid-column: 1 / -1; min-height: 320px;">
      <div class="title">Roles y permisos</div>
      <div style="display:grid; gap:12px; margin-top:12px;">
        ${Object.entries(rolePermissions).map(([role, perms]) => `
          <div style="background: rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 14px; color:#dfeef2;">
            <strong>${role.toUpperCase()}</strong>
            <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:10px;">
              ${perms.map((p) => `<span style="padding:6px 10px; border-radius:999px; background: rgba(71, 220, 163, 0.13); color:#9ff7d6; border:1px solid rgba(71,220,163,0.25);">${p}</span>`).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </article>
  `;
}

function renderCatalogView() {
  const content = document.getElementById('contentArea');
  content.innerHTML = `
    <article class="metric-card" style="grid-column: 1 / -1; min-height: 280px;">
      <div class="title">Catálogo y gestión</div>
      <div style="display:grid; grid-template-columns: repeat(4, minmax(150px,1fr)); gap:12px; margin-top:16px;">
        ${['Planes','Establecimientos','Vehículos','Incidencias'].map((item) => `
          <div style="background: rgba(255,255,255,0.04); border-radius: 16px; padding: 18px; color:#dfeef2; border:1px solid rgba(255,255,255,0.08);">
            <div style="font-size:1.8rem; margin-bottom:10px;">${item[0]}</div>
            <div><strong>${item}</strong></div>
          </div>
        `).join('')}
      </div>
    </article>
  `;
}

function attachEvents() {
  document.getElementById('roleSelector').addEventListener('change', (event) => {
    state.role = event.target.value;
    renderMenu();
    renderRoleAwareView();
  });

  document.getElementById('mainMenu').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-section]');
    if (!btn) return;
    const section = btn.dataset.section;
    if (section === 'dashboard') renderDashboard();
    if (section === 'usuarios') renderUsersView();
    if (section === 'roles') renderRolesView();
    if (section === 'catalogos') renderCatalogView();
    if (section === 'camaras') renderDashboard();
    if (section === 'reportes') renderDashboard();

    document.querySelectorAll('.nav-icon').forEach((el) => el.classList.remove('active'));
    btn.classList.add('active');
  });
}

function renderRoleAwareView() {
  const role = state.role;
  const visible = rolePermissions[role];

  if (visible.includes('usuarios')) {
    renderUsersView();
    return;
  }

  if (visible.includes('roles')) {
    renderRolesView();
    return;
  }

  if (visible.includes('catalogos')) {
    renderCatalogView();
    return;
  }

  renderDashboard();
}

window.addEventListener('online', () => {
  document.getElementById('connectionStatus').textContent = 'Online';
  state.offline = false;
});

window.addEventListener('offline', () => {
  document.getElementById('connectionStatus').textContent = 'Offline';
  state.offline = true;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  });
}

renderMenu();
renderDashboard();
attachEvents();
