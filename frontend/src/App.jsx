import { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';
import { QRCodeSVG } from 'qrcode.react';
import Sidebar from './components/Sidebar';
import Modal from './components/Modal';
import LandingPage from './features/landing/LandingPage';
import EstablishmentModal from './features/empresas/EstablishmentModal';
import RoleManagement from './features/rbac/RoleManagement';
import ResourceManagement from './features/rbac/ResourceManagement';
import UserManagement from './features/rbac/UserManagement';
import { apiFetch, apiRequest as authFetch, loginRequest, logoutRequest, refreshSession } from './lib/api';
import { navigate, usePathname } from './lib/router';
import './App.css';
import './features/rbac/rbac.css';

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

const readSession = () => {
  try {
    const raw = localStorage.getItem('heimdall_session');
    if (!raw) return { user: null };
    const parsed = JSON.parse(raw);
    return { user: parsed.user || null };
  } catch {
    return { user: null };
  }
};

const saveSession = (session) => {
  localStorage.setItem('heimdall_session', JSON.stringify({ user: session.user || null }));
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
  const pathname = usePathname();
  const isLandingRoute = pathname === '/';
  const isLoginRoute = pathname === '/login';
  const isAppRoute = !isLandingRoute && !isLoginRoute;
  const [session, setSession] = useState(initialSession);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [catalogData, setCatalogData] = useState({
    planes: [], establecimientos: [], vehiculos: [], responsables: [],
    planesCount: 0, establecimientosCount: 0, vehiculosCount: 0,
  });
  const [activeCatalog, setActiveCatalog] = useState('planes');
  const [activeReport, setActiveReport] = useState('movimientos');
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [establishmentModal, setEstablishmentModal] = useState(null);
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
  const [loading, setLoading] = useState(Boolean(initialSession.user));
  const [error, setError] = useState('');
  const [reportData, setReportData] = useState({
    movimientos: [],
    incidencias: [],
    reconocimientos: [],
    movimientosCount: 0,
    incidenciasCount: 0,
    reconocimientosCount: 0,
  });

  const isPlatformSuperAdmin = Boolean(session.user?.is_platform_superadmin);
  const isResident = session.user?.rol === 'Residente'
    || Number(session.user?.rol_id) === 5
    || (session.user?.roles_ids || []).some((roleId) => Number(roleId) === 5);
  const effectivePermissions = useMemo(
    () => (Array.isArray(session.user?.permisos_efectivos) ? session.user.permisos_efectivos : []),
    [session.user?.permisos_efectivos],
  );
  const menuKeys = useMemo(
    () => new Set(
      (session.user?.menu || [])
        .filter((item) => item.visible !== false)
        .map((item) => item.key),
    ),
    [session.user?.menu],
  );
  const canAccess = (key) => effectivePermissions.includes(key) || menuKeys.has(key);
  const hasFeature = (feature) => Boolean(isPlatformSuperAdmin || session.user?.funcionalidades?.[feature]);

  useEffect(() => {
    if (!session.user) return;
    const allowed = new Set(effectivePermissions);
    menuKeys.forEach((key) => allowed.add(key));
    if (allowed.has(activeTab)) return;
    const fallback = session.user?.menu?.find((item) => item.visible !== false)?.key || 'dashboard';
    setActiveTab(allowed.has(fallback) ? fallback : 'dashboard');
  }, [session.user, activeTab, effectivePermissions, menuKeys]);

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
    let isMounted = true;

    const bootstrapSession = async () => {
      const stored = readSession();
      if (!stored.user) {
        if (isMounted) setLoading(false);
        return;
      }

      const renewed = await refreshSession();
      if (!renewed) {
        clearSession();
        if (isMounted) {
          setSession({ user: null });
          setLoading(false);
        }
        return;
      }

      try {
        const profile = await apiFetch('/profile/');
        if (!isMounted) return;
        const nextSession = {
          user: { ...profile, nombre: profile.nombre || profile.username || 'Usuario' },
        };
        setSession(nextSession);
        saveSession(nextSession);
      } catch {
        clearSession();
        if (isMounted) setSession({ user: null });
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    bootstrapSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const sessionUserId = session.user?.id_usuario ?? session.user?.id;

  useEffect(() => {
    if (session.user && (isLandingRoute || isLoginRoute)) {
      navigate('/panel', { replace: true });
      return;
    }
    if (!session.user && isAppRoute) {
      navigate('/login', { replace: true });
    }
  }, [session.user, isLandingRoute, isLoginRoute, isAppRoute]);

  useEffect(() => {
    if (!sessionUserId) return undefined;
    const refreshOwnPermissions = async () => {
      try {
        const profile = await apiFetch('/profile/');
        setSession((current) => {
          const currentId = current.user?.id_usuario ?? current.user?.id;
          if (currentId !== sessionUserId) return current;
          const nextUser = {
            ...current.user,
            ...profile,
            nombre: profile.nombre || profile.username || current.user?.nombre || 'Usuario',
          };
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
  }, [sessionUserId]);

  useEffect(() => {
    if (!session.user) return undefined;

    const establecimientoId = session.user?.id_establecimiento;
    if (!establecimientoId) {
      return undefined;
    }

    const loadDashboardData = async () => {
      try {
        const canReadReports = effectivePermissions.includes('reportes');
        const canReadSecurity = effectivePermissions.includes('seguridad');
        const dataRequests = canReadReports ? [
          ['movimientos', authFetch(`/operaciones/movimientos/?id_establecimiento=${establecimientoId}`)],
          ['incidencias', authFetch(`/operaciones/incidencias/?id_establecimiento=${establecimientoId}`)],
        ] : canReadSecurity ? [
          ['incidencias', authFetch(`/operaciones/incidencias/?id_establecimiento=${establecimientoId}&permiso=seguridad`)],
        ] : [];
        if (canReadReports && (isPlatformSuperAdmin || session.user?.funcionalidades?.lpr)) {
          dataRequests.push(['reconocimientos', authFetch(`/inteligencia/reconocimientos/?id_establecimiento=${establecimientoId}`)]);
        }
        if (effectivePermissions.includes('catalogos')) {
          dataRequests.push(['planes', authFetch('/empresas/planes/')]);
          dataRequests.push(['establecimientos', authFetch('/empresas/establecimientos/')]);
          dataRequests.push(['vehiculos', authFetch(`/operaciones/vehiculos/?id_establecimiento=${establecimientoId}`)]);
          dataRequests.push(['responsables', authFetch(`/operaciones/responsables/?id_establecimiento=${establecimientoId}`)]);
        } else if (effectivePermissions.includes('accesos')) {
          dataRequests.push(['vehiculos', authFetch(`/operaciones/vehiculos/?id_establecimiento=${establecimientoId}&permiso=accesos`)]);
        }
        if (effectivePermissions.includes('accesos')) {
          dataRequests.push(['invitaciones', authFetch(`/operaciones/invitaciones-visitantes/?id_establecimiento=${establecimientoId}`)]);
        }
        const responses = await Promise.all(dataRequests.map(([, request]) => request));
        const failedResponse = responses.find((response) => !response.ok);
        if (failedResponse) throw new Error(`La API rechazó la carga de datos (${failedResponse.status}).`);

        const loadedData = await Promise.all(
          dataRequests.map(async ([key], index) => [key, await responses[index].json()]),
        );
        const dataByKey = Object.fromEntries(loadedData);
        const movimientosData = dataByKey.movimientos || { results: [], count: 0 };
        const incidenciasData = dataByKey.incidencias || { results: [], count: 0 };
        const reconocimientosData = dataByKey.reconocimientos || { results: [], count: 0 };
        const planesData = dataByKey.planes || { results: [] };
        const establecimientosData = dataByKey.establecimientos || { results: [] };
        const vehiculosData = dataByKey.vehiculos || { results: [] };
        const responsablesData = dataByKey.responsables || { results: [] };
        const invitacionesData = dataByKey.invitaciones || { results: [] };

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
        setCatalogData({ planes: [], establecimientos: [], vehiculos: [], responsables: [], planesCount: 0, establecimientosCount: 0, vehiculosCount: 0 });
        if (effectivePermissions.includes('reportes') || effectivePermissions.includes('seguridad')) {
          setReportData({ movimientos: [], incidencias: [], reconocimientos: [], movimientosCount: 0, incidenciasCount: 0, reconocimientosCount: 0 });
        }
        setError(loadError.message || 'No se pudieron cargar los datos del establecimiento.');
      }
    };

    loadDashboardData();
  }, [session.user, isPlatformSuperAdmin, effectivePermissions]);

  useEffect(() => {
    if (!isResident) return undefined;
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
  }, [isResident, session.user?.id_establecimiento, residentQrVehicle]);

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
      const payload = await loginRequest(username, password);
      const profile = payload.profile || {};
      const nextSession = {
        user: {
          ...payload.user,
          ...profile,
          nombre: profile.nombre || payload.user?.nombre || payload.user?.username || 'Usuario',
        },
      };
      setSession(nextSession);
      saveSession(nextSession);
      navigate('/panel', { replace: true });
      const firstVisible = profile.menu?.find((item) => item.visible !== false)?.key;
      setActiveTab(firstVisible || 'dashboard');
      setError('');
    } catch (loginError) {
      setError(loginError.message || 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    try {
      const profile = await apiFetch('/profile/');
      setSession((current) => {
        if (!current.user) return current;
        const nextSession = {
          user: {
            ...current.user,
            ...profile,
            nombre: profile.nombre || profile.username || current.user.nombre || 'Usuario',
          },
        };
        saveSession(nextSession);
        return nextSession;
      });
    } catch {
      // Non-blocking: the periodic profile refresh will retry.
    }
  };

  const handleLogout = async () => {
    await logoutRequest();
    clearSession();
    setSession({ user: null });
    setActiveTab('dashboard');
    setError('');
    navigate('/', { replace: true });
  };

  const handleEstablishmentSaved = (saved, wasEditing) => {
    setCatalogData((current) => {
      const list = wasEditing
        ? current.establecimientos.map((item) => (
            item.id_establecimiento === saved.id_establecimiento ? saved : item
          ))
        : [saved, ...current.establecimientos];
      return {
        ...current,
        establecimientos: list,
        establecimientosCount: list.length,
      };
    });
    setEstablishmentModal(null);
    setActiveCatalog('establecimientos');
    refreshProfile();
  };

  const handleCreateVehicle = async (event) => {
    event.preventDefault();
    const establecimientoId = session.user?.id_establecimiento;
    if (!establecimientoId) return setError('La cuenta no tiene un establecimiento asociado.');
    try {
      const created = await apiFetch(`/operaciones/vehiculos/?id_establecimiento=${establecimientoId}`, {
        method: 'POST',
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
      const payload = await apiFetch(`/inteligencia/reconocimientos/procesar/?id_establecimiento=${establishmentId}`, {
        method: 'POST',
        body,
      });
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
      });
      setVisitorInvitations((current) => current.map((item) => item.id_invitacion === id ? updated : item));
      setError('');
    } catch (revokeError) {
      setError(revokeError.message || 'No se pudo revocar la invitación.');
    }
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

  const renderUsers = () => (
    <UserManagement
      profile={session.user}
      isSuperAdmin={isPlatformSuperAdmin}
      catalogo={session.user?.catalogo_permisos || []}
      onSelfChanged={refreshProfile}
    />
  );

  const renderRoles = () => (
    <RoleManagement
      catalogo={session.user?.catalogo_permisos || []}
      isSuperAdmin={isPlatformSuperAdmin}
      onRolesChanged={refreshProfile}
    />
  );

  const renderRecursos = () => (
    <ResourceManagement
      isSuperAdmin={isPlatformSuperAdmin}
      onResourcesChanged={refreshProfile}
    />
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
          {activeCatalog === 'establecimientos' && isPlatformSuperAdmin ? (
            <button className="primary-btn" onClick={() => setEstablishmentModal({ establishment: null })}>
              + Nuevo establecimiento
            </button>
          ) : activeCatalog === 'vehiculos' && canAccess('usuarios') ? (
            <button className="primary-btn" onClick={() => setVehicleFormOpen(true)}>
              + Registrar vehículo
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
                {selected.records.map((record, index) => {
                  const recordId = record[detailConfig[activeCatalog]?.idField] ?? index;
                  return (
                  <tr key={`${activeCatalog}-${recordId}`}>
                    {cellsFor(record).map((cell, cellIndex) => <td key={cellIndex}>{cell || '—'}</td>)}
                    <td>
                      <div className="catalog-row-actions">
                        <button className="ghost-btn" onClick={() => handleOpenDetail(activeCatalog, record)}>Ver detalle</button>
                        {activeCatalog === 'establecimientos' && isPlatformSuperAdmin ? (
                          <button className="ghost-btn" onClick={() => setEstablishmentModal({ establishment: record })}>
                            Editar
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                  );
                })}
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

  const activeMenuItem = session.user?.menu?.find((item) => item.key === activeTab);

  const renderCustomModule = (item) => (
    <div className="panel-card custom-module-panel">
      <div className="section-header">
        <div>
          <span className="eyebrow">Módulo personalizado</span>
          <h3>{item.label}</h3>
          <small>{item.description || 'Módulo habilitado desde el catálogo de recursos.'}</small>
        </div>
        <span className="status-pill">Activo</span>
      </div>
      <div className="custom-module-grid">
        <div className="mini-card"><span>Clave</span><strong>{item.key}</strong></div>
        <div className="mini-card"><span>Grupo</span><strong>{item.group || 'General'}</strong></div>
        <div className="mini-card success"><span>Estado</span><strong>Habilitado</strong></div>
      </div>
      <p className="login-hint">
        Este módulo fue creado desde Recursos y aparece en el menú de los roles que lo tienen asignado.
        Puedes ajustar sus accesos en Roles y permisos.
      </p>
    </div>
  );

  const contentMap = {
    dashboard: renderDashboard(),
    usuarios: canAccess('usuarios') ? renderUsers() : <div className="panel-card warn">No tienes permisos para ver usuarios.</div>,
    roles: canAccess('roles') ? renderRoles() : <div className="panel-card warn">No tienes permisos para ver roles.</div>,
    recursos: isPlatformSuperAdmin && canAccess('recursos') ? renderRecursos() : <div className="panel-card warn">La administración de recursos es exclusiva del Super Admin.</div>,
    catalogos: canAccess('catalogos') ? renderCatalogos() : <div className="panel-card warn">No tienes permisos para ver catálogo.</div>,
    camaras: canAccess('camaras') ? renderCamaras() : <div className="panel-card warn">No tienes permisos para ver cámaras.</div>,
    accesos: canAccess('accesos') ? renderAccesos() : <div className="panel-card warn">No tienes permisos para registrar accesos.</div>,
    mi_qr: canAccess('mi_qr') ? renderMiQr() : <div className="panel-card warn">Esta pantalla solo está disponible para residentes.</div>,
    reportes: canAccess('reportes') ? renderReportes() : <div className="panel-card warn">No tienes permisos para ver reportes.</div>,
    seguridad: canAccess('seguridad') ? renderSeguridad() : <div className="panel-card warn">No tienes permisos para seguridad.</div>,
  };

  if (!session.user) {
    if (isLandingRoute) {
      return <LandingPage onNavigate={navigate} />;
    }
    return (
      <div className="login-page">
        <div className="login-card">
          <a
            className="login-back"
            href="/"
            onClick={(event) => {
              event.preventDefault();
              navigate('/');
            }}
          >
            ← Volver al inicio
          </a>
          <div className="login-brand">HEIMDALL</div>
          <h2>Acceso al sistema</h2>
          <form onSubmit={handleLogin} className="login-form">
            <input name="username" type="text" placeholder="Usuario o correo" autoComplete="username" />
            <input name="password" type="password" placeholder="Contraseña" autoComplete="current-password" />
            <p className="login-hint">
              Acceso con las credenciales asignadas por tu administrador. La sesión se protege mediante cookie HttpOnly y token en memoria.
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

  if (session.user && (isLandingRoute || isLoginRoute)) {
    return <div className="route-redirect" role="status">Entrando a Heimdall…</div>;
  }

  return (
    <div className="app-shell">
      <Sidebar
        profile={session.user}
        activeTab={activeTab}
        onNavigate={setActiveTab}
        mobileOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

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
            <div className="user-box">
              <span>{session.user?.nombre || session.user?.username || 'Usuario'}</span>
              <small className="role-tag">{session.user?.rol || 'Sin rol'}</small>
              <button className="ghost-btn" onClick={handleLogout}>Salir</button>
            </div>
          </div>
        </header>

        <section className="content-area">
          {error ? <div className="error-box" role="alert">{error}</div> : null}
          {!session.user?.id_establecimiento ? (
            <div className="panel-card warn" role="alert">Esta cuenta no tiene un establecimiento asociado. Contacta al administrador.</div>
          ) : null}
          {contentMap[activeTab] || (activeMenuItem ? renderCustomModule(activeMenuItem) : contentMap.dashboard)}
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

        <Modal
          open={vehicleFormOpen}
          onClose={() => setVehicleFormOpen(false)}
          eyebrow="Catálogo · Vehículos"
          title="Registrar vehículo"
          description="Asocia el vehículo a un responsable para que aparezca en su QR de residente y en los accesos."
          size="lg"
          footer={(
            <>
              <button type="button" className="rbac-btn rbac-btn-ghost" onClick={() => setVehicleFormOpen(false)}>
                Cancelar
              </button>
              <button type="submit" form="vehicle-form" className="rbac-btn rbac-btn-gold">
                Guardar vehículo
              </button>
            </>
          )}
        >
          <form id="vehicle-form" className="rbac-form" onSubmit={handleCreateVehicle}>
            <div className="rbac-field-grid">
              <label className="rbac-field">
                <span>Placa</span>
                <input
                  value={vehicleForm.placa}
                  onChange={(e) => setVehicleForm((p) => ({ ...p, placa: e.target.value.toUpperCase() }))}
                  required
                  maxLength="15"
                  placeholder="ABC123"
                />
              </label>
              <label className="rbac-field">
                <span>Marca</span>
                <input
                  value={vehicleForm.marca}
                  onChange={(e) => setVehicleForm((p) => ({ ...p, marca: e.target.value }))}
                  placeholder="Mazda"
                />
              </label>
              <label className="rbac-field">
                <span>Modelo</span>
                <input
                  value={vehicleForm.modelo}
                  onChange={(e) => setVehicleForm((p) => ({ ...p, modelo: e.target.value }))}
                  placeholder="CX-5"
                />
              </label>
              <label className="rbac-field">
                <span>Color</span>
                <input
                  value={vehicleForm.color}
                  onChange={(e) => setVehicleForm((p) => ({ ...p, color: e.target.value }))}
                  placeholder="Gris"
                />
              </label>
              {session.user?.funcionalidades?.rfid ? (
                <label className="rbac-field">
                  <span>Código RFID (opcional)</span>
                  <input
                    value={vehicleForm.codigo_rfid}
                    onChange={(e) => setVehicleForm((p) => ({ ...p, codigo_rfid: e.target.value.trim() }))}
                    maxLength="100"
                  />
                </label>
              ) : null}
              <label className="rbac-field">
                <span>Responsable / residente</span>
                <select
                  value={vehicleForm.id_responsable}
                  onChange={(e) => setVehicleForm((p) => ({ ...p, id_responsable: e.target.value }))}
                >
                  <option value="">Sin responsable</option>
                  {catalogData.responsables.map((person) => (
                    <option key={person.id_responsable} value={person.id_responsable}>
                      {person.nombre}{person.departamento_unidad ? ` · ${person.departamento_unidad}` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="rbac-field">
                <span>Autorización</span>
                <select
                  value={vehicleForm.tipo_autorizacion}
                  onChange={(e) => setVehicleForm((p) => ({ ...p, tipo_autorizacion: e.target.value }))}
                >
                  <option value="AUTORIZADO">Residente autorizado</option>
                  <option value="VISITANTE">Visitante</option>
                  <option value="RESTRINGIDO">Restringido</option>
                </select>
              </label>
            </div>
          </form>
        </Modal>

        {establishmentModal ? (
          <EstablishmentModal
            open
            establishment={establishmentModal.establishment || null}
            plans={catalogData.planes}
            onClose={() => setEstablishmentModal(null)}
            onSaved={handleEstablishmentSaved}
          />
        ) : null}
      </main>
    </div>
  );
}

export default App;
