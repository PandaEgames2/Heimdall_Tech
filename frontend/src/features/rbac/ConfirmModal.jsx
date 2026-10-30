import Modal from '../../components/Modal';

export default function ConfirmModal({
  open,
  title,
  eyebrow = 'Confirmación',
  description,
  details = null,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  loading = false,
  onConfirm,
  onClose,
}) {
  return (
    <Modal
      open={open}
      onClose={loading ? () => {} : onClose}
      eyebrow={eyebrow}
      title={title}
      description={description}
      size="sm"
      footer={(
        <>
          <button type="button" className="rbac-btn rbac-btn-ghost" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`rbac-btn ${tone === 'gold' ? 'rbac-btn-gold' : 'rbac-btn-danger'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Procesando…' : confirmLabel}
          </button>
        </>
      )}
    >
      <div className={`rbac-confirm rbac-confirm-${tone}`}>
        <span className="rbac-confirm-icon" aria-hidden="true">{tone === 'gold' ? '⚑' : '!'}</span>
        <div>
          {details ? <div className="rbac-confirm-details">{details}</div> : null}
          <p className="rbac-confirm-note">Esta acción queda registrada y se valida nuevamente en el backend.</p>
        </div>
      </div>
    </Modal>
  );
}
