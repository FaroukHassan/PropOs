// frontend/src/pages/LeasesPage.jsx
import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { api, fmt } from '../utils/api';
import { Badge, Modal, EmptyState, Spinner, FormGroup } from '../components/UI';

function daysUntil(date) {
  const diff = new Date(date) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function LeasesPage() {
  const { data, loading, refetch } = useFetch('/leases');
  const { data: tenants } = useFetch('/tenants');
  const { data: props   } = useFetch('/properties');

  const [showAdd, setShowAdd]   = useState(false);
  const [filter,  setFilter]    = useState('ALL');
  const [form, setForm]         = useState({ tenantId:'', unitId:'', startDate:'', endDate:'', rentAmount:'', deposit:'' });
  const [busy, setBusy]         = useState(false);

  // Flat list of all units from all properties
  const allUnits = (props||[]).flatMap(p => (p.units||[]).map(u => ({ ...u, propertyName: p.name })));

  const filtered = (data||[]).filter(l => filter === 'ALL' || l.status === filter);

  const handleAdd = async e => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/leases', { ...form, rentAmount: parseFloat(form.rentAmount), deposit: parseFloat(form.deposit) });
      refetch();
      setShowAdd(false);
    } finally { setBusy(false); }
  };

  const handleTerminate = async (id) => {
    if (!confirm('Terminate this lease? This will cancel future payments.')) return;
    await api.post(`/leases/${id}/terminate`);
    refetch();
  };

  if (loading) return <Spinner />;

  return (
    <>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div className="section-title" style={{ margin:0 }}>Leases <span style={{ fontSize:14, fontWeight:400, color:'var(--text-3)' }}>({(data||[]).length})</span></div>
        <div style={{ display:'flex', gap:8 }}>
          <select className="form-input" style={{ width:140 }} value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="EXPIRED">Expired</option>
            <option value="TERMINATED">Terminated</option>
          </select>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ New Lease</button>
        </div>
      </div>

      <div className="card">
        {filtered.length === 0
          ? <EmptyState icon="📄" title="No leases found" message="Create your first lease agreement." />
          : <div className="table-wrap">
              <table>
                <thead><tr><th>Tenant</th><th>Property / Unit</th><th>Start</th><th>End</th><th>Rent/mo</th><th>Expires in</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {filtered.map(l => {
                    const days = daysUntil(l.endDate);
                    return (
                      <tr key={l.id}>
                        <td style={{ fontWeight:500 }}>{l.tenant?.name}</td>
                        <td>
                          <div>{l.unit?.property?.name}</div>
                          <div style={{ fontSize:11, color:'var(--text-3)' }}>Unit {l.unit?.number}</div>
                        </td>
                        <td style={{ color:'var(--text-2)' }}>{fmt.date(l.startDate)}</td>
                        <td style={{ color:'var(--text-2)' }}>{fmt.date(l.endDate)}</td>
                        <td style={{ fontWeight:500 }}>{fmt.currency(l.rentAmount)}</td>
                        <td>
                          {l.status === 'ACTIVE'
                            ? <span style={{ fontSize:12, color: days <= 30 ? 'var(--red)' : days <= 90 ? 'var(--amber)' : 'var(--text-2)' }}>
                                {days > 0 ? `${days}d` : 'Expired'}
                              </span>
                            : <span style={{ color:'var(--text-3)' }}>—</span>
                          }
                        </td>
                        <td><Badge status={l.status} /></td>
                        <td>
                          {l.status === 'ACTIVE' && (
                            <button className="btn btn-sm btn-danger" onClick={() => handleTerminate(l.id)}>Terminate</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
        }
      </div>

      {showAdd && (
        <Modal title="New Lease Agreement" onClose={() => setShowAdd(false)}
          footer={<><button className="btn" onClick={() => setShowAdd(false)}>Cancel</button><button className="btn btn-primary" form="add-lease-form" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Create Lease'}</button></>}
        >
          <form id="add-lease-form" onSubmit={handleAdd}>
            <FormGroup label="Tenant">
              <select className="form-input" value={form.tenantId} onChange={e => setForm(p=>({...p,tenantId:e.target.value}))} required>
                <option value="">Select tenant…</option>
                {(tenants||[]).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Unit">
              <select className="form-input" value={form.unitId} onChange={e => setForm(p=>({...p,unitId:e.target.value}))} required>
                <option value="">Select unit…</option>
                {allUnits.map(u => <option key={u.id} value={u.id}>{u.propertyName} — Unit {u.number} ({fmt.currency(u.rentAmount)}/mo)</option>)}
              </select>
            </FormGroup>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <FormGroup label="Start date"><input className="form-input" type="date" value={form.startDate} onChange={e => setForm(p=>({...p,startDate:e.target.value}))} required /></FormGroup>
              <FormGroup label="End date"><input className="form-input" type="date" value={form.endDate} onChange={e => setForm(p=>({...p,endDate:e.target.value}))} required /></FormGroup>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <FormGroup label="Monthly rent ($)"><input className="form-input" type="number" value={form.rentAmount} onChange={e => setForm(p=>({...p,rentAmount:e.target.value}))} required min="0" placeholder="1500" /></FormGroup>
              <FormGroup label="Security deposit ($)"><input className="form-input" type="number" value={form.deposit} onChange={e => setForm(p=>({...p,deposit:e.target.value}))} required min="0" placeholder="3000" /></FormGroup>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
