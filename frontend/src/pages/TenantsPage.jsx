// frontend/src/pages/TenantsPage.jsx
import { useState } from 'react';
import { useApi } from '../lib/hooks';
import { api, qs } from '../lib/api';
import { useAuth } from '../lib/auth';
import { money, date, L } from '../lib/format';
import { tenantFields } from '../lib/forms';
import { Spinner, ErrorBox, Empty, FormModal, Badge, Drawer, useToast } from '../components/ui';

export default function TenantsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [show, setShow] = useState('current');
  const { data, loading, error, refetch } = useApi(`/tenants${qs({ q })}`);
  const [modal, setModal] = useState(null);
  const [open, setOpen] = useState(null);

  if (error) return <ErrorBox error={error} retry={refetch} />;
  const rows = (data || []).filter(t => show === 'all' || t.leases.some(l => l.status !== 'ENDED'));
  const where = t => {
    const l = t.leases.find(x => x.status !== 'ENDED') || t.leases[0];
    return l ? `${l.unit.building.name} ${l.unit.number}${l.space ? ` · ${l.space.code}` : ''}` : '—';
  };

  return (
    <>
      <div className="toolbar">
        <input className="input" style={{ maxWidth: 280 }} placeholder="Search name, phone or email" value={q} onChange={e => setQ(e.target.value)} />
        <select className="input input-sm" value={show} onChange={e => setShow(e.target.value)}>
          <option value="current">Living with us now</option><option value="all">Everyone (incl. past)</option>
        </select>
        <div className="grow" />
        {can.write && <button className="btn btn-primary" onClick={() => setModal({})}>+ Tenant</button>}
      </div>
      {loading && !data ? <Spinner /> : rows.length === 0 ? (
        <Empty icon="☺" title={q ? 'No match' : 'No tenants yet'}>Tenants are added when you move someone into a partition on the Partitions board.</Empty>
      ) : (
        <div className="card card-flush">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Name</th><th>Phone</th><th>Lives in</th><th className="num">Rent</th><th>Since</th><th>Status</th></tr></thead>
              <tbody>
                {rows.map(t => {
                  const l = t.leases.find(x => x.status !== 'ENDED') || t.leases[0];
                  return (
                    <tr key={t.id} className="clickable" onClick={() => setOpen(t)}>
                      <td className="bold">{t.name}{t.nationality && <div className="tiny faint">{t.nationality}</div>}</td>
                      <td className="small">{t.phone || '—'}</td>
                      <td className="small">{where(t)}</td>
                      <td className="num">{l ? money(l.rent) : '—'}</td>
                      <td className="small">{l ? date(l.startDate) : '—'}</td>
                      <td>{l ? <Badge value={l.status} map={L.leaseStatus} /> : <Badge>No tenancy</Badge>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {open && (
        <Drawer title={open.name} subtitle={open.phone} onClose={() => setOpen(null)}
          actions={can.write && <button className="btn btn-sm" onClick={() => setModal({ tenant: open })}>Edit</button>}>
          <dl className="kv">
            {open.phone && <><dt>WhatsApp</dt><dd><a href={`https://wa.me/${open.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">{open.phone}</a></dd></>}
            {open.email && <><dt>Email</dt><dd>{open.email}</dd></>}
            {open.nationality && <><dt>Nationality</dt><dd>{open.nationality}</dd></>}
            {open.idNumber && <><dt>ID no.</dt><dd>{open.idNumber}</dd></>}
            {open.notes && <><dt>Notes</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{open.notes}</dd></>}
          </dl>
          <div className="section-title">Tenancies</div>
          {open.leases.length === 0 && <p className="small muted">None.</p>}
          {open.leases.map(l => (
            <div key={l.id} className="list-item">
              <div><div className="bold">{l.unit.building.name} {l.unit.number}{l.space ? ` · ${l.space.code}` : ''}</div>
                <div className="tiny faint">{date(l.startDate)} → {l.endDate ? date(l.endDate) : 'ongoing'} · deposit {money(l.depositPaid)}</div></div>
              <div className="right"><div className="num">{money(l.rent)}</div><Badge value={l.status} map={L.leaseStatus} /></div>
            </div>
          ))}
        </Drawer>
      )}

      {modal && (
        <FormModal title={modal.tenant ? 'Edit tenant' : 'New tenant'} fields={tenantFields} initial={modal.tenant} onClose={() => setModal(null)}
          onDelete={modal.tenant && modal.tenant.leases.length === 0 ? async () => { await api.del(`/tenants/${modal.tenant.id}`); toast('Deleted'); setModal(null); setOpen(null); refetch(); } : undefined}
          onSubmit={async v => {
            if (modal.tenant) await api.patch(`/tenants/${modal.tenant.id}`, v); else await api.post('/tenants', v);
            toast('Saved'); setModal(null); setOpen(null); refetch();
          }} />
      )}
    </>
  );
}
