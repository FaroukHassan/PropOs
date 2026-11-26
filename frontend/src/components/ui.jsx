// frontend/src/components/ui.jsx — shared building blocks
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { L, TONE, monthLabel, shiftMonth } from '../lib/format';

// ─── Toasts ──────────────────────────────────────────────────────────────────
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((msg, kind = 'ok') => {
    const id = Math.random();
    setItems(x => [...x, { id, msg, kind }]);
    setTimeout(() => setItems(x => x.filter(i => i.id !== id)), kind === 'error' ? 6000 : 3000);
  }, []);
  useEffect(() => {
    if (!import.meta.env.VITE_DEMO) return;
    const h = e => { if (e.reason?.name === 'Error' || e.reason instanceof Error) { push(e.reason.message, 'error'); e.preventDefault(); } };
    window.addEventListener('unhandledrejection', h);
    return () => window.removeEventListener('unhandledrejection', h);
  }, [push]);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts">{items.map(t => <div key={t.id} className={`toast ${t.kind}`}>{t.msg}</div>)}</div>
    </ToastCtx.Provider>
  );
}

// ─── Badges ──────────────────────────────────────────────────────────────────
export function Badge({ value, map, tone, children }) {
  const t = tone ?? TONE[value] ?? '';
  return <span className={`badge ${t ? `b-${t}` : ''}`}>{children ?? (map ? map[value] : value) ?? value}</span>;
}

// ─── Modal & drawer ──────────────────────────────────────────────────────────
function useEscape(onClose) {
  useEffect(() => {
    const h = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEscape(onClose);
  return (
    <div className="overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-label={title}>
        <div className="modal-head"><h2>{title}</h2><button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">✕</button></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ title, subtitle, onClose, children, actions }) {
  useEscape(onClose);
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer">
        <div className="drawer-head">
          <div><div className="page-title">{title}</div>{subtitle && <div className="small muted">{subtitle}</div>}</div>
          <div className="row">{actions}<button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">✕</button></div>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </>
  );
}

// ─── Form built from a field list ────────────────────────────────────────────
// fields: [{ name, label, type: text|number|date|select|textarea|checkbox, options, required, hint, full, show(values) }]
export function FormModal({ title, fields, initial = {}, onSubmit, onClose, submitLabel = 'Save', onDelete, wide, intro }) {
  const [values, setValues] = useState(() => {
    const v = {};
    for (const f of fields) v[f.name] = initial[f.name] ?? f.default ?? (f.type === 'checkbox' ? false : '');
    return v;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (name, value) => setValues(v => {
    const next = { ...v, [name]: value };
    const f = fields.find(x => x.name === name);
    return f?.onChange ? { ...next, ...f.onChange(value, next) } : next;
  });

  const submit = async e => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const out = {};
      for (const f of fields) {
        if (f.show && !f.show(values)) continue;
        let v = values[f.name];
        if (f.type === 'number') v = v === '' ? null : Number(v);
        if ((f.type === 'select' || f.type === 'date' || f.type === 'text' || f.type === 'textarea') && v === '') v = null;
        out[f.name] = v;
      }
      await onSubmit(out);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose} wide={wide}
      footer={<>
        {onDelete && <button type="button" className="btn btn-danger" style={{ marginRight: 'auto' }} disabled={busy}
          onClick={async () => { if (!confirm('Delete this permanently?')) return; setBusy(true); try { await onDelete(); } catch (e) { setError(e.message); setBusy(false); } }}>Delete</button>}
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button type="submit" form="form-modal" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
      </>}>
      {intro}
      {error && <div className="alert alert-error">{error}</div>}
      <form id="form-modal" onSubmit={submit} className="field-grid">
        {fields.map(f => (f.show && !f.show(values)) ? null : (
          <div key={f.name} className={`field ${f.full || f.type === 'textarea' ? 'full' : ''}`}>
            {f.type === 'checkbox'
              ? <label className="check"><input type="checkbox" checked={!!values[f.name]} onChange={e => set(f.name, e.target.checked)} /> {f.label}</label>
              : <label htmlFor={`f-${f.name}`}>{f.label}{f.required && ' *'}</label>}
            {f.type === 'select' ? (
              <select id={`f-${f.name}`} className="input" value={values[f.name] ?? ''} required={f.required} onChange={e => set(f.name, e.target.value)}>
                {!f.required || f.placeholder ? <option value="">{f.placeholder || '—'}</option> : null}
                {(typeof f.options === 'function' ? f.options(values) : f.options).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea id={`f-${f.name}`} className="input" value={values[f.name] ?? ''} onChange={e => set(f.name, e.target.value)} />
            ) : f.type === 'checkbox' ? null : (
              <input id={`f-${f.name}`} className="input" type={f.type || 'text'} step={f.type === 'number' ? 'any' : undefined}
                value={values[f.name] ?? ''} required={f.required} placeholder={f.placeholder} onChange={e => set(f.name, e.target.value)} />
            )}
            {f.hint && <div className="hint">{typeof f.hint === 'function' ? f.hint(values) : f.hint}</div>}
          </div>
        ))}
      </form>
    </Modal>
  );
}

// ─── Small pieces ────────────────────────────────────────────────────────────
export const Spinner = () => <div className="loading">Loading…</div>;
export const ErrorBox = ({ error, retry }) => (
  <div className="alert alert-error row-between"><span>{error}</span>{retry && <button className="btn btn-sm" onClick={retry}>Try again</button>}</div>
);
export function Empty({ icon = '📭', title, children, action }) {
  return <div className="empty"><div className="icon">{icon}</div><h3>{title}</h3>{children && <p className="small">{children}</p>}{action && <div style={{ marginTop: 14 }}>{action}</div>}</div>;
}
export function Stat({ label, value, sub, progress, accent }) {
  return (
    <div className={`stat ${accent ? 'accent' : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
      {progress !== undefined && <div className="bar"><div style={{ width: `${Math.max(0, Math.min(100, progress * 100))}%` }} /></div>}
    </div>
  );
}
export function MonthPicker({ value, onChange }) {
  return (
    <div className="month-picker">
      <button className="btn btn-sm btn-icon" onClick={() => onChange(shiftMonth(value, -1))} aria-label="Previous month">‹</button>
      <span className="label">{monthLabel(value)}</span>
      <button className="btn btn-sm btn-icon" onClick={() => onChange(shiftMonth(value, 1))} aria-label="Next month">›</button>
    </div>
  );
}
export function Tabs({ value, onChange, items }) {
  return (
    <div className="tabs" role="tablist">
      {items.map(([v, label]) => <button key={v} role="tab" aria-selected={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{label}</button>)}
    </div>
  );
}
export const Field = ({ label, children }) => <div className="field"><label>{label}</label>{children}</div>;
export { L };
