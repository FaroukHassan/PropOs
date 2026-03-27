// frontend/src/pages/MaintenancePage.jsx
import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { api, fmt } from '../utils/api';
import { Badge, Modal, EmptyState, Spinner, FormGroup } from '../components/UI';

const ICONS = { PLUMBING:'🚿', ELECTRICAL:'💡', HVAC:'🔥', APPLIANCE:'🔧', GENERAL:'🔒', STRUCTURAL:'🏗' };

export default function MaintenancePage() {
  const { data, loading, refetch } = useFetch('/maintenance');
  const { data: props }            = useFetch('/properties');
  const [showAdd, setShowAdd]      = useState(false);
  const [filter, setFilter]        = useState('OPEN');
  const [form, setForm]            = useState({ unitId:'', title:'', description:'', category:'GENERAL', priority:'NORMAL' });
  const [busy, setBusy]            = useState(false);

  const allUnits = (props||[]).flatMap(p => (p.units||[]).map(u => ({ ...u, propertyName: p.name })));

  const filtered = (data||[]).filter(m => filter === 'ALL' || m.status === filter);

  const handleAdd = async e => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/maintenance', form);
      refetch();
      setShowAdd(false);
      setForm({ unitId:'', title:'', description:'', category:'GENERAL', priority:'NORMAL' });
    } finally { setBusy(false); }
  };

  const updateStatus = async (id, status) => {
    await api.patch(`/maintenance/${id}`, { status });
    refetch();
  };

  if (loading) return <Spinner />;

  return (
    <>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div className="section-title" style={{ margin:0 }}>Maintenance Requests</div>
        <div style={{ display:'flex', gap:8 }}>
          <select className="form-input" style={{ width:150 }} value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="ALL">All</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Resolved</option>
          </select>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ New Request</button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {['OPEN','IN_PROGRESS','RESOLVED','URGENT'].map(s => {
          const count = (data||[]).filter(m => s === 'URGENT' ? m.priority === 'URGENT' && m.status !== 'RESOLVED' : m.status === s).length;
          return (
            <div key={s} className="metric-card" style={{ cursor:'pointer' }} onClick={() => setFilter(s === 'URGENT' ? 'OPEN' : s)}>
              <div className="metric-label">{s.replace('_',' ')}</div>
              <div className="metric-value" style={{ fontSize:28, color: s==='URGENT' ? 'var(--red)' : s==='RESOLVED' ? 'var(--green)' : 'inherit' }}>{count}</div>
            </div>
          );
        })}
      </div>

      <div className="card">
        {filtered.length === 0
          ? <EmptyState icon="🔧" title="No requests" message={filter === 'OPEN' ? 'No open requests. All clear!' : 'No requests in this category.'} />
          : <div className="table-wrap">
              <table>
                <thead><tr><th>Issue</th><th>Unit / Property</th><th>Category</th><th>Reported</th><th>Priority</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {filtered.map(m => (
                    <tr key={m.id}>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{ fontSize:16 }}>{ICONS[m.category] || '🔧'}</span>
                          <div>
                            <div style={{ fontWeight:500 }}>{m.title}</div>
                            {m.description && <div style={{ fontSize:11, color:'var(--text-3)', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.description}</div>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div>Unit {m.unit?.number}</div>
                        <div style={{ fontSize:11, color:'var(--text-3)' }}>{m.unit?.property?.name}</div>
                      </td>
                      <td style={{ color:'var(--text-2)', fontSize:12 }}>{m.category}</td>
                      <td style={{ color:'var(--text-2)' }}>{fmt.dateShort(m.createdAt)}</td>
                      <td><Badge priority={m.priority} /></td>
                      <td><Badge status={m.status} /></td>
                      <td>
                        <div style={{ display:'flex', gap:4' }}>
                          {m.status === 'OPEN'        && <button className="btn btn-sm" onClick={() => updateStatus(m.id, 'IN_PROGRESS')}>Start</button>}
                          {m.status === 'IN_PROGRESS' && <button className="btn btn-sm" style={{ color:'var(--green)' }} onClick={() => updateStatus(m.id, 'RESOLVED')}>Resolve</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </div>

      {showAdd && (
        <Modal title="New Maintenance Request" onClose={() => setShowAdd(false)}
          footer={<><button className="btn" onClick={() => setShowAdd(false)}>Cancel</button><button className="btn btn-primary" form="add-maint-form" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Submit Request'}</button></>}
        >
          <form id="add-maint-form" onSubmit={handleAdd}>
            <FormGroup label="Unit">
              <select className="form-input" value={form.unitId} onChange={e => setForm(p=>({...p,unitId:e.target.value}))} required>
                <option value="">Select unit…</option>
                {allUnits.map(u => <option key={u.id} value={u.id}>{u.propertyName} — Unit {u.number}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Issue title">
              <input className="form-input" value={form.title} onChange={e => setForm(p=>({...p,title:e.target.value}))} required placeholder="Leaking faucet in bathroom" />
            </FormGroup>
            <FormGroup label="Description">
              <textarea className="form-input" value={form.description} onChange={e => setForm(p=>({...p,description:e.target.value}))} rows={3} placeholder="Additional details…" style={{ resize:'vertical' }} />
            </FormGroup>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <FormGroup label="Category">
                <select className="form-input" value={form.category} onChange={e => setForm(p=>({...p,category:e.target.value}))}>
                  {['PLUMBING','ELECTRICAL','HVAC','APPLIANCE','STRUCTURAL','GENERAL'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </FormGroup>
              <FormGroup label="Priority">
                <select className="form-input" value={form.priority} onChange={e => setForm(p=>({...p,priority:e.target.value}))}>
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </FormGroup>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
