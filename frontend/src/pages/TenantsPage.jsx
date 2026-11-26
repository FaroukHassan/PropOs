// frontend/src/pages/TenantsPage.jsx
import { t, isAr } from '../lib/i18n';
import { useState } from 'react';
import { useScope } from '../lib/scope';
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
  const { scoped } = useScope();
  const { data, loading, error, refetch } = useApi(scoped('/tenants', { q }));
  const [modal, setModal] = useState(null);
  const [open, setOpen] = useState(null);

  if (error) return <ErrorBox error={error} retry={refetch} />;
  const rows = (data || []).filter(tx => show === 'all' || tx.leases.some(l => l.status !== 'ENDED'));
  const where = tx => {
    const l = tx.leases.find(x => x.status !== 'ENDED') || tx.leases[0];
    return l ? `${l.unit.building.name} ${l.unit.number}${l.space ? ` · ${l.space.code}` : ''}` : '—';
  };

  return (
    <>
      <div className="toolbar">
        <input className="input" style={{ maxWidth: 280 }} placeholder={t("Search name, phone or email")} value={q} onChange={e => setQ(e.target.value)} />
        <select className="input input-sm" value={show} onChange={e => setShow(e.target.value)}>
          <option value="current">{t("Living with us now")}</option><option value="all">{t("Everyone (incl. past)")}</option>
        </select>
        <div className="grow" />
        {can.write && <button className="btn btn-primary" onClick={() => setModal({})}>{t("+ Tenant")}</button>}
      </div>
      {loading && !data ? <Spinner /> : rows.length === 0 ? (
        <Empty icon="☺" title={q ? t("No match") : t("No tenants yet")}>{t("Tenants are added when you move someone into a partition on the Partitions board.")}</Empty>
      ) : (
        <div className="card card-flush">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{t("Name")}</th><th>{t("Phone")}</th><th>{t("Lives in")}</th><th className="num">{t("Rent")}</th><th>{t("Since")}</th><th>{t("Status")}</th></tr></thead>
              <tbody>
                {rows.map(tx => {
                  const l = tx.leases.find(x => x.status !== 'ENDED') || tx.leases[0];
                  return (
                    <tr key={tx.id} className="clickable" onClick={() => setOpen(tx)}>
                      <td className="bold">{tx.name}{tx.nationality && <div className="tiny faint">{tx.nationality}</div>}</td>
                      <td className="small">{tx.phone ? <bdi dir="ltr">{tx.phone}</bdi> : '—'}</td>
                      <td className="small">{where(tx)}</td>
                      <td className="num">{l ? money(l.rent) : '—'}</td>
                      <td className="small">{l ? date(l.startDate) : '—'}</td>
                      <td>{l ? <Badge value={l.status} map={L.leaseStatus} /> : <Badge>{t("No tenancy")}</Badge>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {open && (
        <Drawer title={open.name} subtitle={open.phone && <bdi dir="ltr">{open.phone}</bdi>} onClose={() => setOpen(null)}
          actions={can.write && <button className="btn btn-sm" onClick={() => setModal({ tenant: open })}>{t("Edit")}</button>}>
          <dl className="kv">
            {open.phone && <><dt>{t("WhatsApp")}</dt><dd><a href={`https://wa.me/${open.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" dir="ltr">{open.phone}</a></dd></>}
            {open.email && <><dt>{t("Email")}</dt><dd>{open.email}</dd></>}
            {open.nationality && <><dt>{t("Nationality")}</dt><dd>{open.nationality}</dd></>}
            {open.idNumber && <><dt>{t("ID no.")}</dt><dd>{open.idNumber}</dd></>}
            {open.notes && <><dt>{t("Notes")}</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{open.notes}</dd></>}
          </dl>
          <div className="section-title">{t("Tenancies")}</div>
          {open.leases.length === 0 && <p className="small muted">{t("None.")}</p>}
          {open.leases.map(l => (
            <div key={l.id} className="list-item">
              <div><div className="bold">{l.unit.building.name} {l.unit.number}{l.space ? ` · ${l.space.code}` : ''}</div>
                <div className="tiny faint">{date(l.startDate)} {isAr ? '←' : '→'} {l.endDate ? date(l.endDate) : t("ongoing")} {t("· deposit")} {money(l.depositPaid)}</div></div>
              <div className="right"><div className="num">{money(l.rent)}</div><Badge value={l.status} map={L.leaseStatus} /></div>
            </div>
          ))}
        </Drawer>
      )}

      {modal && (
        <FormModal title={modal.tenant ? t("Edit tenant") : t("New tenant")} fields={tenantFields} initial={modal.tenant} onClose={() => setModal(null)}
          onDelete={modal.tenant && modal.tenant.leases.length === 0 ? async () => { await api.del(`/tenants/${modal.tenant.id}`); toast(t("Deleted")); setModal(null); setOpen(null); refetch(); } : undefined}
          onSubmit={async v => {
            if (modal.tenant) await api.patch(`/tenants/${modal.tenant.id}`, v); else await api.post('/tenants', v);
            toast(t("Saved")); setModal(null); setOpen(null); refetch();
          }} />
      )}
    </>
  );
}
