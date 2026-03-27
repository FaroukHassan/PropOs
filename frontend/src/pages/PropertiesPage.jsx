// frontend/src/pages/PropertiesPage.jsx
import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { api, fmt } from '../utils/api';
import { Modal, EmptyState, Spinner, FormGroup } from '../components/UI';

const TYPE_ICONS = { RESIDENTIAL:'🏠', COMMERCIAL:'🏢', SHORT_TERM:'🏖' };

function PropertyCard({ property, onRefresh }) {
  const occ = property.totalUnits > 0 ? (property.occupiedUnits / property.totalUnits) * 100 : 0;
  return (
    <div className="card" style={{ padding:0, overflow:'hidden' }}>
      <div style={{ height:80, background:`linear-gradient(135deg, var(--blue-bg), var(--bg-3))`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:32 }}>
        {TYPE_ICONS[property.type] || '🏢'}
      </div>
      <div style={{ padding:'14px 16px' }}>
        <div style={{ fontWeight:600, fontSize:14, marginBottom:2 }}>{property.name}</div>
        <div style={{ fontSize:12, color:'var(--text-2)', marginBottom:12 }}>{property.address}, {property.city}</div>

        {/* Occupancy bar */}
        <div style={{ marginBottom:10 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-3)', marginBottom:3 }}>
            <span>Occupancy</span><span>{property.occupiedUnits}/{property.totalUnits} units</span>
          </div>
          <div style={{ height:4, background:'var(--bg-3)', borderRadius:2 }}>
            <div style={{ height:'100%', background:'var(--blue)', borderRadius:2, width:`${occ}%`, transition:'width 0.4s' }}/>
          </div>
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
          <span style={{ color:'var(--text-2)' }}>Monthly revenue</span>
          <span style={{ fontWeight:600 }}>{fmt.currency(property.monthlyRevenue)}</span>
        </div>
      </div>
    </div>
  );
}

export default function PropertiesPage() {
  const { data, loading, refetch } = useFetch('/properties');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]       = useState({ name:'', address:'', city:'', type:'RESIDENTIAL' });
  const [busy, setBusy]       = useState(false);

  const handleAdd = async e => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/properties', form);
      refetch();
      setShowAdd(false);
      setForm({ name:'', address:'', city:'', type:'RESIDENTIAL' });
    } finally { setBusy(false); }
  };

  if (loading) return <Spinner />;

  return (
    <>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div className="section-title" style={{ margin:0 }}>Properties <span style={{ fontSize:14, fontWeight:400, color:'var(--text-3)' }}>({(data||[]).length})</span></div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Property</button>
      </div>

      {(data||[]).length === 0
        ? <EmptyState icon="🏢" title="No properties yet" message="Add your first property to get started." action={<button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Property</button>} />
        : <div className="grid-3">
            {data.map(p => <PropertyCard key={p.id} property={p} onRefresh={refetch} />)}
          </div>
      }

      {showAdd && (
        <Modal title="Add Property" onClose={() => setShowAdd(false)}
          footer={<><button className="btn" onClick={() => setShowAdd(false)}>Cancel</button><button className="btn btn-primary" form="add-prop-form" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Add Property'}</button></>}
        >
          <form id="add-prop-form" onSubmit={handleAdd}>
            <FormGroup label="Property name">
              <input className="form-input" value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))} required placeholder="Nile Tower A" />
            </FormGroup>
            <FormGroup label="Address">
              <input className="form-input" value={form.address} onChange={e => setForm(p=>({...p,address:e.target.value}))} required placeholder="12 Tahrir Street" />
            </FormGroup>
            <FormGroup label="City">
              <input className="form-input" value={form.city} onChange={e => setForm(p=>({...p,city:e.target.value}))} required placeholder="Cairo" />
            </FormGroup>
            <FormGroup label="Type">
              <select className="form-input" value={form.type} onChange={e => setForm(p=>({...p,type:e.target.value}))}>
                <option value="RESIDENTIAL">Residential</option>
                <option value="COMMERCIAL">Commercial</option>
                <option value="SHORT_TERM">Short-term rental</option>
              </select>
            </FormGroup>
          </form>
        </Modal>
      )}
    </>
  );
}
