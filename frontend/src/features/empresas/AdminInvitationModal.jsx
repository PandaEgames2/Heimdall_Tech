import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Modal from '../../components/Modal';
import { apiFetch } from '../../lib/api';

const RESIDENTE_ROL_ID = 5;

const pad = (value) => String(value).padStart(2, '0');

const toInputValue = (date) => (
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  + `T${pad(date.getHours())}:${pad(date.getMinutes())}`
);

const defaultRange = () => {
  const start = new Date();
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  return { vigente_desde: toInputValue(start), vigente_hasta: toInputValue(end) };
};

const buildForm = () => ({
  id_residente: '',
  nombre_visitante: '',
  documento_visitante: '',
  placa_visitante: '',
  motivo: '',
  ...defaultRange(),
});

const rolesOf = (user) => {
  const assigned = Array.isArray(user.roles) ? user.roles.map((role) => Number(role.id_rol)) : [];
  const ids = Array.isArray(user.roles_ids) ? user.roles_ids.map(Number) : [];
  return new Set([Number(user.id_rol), ...assigned, ...ids].filter(Boolean));
};

const isResident = (user) => rolesOf(user).has(RESIDENTE_ROL_ID);

const normalizeList = (payload) => (
  Array.isArray(payload) ? payload : (payload?.results || [])
);

const formatRange = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
};

export default function AdminInvitationModal({
  open,
  onClose,
  establishmentId,
  establishmentName,
  onCreated,
}) {
  const [residents, setResidents] = useState([]);
  const [form, setForm] = useState(buildForm);
  const [loadingResidents, setLoadingResidents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);

  useEffect(() => {
    if (!open || !establishmentId) return undefined;
    let cancelled = false;

    const loadResidents = async () => {
      setLoadingResidents(true);
      setError('');
      try {
        const payload = await apiFetch(
          `/identidad/usuarios/?id_establecimiento=${establishmentId}&page_size=200`,
        );
        if (!cancelled) {
          setResidents(normalizeList(payload).filter((user) => user.estado && isResident(user)));
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'No se pudieron cargar los residentes.');
      } finally {
        if (!cancelled) setLoadingResidents(false);
      }
    };

    loadResidents();
    return () => { cancelled = true; };
  }, [open, establishmentId]);

  const residentOptions = useMemo(
    () => residents.map((resident) => ({
      id: resident.id_usuario,
      label: resident.nombre,
      email: resident.correo,
    })),
    [residents],
  );

  const updateField = (field) => (event) => {
    const value = field === 'placa_visitante'
      ? event.target.value.toUpperCase()
      : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.id_residente) {
      setError('Selecciona el residente o empleado anfitrión.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = await apiFetch(
        `/operaciones/invitaciones-visitantes/?id_establecimiento=${establishmentId}`,
        {
          method: 'POST',
          body: JSON.stringify({
            ...form,
            id_residente: Number(form.id_residente),
          }),
        },
      );
      setCreated(payload);
      onCreated?.(payload);
    } catch (saveError) {
      setError(saveError.message || 'No se pudo crear la invitación.');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setCreated(null);
    setError('');
    setForm(buildForm());
  };

  const close = () => {
    if (saving) return;
    setCreated(null);
    setError('');
    setForm(buildForm());
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      eyebrow="Administración · Invitación de visitante"
      title={created ? 'Invitación creada' : 'Invitar visitante'}
      description={created
        ? 'Comparte el QR con el visitante. La invitación queda vinculada al residente anfitrión y al establecimiento.'
        : `Selecciona el residente o empleado anfitrión de ${establishmentName || 'este establecimiento'}. La invitación conserva la trazabilidad aunque la cree la administración.`}
      size="lg"
      footer={created ? (
        <>
          <button type="button" className="rbac-btn rbac-btn-ghost" onClick={resetForm}>Nueva invitación</button>
          <button type="button" className="rbac-btn rbac-btn-gold" onClick={close}>Cerrar</button>
        </>
      ) : (
        <>
          <button type="button" className="rbac-btn rbac-btn-ghost" onClick={close} disabled={saving}>Cancelar</button>
          <button type="submit" form="admin-invitation-form" className="rbac-btn rbac-btn-gold" disabled={saving || loadingResidents}>
            {saving ? 'Generando…' : 'Generar invitación QR'}
          </button>
        </>
      )}
    >
      {error ? <div className="rbac-alert" role="alert">{error}</div> : null}

      {created ? (
        <div className="admin-invite-success">
          <div className="admin-invite-qr">
            <QRCodeSVG value={created.qr_token} size={220} level="M" includeMargin />
          </div>
          <div className="admin-invite-summary">
            <span className="rbac-eyebrow">Visitante</span>
            <strong>{created.nombre_visitante}</strong>
            <p>{created.residente?.nombre || 'Residente anfitrión'} · {created.placa_visitante || 'Peatonal'}</p>
            <p>Vigencia: {formatRange(created.vigente_desde)} → {formatRange(created.vigente_hasta)}</p>
            <details className="manual-qr-code">
              <summary>Mostrar token de respaldo para portería</summary>
              <p>El vigilante puede pegar este token en la validación manual de invitaciones.</p>
              <textarea aria-label="Token de respaldo de la invitación" readOnly rows="4" value={created.qr_token} onFocus={(event) => event.target.select()} />
            </details>
          </div>
        </div>
      ) : (
        <form id="admin-invitation-form" className="admin-invite-form" onSubmit={handleSubmit}>
          <label className="rbac-field">
            <span>Residente / empleado anfitrión</span>
            <select
              value={form.id_residente}
              onChange={updateField('id_residente')}
              disabled={loadingResidents}
              required
            >
              <option value="">{loadingResidents ? 'Cargando residentes…' : 'Selecciona una persona'}</option>
              {residentOptions.map((resident) => (
                <option key={resident.id} value={resident.id}>
                  {resident.label} · {resident.email}
                </option>
              ))}
            </select>
            <small>El cupo y las restricciones del establecimiento ya se validaron en el backend.</small>
          </label>

          {!loadingResidents && residentOptions.length === 0 ? (
            <div className="rbac-alert rbac-alert-warn" role="status">
              No hay residentes/empleados activos para seleccionar. Crea o activa una cuenta con rol Residente antes de invitar.
            </div>
          ) : null}

          <div className="rbac-field-grid admin-invite-grid">
            <label className="rbac-field">
              <span>Nombre del visitante</span>
              <input value={form.nombre_visitante} onChange={updateField('nombre_visitante')} maxLength="100" required />
            </label>
            <label className="rbac-field">
              <span>Documento (opcional)</span>
              <input value={form.documento_visitante} onChange={updateField('documento_visitante')} maxLength="30" />
            </label>
            <label className="rbac-field">
              <span>Placa (opcional)</span>
              <input value={form.placa_visitante} onChange={updateField('placa_visitante')} maxLength="15" placeholder="ABC-123" />
            </label>
            <label className="rbac-field">
              <span>Motivo de visita</span>
              <input value={form.motivo} onChange={updateField('motivo')} maxLength="255" />
            </label>
            <label className="rbac-field">
              <span>Válido desde</span>
              <input type="datetime-local" value={form.vigente_desde} onChange={updateField('vigente_desde')} required />
            </label>
            <label className="rbac-field">
              <span>Válido hasta (máximo 24 horas)</span>
              <input type="datetime-local" value={form.vigente_hasta} onChange={updateField('vigente_hasta')} required />
            </label>
          </div>
        </form>
      )}
    </Modal>
  );
}
