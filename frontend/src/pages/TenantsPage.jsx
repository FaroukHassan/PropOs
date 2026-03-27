// frontend/src/pages/TenantsPage.jsx
import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { api, fmt } from '../utils/api';
import { Badge, Avatar, Modal, EmptyState, Spinner, FormGroup } from '../components/UI';

export default function TenantsPage() {
  const { data, loading, refetch } = useFetch('/tenants');
  const [showAdd, setShowAdd]  = useState(false);
  const [search,  setSearch]   = useState('');
  const [form, setForm]        = useState({ name:'', email:'', phone:'', idNumber:'' });
  const [busy, setBusy]        = useState(false);

  const filtered = (data || []).filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async e => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/tenants', form);
      refetch();
      setShowAdd(false);
      setForm({ name:'', email:'', phone:'', idNumber:'' });
    } finally { setBusy(false); }
  };

  if (loading) return <Spinner />;

  const activeLease = (tenant) => tenant.leases?.[0];

  return (
    <>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div className="section-title" style={{ margin:0 }}>Tenants <span style={{ fontSize:14, fontWeight:400, color:'var(--text-3)' }}>({(data||[]).length})</span></div>
        <div style={{ display:'flex', gap:8 }}>
          <input className="form-input" style={{ width:220 }} placeholder="Search tenants…" value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Tenant</button>
        </div>
      </div>

      <div className="card">
        {filtered.length === 0
          ? <EmptyState icon="👤" title="No tenants found" message={search ? 'Try a different search.' : 'Add your first tenant.'} />
          : <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tenant</th>
                    <th>Contact</th>
                    <th>Current Unit</th>
                    <th>Rent/mo</th>
                    <th>Lease Ends</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => {
                    const lease = activeLease(t);
                    return (
                      <tr key={t.id}>
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                            <Avatar name={t.name} size={30} />
                            <div>
                              <div style={{ fontWeight:500 }}>{t.name}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize:13 }}>{t.email}</div>
                          {t.phone && <div style={{ fontSize:11, color:'var(--text-3)' }}>{t.phone}</div>}
                        </td>
                        <td>
                          {lease ? (
                            <div>
                              <div>Unit {lease.unit?.number}</div>
                              <div style={{ fontSize:11, color:'var(--text-3)' }}>{lease.unit?.property?.name}</div>
                            </div>
                          ) : <span style={{ color:'var(--text-3)' }}>—</span>}
                        </td>
                        <td style={{ fontWeight:500 }}>{lease ? fmt.currency(lease.rentAmount) : '—'}</td>
                        <td style={{ color:'var(--text-2)' }}>{lease ? fmt.date(lease.endDate) : '—'}</td>
                        <td>
                          {lease
                            ? <Badge status={lease.status} />
                            : <Badge status="EXPIRED" />}
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
        <Modal title="Add Tenant" onClose={() => setShowAdd(false)}
          footer={<><button className="btn" onClick={() => setShowAdd(false)}>Cancel</button><button className="btn btn-primary" form="add-tenant-form" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Add Tenant'}</button></>}
        >
          <form id="add-tenant-form" onSubmit={handleAdd}>
            <FormGroup label="Full name">
              <input className="form-input" value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))} required placeholder="Sarah Johnson" />
            </FormGroup>
            <FormGroup label="Email">
              <input className="form-input" type="email" value={form.email} onChange={e => setForm(p=>({...p,email:e.target.value}))} required placeholder="sarah@email.com" />
            </FormGroup>
            <FormGroup label="Phone">
              <input className="form-input" value={form.phone} onChange={e => setForm(p=>({...p,phone:e.target.value}))} placeholder="+1 555 0100" />
            </FormGroup>
            <FormGroup label="ID / Passport number">
              <input className="form-input" value={form.idNumber} onChange={e => setForm(p=>({...p,idNumber:e.target.value}))} placeholder="Optional" />
            </FormGroup>
          </form>
        </Modal>
      )}
    </>
  );
}
