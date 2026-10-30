import { useMemo, useState } from 'react';
import Modal from '../../components/Modal';
import { apiFetch } from '../../lib/api';

const TYPE_OPTIONS = [
  { value: 'modulo', label: 'Módulo' },
  { value: 'accion', label: 'Acción' },
];

const emptyForm = () => ({
  clave: '',
  nombre: '',
  descripcion: '',
  grupo: 'General',
  tipo: 'modulo',
  estado: true,
  orden: '',
});

export default function ResourceModal({ open, resource, onClose, onSaved }) {
  const isEditing = Boolean(resource?.id_recurso);
  const isSystem = Boolean(resource?.es_sistema);

  const initial = useMemo(() => (resource ? {
    clave: resource.clave || '',
    nombre: resource.nombre || '',
    descripcion: resource.descripcion || '',
    grupo: resource.grupo || 'General',
    tipo: resource.tipo || 'modulo',
    estado: resource.estado !== false,
    orden: resource.orden ?? '',
  } : emptyForm()), [resource]);

  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const update = (patch) => {
    setDirty(true);
    setForm((current) => ({ ...current, ...patch }));
  };

  const requestClose = () => {
    if (dirty && !window.confirm('Hay cambios sin guardar. ¿Deseas descartar los cambios?')) return;
    onClose();
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setError('');
    const clave = form.clave.trim().toLowerCase();
    if (!clave || !form.nombre.trim()) {
      setError('La clave y el nombre del recurso son obligatorios.');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(clave)) {
      setError('La clave solo admite letras minúsculas, números y guion bajo.');
      return;
    }
    if (!isSystem && form.estado === false) {
      const confirmed = window.confirm(
        'Un recurso inactivo deja de aparecer en el catálogo y no puede asignarse a nuevos roles. ¿Continuar?',
      );
      if (!confirmed) return;
    }

    setSaving(true);
    try {
      const payload = {
        clave,
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim(),
        grupo: form.grupo.trim() || 'General',
        tipo: form.tipo,
        estado: isSystem ? true : Boolean(form.estado),
        orden: form.orden === '' ? undefined : Number(form.orden),
      };
      const saved = await apiFetch(
        `/identidad/recursos/${isEditing ? `${resource.id_recurso}/` : ''}`,
        {
          method: isEditing ? 'PATCH' : 'POST',
          body: JSON.stringify(payload),
        },
      );
      setDirty(false);
      onSaved?.(saved);
      onClose();
    } catch (saveError) {
      setError(saveError.message || 'No se pudo guardar el recurso.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={requestClose}
      eyebrow={isEditing ? 'Editar recurso' : 'Nuevo recurso'}
      title={form.nombre || (isEditing ? 'Editar recurso' : 'Nuevo recurso')}
      description={isSystem
        ? 'Recurso del sistema: la clave, el tipo y el estado están protegidos para no romper la caché de permisos.'
        : 'Los recursos personalizados amplían el catálogo RBAC. Una clave no puede repetirse.'}
      size="md"
      footer={(
        <>
          <button type="button" className="rbac-btn rbac-btn-ghost" onClick={requestClose} disabled={saving}>Cancelar</button>
          <button type="submit" form="resource-form" className="rbac-btn rbac-btn-gold" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar Cambios'}
          </button>
        </>
      )}
    >
      {error ? <div className="rbac-alert" role="alert">{error}</div> : null}

      <form id="resource-form" className="rbac-form" onSubmit={handleSave}>
        <div className="rbac-tab-panel">
          <div className="rbac-field-grid">
            <label className="rbac-field">
              <span>Clave técnica</span>
              <input
                value={form.clave}
                onChange={(event) => update({ clave: event.target.value })}
                disabled={isSystem}
                placeholder="ej. reportes_avanzados"
                maxLength={50}
                autoComplete="off"
              />
              {isSystem ? <small>Los recursos del sistema conservan su clave.</small> : null}
            </label>
            <label className="rbac-field">
              <span>Nombre visible</span>
              <input
                value={form.nombre}
                onChange={(event) => update({ nombre: event.target.value })}
                maxLength={100}
                required
              />
            </label>
            <label className="rbac-field">
              <span>Grupo</span>
              <input
                value={form.grupo}
                onChange={(event) => update({ grupo: event.target.value })}
                placeholder="General, Operación, Administración…"
                maxLength={50}
              />
            </label>
            <label className="rbac-field">
              <span>Tipo</span>
              <select
                value={form.tipo}
                onChange={(event) => update({ tipo: event.target.value })}
                disabled={isSystem}
              >
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="rbac-field">
              <span>Orden</span>
              <input
                type="number"
                value={form.orden}
                onChange={(event) => update({ orden: event.target.value })}
                min="0"
                step="1"
                placeholder="Automático"
              />
            </label>
            <label className="rbac-field">
              <span>Estado</span>
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(form.estado)}
                className={`rbac-switch ${form.estado ? 'is-on' : ''}`}
                disabled={isSystem}
                onClick={() => update({ estado: !form.estado })}
              >
                <span />
              </button>
              {isSystem
                ? <small>Los recursos del sistema no se pueden desactivar.</small>
                : <small>Los recursos inactivos no se asignan a nuevos roles.</small>}
            </label>
          </div>

          <label className="rbac-field">
            <span>Descripción</span>
            <input
              value={form.descripcion}
              onChange={(event) => update({ descripcion: event.target.value })}
              maxLength={200}
              placeholder="Describe qué habilita este recurso."
            />
          </label>

          {isEditing ? (
            <div className="rbac-subcard">
              <div className="rbac-subcard-title">
                <strong>Impacto del recurso</strong>
                <small>
                  {isSystem ? 'Protegido por el sistema' : 'Personalizado'} · {resource?.roles_count || 0} rol(es) lo tienen asignado.
                  {isSystem ? ' Si cambias la clave de un recurso del sistema no está permitido; para personalizados se recalcula la caché de los roles.' : ''}
                </small>
              </div>
              <div className="rbac-pill-list">
                <span className="rbac-pill">ID {resource?.id_recurso}</span>
                <span className="rbac-pill">{isSystem ? 'No eliminable' : 'Eliminable si no tiene roles'}</span>
                <span className="rbac-pill">{form.tipo === 'accion' ? 'Política de escritura' : 'Módulo de navegación'}</span>
              </div>
            </div>
          ) : (
            <div className="rbac-alert rbac-alert-info">
              El recurso se creará sin asignaciones. Luego podrás activarlo en los roles desde “Roles y permisos”.
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
}
