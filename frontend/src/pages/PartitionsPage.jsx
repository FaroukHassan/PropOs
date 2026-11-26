// frontend/src/pages/PartitionsPage.jsx — the availability board (replaces the partitions sheet)
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useSticky } from '../lib/hooks';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { money, date, L, today, isoDay, monthKey } from '../lib/format';
import { spaceFields, leaseFields, transactionFields } from '../lib/forms';
import { Spinner, ErrorBox, Empty, Drawer, FormModal, Badge, Tabs, useToast } from '../components/ui';

// WhatsApp-ready list of what is free, like the one the team sends to brokers
function availabilityText(buildings) {
  const lines = ['🏠 *Sakanly — available now*', ''];
  for (const b of buildings) {
    const units = b.units.map(u => ({ u, free: u.spaces.filter(s => s.status === 'AVAILABLE') })).filter(x => x.free.length);
    if (!units.length) continue;
    lines.push(`📍 *${b.name}*${b.area ? ` — ${b.area}` : ''}`);
    for (const { u, free } of units) {
      for (const s of free) {
        const when = !s.availableFrom || isoDay(s.availableFrom) <= today() ? 'Ready to move' : `From ${date(s.availableFrom)}`;
        lines.push(`• Flat ${u.number} ${s.code} — AED ${s.monthlyRate.toLocaleString()} · ${L.occupancy[u.occupancy]}${s.amenities ? ` · ${s.amenities}` : ''} · ${when}`);
      }
    }
    lines.push('');
  }
  lines.push('📞 +971 56 591 3200');
  return lines.join('\n');
}

export default function PartitionsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const { data, loading, error, refetch } = useApi('/spaces/board');
  const units = useApi('/units?mode=PARTITIONS');
  const tenants = useApi('/tenants');
  const [filter, setFilter] = useSticky('board_filter', 'ALL');
  const [occ, setOcc] = useSticky('board_occ', '');
  const [open, setOpen] = useState(null); // { space, unit }
  const [modal, setModal] = useState(null);

  const buildings = useMemo(() => (data?.buildings || []).map(b => ({
    ...b,
    units: b.units
      .filter(u => !occ || u.occupancy === occ)
      .map(u => ({ ...u, spaces: u.spaces.filter(s => filter === 'ALL' || s.status === filter) }))
      .filter(u => u.spaces.length || filter === 'ALL'),
  })).filter(b => b.units.length), [data, filter, occ]);

  if (error) return <ErrorBox error={error} retry={refetch} />;
  if (loading && !data) return <Spinner />;
  const t = data.totals;
  const reload = () => { refetch(); units.refetch(); tenants.refetch(); };

  const copyList = async () => {
    const text = availabilityText(data.buildings);
    try { await navigator.clipboard.writeText(text); toast('Available list copied, paste it into WhatsApp'); }
    catch { setModal({ kind: 'text', text }); }
  };

  return (
    <>
      <div className="toolbar">
        <Tabs value={filter} onChange={setFilter} items={[
          ['ALL', `All ${t.spaces}`], ['AVAILABLE', `Available ${t.available}`], ['OCCUPIED', `Occupied ${t.occupied}`],
          ['RESERVED', `Reserved ${t.reserved}`], ['NOT_READY', `Not ready ${t.notReady}`],
        ]} />
        <select className="input input-sm" value={occ} onChange={e => setOcc(e.target.value)} aria-label="Who for">
          <option value="">Mixed & ladies</option>
          {Object.entries(L.occupancy).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="grow" />
        <button className="btn" onClick={copyList}>Copy available list for WhatsApp</button>
      </div>
      <div className="legend" style={{ marginBottom: 18 }}>
        <span><i className="s-AVAILABLE" />Available</span><span><i className="s-OCCUPIED" />Occupied</span>
        <span><i className="s-RESERVED" />Reserved</span><span><i className="s-NOT_READY" />Not ready</span>
        <span className="faint">Occupancy {t.spaces ? Math.round((t.occupied / t.spaces) * 100) : 0}%</span>
      </div>

      {data.buildings.length === 0 && (
        <Empty icon="▦" title="No partition apartments yet" action={<Link className="btn btn-primary" to="/import">Import from your sheet</Link>}>
          Add apartments under Apartments (set "How it is rented" to Partitions), or import your availability sheet.
        </Empty>
      )}

      {buildings.map(b => (
        <section key={b.id} className="board-building">
          <h2>{b.name} <span className="small faint">{b.area}</span></h2>
          <div className="board-units">
            {b.units.map(u => {
              const occupied = u.spaces.filter(s => s.status === 'OCCUPIED');
              return (
                <div key={u.id} className="board-unit">
                  <div className="board-unit-head">
                    <div><Link to={`/units/${u.id}`} className="apt" style={{ textDecoration: 'none' }}>Flat {u.number}</Link> <Badge tone={u.occupancy === 'LADIES' ? 'violet' : ''}>{L.occupancy[u.occupancy]}</Badge></div>
                    <div className="small muted">{filter === 'ALL' ? `${occupied.length}/${u.spaces.length}` : ''}</div>
                  </div>
                  <div className="spaces">
                    {u.spaces.map(s => (
                      <button key={s.id} className={`space s-${s.status}`} onClick={() => setOpen({ space: s, unit: u, building: b })} title={s.amenities || ''}>
                        <div className="code">{s.code}</div>
                        <div className="who">{s.lease ? s.lease.tenant.name : L.spaceStatus[s.status]}</div>
                        <div className="price">{num0(s.lease ? s.lease.rent : s.monthlyRate)}</div>
                      </button>
                    ))}
                    {can.write && filter === 'ALL' && (
                      <button className="space" style={{ borderStyle: 'dashed', borderColor: 'var(--line-2)', color: 'var(--text-3)' }}
                        onClick={() => setModal({ kind: 'addSpace', unit: u })}>
                        <div className="code">+ Add</div><div className="who">partition / bed</div>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {open && (
        <SpaceDrawer {...open} canWrite={can.write} onClose={() => setOpen(null)}
          onAction={kind => setModal({ kind, ...open })} />
      )}

      {modal?.kind === 'text' && (
        <FormModal title="Available list" fields={[{ name: 'text', label: 'Copy this text', type: 'textarea', full: true }]} initial={{ text: modal.text }}
          onClose={() => setModal(null)} onSubmit={async () => setModal(null)} submitLabel="Done" />
      )}
      {modal?.kind === 'addSpace' && (
        <FormModal title={`Add partition to Flat ${modal.unit.number}`} fields={spaceFields} onClose={() => setModal(null)}
          onSubmit={async v => { await api.post('/spaces', { ...v, unitId: modal.unit.id }); toast('Partition added'); setModal(null); reload(); }} />
      )}
      {modal?.kind === 'editSpace' && (
        <FormModal title={`Edit ${modal.space.code}`} fields={spaceFields.map(f => f.name === 'status' && modal.space.status === 'OCCUPIED' ? { ...f, options: Object.entries(L.spaceStatus).map(([value, label]) => ({ value, label })) } : f)}
          initial={{ ...modal.space, availableFrom: isoDay(modal.space.availableFrom) }} onClose={() => setModal(null)}
          onDelete={modal.space.lease ? undefined : async () => { await api.del(`/spaces/${modal.space.id}`); toast('Removed'); setModal(null); setOpen(null); reload(); }}
          onSubmit={async v => { await api.patch(`/spaces/${modal.space.id}`, v); toast('Saved'); setModal(null); setOpen(null); reload(); }} />
      )}
      {modal?.kind === 'moveIn' && (
        <FormModal title={`Move in — Flat ${modal.unit.number} ${modal.space.code}`} wide
          fields={leaseFields({ tenants: tenants.data, fixedUnit: modal.unit, fixedSpace: modal.space })}
          initial={{ rent: modal.space.monthlyRate, deposit: modal.space.deposit }}
          onClose={() => setModal(null)}
          onSubmit={async v => {
            let tenantId = v.tenantId;
            if (tenantId === '__new') tenantId = (await api.post('/tenants', { name: v.newName, phone: v.newPhone })).id;
            const { newName, newPhone, ...rest } = v;
            await api.post('/leases', { ...rest, tenantId, unitId: modal.unit.id, spaceId: modal.space.id });
            toast('Tenant moved in'); setModal(null); setOpen(null); reload();
          }} />
      )}
      {modal?.kind === 'pay' && (
        <FormModal title={`Record payment — ${modal.space.lease.tenant.name}`}
          fields={transactionFields({ units: units.data, preset: { type: 'INCOME', category: 'RENT', unitId: modal.unit.id, spaceId: modal.space.id, description: 'Rent collection', periodMonth: monthKey() } }).filter(f => !['type', 'unitId', 'spaceId'].includes(f.name))}
          initial={{ amount: modal.space.lease.rent }}
          onClose={() => setModal(null)}
          onSubmit={async v => { await api.post('/transactions', { ...v, type: 'INCOME', leaseId: modal.space.lease.id }); toast('Payment recorded'); setModal(null); }} />
      )}
      {modal?.kind === 'moveOut' && (
        <FormModal title={`Move out — ${modal.space.lease.tenant.name}`}
          intro={<p className="small muted" style={{ marginBottom: 12 }}>Ends the tenancy and marks {modal.space.code} as available. Deposit held: {money(modal.space.lease.depositPaid)}.</p>}
          fields={[
            { name: 'endDate', label: 'Move-out date', type: 'date', required: true, default: today() },
            { name: 'refund', label: 'Deposit refunded (AED)', type: 'number', default: modal.space.lease.depositPaid },
            { name: 'method', label: 'Refunded by', type: 'select', required: true, options: Object.entries(L.method).map(([value, label]) => ({ value, label })), default: 'CASH' },
          ]}
          submitLabel="Move out" onClose={() => setModal(null)}
          onSubmit={async v => { await api.post(`/leases/${modal.space.lease.id}/end`, v); toast('Moved out'); setModal(null); setOpen(null); reload(); }} />
      )}
    </>
  );
}

const num0 = n => `AED ${Number(n || 0).toLocaleString()}`;

function SpaceDrawer({ space, unit, building, onClose, onAction, canWrite }) {
  const lease = space.lease;
  return (
    <Drawer title={`Flat ${unit.number} · ${space.code}`} subtitle={`${building.name} · ${L.spaceKind[space.kind]} · ${L.occupancy[unit.occupancy]}`} onClose={onClose}
      actions={canWrite && <button className="btn btn-sm" onClick={() => onAction('editSpace')}>Edit</button>}>
      <div className="row" style={{ marginBottom: 16 }}><Badge value={space.status} map={L.spaceStatus} /></div>
      <dl className="kv">
        <dt>Listed rent</dt><dd className="bold">{money(space.monthlyRate)} / month</dd>
        <dt>Deposit</dt><dd>{money(space.deposit)}</dd>
        <dt>Persons</dt><dd>{space.capacity}</dd>
        {space.amenities && <><dt>Features</dt><dd>{space.amenities}</dd></>}
        {space.availableFrom && space.status !== 'OCCUPIED' && <><dt>Available from</dt><dd>{date(space.availableFrom)}</dd></>}
        {space.notes && <><dt>Notes</dt><dd>{space.notes}</dd></>}
      </dl>

      <div className="section-title">Tenant</div>
      {lease ? (
        <>
          <dl className="kv">
            <dt>Name</dt><dd className="bold">{lease.tenant.name}</dd>
            {lease.tenant.phone && <><dt>Phone</dt><dd><a href={`https://wa.me/${lease.tenant.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">{lease.tenant.phone}</a></dd></>}
            <dt>Since</dt><dd>{date(lease.startDate)}</dd>
            {lease.endDate && <><dt>Until</dt><dd>{date(lease.endDate)}</dd></>}
            <dt>Rent</dt><dd>{money(lease.rent)} · due on day {lease.dueDay}</dd>
            <dt>Deposit held</dt><dd>{money(lease.depositPaid)} of {money(lease.deposit)}</dd>
            {lease.broker && <><dt>Broker</dt><dd>{lease.broker}</dd></>}
          </dl>
          {canWrite && (
            <div className="row wrap" style={{ marginTop: 16 }}>
              <button className="btn btn-primary" onClick={() => onAction('pay')}>Record payment</button>
              <button className="btn btn-danger" onClick={() => onAction('moveOut')}>Move out</button>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="small muted">Nobody lives here right now.</p>
          {canWrite && space.status !== 'NOT_READY' && <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => onAction('moveIn')}>Move a tenant in</button>}
        </>
      )}
    </Drawer>
  );
}
