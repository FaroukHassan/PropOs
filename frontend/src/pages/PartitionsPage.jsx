// frontend/src/pages/PartitionsPage.jsx — the availability board (replaces the partitions sheet)
import { t } from '../lib/i18n';
import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useScope } from '../lib/scope';
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
  const { scoped } = useScope();
  const { data, loading, error, refetch } = useApi(scoped('/spaces/board'));
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
  const tx = data.totals;
  const reload = () => { refetch(); units.refetch(); tenants.refetch(); };

  const copyList = async () => {
    const text = availabilityText(data.buildings);
    try { await navigator.clipboard.writeText(text); toast(t("Available list copied, paste it into WhatsApp")); }
    catch { setModal({ kind: 'text', text }); }
  };

  return (
    <>
      <div className="toolbar">
        <Tabs value={filter} onChange={setFilter} items={[
          ['ALL', t("All {0}", [tx.spaces])], ['AVAILABLE', t("Available {0}", [tx.available])], ['OCCUPIED', t("Occupied {0}", [tx.occupied])],
          ['RESERVED', t("Reserved {0}", [tx.reserved])], ['NOT_READY', t("Not ready {0}", [tx.notReady])],
        ]} />
        <select className="input input-sm" value={occ} onChange={e => setOcc(e.target.value)} aria-label={t("Who for")}>
          <option value="">{t("Mixed & ladies")}</option>
          {Object.entries(L.occupancy).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="grow" />
        <button className="btn" onClick={copyList}>{t("Copy available list for WhatsApp")}</button>
      </div>
      <div className="legend" style={{ marginBottom: 18 }}>
        <span><i className="s-AVAILABLE" />{t("Available")}</span><span><i className="s-OCCUPIED" />{t("Occupied")}</span>
        <span><i className="s-RESERVED" />{t("Reserved")}</span><span><i className="s-NOT_READY" />{t("Not ready")}</span>
        <span className="faint">{t("Occupancy")} {tx.spaces ? Math.round((tx.occupied / tx.spaces) * 100) : 0}%</span>
      </div>

      {data.buildings.length === 0 && (
        <Empty icon="▦" title={t("No partition apartments yet")} action={<Link className="btn btn-primary" to="/import">{t("Import from your sheet")}</Link>}>
          {t("Add apartments under Apartments (set \"How it is rented\" to Partitions), or import your availability sheet.")}
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
                    <div><Link to={`/units/${u.id}`} className="apt" style={{ textDecoration: 'none' }}>{t("Flat")} {u.number}</Link> <Badge tone={u.occupancy === 'LADIES' ? 'violet' : ''}>{L.occupancy[u.occupancy]}</Badge></div>
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
                        <div className="code">{t("+ Add")}</div><div className="who">{t("partition / bed")}</div>
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
        <FormModal title={t("Available list")} fields={[{ name: 'text', label: t("Copy this text"), type: 'textarea', full: true }]} initial={{ text: modal.text }}
          onClose={() => setModal(null)} onSubmit={async () => setModal(null)} submitLabel={t("Done")} />
      )}
      {modal?.kind === 'addSpace' && (
        <FormModal title={t("Add partition to Flat {0}", [modal.unit.number])} fields={spaceFields} onClose={() => setModal(null)}
          onSubmit={async v => { await api.post('/spaces', { ...v, unitId: modal.unit.id }); toast(t("Partition added")); setModal(null); reload(); }} />
      )}
      {modal?.kind === 'editSpace' && (
        <FormModal title={t("Edit {0}", [modal.space.code])} fields={spaceFields.map(f => f.name === 'status' && modal.space.status === 'OCCUPIED' ? { ...f, options: Object.entries(L.spaceStatus).map(([value, label]) => ({ value, label })) } : f)}
          initial={{ ...modal.space, availableFrom: isoDay(modal.space.availableFrom) }} onClose={() => setModal(null)}
          onDelete={modal.space.lease ? undefined : async () => { await api.del(`/spaces/${modal.space.id}`); toast(t("Removed")); setModal(null); setOpen(null); reload(); }}
          onSubmit={async v => { await api.patch(`/spaces/${modal.space.id}`, v); toast(t("Saved")); setModal(null); setOpen(null); reload(); }} />
      )}
      {modal?.kind === 'moveIn' && (
        <FormModal title={t("Move in — Flat {0} {1}", [modal.unit.number, modal.space.code])} wide
          fields={leaseFields({ tenants: tenants.data, fixedUnit: modal.unit, fixedSpace: modal.space })}
          initial={{ rent: modal.space.monthlyRate, deposit: modal.space.deposit }}
          onClose={() => setModal(null)}
          onSubmit={async v => {
            let tenantId = v.tenantId;
            if (tenantId === '__new') tenantId = (await api.post('/tenants', { name: v.newName, phone: v.newPhone })).id;
            const { newName, newPhone, ...rest } = v;
            await api.post('/leases', { ...rest, tenantId, unitId: modal.unit.id, spaceId: modal.space.id });
            toast(t("Tenant moved in")); setModal(null); setOpen(null); reload();
          }} />
      )}
      {modal?.kind === 'pay' && (
        <FormModal title={t("Record payment — {0}", [modal.space.lease.tenant.name])}
          fields={transactionFields({ units: units.data, preset: { type: 'INCOME', category: 'RENT', unitId: modal.unit.id, spaceId: modal.space.id, description: 'Rent collection', periodMonth: monthKey() } }).filter(f => !['type', 'unitId', 'spaceId'].includes(f.name))}
          initial={{ amount: modal.space.lease.rent }}
          onClose={() => setModal(null)}
          onSubmit={async v => { await api.post('/transactions', { ...v, type: 'INCOME', leaseId: modal.space.lease.id }); toast(t("Payment recorded")); setModal(null); }} />
      )}
      {modal?.kind === 'moveOut' && (
        <FormModal title={t("Move out — {0}", [modal.space.lease.tenant.name])}
          intro={<p className="small muted" style={{ marginBottom: 12 }}>{t("Ends the tenancy and marks")} {modal.space.code} {t("as available. Deposit held:")} {money(modal.space.lease.depositPaid)}.</p>}
          fields={[
            { name: 'endDate', label: t("Move-out date"), type: 'date', required: true, default: today() },
            { name: 'refund', label: t("Deposit refunded (AED)"), type: 'number', default: modal.space.lease.depositPaid },
            { name: 'method', label: t("Refunded by"), type: 'select', required: true, options: Object.entries(L.method).map(([value, label]) => ({ value, label })), default: 'CASH' },
          ]}
          submitLabel={t("Move out")} onClose={() => setModal(null)}
          onSubmit={async v => { await api.post(`/leases/${modal.space.lease.id}/end`, v); toast(t("Moved out")); setModal(null); setOpen(null); reload(); }} />
      )}
    </>
  );
}

const num0 = n => money(Number(n || 0));

function SpaceDrawer({ space, unit, building, onClose, onAction, canWrite }) {
  const lease = space.lease;
  return (
    <Drawer title={t("Flat {0} · {1}", [unit.number, space.code])} subtitle={`${building.name} · ${L.spaceKind[space.kind]} · ${L.occupancy[unit.occupancy]}`} onClose={onClose}
      actions={canWrite && <button className="btn btn-sm" onClick={() => onAction('editSpace')}>{t("Edit")}</button>}>
      <div className="row" style={{ marginBottom: 16 }}><Badge value={space.status} map={L.spaceStatus} /></div>
      <dl className="kv">
        <dt>{t("Listed rent")}</dt><dd className="bold">{money(space.monthlyRate)} {t("/ month")}</dd>
        <dt>{t("Deposit")}</dt><dd>{money(space.deposit)}</dd>
        <dt>{t("Persons")}</dt><dd>{space.capacity}</dd>
        {space.amenities && <><dt>{t("Features")}</dt><dd>{space.amenities}</dd></>}
        {space.availableFrom && space.status !== 'OCCUPIED' && <><dt>{t("Available from")}</dt><dd>{date(space.availableFrom)}</dd></>}
        {space.notes && <><dt>{t("Notes")}</dt><dd>{space.notes}</dd></>}
      </dl>

      <div className="section-title">{t("Tenant")}</div>
      {lease ? (
        <>
          <dl className="kv">
            <dt>{t("Name")}</dt><dd className="bold">{lease.tenant.name}</dd>
            {lease.tenant.phone && <><dt>{t("Phone")}</dt><dd><a href={`https://wa.me/${lease.tenant.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" dir="ltr">{lease.tenant.phone}</a></dd></>}
            <dt>{t("Since")}</dt><dd>{date(lease.startDate)}</dd>
            {lease.endDate && <><dt>{t("Until")}</dt><dd>{date(lease.endDate)}</dd></>}
            <dt>{t("Rent")}</dt><dd>{money(lease.rent)} {t("· due on day")} {lease.dueDay}</dd>
            <dt>{t("Deposit held")}</dt><dd>{money(lease.depositPaid)} {t("of")} {money(lease.deposit)}</dd>
            {lease.broker && <><dt>{t("Broker")}</dt><dd>{lease.broker}</dd></>}
          </dl>
          {canWrite && (
            <div className="row wrap" style={{ marginTop: 16 }}>
              <button className="btn btn-primary" onClick={() => onAction('pay')}>{t("Record payment")}</button>
              <button className="btn btn-danger" onClick={() => onAction('moveOut')}>{t("Move out")}</button>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="small muted">{t("Nobody lives here right now.")}</p>
          {canWrite && space.status !== 'NOT_READY' && <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => onAction('moveIn')}>{t("Move a tenant in")}</button>}
        </>
      )}
    </Drawer>
  );
}
