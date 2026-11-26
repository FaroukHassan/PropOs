// frontend/src/pages/UnitDetailPage.jsx — one apartment: spaces, tenancies, money, cheques
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useApi, useSticky } from '../lib/hooks';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { money, date, L, monthKey, isoDay } from '../lib/format';
import { unitFields, spaceFields, leaseFields } from '../lib/forms';
import { Spinner, ErrorBox, FormModal, Badge, Stat, MonthPicker, useToast } from '../components/ui';

export default function UnitDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const { data: u, loading, error, refetch } = useApi(`/units/${id}`);
  const buildings = useApi('/buildings');
  const landlords = useApi('/landlords');
  const tenants = useApi('/tenants');
  const [month, setMonth] = useSticky('unit_month', monthKey());
  const tx = useApi(`/transactions?unitId=${id}&month=${month}`);
  const [modal, setModal] = useState(null);

  if (error) return <ErrorBox error={error} retry={refetch} />;
  if (loading && !u) return <Spinner />;

  const income = (tx.data || []).filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
  const expenses = (tx.data || []).filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
  const activeLeases = u.leases.filter(l => l.status !== 'ENDED');
  const reload = () => { refetch(); tx.refetch(); };

  return (
    <div className="stack">
      <div className="row-between wrap">
        <div>
          <Link to="/units" className="small muted">← Apartments</Link>
          <h2 style={{ fontSize: 22, marginTop: 4 }}>{u.building.name} · {u.number}</h2>
          <div className="row wrap" style={{ marginTop: 6 }}>
            <Badge tone="sand">{L.mode[u.mode]}</Badge><Badge>{L.arrangement[u.arrangement]}</Badge><Badge tone={u.occupancy === 'LADIES' ? 'violet' : ''}>{L.occupancy[u.occupancy]}</Badge>
            {!u.active && <Badge tone="red">Inactive</Badge>}
          </div>
        </div>
        {can.write && <div className="row">
          {u.mode === 'PARTITIONS' && <button className="btn" onClick={() => setModal({ kind: 'space' })}>+ Partition / bed</button>}
          {u.mode === 'LONG_TERM' && activeLeases.length === 0 && <button className="btn" onClick={() => setModal({ kind: 'lease' })}>+ Tenant</button>}
          {u.mode === 'HOLIDAY' && <Link className="btn" to="/bookings">Bookings calendar</Link>}
          <button className="btn btn-primary" onClick={() => setModal({ kind: 'edit' })}>Edit apartment</button>
        </div>}
      </div>

      <div className="row-between"><div className="section-title" style={{ margin: 0 }}>Money</div><MonthPicker value={month} onChange={setMonth} /></div>
      <div className="grid g4">
        <Stat label="Income" value={money(income)} />
        <Stat label="Expenses" value={money(expenses)} />
        <Stat accent label="Net" value={money(income - expenses)} />
        <Stat label={u.arrangement === 'MANAGEMENT' ? `Owner share (after ${u.managementFee || 0}% fee)` : 'Landlord rent / month'}
          value={u.arrangement === 'MANAGEMENT' ? money(income - expenses - income * (u.managementFee || 0) / 100) : money((u.landlordRent || 0) / 12)}
          sub={u.landlord ? u.landlord.name : undefined} />
      </div>

      <div className="grid g-2-1">
        <div className="card card-flush">
          <div className="card-head"><div className="card-title">{u.mode === 'PARTITIONS' ? 'Partitions & beds' : 'Tenancies'}</div></div>
          <div className="table-wrap">
            {u.mode === 'PARTITIONS' ? (
              <table className="table">
                <thead><tr><th>Code</th><th>Status</th><th>Tenant</th><th className="num">Rent</th><th></th></tr></thead>
                <tbody>
                  {u.spaces.length === 0 && <tr><td colSpan={5} className="muted">No partitions yet.</td></tr>}
                  {[...u.spaces].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })).map(s => {
                    const l = s.leases[0];
                    return (
                      <tr key={s.id}>
                        <td><b>{s.code}</b> <span className="tiny faint">{L.spaceKind[s.kind]}</span></td>
                        <td><Badge value={s.status} map={L.spaceStatus} /></td>
                        <td>{l ? <>{l.tenant.name}<div className="tiny faint">since {date(l.startDate)}</div></> : <span className="faint">—</span>}</td>
                        <td className="num">{money(l ? l.rent : s.monthlyRate)}</td>
                        <td className="right">{can.write && <button className="btn btn-sm" onClick={() => setModal({ kind: 'editSpace', space: s })}>Edit</button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="table">
                <thead><tr><th>Tenant</th><th>From</th><th>To</th><th className="num">Rent</th><th>Status</th></tr></thead>
                <tbody>
                  {u.leases.length === 0 && <tr><td colSpan={5} className="muted">{u.mode === 'HOLIDAY' ? 'Holiday homes use bookings instead of tenancies.' : 'No tenancies yet.'}</td></tr>}
                  {u.leases.map(l => (
                    <tr key={l.id}><td>{l.tenant.name}</td><td>{date(l.startDate)}</td><td>{date(l.endDate)}</td><td className="num">{money(l.rent)} {l.rentPeriod === 'YEARLY' ? '/yr' : '/mo'}</td><td><Badge value={l.status} map={L.leaseStatus} /></td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 10 }}>Details</div>
          <dl className="kv">
            <dt>Landlord / owner</dt><dd>{u.landlord?.name || '—'}</dd>
            {u.landlordRent ? <><dt>Annual rent</dt><dd>{money(u.landlordRent)}</dd></> : null}
            {u.nightlyRate ? <><dt>Nightly rate</dt><dd>{money(u.nightlyRate)}</dd></> : null}
            {u.monthlyRent ? <><dt>Monthly rent</dt><dd>{money(u.monthlyRent)}</dd></> : null}
            <dt>Bedrooms</dt><dd>{u.bedrooms ?? '—'} · {u.bathrooms ?? '—'} bath</dd>
            <dt>DEWA account</dt><dd>{u.dewaAccount || '—'}</dd>
            {u.amenities && <><dt>Amenities</dt><dd>{u.amenities}</dd></>}
            {u.notes && <><dt>Notes</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{u.notes}</dd></>}
          </dl>
        </div>
      </div>

      <div className="grid g2">
        <div className="card card-flush">
          <div className="card-head"><div className="card-title">Income & expenses · {month}</div><Link to="/ledger" className="btn btn-sm">Ledger</Link></div>
          <div className="table-wrap">
            <table className="table">
              <tbody>
                {(tx.data || []).length === 0 && <tr><td className="muted">Nothing recorded this month.</td></tr>}
                {(tx.data || []).map(t => (
                  <tr key={t.id}><td className="small nowrap">{date(t.date)}</td><td>{t.description}<div className="tiny faint">{L.category[t.category]}{t.space ? ` · ${t.space.code}` : ''}</div></td>
                    <td className="num" style={{ color: t.type === 'INCOME' ? 'var(--green)' : 'var(--red)' }}>{t.type === 'INCOME' ? '+' : '−'}{money(t.amount).replace('AED ', '')}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card card-flush">
          <div className="card-head"><div className="card-title">Cheques</div><Link to="/cheques" className="btn btn-sm">All cheques</Link></div>
          <div className="table-wrap">
            <table className="table">
              <tbody>
                {u.cheques.length === 0 && <tr><td className="muted">No cheques for this apartment.</td></tr>}
                {u.cheques.map(c => (
                  <tr key={c.id}><td className="small nowrap">{date(c.status === 'POSTPONED' && c.postponedTo ? c.postponedTo : c.dueDate)}</td><td>{c.direction === 'OUT' ? 'Issued' : 'Received'} #{c.number}<div className="tiny faint">{c.partyName || c.bank}</div></td>
                    <td className="num">{money(c.amount)}</td><td><Badge value={c.status} map={L.chequeStatus} /></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modal?.kind === 'edit' && (
        <FormModal title="Edit apartment" wide fields={unitFields(buildings.data, landlords.data)} initial={u} onClose={() => setModal(null)}
          onDelete={async () => { await api.del(`/units/${u.id}`); toast('Apartment deleted'); nav('/units'); }}
          onSubmit={async v => { await api.patch(`/units/${u.id}`, v); toast('Saved'); setModal(null); reload(); }} />
      )}
      {modal?.kind === 'space' && (
        <FormModal title="Add partition / bed" fields={spaceFields} onClose={() => setModal(null)}
          onSubmit={async v => { await api.post('/spaces', { ...v, unitId: u.id }); toast('Added'); setModal(null); reload(); }} />
      )}
      {modal?.kind === 'editSpace' && (
        <FormModal title={`Edit ${modal.space.code}`} fields={spaceFields} initial={{ ...modal.space, availableFrom: isoDay(modal.space.availableFrom) }} onClose={() => setModal(null)}
          onDelete={modal.space.leases[0] ? undefined : async () => { await api.del(`/spaces/${modal.space.id}`); toast('Removed'); setModal(null); reload(); }}
          onSubmit={async v => { await api.patch(`/spaces/${modal.space.id}`, v); toast('Saved'); setModal(null); reload(); }} />
      )}
      {modal?.kind === 'lease' && (
        <FormModal title="New long-term tenancy" wide fields={leaseFields({ tenants: tenants.data, fixedUnit: u, fixedSpace: {} })}
          initial={{ rentPeriod: 'YEARLY', rent: u.monthlyRent ? u.monthlyRent * 12 : '' }} onClose={() => setModal(null)}
          onSubmit={async v => {
            let tenantId = v.tenantId;
            if (tenantId === '__new') tenantId = (await api.post('/tenants', { name: v.newName, phone: v.newPhone })).id;
            const { newName, newPhone, ...rest } = v;
            await api.post('/leases', { ...rest, tenantId, unitId: u.id });
            toast('Tenancy added. Add the tenant\'s cheques under Cheques.'); setModal(null); reload();
          }} />
      )}
    </div>
  );
}
