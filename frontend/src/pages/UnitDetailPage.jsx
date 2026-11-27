// frontend/src/pages/UnitDetailPage.jsx — one apartment: spaces, tenancies, money, cheques
import { t } from '../lib/i18n';
import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { usePeriod, PeriodPicker } from '../lib/period';
import { useApi, useSticky } from '../lib/hooks';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { money, date, L, monthKey, isoDay } from '../lib/format';
import { unitFields, spaceFields, leaseFields } from '../lib/forms';
import { Spinner, ErrorBox, FormModal, Badge, Stat, MonthPicker, useToast } from '../components/ui';
import PhotoManager from '../components/PhotoManager';

export default function UnitDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const { data: u, loading, error, refetch } = useApi(`/units/${id}`);
  const buildings = useApi('/buildings');
  const landlords = useApi('/landlords');
  const tenants = useApi('/tenants');
  const period = usePeriod();
  const tx = useApi(`/transactions?unitId=${id}&from=${period.from}&to=${period.to}`);
  const [modal, setModal] = useState(null);

  if (error) return <ErrorBox error={error} retry={refetch} />;
  if (loading && !u) return <Spinner />;

  const income = (tx.data || []).filter(tx => tx.type === 'INCOME').reduce((s, tx) => s + tx.amount, 0);
  const expenses = (tx.data || []).filter(tx => tx.type === 'EXPENSE').reduce((s, tx) => s + tx.amount, 0);
  const activeLeases = u.leases.filter(l => l.status !== 'ENDED');
  const reload = () => { refetch(); tx.refetch(); };

  return (
    <div className="stack">
      <div className="row-between wrap">
        <div>
          <Link to="/units" className="small muted">{t("← Apartments")}</Link>
          <h2 style={{ fontSize: 22, marginTop: 4 }}>{u.building.name} · {u.number}</h2>
          <div className="row wrap" style={{ marginTop: 6 }}>
            <Badge tone="sand">{L.mode[u.mode]}</Badge><Badge>{L.arrangement[u.arrangement]}</Badge><Badge tone={u.occupancy === 'LADIES' ? 'violet' : ''}>{L.occupancy[u.occupancy]}</Badge>
            {!u.active && <Badge tone="red">{t("Inactive")}</Badge>}
          </div>
        </div>
        {can.write && <div className="row">
          {u.mode === 'PARTITIONS' && <button className="btn" onClick={() => setModal({ kind: 'space' })}>{t("+ Room / bed")}</button>}
          {u.mode === 'LONG_TERM' && activeLeases.length === 0 && <button className="btn" onClick={() => setModal({ kind: 'lease' })}>{t("+ Tenant")}</button>}
          {u.mode === 'HOLIDAY' && <Link className="btn" to="/bookings">{t("Bookings calendar")}</Link>}
          <button className="btn btn-primary" onClick={() => setModal({ kind: 'edit' })}>{t("Edit apartment")}</button>
        </div>}
      </div>

      <div className="row-between"><div className="section-title" style={{ margin: 0 }}>{t("Money")}</div><PeriodPicker /></div>
      <div className="grid g4">
        <Stat label={t("Income")} value={money(income)} />
        <Stat label={t("Expenses")} value={money(expenses)} />
        <Stat accent label={t("Net")} value={money(income - expenses)} />
        <Stat label={u.arrangement === 'MANAGEMENT' ? t("Owner share (after {0}% fee)", [u.managementFee || 0]) : t("Landlord rent / month")}
          value={u.arrangement === 'MANAGEMENT' ? money(income - expenses - income * (u.managementFee || 0) / 100) : money((u.landlordRent || 0) / 12)}
          sub={u.landlord ? u.landlord.name : undefined} />
      </div>

      <div className="grid g-2-1">
        <div className="card card-flush">
          <div className="card-head"><div className="card-title">{u.mode === 'PARTITIONS' ? t("Rooms & beds") : t("Tenancies")}</div></div>
          <div className="table-wrap">
            {u.mode === 'PARTITIONS' ? (
              <table className="table">
                <thead><tr><th>{t("Code")}</th><th>{t("Status")}</th><th>{t("Tenant")}</th><th className="num">{t("Rent")}</th><th></th></tr></thead>
                <tbody>
                  {u.spaces.length === 0 && <tr><td colSpan={5} className="muted">{t("No rooms yet.")}</td></tr>}
                  {[...u.spaces].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })).map(s => {
                    const l = s.leases[0];
                    return (
                      <tr key={s.id}>
                        <td><b>{s.code}</b> <span className="tiny faint">{L.spaceKind[s.kind]}</span></td>
                        <td><Badge value={s.status} map={L.spaceStatus} /></td>
                        <td>{l ? <>{l.tenant.name}<div className="tiny faint">{t("since")} {date(l.startDate)}</div></> : <span className="faint">—</span>}</td>
                        <td className="num">{money(l ? l.rent : s.monthlyRate)}</td>
                        <td className="right">{can.write && <button className="btn btn-sm" onClick={() => setModal({ kind: 'editSpace', space: s })}>{t("Edit")}</button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="table">
                <thead><tr><th>{t("Tenant")}</th><th>{t("From")}</th><th>{t("To")}</th><th className="num">{t("Rent")}</th><th>{t("Status")}</th></tr></thead>
                <tbody>
                  {u.leases.length === 0 && <tr><td colSpan={5} className="muted">{u.mode === 'HOLIDAY' ? t("Holiday homes use bookings instead of tenancies.") : t("No tenancies yet.")}</td></tr>}
                  {u.leases.map(l => (
                    <tr key={l.id}><td>{l.tenant.name}</td><td>{date(l.startDate)}</td><td>{date(l.endDate)}</td><td className="num">{money(l.rent)} {l.rentPeriod === 'YEARLY' ? t("/yr") : t("/mo")}</td><td><Badge value={l.status} map={L.leaseStatus} /></td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 10 }}>{t("Details")}</div>
          <dl className="kv">
            <dt>{t("Landlord / owner")}</dt><dd>{u.landlord?.name || '—'}</dd>
            {u.landlordRent ? <><dt>{t("Annual rent")}</dt><dd>{money(u.landlordRent)}</dd></> : null}
            {u.nightlyRate ? <><dt>{t("Nightly rate")}</dt><dd>{money(u.nightlyRate)}</dd></> : null}
            {u.monthlyRent ? <><dt>{t("Monthly rent")}</dt><dd>{money(u.monthlyRent)}</dd></> : null}
            <dt>{t("Bedrooms")}</dt><dd>{u.bedrooms ?? '—'} · {u.bathrooms ?? '—'} {t("bath")}</dd>
            <dt>{t("DEWA account")}</dt><dd>{u.dewaAccount || '—'}</dd>
            {u.amenities && <><dt>{t("Amenities")}</dt><dd>{u.amenities}</dd></>}
            {u.notes && <><dt>{t("Notes")}</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{u.notes}</dd></>}
          </dl>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title" style={{ marginBottom: 10 }}>{t("Photos")}</div>
        <PhotoManager unit={u} spaces={u.spaces || []} />
      </div>

      <div className="grid g2">
        <div className="card card-flush">
          <div className="card-head"><div className="card-title">{t("Income & expenses ·")} {period.label}</div><Link to="/ledger" className="btn btn-sm">{t("Ledger")}</Link></div>
          <div className="table-wrap">
            <table className="table">
              <tbody>
                {(tx.data || []).length === 0 && <tr><td className="muted">{t("Nothing recorded in this period.")}</td></tr>}
                {(tx.data || []).map(tx => (
                  <tr key={tx.id}><td className="small nowrap">{date(tx.date)}</td><td>{tx.description}<div className="tiny faint">{L.category[tx.category]}{tx.space ? ` · ${tx.space.code}` : ''}</div></td>
                    <td className="num" style={{ color: tx.type === 'INCOME' ? 'var(--green)' : 'var(--red)' }}>{tx.type === 'INCOME' ? '+' : '−'}{money(tx.amount).replace('AED ', '')}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card card-flush">
          <div className="card-head"><div className="card-title">{t("Cheques")}</div><Link to="/cheques" className="btn btn-sm">{t("All cheques")}</Link></div>
          <div className="table-wrap">
            <table className="table">
              <tbody>
                {u.cheques.length === 0 && <tr><td className="muted">{t("No cheques for this apartment.")}</td></tr>}
                {u.cheques.map(c => (
                  <tr key={c.id}><td className="small nowrap">{date(c.status === 'POSTPONED' && c.postponedTo ? c.postponedTo : c.dueDate)}</td><td>{c.direction === 'OUT' ? t("Issued") : t("Received")} #{c.number}<div className="tiny faint">{c.partyName || c.bank}</div></td>
                    <td className="num">{money(c.amount)}</td><td><Badge value={c.status} map={L.chequeStatus} /></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modal?.kind === 'edit' && (
        <FormModal title={t("Edit apartment")} wide fields={unitFields(buildings.data, landlords.data)} initial={u} onClose={() => setModal(null)}
          onDelete={async () => { await api.del(`/units/${u.id}`); toast(t("Apartment deleted")); nav('/units'); }}
          onSubmit={async v => { await api.patch(`/units/${u.id}`, v); toast(t("Saved")); setModal(null); reload(); }} />
      )}
      {modal?.kind === 'space' && (
        <FormModal title={t("Add room / bed")} fields={spaceFields} onClose={() => setModal(null)}
          onSubmit={async v => { await api.post('/spaces', { ...v, unitId: u.id }); toast(t("Added")); setModal(null); reload(); }} />
      )}
      {modal?.kind === 'editSpace' && (
        <FormModal title={t("Edit {0}", [modal.space.code])} fields={spaceFields} initial={{ ...modal.space, availableFrom: isoDay(modal.space.availableFrom) }} onClose={() => setModal(null)}
          onDelete={modal.space.leases[0] ? undefined : async () => { await api.del(`/spaces/${modal.space.id}`); toast(t("Removed")); setModal(null); reload(); }}
          onSubmit={async v => { await api.patch(`/spaces/${modal.space.id}`, v); toast(t("Saved")); setModal(null); reload(); }} />
      )}
      {modal?.kind === 'lease' && (
        <FormModal title={t("New long-term tenancy")} wide fields={leaseFields({ tenants: tenants.data, fixedUnit: u, fixedSpace: {} })}
          initial={{ rentPeriod: 'YEARLY', rent: u.monthlyRent ? u.monthlyRent * 12 : '' }} onClose={() => setModal(null)}
          onSubmit={async v => {
            let tenantId = v.tenantId;
            if (tenantId === '__new') tenantId = (await api.post('/tenants', { name: v.newName, phone: v.newPhone })).id;
            const { newName, newPhone, ...rest } = v;
            await api.post('/leases', { ...rest, tenantId, unitId: u.id });
            toast(t("Tenancy added. Add the tenant's cheques under Cheques.")); setModal(null); reload();
          }} />
      )}
    </div>
  );
}
