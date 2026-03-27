// frontend/src/components/UI.jsx
import { STATUS_BADGE, PRIORITY_BADGE, fmt } from '../utils/api';

export function Badge({ status, priority, label }) {
  const cls = priority
    ? PRIORITY_BADGE[priority] || 'badge-neutral'
    : STATUS_BADGE[status]    || 'badge-neutral';
  return <span className={`badge ${cls}`}>{label || status || priority}</span>;
}

export function Avatar({ name, size = 32 }) {
  return (
    <div
      className={`avatar ${fmt.avatarColor(name)}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {fmt.initials(name)}
    </div>
  );
}

export function Modal({ title, onClose, children, footer }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 className="modal-title" style={{ margin: 0 }}>{title}</h2>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>
        {children}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon = '📭', title, message, action }) {
  return (
    <div className="empty-state">
      <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
      <h3>{title}</h3>
      {message && <p style={{ fontSize: 13, marginTop: 4 }}>{message}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

export function Spinner() {
  return <div className="loading">Loading…</div>;
}

export function FormGroup({ label, children }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}
