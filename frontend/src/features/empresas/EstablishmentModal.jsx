import { useMemo, useState } from 'react';
import Modal from '../../components/Modal';
import { apiFetch } from '../../lib/api';

const buildForm = (establishment) => ({
  nombre: establishment?.nombre || '',
  direccion: establishment?.direccion || '',
  telefono: establishment?.telefono || '',
  id_plan: establishment?.id_plan ?? establishment?.plan?.id_plan ?? '',
  estado: establishment?.estado !== false,
});

export default function EstablishmentModal({
  open,
  establishment = null,
  plans = [],
  onClose,
  onSaved,
}) {
  const isEditing = Boolean(establishment?.id_establecimiento);
  const activePlans = useMemo(
    () => plans.filter((plan) => plan.estado !== false),
    [plans],
  );
  const [form, setForm] = useState(() => buildForm(establishment));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const updateField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.nombre.trim() || !form.direccion.trim() || !form.id_plan) {
      setError('Completa el nombre, la dirección y el plan comercial.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        nombre: form.nombre.trim(),
        direccion: form.direccion.trim(),
        telefono: form.telefono.trim(),
        id_plan: Number(form.id_plan),
        estado: form.estado,
      };
      const saved = await apiFetch(
        isEditing
          ? `/empresas/establecimientos/${establishment.id_establecimiento}/`
          : '/empresas/establecimientos/',
        {
          method: isEditing ? 'PATCH' : 'POST',
          body: JSON.stringify(payload),
        },
      );
      onSaved(saved, isEditing);
    } catch (saveError) {
      setError(saveError.message || 'No se pudo guardar el establecimiento.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      eyebrow={isEditing ? 'Edición de establecimiento' : 'Nuevo establecimiento'}
      title={isEditing ? establishment.nombre : 'Crear establecimiento'}
      description="El plan comercial define las funcionalidades disponibles (QR, RFID, LPR/IA). Los establecimientos no se borran: se desactivan para conservar su historial."
      size="lg"
      footer={(
        <>
          <button type="button" className="rbac-btn rbac-btn-ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" form="establishment-form" className="rbac-btn rbac-btn-gold" disabled={saving || !activePlans.length}>
            {saving ? 'Guardando…' : (isEditing ? 'Guardar cambios' : 'Crear establecimiento')}
          </button>
        </>
      )}
    >
      <form id="establishment-form" className="rbac-form" onSubmit={handleSubmit}>
        {error ? <div className="rbac-alert" role="alert">{error}</div> : null}
        {!activePlans.length ? (
          <div className="rbac-alert rbac-alert-warn" role="status">
            No hay planes comerciales activos. Activa un plan antes de crear establecimientos.
          </div>
        ) : null}
        <div className="rbac-field-grid">
          <label className="rbac-field">
            <span>Nombre del establecimiento</span>
            <input
              value={form.nombre}
              onChange={updateField('nombre')}
              maxLength="100"
              placeholder="Conjunto Residencial…"
              required
            />
          </label>
          <label className="rbac-field">
            <span>Plan comercial</span>
            <select value={form.id_plan} onChange={updateField('id_plan')} required>
              <option value="">Selecciona un plan</option>
              {activePlans.map((plan) => (
                <option key={plan.id_plan} value={plan.id_plan}>
                  {plan.nombre} · {plan.limite_usuarios} usuarios
                </option>
              ))}
            </select>
          </label>
          <label className="rbac-field">
            <span>Dirección</span>
            <input
              value={form.direccion}
              onChange={updateField('direccion')}
              maxLength="200"
              placeholder="Dirección del establecimiento"
              required
            />
          </label>
          <label className="rbac-field">
            <span>Teléfono (opcional)</span>
            <input
              value={form.telefono}
              onChange={updateField('telefono')}
              maxLength="20"
              placeholder="300 000 0000"
            />
          </label>
        </div>
        <label className="rbac-permission-row is-enabled" style={{ marginTop: 18 }}>
          <span className="rbac-permission-label">
            <strong>Establecimiento activo</strong>
            <small>Los establecimientos inactivos conservan sus datos, pero sus usuarios no deben operar.</small>
          </span>
          <button
            type="button"
            className={`rbac-switch ${form.estado ? 'is-on' : ''}`}
            role="switch"
            aria-checked={form.estado}
            aria-label="Establecimiento activo"
            onClick={() => setForm((current) => ({ ...current, estado: !current.estado }))}
          >
            <span />
          </button>
        </label>
      </form>
    </Modal>
  );
}
