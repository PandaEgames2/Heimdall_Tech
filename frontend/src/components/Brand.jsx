export function HeimdallMark() {
  return (
    <svg className="heimdall-mark" viewBox="0 0 48 48" role="img" aria-label="El ojo vigilante de Heimdall">
      <path className="watcher-arch" d="M7 26a17 17 0 0 1 34 0" />
      <path className="watcher-ray" d="M13 19a12 12 0 0 1 22 0" />
      <path className="watcher-eye" d="M6 30s7-9 18-9 18 9 18 9-7 9-18 9S6 30 6 30Z" />
      <circle className="watcher-iris" cx="24" cy="30" r="5.2" />
      <circle className="watcher-glint" cx="26" cy="28" r="1.35" />
      <path className="watcher-bifrost" d="M16 43h16" />
    </svg>
  );
}

export function NavigationIcon({ name }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
  const accent = <path className="nav-icon-accent" d="M5 19h14" />;
  const shapes = {
    dashboard: <><path d="M3 20h18M5 20V10l7-7 7 7v10M8 20v-7a4 4 0 0 1 8 0v7M10 14h4M12 13v7M3 10h4m10 0h4" /><path d="m4 7 2 1m14-1-2 1M7 5l2 2m8-2-2 2" />{accent}</>,
    accesos: <><path d="M3 17.5c3.7-.2 6.2-2 8-5.8l2.5-5.2c.6-1.2 2.1-1.2 2.7 0l1 2.2c.5 1 1.6 1.4 2.6 1l1.2-.5-1.1 3c-1 2.8-3 4.3-6 3.8l-2.6-.4M4 18h8" /><path d="m14.5 7.7 1.4.6m-3.1 2 1.4.7m-3 1.6 1.5.7m6.1-2.9 1.3.1" />{accent}</>,
    camaras: <><path d="M2 9c2.4-2.3 4.5-3.4 6.8-3.4C11.7 5.6 14 9 14 9s-2.3 3.4-5.2 3.4C6.5 12.4 4.4 11.3 2 9Z" /><circle cx="8.8" cy="9" r="1.5" /><path d="M10 15c2.2-2.3 4.2-3.4 6.5-3.4 2.8 0 5 3.4 5 3.4s-2.2 3.4-5 3.4c-2.3 0-4.3-1.1-6.5-3.4Z" /><circle cx="16.5" cy="15" r="1.5" /><path d="m4 4-1-1m8 0-1 1m7 7 1-2m3 7h1" />{accent}</>,
    usuarios: <><circle cx="12" cy="7" r="2.3" /><path d="M7.5 17.5c.4-2.7 1.9-4.2 4.5-4.2s4.1 1.5 4.5 4.2" /><circle cx="5.2" cy="9.2" r="1.7" /><path d="M2.5 16c.2-1.8 1.1-2.8 2.7-3M18.8 9.2a1.7 1.7 0 1 0 0-3.4M18.8 13c1.6.2 2.5 1.2 2.7 3" />{accent}</>,
    roles: <><path d="M12 4v16M12 4 6 10m6-6 6 6" />{accent}</>,
    catalogos: <><path d="M5 5c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2v14c0 1.1-.9 2-2 2H7c-1.1 0-2-.9-2-2V5Zm0 1H3v12h2M7 3v2m10-2v2m-6 4v6m0-6-2 2m2-2 2 2" /><path d="M8 17h8" />{accent}</>,
    reportes: <><path d="M12 20V8m0 3C9 6 5 5 2.5 6.5 4 11 7.2 13.5 12 14m0-3c3-5 7-6 9.5-4.5C20 11 16.8 13.5 12 14M12 16c-2-2.5-4.5-3.2-7.5-2.8 1.3 3.4 3.8 5.2 7.5 5.4m0-2.6c2-2.5 4.5-3.2 7.5-2.8-1.3 3.4-3.8 5.2-7.5 5.4" /><path d="M11 5.5 13 4l2 1.5-2 1.5-2-1.5Z" />{accent}</>,
    mi_qr: <><path d="M3.5 3.5h6v6h-6zM14.5 3.5h6v6h-6zM3.5 14.5h6v6h-6zM14.5 14.5h2v2h-2zM18.5 14.5h2v6h-2zM14.5 18.5h2" />{accent}</>,
    seguridad: <><path d="M12 2.8 20 6v5.5c0 4.8-3.2 8-8 9.8-4.8-1.8-8-5-8-9.8V6l8-3.2Z" /><path d="m8.5 12 2.2 2.2 4.8-5" />{accent}</>,
  };
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true" {...common}>
      {shapes[name] || shapes.catalogos}
    </svg>
  );
}
