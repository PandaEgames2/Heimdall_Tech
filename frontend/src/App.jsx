import { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';
import { QRCodeSVG } from 'qrcode.react';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:8000/api`;
const SUPER_ADMIN_ROL_ID = 4;
const EMPTY_PERMISSION_OVERRIDES = Object.freeze({});

const permissionsByRole = {
  superadmin: ['dashboard', 'usuarios', 'roles', 'catalogos', 'reportes', 'camaras', 'seguridad', 'config', 'accesos'],
  admin: ['dashboard', 'usuarios', 'catalogos', 'reportes', 'camaras', 'accesos'],
  supervisor: ['dashboard', 'reportes', 'camaras', 'accesos'],
  vigilante: ['dashboard', 'camaras', 'accesos'],
  residente: ['mi_qr'],
  'sin rol': ['dashboard'],
};

const normalizeRoleFromUser = (user) => {
  if (!user) return 'vigilante';
  if (user.rol_id === SUPER_ADMIN_ROL_ID || user.is_platform_superadmin) return 'superadmin';
  if (user.rol_id === 2) return 'vigilante';
  if (user.rol_id === 3) return 'supervisor';
  if (user.rol_id === 1) return 'admin';
  if (user.rol_id === 5) return 'residente';
  const str = String(user.rol || '').trim().toLowerCase();
  if (str.includes('super admin') || str === 'super admin') return 'superadmin';
  if (str.includes('vigilante')) return 'vigilante';
  if (str.includes('supervisor')) return 'supervisor';
  if (str.includes('administrador')) return 'admin';
  if (str.includes('residente')) return 'residente';
  return 'vigilante';
};

function QRScanner({ onDetected }) {
  const videoRef = useRef(null);
  const onDetectedRef = useRef(onDetected);
  const [active, setActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [waitingForCode, setWaitingForCode] = useState(false);
  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    if (!active) return undefined;
    let controls;
    let fallbackTimer;
    let cancelled = false;

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Este navegador no permite acceso a la cámara. Usa el código de 6 dígitos del residente.');
        return;
      }
      try {
        setCameraError('');
        setWaitingForCode(false);
        const reader = new BrowserQRCodeReader();
        fallbackTimer = window.setTimeout(() => {
          if (!cancelled) setWaitingForCode(true);
        }, 8000);
        const scanControls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result, _scanError, scannerControls) => {
            if (!result || cancelled) return;
            window.clearTimeout(fallbackTimer);
            setWaitingForCode(false);
            scannerControls?.stop();
            setActive(false);
            onDetectedRef.current(result.getText());
          },
        );
        controls = scanControls;
        if (cancelled) controls.stop();
      } catch (error) {
        if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
          setCameraError('No se concedió permiso para usar la cámara. Puedes ingresar el código de 6 dígitos del residente.');
        } else if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
          setCameraError('No se encontró una cámara disponible. Puedes ingresar el código manualmente.');
        } else {
          setCameraError('No se pudo iniciar la cámara. Comprueba el permiso del navegador o ingresa el código manualmente.');
          }
      }
    };

    start();
    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
      controls?.stop();
    };
  }, [active]);

  return (
    <div className="qr-scanner">
      {active ? <video ref={videoRef} className="qr-scanner-video" autoPlay playsInline muted /> : null}
      {cameraError ? <p className="login-hint">{cameraError}</p> : null}
      {active && waitingForCode ? <p className="login-hint">Aún no se detecta el QR. Acércalo a la cámara o ingresa el código de 6 dígitos del residente.</p> : null}
      <button type="button" className="ghost-btn" onClick={() => { setCameraError(''); setActive((value) => !value); }}>
        {active ? 'Detener cámara' : 'Escanear QR con cámara'}
      </button>
    </div>
  );
}

function HeimdallMark() {
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

function PlateCamera({ onCapture, processing }) {
  const videoRef = useRef(null);
  const [cameraError, setCameraError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream;
    let cancelled = false;
    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Para abrir la cámara, usa localhost o una conexión HTTPS. También puedes registrar la placa manualmente en Control de acceso.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setReady(true);
      } catch (error) {
        setCameraError(error?.name === 'NotAllowedError'
          ? 'No se concedió permiso para la cámara. Habilítalo en el navegador o registra la placa manualmente.'
          : 'No se pudo iniciar la cámara. Comprueba que no esté siendo usada por otra aplicación.');
      }
    };
    startCamera();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) onCapture(blob);
      else setCameraError('No se pudo tomar la captura. Intenta nuevamente.');
    }, 'image/jpeg', 0.9);
  };

  return (
    <div className="plate-camera">
      {cameraError ? <div className="camera-message" role="status">{cameraError}</div> : null}
      <div className="plate-camera-view">
        <video ref={videoRef} autoPlay playsInline muted aria-label="Vista previa de cámara para placas" />
        <div className="plate-camera-guide"><span>Centra la placa dentro del marco</span></div>
      </div>
      <div className="plate-camera-actions">
        <span className={`camera-ready ${ready ? 'is-ready' : ''}`}>{ready ? 'Cámara lista' : 'Conectando cámara…'}</span>
        <button type="button" className="primary-btn" onClick={capture} disabled={!ready || processing}>
          {processing ? 'Analizando…' : 'Capturar y reconocer placa'}
        </button>
      </div>
    </div>
  );
}

const menuBase = [
  { key: 'dashboard', label: 'Dashboard', icon: '⌂' },
  { key: 'accesos', label: 'Control de acceso', icon: '✓' },
  { key: 'camaras', label: 'Cámaras', icon: '◉' },
  { key: 'usuarios', label: 'Usuarios', icon: '◌' },
  { key: 'roles', label: 'Roles', icon: '⚙' },
  { key: 'catalogos', label: 'Catálogo', icon: '▣' },
  { key: 'reportes', label: 'Reportes', icon: '◫' },
  { key: 'mi_qr', label: 'Mi QR e invitados', icon: '▦' },
  { key: 'seguridad', label: 'Seguridad', icon: '⛨' },
];

function NavigationIcon({ name }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const accent = <path className="nav-icon-accent" d="M5 19h14" />;
  const shapes = {
    // Heimdall iconography: Nordic realm gate, Gjallarhorn, watchful eyes,
    // the people under his watch, rune scroll, and Odin's raven reports.
    dashboard: <><path d="M3 20h18M5 20V10l7-7 7 7v10M8 20v-7a4 4 0 0 1 8 0v7M10 14h4M12 13v7M3 10h4m10 0h4" /><path d="m4 7 2 1m14-1-2 1M7 5l2 2m8-2-2 2" />{accent}</>,
    accesos: <><path d="M3 17.5c3.7-.2 6.2-2 8-5.8l2.5-5.2c.6-1.2 2.1-1.2 2.7 0l1 2.2c.5 1 1.6 1.4 2.6 1l1.2-.5-1.1 3c-1 2.8-3 4.3-6 3.8l-2.6-.4M4 18h8" /><path d="m14.5 7.7 1.4.6m-3.1 2 1.4.7m-3 1.6 1.5.7m6.1-2.9 1.3.1" />{accent}</>,
    camaras: <><path d="M2 9c2.4-2.3 4.5-3.4 6.8-3.4C11.7 5.6 14 9 14 9s-2.3 3.4-5.2 3.4C6.5 12.4 4.4 11.3 2 9Z" /><circle cx="8.8" cy="9" r="1.5" /><path d="M10 15c2.2-2.3 4.2-3.4 6.5-3.4 2.8 0 5 3.4 5 3.4s-2.2 3.4-5 3.4c-2.3 0-4.3-1.1-6.5-3.4Z" /><circle cx="16.5" cy="15" r="1.5" /><path d="m4 4-1-1m8 0-1 1m7 7 1-2m3 7h1" />{accent}</>,
    usuarios: <><circle cx="12" cy="7" r="2.3" /><path d="M7.5 17.5c.4-2.7 1.9-4.2 4.5-4.2s4.1 1.5 4.5 4.2" /><circle cx="5.2" cy="9.2" r="1.7" /><path d="M2.5 16c.2-1.8 1.1-2.8 2.7-3M18.8 9.2a1.7 1.7 0 1 0 0-3.4M18.8 13c1.6.2 2.5 1.2 2.7 3" />{accent}</>,
    // Tiwaz (ᛏ): a clear rune silhouette to signal leadership and authority.
    roles: <><path d="M12 4v16M12 4 6 10m6-6 6 6" />{accent}</>,
    catalogos: <><path d="M5 5c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2v14c0 1.1-.9 2-2 2H7c-1.1 0-2-.9-2-2V5Zm0 1H3v12h2M7 3v2m10-2v2m-6 4v6m0-6-2 2m2-2 2 2" /><path d="M8 17h8" />{accent}</>,
    reportes: <><path d="M12 20V8m0 3C9 6 5 5 2.5 6.5 4 11 7.2 13.5 12 14m0-3c3-5 7-6 9.5-4.5C20 11 16.8 13.5 12 14M12 16c-2-2.5-4.5-3.2-7.5-2.8 1.3 3.4 3.8 5.2 7.5 5.4m0-2.6c2-2.5 4.5-3.2 7.5-2.8-1.3 3.4-3.8 5.2-7.5 5.4" /><path d="M11 5.5 13 4l2 1.5-2 1.5-2-1.5Z" />{accent}</>,
    mi_qr: <><path d="M3.5 3.5h6v6h-6zM14.5 3.5h6v6h-6zM3.5 14.5h6v6h-6zM14.5 14.5h2v2h-2zM18.5 14.5h2v6h-2zM14.5 18.5h2" />{accent}</>,
    seguridad: <><path d="M12 2.8 20 6v5.5c0 4.8-3.2 8-8 9.8-4.8-1.8-8-5-8-9.8V6l8-3.2Z" /><path d="m8.5 12 2.2 2.2 4.8-5" />{accent}</>,
  };
  return <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true" {...common}>{shapes[name] || shapes.catalogos}</svg>;
}

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

const formatDateTime = (value) => value
  ? new Date(value).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })
  : '—';

const planFeatures = (plan) => {
  const planId = Number(plan?.id_plan);
  return {
    manual: true,
    qr: [1, 2, 3].includes(planId),
    rfid: [2, 3].includes(planId),
    lpr: Boolean(plan?.permite_ia),
  };
};

const apiErrorMessage = (payload, fallback) => {
  const body = payload?.message ?? payload;
  if (typeof body === 'string') return body;
  if (body?.detail) return body.detail;
  if (Array.isArray(body?.non_field_errors)) return body.non_field_errors[0];
  if (body && typeof body === 'object') {
    const firstValue = Object.values(body).flat(2).find((value) => typeof value === 'string');
    if (firstValue) return firstValue;
  }
  return fallback;
};

const apiFetch = async (path, options = {}) => {
  const headers = { ...(options.headers || {}) };
  const token = readSession().accessToken || localStorage.getItem('heimdall_session');
  if (!headers.Authorization && token) {
    if (typeof token === 'string' && token.split('.').length === 3) {
      headers.Authorization = `Bearer ${token}`;
    } else if (typeof token === 'string') {
      try {
        const parsed = JSON.parse(token);
        if (parsed.accessToken) headers.Authorization = `Bearer ${parsed.accessToken}`;
      } catch {
        // A malformed saved session should fail as an API authorization error.
      }
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
    throw new Error(apiErrorMessage(payload, 'Error de API'));
  }

  return payload;
};

const roleIdMap = {
  superadmin: SUPER_ADMIN_ROL_ID,
  admin: 1,
  supervisor: 3,
  vigilante: 2,
  residente: 5,
};

const listRoleNames = {
  1: 'Administrador',
  2: 'Vigilante',
  3: 'Supervisor',
  5: 'Residente',
};

const permissionExceptionOptions = [
  { key: 'usuarios', label: 'Usuarios', hint: 'Gestionar las cuentas del establecimiento' },
  { key: 'roles', label: 'Roles', hint: 'Consultar o administrar roles' },
  { key: 'catalogos', label: 'Catálogo', hint: 'Consultar los catálogos del sistema' },
  { key: 'reportes', label: 'Reportes', hint: 'Consultar actividad y reportes' },
  { key: 'camaras', label: 'Cámaras', hint: 'Acceder a las cámaras' },
  { key: 'seguridad', label: 'Seguridad', hint: 'Consultar el panel de seguridad' },
  { key: 'config', label: 'Configuración', hint: 'Acceder a la configuración' },
  { key: 'accesos', label: 'Control de acceso', hint: 'Registrar y consultar accesos' },
  { key: 'mi_qr', label: 'Mi QR e invitados', hint: 'Acceder a invitaciones y QR' },
];

const userPermissionLabels = {
  puede_editar: 'Permiso de edición',
  solo_lectura: 'Solo lectura',
};

const defaultUserForm = {
  nombre: '',
  email: '',
  password: '',
  rol: 'vigilante',
  id_establecimiento: '',
  residente_documento: '',
  residente_telefono: '',
  residente_unidad: '',
  permisos_excepciones: {},
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
  accesos: 'Control de acceso',
  mi_qr: 'Mi QR e invitados',
};

const detailFieldLabels = {
  id_establecimiento: 'Establecimiento', id_vehiculo: 'Vehículo', id_usuario: 'Usuario',
  id_movimiento: 'Movimiento', id_dispositivo: 'Dispositivo', placa_leida: 'Placa leída',
  placa_detectada: 'Placa detectada', tipo_movimiento: 'Tipo de movimiento',
  fecha_evento: 'Fecha del movimiento', fecha_incidencia: 'Fecha de incidencia',
  fecha_procesamiento: 'Fecha de procesamiento', fecha_sincronizacion: 'Fecha de sincronización',
  estado_sincronizacion: 'Estado de sincronización', nivel_prioridad: 'Prioridad',
  nivel_confianza: 'Confianza', resultado_ia: 'Resultado IA', url_fotografia: 'Fotografía',
  observacion: 'Observación', descripcion: 'Descripción', titulo: 'Título', tipo_autorizacion: 'Autorización',
  nombre: 'Nombre', correo: 'Correo', marca: 'Marca', modelo: 'Modelo', color: 'Color',
};

function App() {
  const initialSession = readSession();
  const [session, setSession] = useState(initialSession);
  const [debugViewRole, setDebugViewRole] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [catalogData, setCatalogData] = useState({
    planes: [], establecimientos: [], vehiculos: [], responsables: [],
    planesCount: 0, establecimientosCount: 0, vehiculosCount: 0,
  });
  const [activeCatalog, setActiveCatalog] = useState('planes');
  const [activeReport, setActiveReport] = useState('movimientos');
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [movementForm, setMovementForm] = useState({ placa_leida: '', id_vehiculo: '', codigo_rfid: '', tipo_movimiento: 'INGRESO', observacion: '' });
  const [movementSaved, setMovementSaved] = useState('');
  const [incidentForm, setIncidentForm] = useState({ titulo: '', descripcion: '', nivel_prioridad: 'MEDIA', id_vehiculo: '', id_invitacion: '' });
  const [incidentSaved, setIncidentSaved] = useState('');
  const [scanToken, setScanToken] = useState('');
  const [scanAction, setScanAction] = useState('INGRESO');
  const [scanPurpose, setScanPurpose] = useState('residente');
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState('');
  const [lprProcessing, setLprProcessing] = useState(false);
  const [lprError, setLprError] = useState('');
  const [lprNotice, setLprNotice] = useState('');
  const [lprResult, setLprResult] = useState(null);
  const [residentVehicles, setResidentVehicles] = useState([]);
  const [residentQr, setResidentQr] = useState(null);
  const [residentQrVehicle, setResidentQrVehicle] = useState('');
  const [visitorInvitations, setVisitorInvitations] = useState([]);
  const [visitorQr, setVisitorQr] = useState(null);
  const [visitorForm, setVisitorForm] = useState({ nombre_visitante: '', documento_visitante: '', placa_visitante: '', motivo: '', vigente_desde: '', vigente_hasta: '' });
  const [vehicleFormOpen, setVehicleFormOpen] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({ placa: '', marca: '', modelo: '', color: '', codigo_rfid: '', tipo_autorizacion: 'AUTORIZADO', id_responsable: '' });
  const [offlineMode, setOfflineMode] = useState(!navigator.onLine);
  const [loading, setLoading] = useState(Boolean(initialSession.accessToken));
  const [error, setError] = useState('');
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [userModalTab, setUserModalTab] = useState('account');
  const [userSearch, setUserSearch] = useState('');
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [userForm, setUserForm] = useState(defaultUserForm);
  const [roleForm, setRoleForm] = useState(defaultRoleForm);
  const [reportData, setReportData] = useState({
    movimientos: [],
    incidencias: [],
    reconocimientos: [],
    movimientosCount: 0,
    incidenciasCount: 0,
    reconocimientosCount: 0,
  });

  const isPlatformSuperAdmin = Boolean(
    session.user?.is_platform_superadmin || session.user?.rol_id === SUPER_ADMIN_ROL_ID,
  );
  const actualRole = useMemo(() => normalizeRoleFromUser(session.user), [session.user]);
  const effectiveRole = isPlatformSuperAdmin && debugViewRole ? debugViewRole : actualRole;
  const permissions = useMemo(
    () => permissionsByRole[effectiveRole] || permissionsByRole.vigilante,
    [effectiveRole],
  );
  const hasFeature = (feature) => Boolean(isPlatformSuperAdmin || session.user?.funcionalidades?.[feature]);
  const ownOverrides = session.user?.permisos_excepciones || EMPTY_PERMISSION_OVERRIDES;
  const effectivePermissions = useMemo(() => {
    const next = new Set(permissions);
    Object.entries(ownOverrides).forEach(([key, allowed]) => {
      if (!permissionCatalog[key]) return;
      if (allowed) next.add(key);
      else next.delete(key);
    });
    return [...next];
  }, [permissions, ownOverrides]);
  const canAccess = (key) => effectivePermissions.includes(key);
  const canEdit = isPlatformSuperAdmin || (ownOverrides.puede_editar !== false && ownOverrides.solo_lectura !== true);

  useEffect(() => {
    if (actualRole === 'residente' && activeTab !== 'mi_qr' && !effectivePermissions.includes(activeTab)) {
      setActiveTab('mi_qr');
    }
  }, [actualRole, activeTab, effectivePermissions]);

  const assignableRoleOptions = useMemo(() => {
    const base = [
      { value: 'supervisor', label: 'Supervisor' },
      { value: 'vigilante', label: 'Vigilante' },
      { value: 'residente', label: 'Residente' },
    ];
    if (isPlatformSuperAdmin) {
      return [
        { value: 'superadmin', label: 'Super Admin' },
        { value: 'admin', label: 'Administrador de establecimiento' },
        ...base,
      ];
    }
    return base;
  }, [isPlatformSuperAdmin]);

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
    if (!showUserForm) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setShowUserForm(false);
        setEditingUserId(null);
        setUserForm(defaultUserForm);
        setUserModalTab('account');
        setError('');
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [showUserForm]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!session.accessToken) {
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
        const savedSession = readSession();
        const nextSession = {
          ...savedSession,
          loggedIn: true,
          user: {
            ...savedSession.user,
            ...payload,
            nombre: payload.nombre || payload.username || 'Usuario',
          },
        };

        if (isMounted) {
          setSession(nextSession);
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
    if (!session.accessToken) return undefined;
    const refreshOwnPermissions = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/profile/`, {
          headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' },
        });
        if (!response.ok) return;
        const profile = await response.json();
        setSession((current) => {
          if (current.accessToken !== session.accessToken) return current;
          const nextUser = { ...current.user, ...profile };
          if (JSON.stringify(nextUser) === JSON.stringify(current.user)) return current;
          const nextSession = { ...current, user: nextUser };
          saveSession(nextSession);
          return nextSession;
        });
      } catch {
        // Keep the current session if the profile refresh fails temporarily.
      }
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshOwnPermissions();
    };
    window.addEventListener('focus', refreshOwnPermissions);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    const refreshTimer = window.setInterval(refreshOwnPermissions, 30000);
    return () => {
      window.removeEventListener('focus', refreshOwnPermissions);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.clearInterval(refreshTimer);
    };
  }, [session.accessToken]);

  useEffect(() => {
    if (!session.loggedIn || !session.accessToken) return;

    const establecimientoId = session.user?.id_establecimiento;
    if (!establecimientoId) {
      return;
    }
    const options = {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
    };

    const loadDashboardData = async () => {
      try {
        const canReadReports = effectivePermissions.includes('reportes')
          || (actualRole !== 'residente' && ownOverrides.reportes !== false);
        const canReadSecurity = effectivePermissions.includes('seguridad');
        const dataRequests = canReadReports ? [
          ['movimientos', fetch(`${API_BASE_URL}/operaciones/movimientos/?id_establecimiento=${establecimientoId}`, options)],
          ['incidencias', fetch(`${API_BASE_URL}/operaciones/incidencias/?id_establecimiento=${establecimientoId}`, options)],
        ] : canReadSecurity ? [
          ['incidencias', fetch(`${API_BASE_URL}/operaciones/incidencias/?id_establecimiento=${establecimientoId}&permiso=seguridad`, options)],
        ] : [];
        if (canReadReports && (isPlatformSuperAdmin || session.user?.funcionalidades?.lpr)) {
          dataRequests.push(['reconocimientos', fetch(`${API_BASE_URL}/inteligencia/reconocimientos/?id_establecimiento=${establecimientoId}`, options)]);
        }
        if (effectivePermissions.includes('usuarios')) {
          dataRequests.push(['usuarios', fetch(`${API_BASE_URL}/identidad/usuarios/?id_establecimiento=${establecimientoId}`, options)]);
        }
        if (effectivePermissions.includes('catalogos')) {
          dataRequests.push(['planes', fetch(`${API_BASE_URL}/empresas/planes/`, options)]);
          dataRequests.push(['establecimientos', fetch(`${API_BASE_URL}/empresas/establecimientos/`, options)]);
          dataRequests.push(['vehiculos', fetch(`${API_BASE_URL}/operaciones/vehiculos/?id_establecimiento=${establecimientoId}`, options)]);
          dataRequests.push(['responsables', fetch(`${API_BASE_URL}/operaciones/responsables/?id_establecimiento=${establecimientoId}`, options)]);
        } else if (effectivePermissions.includes('accesos')) {
          dataRequests.push(['vehiculos', fetch(`${API_BASE_URL}/operaciones/vehiculos/?id_establecimiento=${establecimientoId}&permiso=accesos`, options)]);
        }
        if (effectivePermissions.includes('accesos')) {
          dataRequests.push(['invitaciones', fetch(`${API_BASE_URL}/operaciones/invitaciones-visitantes/?id_establecimiento=${establecimientoId}`, options)]);
        }
        if (effectivePermissions.includes('roles')) dataRequests.push(['roles', fetch(`${API_BASE_URL}/identidad/roles/`, options)]);
        const responses = await Promise.all(dataRequests.map(([, request]) => request));
        const failedResponse = responses.find((response) => !response.ok);
        if (failedResponse) throw new Error(`La API rechazó la carga de datos (${failedResponse.status}).`);

        const loadedData = await Promise.all(dataRequests.map(async ([key, request]) => [key, await (await request).json()]));
        const dataByKey = Object.fromEntries(loadedData);
        const usuariosData = dataByKey.usuarios || { results: [] };
        const movimientosData = dataByKey.movimientos || { results: [], count: 0 };
        const incidenciasData = dataByKey.incidencias || { results: [], count: 0 };
        const reconocimientosData = dataByKey.reconocimientos || { results: [], count: 0 };
        const rolesData = dataByKey.roles || { results: [] };
        const planesData = dataByKey.planes || { results: [] };
        const establecimientosData = dataByKey.establecimientos || { results: [] };
        const vehiculosData = dataByKey.vehiculos || { results: [] };
        const responsablesData = dataByKey.responsables || { results: [] };
        const invitacionesData = dataByKey.invitaciones || { results: [] };

        const usuarios = normalizeListResponse(usuariosData).map((u) => ({
          id: u.id_usuario,
          nombre: u.nombre,
          rol: u.rol?.nombre || listRoleNames[u.id_rol] || u.id_rol || 'Sin rol',
          rolId: u.id_rol,
          email: u.correo,
          estado: u.estado ? 'Activo' : 'Inactivo',
          activo: Boolean(u.estado),
          permisos_excepciones: u.permisos_excepciones || {},
        }));

        const rolesList = normalizeListResponse(rolesData).map((roleItem) => ({
          nombre: roleItem.nombre,
          permisos: Array.isArray(roleItem.permisos)
            ? roleItem.permisos
            : ['dashboard', 'reportes', 'camaras'],
        }));

        setUsers(usuarios);
        setRoles(rolesList);
        if (effectivePermissions.includes('accesos')) setVisitorInvitations(normalizeListResponse(invitacionesData));
        setCatalogData({
          planes: normalizeListResponse(planesData),
          establecimientos: normalizeListResponse(establecimientosData),
          vehiculos: normalizeListResponse(vehiculosData),
          responsables: normalizeListResponse(responsablesData),
          planesCount: planesData.count ?? normalizeListResponse(planesData).length,
          establecimientosCount: establecimientosData.count ?? normalizeListResponse(establecimientosData).length,
          vehiculosCount: vehiculosData.count ?? normalizeListResponse(vehiculosData).length,
        });
        if (canReadReports || canReadSecurity) {
          setReportData({
            movimientos: normalizeListResponse(movimientosData),
            incidencias: normalizeListResponse(incidenciasData),
            reconocimientos: normalizeListResponse(reconocimientosData),
            movimientosCount: movimientosData.count ?? normalizeListResponse(movimientosData).length,
            incidenciasCount: incidenciasData.count ?? normalizeListResponse(incidenciasData).length,
            reconocimientosCount: reconocimientosData.count ?? normalizeListResponse(reconocimientosData).length,
          });
        }
        setError('');
      } catch (loadError) {
        setUsers([]);
        setRoles([]);
        setCatalogData({ planes: [], establecimientos: [], vehiculos: [], planesCount: 0, establecimientosCount: 0, vehiculosCount: 0 });
        if ((actualRole !== 'residente' && ownOverrides.reportes !== false) || effectivePermissions.includes('seguridad')) {
          setReportData({ movimientos: [], incidencias: [], reconocimientos: [], movimientosCount: 0, incidenciasCount: 0, reconocimientosCount: 0 });
        }
        setError(loadError.message || 'No se pudieron cargar los datos del establecimiento.');
      }
    };

    loadDashboardData();
  }, [session.loggedIn, session.accessToken, session.user?.id_establecimiento, session.user?.funcionalidades?.lpr, isPlatformSuperAdmin, effectivePermissions, actualRole]);

  useEffect(() => {
    if (!session.loggedIn || actualRole !== 'residente' || !session.accessToken) return undefined;
    const establishmentId = session.user?.id_establecimiento;
    if (!establishmentId) return undefined;
    let cancelled = false;
    const loadResidentData = async () => {
      try {
        const [vehicles, invitations] = await Promise.all([
          apiFetch('/operaciones/vehiculos/mios/'),
          apiFetch(`/operaciones/invitaciones-visitantes/?id_establecimiento=${establishmentId}`),
        ]);
        if (!cancelled) {
          setResidentVehicles(normalizeListResponse(vehicles));
          setVisitorInvitations(normalizeListResponse(invitations));
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'No se pudieron cargar los datos del residente.');
      }
    };
    const refreshQr = async () => {
      try {
        const qr = await apiFetch('/operaciones/qr/residente/', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(residentQrVehicle ? { id_vehiculo: residentQrVehicle } : {}),
        });
        if (!cancelled) setResidentQr(qr);
      } catch (qrError) {
        if (!cancelled) setError(qrError.message || 'No se pudo generar el QR de residente.');
      }
    };
    loadResidentData();
    refreshQr();
    const interval = window.setInterval(refreshQr, 65000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [session.loggedIn, session.accessToken, session.user?.id_establecimiento, actualRole, residentQrVehicle]);

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
        throw new Error(apiErrorMessage(payload, 'Credenciales inválidas'));
      }

      const nextSession = {
        loggedIn: true,
        user: payload.user,
        accessToken: payload.access,
        refreshToken: payload.refresh,
      };

      setSession(nextSession);
      setDebugViewRole('');
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
    setDebugViewRole('');
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
      const establecimientoId = isPlatformSuperAdmin
        ? (userForm.id_establecimiento || session.user?.id_establecimiento)
        : session.user?.id_establecimiento;
      if (!establecimientoId) throw new Error('La cuenta no tiene un establecimiento asociado.');
      const payload = editingUserId
        ? {
          nombre: userForm.nombre.trim(),
          correo: userForm.email.trim(),
          id_rol: roleIdMap[userForm.rol],
          estado: Boolean(userForm.estado),
          ...(isPlatformSuperAdmin ? { permisos_excepciones: userForm.permisos_excepciones || {} } : {}),
        }
        : {
          id_establecimiento: establecimientoId,
          id_rol: roleIdMap[userForm.rol] || 2,
          nombre: userForm.nombre.trim(),
          correo: userForm.email.trim(),
          password: userForm.password,
          estado: true,
        };
      if (editingUserId && userForm.password.trim()) payload.password = userForm.password;
      if (!editingUserId && userForm.rol === 'residente') {
        payload.residente_documento = userForm.residente_documento;
        payload.residente_telefono = userForm.residente_telefono;
        payload.residente_unidad = userForm.residente_unidad;
      }

      const saved = await apiFetch(
        `/identidad/usuarios/${editingUserId ? `${editingUserId}/` : ''}?id_establecimiento=${establecimientoId}`,
        {
        method: editingUserId ? 'PATCH' : 'POST',
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const nextUser = {
        id: saved.id_usuario,
        nombre: saved.nombre,
        rol: saved.rol?.nombre || listRoleNames[saved.id_rol] || userForm.rol,
        rolId: saved.id_rol,
        email: saved.correo,
        estado: saved.estado ? 'Activo' : 'Inactivo',
        activo: Boolean(saved.estado),
        permisos_excepciones: saved.permisos_excepciones || userForm.permisos_excepciones || {},
      };

      if (editingUserId) {
        setUsers((prev) => prev.map((user) => user.id === editingUserId ? nextUser : user));
      } else {
        setUsers((prev) => [nextUser, ...prev]);
      }
      setUserForm(defaultUserForm);
      setEditingUserId(null);
      setUserModalTab('account');
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

  const handleCreateVehicle = async (event) => {
    event.preventDefault();
    const establecimientoId = session.user?.id_establecimiento;
    if (!establecimientoId) return setError('La cuenta no tiene un establecimiento asociado.');
    try {
      const created = await apiFetch(`/operaciones/vehiculos/?id_establecimiento=${establecimientoId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...vehicleForm,
          placa: vehicleForm.placa.trim().toUpperCase(),
          id_establecimiento: establecimientoId,
          id_responsable: vehicleForm.id_responsable || null,
        }),
      });
      setCatalogData((current) => ({
        ...current,
        vehiculos: [created, ...current.vehiculos],
        vehiculosCount: current.vehiculosCount + 1,
      }));
      setVehicleForm({ placa: '', marca: '', modelo: '', color: '', codigo_rfid: '', tipo_autorizacion: 'AUTORIZADO', id_responsable: '' });
      setVehicleFormOpen(false);
      setError('');
    } catch (createError) {
      setError(createError.message || 'No se pudo registrar el vehículo.');
    }
  };

  const handleCreateMovement = async (event) => {
    event.preventDefault();
    const establishmentId = session.user?.id_establecimiento;
    const operatorId = session.user?.id_usuario;
    const vehicle = catalogData.vehiculos.find((item) => String(item.id_vehiculo) === String(movementForm.id_vehiculo))
      || (movementForm.codigo_rfid ? catalogData.vehiculos.find((item) => item.codigo_rfid?.toLowerCase() === movementForm.codigo_rfid.trim().toLowerCase()) : null);
    const plate = String(vehicle?.placa || movementForm.placa_leida || '').trim().toUpperCase();
    if (!establishmentId || !operatorId) return setError('No se pudo resolver el usuario o establecimiento de vigilancia. Vuelve a iniciar sesión.');
    if (!plate) return setError('Selecciona un vehículo o escribe la placa leída.');
    if (movementForm.codigo_rfid && !vehicle) return setError('El código RFID no está vinculado a un vehículo de este establecimiento.');
    try {
      const now = new Date().toISOString();
      const created = await apiFetch(`/operaciones/movimientos/?id_establecimiento=${establishmentId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_establecimiento: establishmentId,
          id_vehiculo: vehicle?.id_vehiculo || null,
          id_usuario: operatorId,
          placa_leida: plate,
          tipo_movimiento: movementForm.tipo_movimiento,
          fecha_evento: now,
          id_dispositivo: movementForm.codigo_rfid ? 'LECTOR-RFID' : 'PORTERIA-MANUAL',
          observacion: [movementForm.observacion.trim() || 'Registro manual de vigilancia', movementForm.codigo_rfid ? `RFID: ${movementForm.codigo_rfid.trim()}` : ''].filter(Boolean).join(' · '),
          estado_sincronizacion: 'SINCRONIZADO',
          fecha_sincronizacion: now,
        }),
      });
      setReportData((current) => ({
        ...current,
        movimientos: [created, ...current.movimientos],
        movimientosCount: current.movimientosCount + 1,
      }));
      setMovementSaved(`${created.tipo_movimiento_etiqueta || created.tipo_movimiento} registrado para ${created.placa_leida}.`);
      setMovementForm({ placa_leida: '', id_vehiculo: '', codigo_rfid: '', tipo_movimiento: 'INGRESO', observacion: '' });
      setError('');
    } catch (saveError) {
      setError(saveError.message || 'No se pudo registrar el movimiento.');
    }
  };

  const handleCreateIncident = async (event) => {
    event.preventDefault();
    const establishmentId = session.user?.id_establecimiento;
    const operatorId = session.user?.id_usuario;
    if (!establishmentId || !operatorId) return setError('No se pudo resolver el usuario o establecimiento de vigilancia. Vuelve a iniciar sesión.');
    try {
      const created = await apiFetch(`/operaciones/incidencias/?id_establecimiento=${establishmentId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_establecimiento: establishmentId,
          id_vehiculo: incidentForm.id_vehiculo || null,
          id_invitacion: incidentForm.id_invitacion || null,
          id_usuario: operatorId,
          titulo: incidentForm.titulo.trim(),
          descripcion: incidentForm.descripcion.trim(),
          nivel_prioridad: incidentForm.nivel_prioridad,
          fecha_incidencia: new Date().toISOString(),
        }),
      });
      setReportData((current) => ({
        ...current,
        incidencias: [created, ...current.incidencias],
        incidenciasCount: current.incidenciasCount + 1,
      }));
      setIncidentSaved(`Incidencia “${created.titulo}” registrada.`);
      setIncidentForm({ titulo: '', descripcion: '', nivel_prioridad: 'MEDIA', id_vehiculo: '', id_invitacion: '' });
      setError('');
    } catch (saveError) {
      setError(saveError.message || 'No se pudo registrar la incidencia.');
    }
  };

  const handleScanCode = async (rawToken) => {
    const establishmentId = session.user?.id_establecimiento;
    if (!establishmentId) return setScanError('La cuenta no tiene un establecimiento asociado.');
    const cleanCode = rawToken.trim();
    // Resident fallback codes are six digits. Route these to the resident
    // validator even if the dropdown was left on visitor by mistake.
    const isResidentShortCode = /^\d{6}$/.test(cleanCode);
    const purpose = isResidentShortCode ? 'residente' : scanPurpose;
    setScanError('');
    setScanResult(null);
    try {
      const result = await apiFetch(`/operaciones/qr/${purpose === 'visitante' ? 'visitante/validar' : 'residente/validar'}/?id_establecimiento=${establishmentId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isResidentShortCode ? { codigo: cleanCode } : { token: cleanCode }),
          tipo_movimiento: scanAction,
          id_dispositivo: 'PORTERIA-QR',
        }),
      });
      setScanResult(result);
      setScanToken('');
      if (result.movimiento) {
        setReportData((current) => ({
          ...current,
          movimientos: [result.movimiento, ...current.movimientos],
          movimientosCount: current.movimientosCount + 1,
        }));
      }
      setError('');
    } catch (scanFailure) {
      setScanError(scanFailure.message || 'No se pudo validar el QR.');
    }
  };

  const handlePlateCapture = async (imageBlob) => {
    const establishmentId = session.user?.id_establecimiento;
    if (!establishmentId) {
      setLprError('La cuenta no tiene un establecimiento asociado.');
      return;
    }
    setLprProcessing(true);
    setLprError('');
    setLprNotice('');
    try {
      const body = new FormData();
      body.append('imagen', imageBlob, 'captura-placa.jpg');
      body.append('id_dispositivo', 'CAMARA-WEB-LPR');
      const response = await fetch(`${API_BASE_URL}/inteligencia/reconocimientos/procesar/?id_establecimiento=${establishmentId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.accessToken}` },
        body,
      });
      const responseText = await response.text();
      let payload = {};
      try {
        payload = responseText ? JSON.parse(responseText) : {};
      } catch {
        payload = { detail: responseText };
      }
      if (!response.ok) throw new Error(apiErrorMessage(payload, 'No se pudo analizar la captura.'));
      if (!payload.detectado || !payload.resultados?.length) {
        setLprResult(null);
        setLprNotice(payload.mensaje || 'No se detectó una placa. Ajusta el encuadre e intenta otra vez.');
        return;
      }
      const first = payload.resultados[0];
      setLprResult({ ...first, motor: payload.motor, requiere_confirmacion_vigilante: payload.requiere_confirmacion_vigilante });
      setReportData((current) => ({
        ...current,
        reconocimientos: [...payload.resultados, ...current.reconocimientos],
        reconocimientosCount: current.reconocimientosCount + payload.resultados.length,
      }));
      if (first.placa_detectada && first.placa_detectada !== 'SIN_LECTURA') {
        const matchedVehicle = catalogData.vehiculos.find(
          (vehicle) => vehicle.placa?.replace(/[^A-Z0-9]/gi, '').toUpperCase() === first.placa_detectada,
        );
        setMovementForm((current) => ({
          ...current,
          placa_leida: first.placa_detectada,
          id_vehiculo: matchedVehicle ? String(matchedVehicle.id_vehiculo) : '',
        }));
        setLprNotice('Revisa la placa detectada. El sistema no abre el acceso automáticamente.');
      }
    } catch (captureError) {
      setLprError(captureError.message || 'No se pudo procesar la placa.');
    } finally {
      setLprProcessing(false);
    }
  };

  const handleRefreshResidentQR = async () => {
    try {
      const qr = await apiFetch('/operaciones/qr/residente/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(residentQrVehicle ? { id_vehiculo: residentQrVehicle } : {}),
      });
      setResidentQr(qr);
      setError('');
    } catch (qrError) {
      setError(qrError.message || 'No se pudo generar el QR de residente.');
    }
  };

  const handleCreateVisitorInvitation = async (event) => {
    event.preventDefault();
    const establishmentId = session.user?.id_establecimiento;
    if (!establishmentId) return setError('La cuenta no tiene un establecimiento asociado.');
    try {
      const now = new Date();
      const start = visitorForm.vigente_desde ? new Date(visitorForm.vigente_desde) : now;
      const end = visitorForm.vigente_hasta ? new Date(visitorForm.vigente_hasta) : new Date(now.getTime() + 60 * 60 * 1000);
      const created = await apiFetch(`/operaciones/invitaciones-visitantes/?id_establecimiento=${establishmentId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_visitante: visitorForm.nombre_visitante.trim(),
          documento_visitante: visitorForm.documento_visitante.trim() || null,
          placa_visitante: visitorForm.placa_visitante.trim().toUpperCase() || null,
          motivo: visitorForm.motivo.trim(),
          vigente_desde: start.toISOString(),
          vigente_hasta: end.toISOString(),
        }),
      });
      setVisitorQr(created);
      setVisitorInvitations((current) => [created, ...current]);
      setVisitorForm({ nombre_visitante: '', documento_visitante: '', placa_visitante: '', motivo: '', vigente_desde: '', vigente_hasta: '' });
      setError('');
    } catch (inviteError) {
      setError(inviteError.message || 'No se pudo crear la invitación.');
    }
  };

  const handleRevokeInvitation = async (id) => {
    const establishmentId = session.user?.id_establecimiento;
    try {
      const updated = await apiFetch(`/operaciones/invitaciones-visitantes/${id}/revocar/?id_establecimiento=${establishmentId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      setVisitorInvitations((current) => current.map((item) => item.id_invitacion === id ? updated : item));
      setError('');
    } catch (revokeError) {
      setError(revokeError.message || 'No se pudo revocar la invitación.');
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

  const reportConfig = {
    movimientos: { label: 'Movimientos', endpoint: '/operaciones/movimientos/', idField: 'id_movimiento' },
    incidencias: { label: 'Incidencias', endpoint: '/operaciones/incidencias/', idField: 'id_incidencia' },
    reconocimientos: { label: 'Reconocimientos', endpoint: '/inteligencia/reconocimientos/', idField: 'id_reconocimiento' },
  };
  const detailConfig = {
    ...reportConfig,
    planes: { label: 'Planes', endpoint: '/empresas/planes/', idField: 'id_plan', tenantScoped: false },
    establecimientos: { label: 'Establecimientos', endpoint: '/empresas/establecimientos/', idField: 'id_establecimiento' },
    vehiculos: { label: 'Vehículos', endpoint: '/operaciones/vehiculos/', idField: 'id_vehiculo' },
  };

  const handleOpenDetail = async (type, record) => {
    const config = detailConfig[type] || { endpoint: '/operaciones/vehiculos/', idField: 'id_vehiculo' };
    const id = record[config.idField];
    const establishmentId = type === 'establecimientos'
      ? record.id_establecimiento
      : session.user?.id_establecimiento;
    if ((!establishmentId && config.tenantScoped !== false) || !id) return;
    const key = `${type}-${id}`;
    setSelectedDetail({ key, type, record, detail: null, loading: true });
    try {
      const tenantQuery = config.tenantScoped === false ? '' : `?id_establecimiento=${establishmentId}`;
      const detail = await apiFetch(`${config.endpoint}${id}/${tenantQuery}`);
      setSelectedDetail((current) => current?.key === key
        ? { key, type, record, detail, loading: false }
        : current);
    } catch (detailError) {
      setSelectedDetail((current) => current?.key === key
        ? { ...current, loading: false, error: detailError.message }
        : current);
    }
  };

  const handleLoadMoreReport = async (type) => {
    const config = reportConfig[type];
    const records = reportData[type];
    const count = reportData[`${type}Count`];
    const establishmentId = session.user?.id_establecimiento;
    if (!config || !establishmentId || records.length >= count || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = Math.floor(records.length / 25) + 1;
      const payload = await apiFetch(`${config.endpoint}?id_establecimiento=${establishmentId}&page=${page}`);
      setReportData((current) => ({
        ...current,
        [type]: [...current[type], ...normalizeListResponse(payload)],
        [`${type}Count`]: payload.count ?? current[`${type}Count`],
      }));
    } catch (loadError) {
      setError(loadError.message || 'No se pudieron cargar más registros.');
    } finally {
      setLoadingMore(false);
    }
  };

  const renderReportTable = (type, records) => {
    const rows = records.map((item) => {
      if (type === 'movimientos') return {
        key: item.id_movimiento,
        cells: [formatDateTime(item.fecha_evento), item.placa_leida, item.tipo_movimiento_etiqueta || item.tipo_movimiento, item.estado_sincronizacion_etiqueta || item.estado_sincronizacion],
      };
      if (type === 'incidencias') return {
        key: item.id_incidencia,
        cells: [formatDateTime(item.fecha_incidencia), item.titulo, item.nivel_prioridad_etiqueta || item.nivel_prioridad, item.vehiculo?.placa || 'Sin vehículo'],
      };
      return {
        key: item.id_reconocimiento,
        cells: [formatDateTime(item.fecha_procesamiento), item.placa_detectada, `${item.nivel_confianza}%`, item.resultado_ia_etiqueta || item.resultado_ia],
      };
    });
    const columns = type === 'movimientos'
      ? ['Fecha', 'Placa', 'Tipo', 'Sincronización']
      : type === 'incidencias'
        ? ['Fecha', 'Incidencia', 'Prioridad', 'Vehículo']
        : ['Fecha', 'Placa detectada', 'Confianza', 'Resultado'];

    return (
      <div className="table-scroll">
        <table className="data-table detail-table">
          <thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}<th>Consulta</th></tr></thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.key ?? `${type}-${index}`}>
                {row.cells.map((cell, cellIndex) => <td key={`${row.key}-${cellIndex}`}>{cell || '—'}</td>)}
                <td><button className="ghost-btn" onClick={() => handleOpenDetail(type, records[index])}>Ver detalle</button></td>
              </tr>
            ))}
            {!rows.length ? <tr><td colSpan={columns.length + 1}>No hay registros para mostrar.</td></tr> : null}
          </tbody>
        </table>
      </div>
    );
  };

  const totalMovimientos = reportData.movimientosCount;
  const totalIncidencias = reportData.incidenciasCount;
  const totalReconocimientos = reportData.reconocimientosCount;
  const aprobados = reportData.reconocimientos.filter((item) => ['COINCIDE', 'AUTORIZADO'].includes(String(item.resultado_ia || item.resultado || '').toUpperCase())).length;
  const latestRecognition = reportData.reconocimientos[0];
  const latestPlate = latestRecognition?.placa_detectada || 'Sin lectura';
  const latestConfidence = latestRecognition?.nivel_confianza != null
    ? `${Number(latestRecognition.nivel_confianza).toFixed(1)}%`
    : '—';
  const syncedInSample = reportData.movimientos.length
    ? Math.round((reportData.movimientos.filter((item) => item.estado_sincronizacion === 'SINCRONIZADO').length / reportData.movimientos.length) * 100)
    : 0;

  const renderDashboard = () => (
    <div className="dashboard-grid">
      {hasFeature('lpr') ? <div className="hero-panel lpr-dashboard-card">
        <div className="hero-header-row">
          <div className="hero-left"><span className="live-dot" /><span>Reconocimiento de placas con IA</span></div>
          <span className="chip active">DNN</span>
        </div>
        <div className="lpr-dashboard-content">
          <div><span className="eyebrow">Última lectura</span><strong className="lpr-latest-plate">{latestPlate}</strong><small>Confianza: {latestConfidence} · {latestRecognition?.resultado_ia_etiqueta || 'Sin lecturas aún'}</small></div>
          <div className="lpr-dashboard-actions"><p>FastALPR combina detección de placas y lectura neuronal ONNX en una captura de cámara.</p><button type="button" className="primary-btn" onClick={() => setActiveTab('camaras')}>Abrir cámara LPR</button></div>
        </div>
      </div> : <div className="hero-panel plan-notice" role="status">
        <div className="hero-header-row"><div className="hero-left"><span className="live-dot" /><span>Plan contratado: {session.user?.plan?.nombre || 'Plan actual'}</span></div></div>
        <h2>Control de acceso del establecimiento</h2>
        <p>El plan actual incluye registro manual{hasFeature('qr') ? ' y acceso QR' : ''}{hasFeature('rfid') ? ' y RFID' : ''}. LPR / IA no está incluido.</p>
        <p>Usa “Control de acceso” para registrar ingresos, salidas e incidencias.</p>
      </div>}

      <div className="metrics-grid">
        {[
          { label: 'Vehículos detectados', value: totalMovimientos.toLocaleString(), tone: 'green' },
          hasFeature('lpr')
            ? { label: 'Coincidencias recientes', value: aprobados.toLocaleString(), tone: 'cyan' }
            : { label: 'Acceso QR', value: hasFeature('qr') ? 'Incluido' : 'No incluido', tone: 'cyan' },
          { label: 'Incidencias', value: totalIncidencias.toLocaleString(), tone: 'orange' },
          { label: 'Sincronizados (muestra)', value: `${syncedInSample}%`, tone: 'red' },
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

  const closeUserModal = () => {
    setShowUserForm(false);
    setEditingUserId(null);
    setUserForm(defaultUserForm);
    setUserModalTab('account');
    setError('');
  };

  const openUserModal = (user = null, tab = 'account') => {
    setEditingUserId(user?.id ?? null);
    if (user) {
      const matchingRole = Object.entries(roleIdMap).find(([, id]) => Number(id) === Number(user.rolId));
      setUserForm({ ...defaultUserForm, nombre: user.nombre, email: user.email, rol: matchingRole?.[0] || 'vigilante', estado: user.activo ?? user.estado === 'Activo', permisos_excepciones: user.permisos_excepciones || {} });
    } else setUserForm(defaultUserForm);
    setUserModalTab(tab);
    setShowUserForm(true);
    setError('');
  };

  const setPermissionException = (key, value) => {
    setUserForm((current) => {
      const next = { ...(current.permisos_excepciones || {}) };
      if (value === null) delete next[key];
      else next[key] = value;
      return { ...current, permisos_excepciones: next };
    });
  };

  const filteredUsers = users.filter((user) => `${user.nombre} ${user.email} ${user.rol}`.toLocaleLowerCase().includes(userSearch.trim().toLocaleLowerCase()));
  const modalRoleOptions = editingUserId && !assignableRoleOptions.some((option) => option.value === userForm.rol)
    ? [{ value: userForm.rol, label: listRoleNames[roleIdMap[userForm.rol]] || userForm.rol }, ...assignableRoleOptions]
    : assignableRoleOptions;

  const renderUsers = () => (
    <div className="panel-card user-management-card">
      <div className="user-management-heading">
        <div><span className="eyebrow">Administración de acceso</span><h3>Usuarios y roles</h3><p>Administra cuentas, asigna roles y define excepciones de acceso.</p></div>
        <button className="primary-btn" type="button" disabled={!canEdit} onClick={() => openUserModal()}><span aria-hidden="true">＋</span> Nuevo usuario</button>
      </div>
      <div className="user-table-toolbar">
        <label className="user-search-field"><span className="sr-only">Buscar usuarios</span><span aria-hidden="true">⌕</span><input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Buscar por nombre, correo o rol…" /></label>
        <span className="user-result-count">{filteredUsers.length} de {users.length} usuarios</span>
      </div>
      <div className="table-scroll user-table-scroll"><table className="data-table user-data-table">
        <thead><tr><th>Usuario</th><th>Rol asignado</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead>
        <tbody>{filteredUsers.map((user) => {
          const initials = user.nombre.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
          const exceptionCount = Object.keys(user.permisos_excepciones || {}).length;
          return <tr key={user.id}>
            <td><div className="user-identity"><span className="user-avatar">{initials || 'U'}</span><span><strong>{user.nombre}</strong><small>{user.email}</small></span></div></td>
            <td><span className="user-role-pill">{user.rol}</span></td>
            <td><span className={`user-status ${user.estado === 'Activo' ? 'is-active' : 'is-inactive'}`}><i />{user.estado}</span></td>
            <td><div className="user-row-actions"><button type="button" className="user-action-btn" disabled={!canEdit} onClick={() => openUserModal(user)}>Editar usuario</button>{isPlatformSuperAdmin ? <button type="button" className="user-action-btn permission-action" onClick={() => openUserModal(user, 'permissions')}>Permisos{exceptionCount ? <span>{exceptionCount}</span> : null}</button> : null}</div></td>
          </tr>;
        })}{!filteredUsers.length ? <tr><td colSpan="4" className="user-empty-state">{users.length ? 'No hay usuarios que coincidan con la búsqueda.' : 'Todavía no hay usuarios registrados.'}</td></tr> : null}</tbody>
      </table></div>

      {showUserForm ? <div className="user-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeUserModal(); }}>
        <section className="user-modal" role="dialog" aria-modal="true" aria-labelledby="user-modal-title">
          <div className="user-modal-prism" />
          <header className="user-modal-header"><div><span className="eyebrow">HEIMDALL TECH · ACCESOS</span><h2 id="user-modal-title">{editingUserId ? 'Editar usuario' : 'Crear usuario'}</h2><p>{editingUserId ? `Actualiza el acceso de ${userForm.nombre}.` : 'Crea una cuenta y asigna su rol inicial.'}</p></div><button type="button" className="user-modal-close" aria-label="Cerrar ventana" onClick={closeUserModal}>×</button></header>
          {editingUserId && isPlatformSuperAdmin ? <div className="user-modal-tabs" role="tablist" aria-label="Secciones de usuario"><button type="button" role="tab" aria-selected={userModalTab === 'account'} className={userModalTab === 'account' ? 'active' : ''} onClick={() => setUserModalTab('account')}>Datos y rol</button><button type="button" role="tab" aria-selected={userModalTab === 'permissions'} className={userModalTab === 'permissions' ? 'active' : ''} onClick={() => setUserModalTab('permissions')}>Permisos extra</button></div> : null}
          <form className="user-modal-form" onSubmit={handleCreateUser}>
            {userModalTab === 'account' ? <div className="user-modal-content">
              <div className="user-modal-section-title"><span>01</span><div><strong>Datos de la cuenta</strong><small>Información básica y estado de acceso</small></div></div>
              <div className="user-modal-fields">
                <label><span>Nombre completo</span><input autoFocus value={userForm.nombre} onChange={(event) => setUserForm((p) => ({ ...p, nombre: event.target.value }))} required /></label>
                <label><span>Correo electrónico</span><input type="email" value={userForm.email} onChange={(event) => setUserForm((p) => ({ ...p, email: event.target.value }))} required /></label>
                <label><span>Rol base</span><select value={userForm.rol} onChange={(event) => setUserForm((p) => ({ ...p, rol: event.target.value }))}>{modalRoleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                {editingUserId ? <label><span>Estado de la cuenta</span><select value={userForm.estado ? 'true' : 'false'} onChange={(event) => setUserForm((p) => ({ ...p, estado: event.target.value === 'true' }))}><option value="true">Activo</option><option value="false">Inactivo</option></select></label> : <label><span>Contraseña inicial</span><input type="password" minLength="8" autoComplete="new-password" value={userForm.password} onChange={(event) => setUserForm((p) => ({ ...p, password: event.target.value }))} required /></label>}
                {editingUserId ? <label className="user-modal-field-wide"><span>Nueva contraseña <small>· opcional</small></span><input type="password" minLength="8" autoComplete="new-password" value={userForm.password} onChange={(event) => setUserForm((p) => ({ ...p, password: event.target.value }))} placeholder="Déjala vacía para conservar la actual" /></label> : null}
                {!editingUserId && isPlatformSuperAdmin ? <label className="user-modal-field-wide"><span>Establecimiento asignado</span><select value={userForm.id_establecimiento || String(session.user?.id_establecimiento || '')} onChange={(event) => setUserForm((p) => ({ ...p, id_establecimiento: event.target.value }))} required><option value="" disabled>Selecciona un establecimiento</option>{catalogData.establecimientos.map((item) => <option key={item.id_establecimiento} value={item.id_establecimiento}>{item.nombre} · {item.plan?.nombre || 'Sin plan'}</option>)}</select></label> : null}
                {!editingUserId && userForm.rol === 'residente' ? <><label><span>Documento del residente</span><input value={userForm.residente_documento} onChange={(event) => setUserForm((p) => ({ ...p, residente_documento: event.target.value }))} required /></label><label><span>Teléfono</span><input value={userForm.residente_telefono} onChange={(event) => setUserForm((p) => ({ ...p, residente_telefono: event.target.value }))} /></label><label className="user-modal-field-wide"><span>Casa o unidad</span><input value={userForm.residente_unidad} onChange={(event) => setUserForm((p) => ({ ...p, residente_unidad: event.target.value }))} placeholder="Ej. Casa 14, Torre B" /></label></> : null}
              </div>
            </div> : <div className="user-modal-content permissions-content">
              <div className="user-modal-section-title"><span>02</span><div><strong>Excepciones individuales</strong><small>Estos ajustes sobreescriben los permisos del rol asignado.</small></div></div>
              <div className="permission-reset-bar"><span>Quita las excepciones y vuelve a aplicar los permisos originales del rol.</span><button type="button" className="permission-reset-all" disabled={!Object.keys(userForm.permisos_excepciones || {}).length} onClick={() => setUserForm((current) => ({ ...current, permisos_excepciones: {} }))}>Restablecer permisos del rol</button></div>
              <div className="permission-override-list">{permissionExceptionOptions.map((item) => {
                const overrides = userForm.permisos_excepciones || {};
                const inherited = !Object.prototype.hasOwnProperty.call(overrides, item.key);
                const enabled = inherited ? (permissionsByRole[userForm.rol] || []).includes(item.key) : Boolean(overrides[item.key]);
                return <div className="permission-override-row" key={item.key}><div><strong>{item.label}</strong><small>{item.hint}</small></div><div className="permission-override-control"><span className={inherited ? 'inherit-label' : enabled ? 'allow-label' : 'deny-label'}>{inherited ? 'Por rol' : enabled ? 'Permitido' : 'Denegado'}</span><button type="button" role="switch" aria-checked={enabled} aria-label={`${item.label}: ${inherited ? 'heredado del rol' : enabled ? 'permitido' : 'denegado'}`} className={`permission-switch ${enabled ? 'is-on' : ''} ${inherited ? 'is-inherited' : ''}`} onClick={() => setPermissionException(item.key, !enabled)}><span /></button>{!inherited ? <button type="button" className="inherit-reset" onClick={() => setPermissionException(item.key, null)} aria-label={`Restablecer ${item.label} al permiso del rol`}>Restablecer</button> : null}</div></div>;
              })}</div>
              <div className="permission-policy-card"><div className="policy-icon" aria-hidden="true">◇</div><div className="policy-heading"><strong>Política de edición</strong><small>El modo de solo lectura prevalece sobre el permiso de edición.</small></div>{[{ key: 'puede_editar', label: userPermissionLabels.puede_editar, fallback: true }, { key: 'solo_lectura', label: userPermissionLabels.solo_lectura, fallback: false }].map((item) => {
                const overrides = userForm.permisos_excepciones || {};
                const inherited = !Object.prototype.hasOwnProperty.call(overrides, item.key);
                const enabled = inherited ? item.fallback : Boolean(overrides[item.key]);
                return <div className="permission-policy-toggle" key={item.key}><span>{item.label}<small>{inherited ? 'Heredado' : 'Excepción activa'}</small></span><button type="button" role="switch" aria-checked={enabled} aria-label={`${item.label}: ${enabled ? 'activado' : 'desactivado'}`} className={`permission-switch ${enabled ? 'is-on' : ''} ${inherited ? 'is-inherited' : ''}`} onClick={() => setPermissionException(item.key, !enabled)}><span /></button></div>;
              })}</div>
            </div>}
            {error ? <div className="user-modal-error" role="alert">{error}</div> : null}
            <footer className="user-modal-footer"><button type="button" className="ghost-btn" onClick={closeUserModal}>Cancelar</button><button type="submit" className="primary-btn" disabled={!canEdit}>{editingUserId ? 'Guardar cambios' : 'Crear usuario'}</button></footer>
          </form>
        </section>
      </div> : null}
    </div>
  );

  const renderRoles = () => (
    <div className="panel-card">
      <div className="section-header">
        <h3>Roles y permisos</h3>
        {isPlatformSuperAdmin ? <button className="primary-btn" onClick={() => setShowRoleForm((v) => !v)}>
          {showRoleForm ? 'Cerrar' : '+ Crear rol'}
        </button> : null}
      </div>

      {showRoleForm && isPlatformSuperAdmin && (
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
      { key: 'planes', label: isPlatformSuperAdmin ? 'Planes' : 'Mi plan', value: catalogData.planesCount, records: catalogData.planes, icon: 'P', tone: 'green' },
      { key: 'establecimientos', label: 'Establecimientos', value: catalogData.establecimientosCount, records: catalogData.establecimientos, icon: 'E', tone: 'cyan' },
      { key: 'vehiculos', label: 'Vehículos', value: catalogData.vehiculosCount, records: catalogData.vehiculos, icon: 'V', tone: 'orange' },
      { key: 'incidencias', label: 'Incidencias', value: totalIncidencias, records: reportData.incidencias, icon: 'I', tone: 'red' },
    ];
    const selected = catalogItems.find((item) => item.key === activeCatalog) || catalogItems[0];
    const catalogColumns = {
      planes: ['Plan', 'Descripción', 'Precio', 'Usuarios incluidos', 'Manual', 'QR', 'RFID', 'LPR / IA'],
      establecimientos: ['Establecimiento', 'Plan', 'Dirección', 'Teléfono', 'Estado'],
      vehiculos: ['Placa', 'Marca y modelo', 'Color', 'RFID', 'Autorización', 'Responsable'],
      incidencias: ['Fecha', 'Título', 'Prioridad', 'Vehículo'],
    };
    const cellsFor = (record) => {
      if (activeCatalog === 'planes') {
        const features = planFeatures(record);
        return [record.nombre, record.descripcion, `$ ${Number(record.precio).toLocaleString('es-CO')}`, record.limite_usuarios,
          features.manual ? 'Sí' : 'No', features.qr ? 'Sí' : 'No', features.rfid ? 'Sí' : 'No', features.lpr ? 'Sí' : 'No'];
      }
      if (activeCatalog === 'establecimientos') return [
        record.nombre,
        record.plan?.nombre || '—',
        record.direccion,
        record.telefono || '—',
        record.estado ? 'Activo' : 'Inactivo',
      ];
      if (activeCatalog === 'vehiculos') return [
        record.placa,
        [record.marca, record.modelo].filter(Boolean).join(' ') || '—',
        record.color || '—',
        hasFeature('rfid') ? (record.codigo_rfid || '—') : 'No incluido en el plan',
        record.tipo_autorizacion_etiqueta || record.tipo_autorizacion,
        record.responsable?.nombre || (record.id_responsable ? `Responsable #${record.id_responsable}` : 'Sin responsable'),
      ];
      return [
        formatDateTime(record.fecha_incidencia),
        record.titulo,
        record.nivel_prioridad_etiqueta || record.nivel_prioridad,
        record.vehiculo?.placa || 'Sin vehículo',
      ];
    };

    return (
      <div className="catalog-panel">
        <div className="section-header">
          <h3>Catálogo y gestión</h3>
          {activeCatalog === 'vehiculos' && canAccess('usuarios') ? (
            <button className="primary-btn" onClick={() => setVehicleFormOpen((open) => !open)}>
              {vehicleFormOpen ? 'Cerrar' : '+ Registrar vehículo'}
            </button>
          ) : null}
        </div>
        <div className="catalog-grid">
          {catalogItems.map((item) => (
            <button key={item.key} className={`catalog-card ${item.tone} ${activeCatalog === item.key ? 'selected' : ''}`} onClick={() => setActiveCatalog(item.key)}>
              <div className="catalog-icon">{item.icon}</div>
              <strong>{item.label}</strong>
              <span>{item.value.toLocaleString('es-CO')}</span>
            </button>
          ))}
        </div>
        {activeCatalog === 'vehiculos' && vehicleFormOpen ? (
          <form className="form-panel" onSubmit={handleCreateVehicle}>
            <div className="field-grid">
              <label><span>Placa</span><input value={vehicleForm.placa} onChange={(e) => setVehicleForm((p) => ({ ...p, placa: e.target.value.toUpperCase() }))} required maxLength="15" /></label>
              <label><span>Marca</span><input value={vehicleForm.marca} onChange={(e) => setVehicleForm((p) => ({ ...p, marca: e.target.value }))} /></label>
              <label><span>Modelo</span><input value={vehicleForm.modelo} onChange={(e) => setVehicleForm((p) => ({ ...p, modelo: e.target.value }))} /></label>
              <label><span>Color</span><input value={vehicleForm.color} onChange={(e) => setVehicleForm((p) => ({ ...p, color: e.target.value }))} /></label>
              {session.user?.funcionalidades?.rfid ? <label><span>Código RFID (opcional)</span><input value={vehicleForm.codigo_rfid} onChange={(e) => setVehicleForm((p) => ({ ...p, codigo_rfid: e.target.value.trim() }))} maxLength="100" /></label> : null}
              <label>
                <span>Responsable / residente</span>
                <select value={vehicleForm.id_responsable} onChange={(e) => setVehicleForm((p) => ({ ...p, id_responsable: e.target.value }))}>
                  <option value="">Sin responsable</option>
                  {catalogData.responsables.map((person) => <option key={person.id_responsable} value={person.id_responsable}>{person.nombre}{person.departamento_unidad ? ` · ${person.departamento_unidad}` : ''}</option>)}
                </select>
              </label>
              <label>
                <span>Autorización</span>
                <select value={vehicleForm.tipo_autorizacion} onChange={(e) => setVehicleForm((p) => ({ ...p, tipo_autorizacion: e.target.value }))}>
                  <option value="AUTORIZADO">Residente autorizado</option>
                  <option value="VISITANTE">Visitante</option>
                  <option value="RESTRINGIDO">Restringido</option>
                </select>
              </label>
            </div>
            <div className="form-actions"><button className="primary-btn" type="submit">Guardar vehículo</button></div>
          </form>
        ) : null}
        <div className="panel-card catalog-records">
          <div className="section-header">
            <div>
              <h3>{selected.label}</h3>
              <small>{selected.value} registros disponibles</small>
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table detail-table">
              <thead><tr>{catalogColumns[activeCatalog].map((column) => <th key={column}>{column}</th>)}<th>Consulta</th></tr></thead>
              <tbody>
                {selected.records.map((record, index) => (
                  <tr key={record.id_plan || record.id_establecimiento || record.id_vehiculo || record.id_incidencia || index}>
                    {cellsFor(record).map((cell, cellIndex) => <td key={cellIndex}>{cell || '—'}</td>)}
                    <td><button className="ghost-btn" onClick={() => handleOpenDetail(activeCatalog, record)}>Ver detalle</button></td>
                  </tr>
                ))}
                {!selected.records.length ? <tr><td colSpan={catalogColumns[activeCatalog].length + 1}>No hay registros para mostrar.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
        {activeCatalog === 'incidencias' && selected.records.length < totalIncidencias ? (
          <button className="ghost-btn load-more" onClick={() => handleLoadMoreReport('incidencias')} disabled={loadingMore}>
            {loadingMore ? 'Cargando…' : 'Cargar más incidencias'}
          </button>
        ) : null}
      </div>
    );
  };

  const renderCamaras = () => (
    <div className="panel-card">
      <div className="section-header">
        <div><h3>Reconocimiento de placas</h3><small>FastALPR · detector YOLO DNN + lectura OCR mediante ONNX</small></div>
        <div className="status-pill">{offlineMode ? 'Sin conexión' : 'Con conexión'}</div>
      </div>

      {!hasFeature('lpr') ? <div className="plan-notice">El plan {session.user?.plan?.nombre || ''} incluye control manual. LPR/IA está disponible en el plan Avanzado.</div> : <>
        <div className="lpr-workspace">
          <PlateCamera onCapture={handlePlateCapture} processing={lprProcessing} />
          <aside className="lpr-result-card">
            <span className="eyebrow">Resultado de la captura</span>
            <strong className="lpr-latest-plate">{lprResult?.placa_detectada || latestPlate}</strong>
            <span>Confianza: {lprResult ? `${Number(lprResult.nivel_confianza).toFixed(1)}%` : latestConfidence}</span>
            <span>Estado: {lprResult?.resultado_ia_etiqueta || latestRecognition?.resultado_ia_etiqueta || 'Esperando captura'}</span>
            {lprError ? <div className="error-box" role="alert">{lprError}</div> : null}
            {lprNotice ? <div className="success-box" role="status">{lprNotice}</div> : null}
            {lprResult?.placa_detectada && lprResult.placa_detectada !== 'SIN_LECTURA' ? <button type="button" className="ghost-btn" onClick={() => setActiveTab('accesos')}>Revisar placa en Control de acceso</button> : null}
            <small>La lectura ayuda al vigilante; siempre debe revisar el resultado antes de registrar el ingreso.</small>
          </aside>
        </div>
      </>}
    </div>
  );

  const renderAccesos = () => (
    <div className="access-workspace">
      <div className="panel-card">
        <div className="section-header">
          <div><h3>Control manual de acceso</h3><small>Registra ingresos y salidas desde portería.</small></div>
          <span className="status-pill">{session.user?.plan?.nombre || 'Plan activo'}</span>
        </div>
        {!hasFeature('rfid') ? <div className="plan-notice" role="status">Tu plan incluye registro manual{hasFeature('qr') ? ' y acceso QR' : ''}; RFID no está incluido. Puedes continuar con captura manual.</div> : null}
        <form className="form-panel" onSubmit={handleCreateMovement}>
          <div className="field-grid">
            <label>
              <span>Vehículo registrado</span>
              <select value={movementForm.id_vehiculo} onChange={(e) => {
                const chosen = catalogData.vehiculos.find((item) => String(item.id_vehiculo) === e.target.value);
                setMovementForm((p) => ({ ...p, id_vehiculo: e.target.value, placa_leida: chosen?.placa || p.placa_leida }));
              }}>
                <option value="">No está registrado / visitante</option>
                {catalogData.vehiculos.map((item) => <option key={item.id_vehiculo} value={item.id_vehiculo}>{item.placa} · {item.responsable?.nombre || 'Sin responsable'}</option>)}
              </select>
            </label>
            <label>
              <span>Placa leída o escrita</span>
              <input value={movementForm.placa_leida} onChange={(e) => setMovementForm((p) => ({ ...p, placa_leida: e.target.value.toUpperCase() }))} required maxLength="15" placeholder="ABC-123" />
            </label>
            {session.user?.funcionalidades?.rfid ? <label><span>Código RFID (lector USB)</span><input value={movementForm.codigo_rfid} onChange={(e) => {
              const code = e.target.value.trim();
              const matched = catalogData.vehiculos.find((item) => item.codigo_rfid?.toLowerCase() === code.toLowerCase());
              setMovementForm((p) => ({ ...p, codigo_rfid: code, id_vehiculo: matched ? String(matched.id_vehiculo) : p.id_vehiculo, placa_leida: matched?.placa || p.placa_leida }));
            }} placeholder="Escanea la tarjeta o etiqueta" /></label> : null}
            <label>
              <span>Tipo de movimiento</span>
              <select value={movementForm.tipo_movimiento} onChange={(e) => setMovementForm((p) => ({ ...p, tipo_movimiento: e.target.value }))}>
                <option value="INGRESO">Ingreso</option><option value="SALIDA">Salida</option>
              </select>
            </label>
            <label>
              <span>Observación</span>
              <input value={movementForm.observacion} onChange={(e) => setMovementForm((p) => ({ ...p, observacion: e.target.value }))} maxLength="255" placeholder="Motivo, visitante o nota de portería" />
            </label>
          </div>
          <div className="form-actions"><button className="primary-btn" type="submit">Registrar movimiento</button></div>
          {movementSaved ? <div className="success-box" role="status">{movementSaved}</div> : null}
        </form>
      </div>

      <div className="panel-card">
        <div className="section-header"><div><h3>Validar QR</h3><small>Escanea el QR de un residente o la invitación de un visitante.</small></div></div>
        {hasFeature('qr') ? <>
        <div className="field-grid">
          <label><span>Tipo de QR</span><select value={scanPurpose} onChange={(e) => setScanPurpose(e.target.value)}><option value="residente">Residente</option><option value="visitante">Visitante invitado</option></select></label>
          <label><span>Acción</span><select value={scanAction} onChange={(e) => setScanAction(e.target.value)}><option value="INGRESO">Registrar ingreso</option><option value="SALIDA">Registrar salida</option></select></label>
        </div>
        <QRScanner onDetected={handleScanCode} />
        <form className="form-panel" onSubmit={(event) => { event.preventDefault(); handleScanCode(scanToken.trim()); }}>
          <label>
            <span>{scanPurpose === 'residente' ? 'Código rápido del residente (6 dígitos)' : 'Código QR de invitación'}</span>
            {scanPurpose === 'residente' ? (
              <input
                value={scanToken}
                onChange={(event) => setScanToken(event.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoComplete="one-time-code"
                placeholder="000000"
              />
            ) : (
              <textarea value={scanToken} onChange={(e) => setScanToken(e.target.value)} required rows="3" autoCapitalize="off" autoCorrect="off" spellCheck="false" placeholder="Ingresa el código completo de la invitación" />
            )}
          </label>
          <div className="form-actions"><button className="primary-btn" type="submit">Validar código</button></div>
        </form>
        {scanError ? <div className="error-box" role="alert">{scanError}</div> : null}
        {scanResult ? (
          <div className="success-box" role="status">
            <strong>Acceso registrado.</strong>
            <p>{scanResult.residente?.nombre || scanResult.invitacion?.nombre_visitante} · {scanResult.movimiento?.tipo_movimiento_etiqueta}</p>
            {scanResult.responsable_anfitrion ? <p>Anfitrión responsable registrado: {scanResult.responsable_anfitrion}</p> : null}
            {scanResult.invitacion?.motivo ? <p>Motivo: {scanResult.invitacion.motivo}</p> : null}
          </div>
        ) : null}
        </> : <div className="plan-notice" role="status">El acceso QR no está incluido en el plan {session.user?.plan?.nombre || 'actual'}. Continúa usando el registro manual.</div>}
      </div>

      <div className="panel-card">
        <div className="section-header"><div><h3>Registrar incidencia</h3><small>Deja constancia de daños, novedades o intentos de acceso.</small></div></div>
        <form className="form-panel" onSubmit={handleCreateIncident}>
          <div className="field-grid">
            <label><span>Título</span><input value={incidentForm.titulo} onChange={(e) => setIncidentForm((p) => ({ ...p, titulo: e.target.value }))} required maxLength="100" /></label>
            <label><span>Prioridad</span><select value={incidentForm.nivel_prioridad} onChange={(e) => setIncidentForm((p) => ({ ...p, nivel_prioridad: e.target.value }))}><option value="BAJA">Baja</option><option value="MEDIA">Media</option><option value="ALTA">Alta</option><option value="CRITICA">Crítica</option></select></label>
            <label><span>Vehículo relacionado</span><select value={incidentForm.id_vehiculo} onChange={(e) => setIncidentForm((p) => ({ ...p, id_vehiculo: e.target.value }))}><option value="">Sin vehículo vinculado</option>{catalogData.vehiculos.map((item) => <option key={item.id_vehiculo} value={item.id_vehiculo}>{item.placa}</option>)}</select></label>
            <label><span>Invitación de visitante relacionada</span><select value={incidentForm.id_invitacion} onChange={(e) => setIncidentForm((p) => ({ ...p, id_invitacion: e.target.value }))}><option value="">Sin invitación vinculada</option>{visitorInvitations.map((item) => <option key={item.id_invitacion} value={item.id_invitacion}>{item.nombre_visitante} · anfitrión: {item.residente?.nombre || item.id_residente} · {item.estado}</option>)}</select></label>
            <label><span>Descripción</span><textarea value={incidentForm.descripcion} onChange={(e) => setIncidentForm((p) => ({ ...p, descripcion: e.target.value }))} required rows="3" /></label>
          </div>
          <div className="form-actions"><button className="primary-btn" type="submit">Guardar incidencia</button></div>
          {incidentSaved ? <div className="success-box" role="status">{incidentSaved}</div> : null}
        </form>
      </div>
    </div>
  );

  const renderMiQr = () => {
    const qrEnabled = session.user?.funcionalidades?.qr !== false;
    return (
      <div className="resident-workspace">
        {!qrEnabled ? <div className="panel-card warn">El plan actual no incluye códigos QR.</div> : null}
        <div className="panel-card resident-qr-card">
          <div className="section-header"><div><h3>Mi QR de residente</h3><small>Se renueva automáticamente y cada código se acepta una sola vez.</small></div><span className="status-pill">{session.user?.establecimiento}</span></div>
          <label><span>Vehículo asociado</span><select value={residentQrVehicle} onChange={(e) => setResidentQrVehicle(e.target.value)}><option value="">Acceso peatonal</option>{residentVehicles.map((item) => <option key={item.id_vehiculo} value={item.id_vehiculo}>{item.placa} · {item.marca || ''}</option>)}</select></label>
          {residentQr?.token && qrEnabled ? <div className="qr-display"><QRCodeSVG value={residentQr.token} size={230} level="M" includeMargin /><p>{residentQr.residente} · {residentQr.vehiculo}</p><small>Vence: {formatDateTime(residentQr.expires_at)}</small><div className="resident-fallback-code"><span>Código rápido para dictar al vigilante</span><strong aria-label={`Código de respaldo ${residentQr.codigo_respaldo}`}>{residentQr.codigo_respaldo}</strong><small>Válido por 90 segundos y de un solo uso.</small></div></div> : <div className="empty-state">Generando el QR de acceso…</div>}
          <button className="ghost-btn" onClick={handleRefreshResidentQR} disabled={!qrEnabled}>Actualizar QR ahora</button>
        </div>

        <div className="panel-card">
          <div className="section-header"><div><h3>Invitar visitante</h3><small>El registro queda asociado a tu cuenta como residente anfitrión.</small></div></div>
          <form className="form-panel" onSubmit={handleCreateVisitorInvitation}>
            <div className="field-grid">
              <label><span>Nombre del visitante</span><input value={visitorForm.nombre_visitante} onChange={(e) => setVisitorForm((p) => ({ ...p, nombre_visitante: e.target.value }))} required maxLength="100" /></label>
              <label><span>Documento (opcional)</span><input value={visitorForm.documento_visitante} onChange={(e) => setVisitorForm((p) => ({ ...p, documento_visitante: e.target.value }))} maxLength="30" /></label>
              <label><span>Placa (opcional)</span><input value={visitorForm.placa_visitante} onChange={(e) => setVisitorForm((p) => ({ ...p, placa_visitante: e.target.value.toUpperCase() }))} maxLength="15" /></label>
              <label><span>Motivo de visita</span><input value={visitorForm.motivo} onChange={(e) => setVisitorForm((p) => ({ ...p, motivo: e.target.value }))} maxLength="255" /></label>
              <label><span>Válido desde</span><input type="datetime-local" value={visitorForm.vigente_desde} onChange={(e) => setVisitorForm((p) => ({ ...p, vigente_desde: e.target.value }))} required /></label>
              <label><span>Válido hasta (máximo 24 horas)</span><input type="datetime-local" value={visitorForm.vigente_hasta} onChange={(e) => setVisitorForm((p) => ({ ...p, vigente_hasta: e.target.value }))} required /></label>
            </div>
            <div className="form-actions"><button className="primary-btn" type="submit" disabled={!qrEnabled}>Generar invitación QR</button></div>
          </form>
          {visitorQr?.qr_token ? <div className="qr-display"><QRCodeSVG value={visitorQr.qr_token} size={220} level="M" includeMargin /><p>Invitación para {visitorQr.nombre_visitante}</p><small>Anfitrión responsable: {session.user?.nombre} · Válida hasta {formatDateTime(visitorQr.vigente_hasta)}</small><details className="manual-qr-code"><summary>Mostrar código de respaldo para portería</summary><p>El vigilante puede pegar o escribir este código en la validación manual.</p><textarea aria-label="Código de respaldo de la invitación" readOnly rows="4" value={visitorQr.qr_token} onFocus={(event) => event.target.select()} /></details></div> : null}
        </div>

        <div className="panel-card">
          <div className="section-header"><h3>Mis invitaciones</h3></div>
          <div className="table-scroll"><table className="data-table detail-table"><thead><tr><th>Visitante</th><th>Placa</th><th>Motivo</th><th>Vigencia</th><th>Estado</th><th></th></tr></thead><tbody>
            {visitorInvitations.map((item) => <tr key={item.id_invitacion}><td>{item.nombre_visitante}</td><td>{item.placa_visitante || 'Peatonal'}</td><td>{item.motivo || '—'}</td><td>{formatDateTime(item.vigente_desde)} – {formatDateTime(item.vigente_hasta)}</td><td>{item.estado}</td><td>{item.estado === 'PENDIENTE' ? <button className="ghost-btn" onClick={() => handleRevokeInvitation(item.id_invitacion)}>Revocar</button> : null}</td></tr>)}
            {!visitorInvitations.length ? <tr><td colSpan="6">Todavía no has creado invitaciones.</td></tr> : null}
          </tbody></table></div>
          <p className="login-hint liability-note">Cada ingreso y salida conserva el visitante y el residente que lo invitó para consulta en reportes e incidencias.</p>
        </div>
      </div>
    );
  };

  const renderReportes = () => (
    <div className="report-stack">
      <div className="panel-card">
        <div className="section-header">
          <h3>Reportes y actividad del establecimiento</h3>
          <span className="status-pill">Establecimiento {session.user?.id_establecimiento}</span>
        </div>
        <div className="report-summary">
          <div className="mini-card"><span>Movimientos</span><strong>{totalMovimientos}</strong></div>
          <div className="mini-card warning"><span>Incidencias</span><strong>{totalIncidencias}</strong></div>
          {hasFeature('lpr') ? <div className="mini-card success"><span>Reconocimientos</span><strong>{totalReconocimientos}</strong></div> : null}
        </div>
      </div>
      <div className="panel-card">
        <div className="section-header report-tabs" role="tablist" aria-label="Registros de actividad">
          {Object.entries(reportConfig).filter(([key]) => key !== 'reconocimientos' || hasFeature('lpr')).map(([key, item]) => (
            <button key={key} role="tab" aria-selected={activeReport === key} className={`report-tab ${activeReport === key ? 'active' : ''}`} onClick={() => setActiveReport(key)}>
              {item.label} ({reportData[`${key}Count`]})
            </button>
          ))}
        </div>
        {renderReportTable(activeReport, reportData[activeReport])}
        {reportData[activeReport].length < reportData[`${activeReport}Count`] ? (
          <button className="ghost-btn load-more" onClick={() => handleLoadMoreReport(activeReport)} disabled={loadingMore}>
            {loadingMore ? 'Cargando…' : 'Cargar más registros'}
          </button>
        ) : null}
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
        <div className="security-item">La vista web puede abrir sin red; la sincronización pendiente aún no está implementada</div>
      </div>
    </div>
  );

  const contentMap = {
    dashboard: renderDashboard(),
    usuarios: canAccess('usuarios') ? renderUsers() : <div className="panel-card warn">No tienes permisos para ver usuarios.</div>,
    roles: canAccess('roles') ? renderRoles() : <div className="panel-card warn">No tienes permisos para ver roles.</div>,
    catalogos: canAccess('catalogos') ? renderCatalogos() : <div className="panel-card warn">No tienes permisos para ver catálogo.</div>,
    camaras: canAccess('camaras') ? renderCamaras() : <div className="panel-card warn">No tienes permisos para ver cámaras.</div>,
    accesos: canAccess('accesos') ? renderAccesos() : <div className="panel-card warn">No tienes permisos para registrar accesos.</div>,
    mi_qr: canAccess('mi_qr') ? renderMiQr() : <div className="panel-card warn">Esta pantalla solo está disponible para residentes.</div>,
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
            <input name="username" type="text" placeholder="Usuario o correo (ej. vigilante@pinos.com)" />
            <input name="password" type="password" placeholder="Contraseña" />
            <p className="login-hint">
              Super Admin: admin / miacarola · Vigilante: vigilante@pinos.com / hash_pass_123 · Residente: residente@pinos.com / hash_pass_123
            </p>
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
      {mobileMenuOpen ? <button type="button" className="mobile-nav-backdrop" aria-label="Cerrar menú de navegación" onClick={() => setMobileMenuOpen(false)} /> : null}
      <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-mobile-header"><span>MENÚ PRINCIPAL</span><button type="button" aria-label="Cerrar menú" onClick={() => setMobileMenuOpen(false)}>×</button></div>
        <div className="brand" title="Heimdall · Guardián de Bifröst"><HeimdallMark /></div>
        <nav className="side-menu" id="primary-navigation" aria-label="Navegación principal">
          {menuBase.filter((item) => canAccess(item.key) || item.key === 'dashboard').map((item) => {
            const lockedByPlan = item.key === 'camaras' && !hasFeature('lpr');
            return (
            <button
              key={item.key}
              className={`nav-btn ${activeTab === item.key ? 'active' : ''} ${lockedByPlan ? 'locked' : ''}`}
              aria-current={activeTab === item.key ? 'page' : undefined}
              onClick={() => { setActiveTab(item.key); setMobileMenuOpen(false); }}
              title={lockedByPlan ? `LPR/IA no está incluido en el plan ${session.user?.plan?.nombre || 'actual'}` : item.label}
            >
              <span className="nav-icon-wrap">{lockedByPlan ? <NavigationIcon name="seguridad" /> : <NavigationIcon name={item.key} />}</span>
              <small>{lockedByPlan ? `${item.label} · Plan` : item.label}</small>
            </button>
            );
          })}
        </nav>
        <div className="sidebar-guard"><span><HeimdallMark /></span><strong>Himinbjörg Guard</strong><small>SISTEMA ACTIVO</small></div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="mobile-menu-toggle" aria-label={mobileMenuOpen ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'} aria-expanded={mobileMenuOpen} aria-controls="primary-navigation" onClick={() => setMobileMenuOpen((open) => !open)}>
              <span /><span /><span />
            </button>
            <div className="product-lockup"><strong>HEIMDALL TECH</strong><small>CONTROL Y TRAZABILIDAD VEHICULAR</small></div>
            <div className="status-pill">{offlineMode ? 'Modo offline' : 'Online'}</div>
          </div>

          <div className="topbar-right">
            {isPlatformSuperAdmin ? (
              <select
                value={debugViewRole || actualRole}
                onChange={(e) => setDebugViewRole(e.target.value === actualRole ? '' : e.target.value)}
                title="Vista de prueba (solo Super Admin)"
                aria-label="Vista de prueba por rol"
              >
                <option value="superadmin">Vista: Super Admin</option>
                <option value="admin">Vista: Administrador</option>
                <option value="supervisor">Vista: Supervisor</option>
                <option value="vigilante">Vista: Vigilante</option>
              </select>
            ) : null}
            <div className="user-box">
              <span>{session.user?.nombre || session.user?.username || 'Usuario'}</span>
              <small className="role-tag">{session.user?.rol || actualRole}</small>
              <button className="ghost-btn" onClick={handleLogout}>Salir</button>
            </div>
          </div>
        </header>

        <section className="content-area">
          {error ? <div className="error-box" role="alert">{error}</div> : null}
          {!session.user?.id_establecimiento ? (
            <div className="panel-card warn" role="alert">Esta cuenta no tiene un establecimiento asociado. Contacta al administrador.</div>
          ) : null}
          {contentMap[activeTab] || contentMap.dashboard}
          {selectedDetail ? (
            <div className="detail-backdrop" role="presentation" onClick={() => setSelectedDetail(null)}>
              <section className="detail-dialog" role="dialog" aria-modal="true" aria-labelledby="detail-dialog-title" onClick={(event) => event.stopPropagation()}>
                <div className="section-header">
                  <div>
                    <h3 id="detail-dialog-title">Detalle: {detailConfig[selectedDetail.type]?.label || selectedDetail.type}</h3>
                    <small>Registro #{selectedDetail.record[detailConfig[selectedDetail.type]?.idField || 'id_vehiculo']}</small>
                  </div>
                  <button className="ghost-btn" onClick={() => setSelectedDetail(null)}>Cerrar</button>
                </div>
                {selectedDetail.loading ? <p>Cargando detalle…</p> : null}
                {selectedDetail.error ? <div className="error-box" role="alert">{selectedDetail.error}</div> : null}
                {selectedDetail.detail ? (
                  <dl className="detail-fields">
                    {Object.entries(selectedDetail.detail).flatMap(([key, value]) => {
                      if (value && typeof value === 'object' && !Array.isArray(value)) {
                        return Object.entries(value).map(([nestedKey, nestedValue]) => ({
                          key: `${key}-${nestedKey}`,
                          label: `${key}: ${detailFieldLabels[nestedKey] || nestedKey.replaceAll('_', ' ')}`,
                          value: nestedValue,
                        }));
                      }
                      return [{ key, label: detailFieldLabels[key] || key.replaceAll('_', ' '), value }];
                    }).map(({ key, label, value }) => (
                      <div className="detail-field" key={key}>
                        <dt>{label}</dt>
                        <dd>{value == null || value === '' ? '—' : typeof value === 'boolean' ? (value ? 'Sí' : 'No') : String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </section>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}

export default App;
