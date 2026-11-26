// frontend/src/pages/LandlordsPage.jsx — landlords & owners, with monthly owner statements
import { t } from '../lib/i18n';
import { useState } from 'react';
import { usePeriod, PeriodPicker } from '../lib/period';
import { useApi, useSticky } from '../lib/hooks';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { money, date, L, monthKey, monthLabel } from '../lib/format';
import { landlordFields } from '../lib/forms';
import { Spinner, ErrorBox, Empty, FormModal, Badge, MonthPicker, Modal, useToast } from '../components/ui';

export default function LandlordsPage() {
  const { can } = useAuth();
  const toast = useToast();
  const { data, loading, error, refetch } = useApi('/landlords');
  const [modal, setModal] = useState(null);
  const [statementFor, setStatementFor] = useState(null);

  if (error) return <ErrorBox error={error} retry={refetch} />;
  return (
    <>
      <div className="toolbar"><div className="grow" />{can.write && <button className="btn btn-primary" onClick={() => setModal({})}>{t("+ Landlord / owner")}</button>}</div>
      {loading && !data ? <Spinner /> : !data.length ? (
        <Empty icon="⚿" title={t("No landlords yet")}>{t("Add the people Sakanly rents apartments from, and owners whose homes Sakanly manages.")}</Empty>
      ) : (
        <div className="grid g3">
          {data.map(l => {
            const annual = l.units.filter(u => u.arrangement === 'MASTER_LEASE').reduce((s, u) => s + (u.landlordRent || 0), 0);
            return (
              <div key={l.id} className="card">
                <div className="row-between">
                  <div><div className="bold" style={{ fontSize: 15 }}>{l.name}</div><div className="small muted">{l.phone ? <bdi dir="ltr">{l.phone}</bdi> : l.email || '—'}</div></div>
                  {can.write && <button className="btn btn-sm btn-ghost" onClick={() => setModal({ landlord: l })}>{t("Edit")}</button>}
                </div>
                <div style={{ margin: '12px 0' }}>
                  {l.units.length === 0 && <span className="small faint">{t("No apartments linked yet")}</span>}
                  {l.units.map(u => <div key={u.id} className="list-item"><span>{u.building.name} {u.number}</span><Badge tone={u.arrangement === 'MANAGEMENT' ? 'blue' : 'sand'}>{u.arrangement === 'MANAGEMENT' ? t("Managed {0}%", [u.managementFee || 0]) : t("Leased to Sakanly")}</Badge></div>)}
                </div>
                {annual > 0 && <div className="small muted" style={{ marginBottom: 10 }}>{t("Annual rent to pay:")} <b>{money(annual)}</b></div>}
                <button className="btn btn-sm" onClick={() => setStatementFor(l)} disabled={!l.units.length}>{t("Monthly statement")}</button>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <FormModal title={modal.landlord ? t("Edit landlord") : t("New landlord / owner")} fields={landlordFields} initial={modal.landlord} onClose={() => setModal(null)}
          onDelete={modal.landlord && !modal.landlord.units.length ? async () => { await api.del(`/landlords/${modal.landlord.id}`); toast(t("Deleted")); setModal(null); refetch(); } : undefined}
          onSubmit={async v => {
            if (modal.landlord) await api.patch(`/landlords/${modal.landlord.id}`, v); else await api.post('/landlords', v);
            toast(t("Saved")); setModal(null); refetch();
          }} />
      )}
      {statementFor && <Statement landlord={statementFor} onClose={() => setStatementFor(null)} />}
    </>
  );
}

function Statement({ landlord, onClose }) {
  const period = usePeriod();
  const { data, loading, error } = useApi(`/reports/owner-statement?landlordId=${landlord.id}&from=${period.from}&to=${period.to}`);
  return (
    <Modal title={t("Statement — {0}", [landlord.name])} onClose={onClose} wide
      footer={<><button className="btn" onClick={() => window.print()}>{t("Print / save PDF")}</button><button className="btn btn-primary" onClick={onClose}>{t("Close")}</button></>}>
      <div className="row-between no-print" style={{ marginBottom: 14 }}><PeriodPicker /></div>
      {error && <div className="alert alert-error">{error}</div>}
      {loading || !data ? <Spinner /> : (
        <div id="statement">
          <div className="print-only" style={{ marginBottom: 16 }}>
            <div className="bold" style={{ fontSize: 18 }}>{t("Sakanly Real Estate")}</div>
            <div className="small">{t("Owner statement ·")} {landlord.name} · {period.label}</div>
          </div>
          {data.units.map(u => (
            <div key={u.unitId} style={{ marginBottom: 18 }}>
              <div className="row-between"><div className="bold">{u.building} {u.unit}</div><Badge>{L.arrangement[u.arrangement]}</Badge></div>
              <table className="table" style={{ marginTop: 6 }}>
                <tbody>
                  {u.lines.map((x, i) => (
                    <tr key={i}><td className="small nowrap">{date(x.date)}</td><td className="small">{x.description}{x.space ? ` · ${x.space}` : ''}</td><td className="small faint">{L.category[x.category]}</td>
                      <td className="num small">{x.type === 'INCOME' ? '' : '−'}{money(x.amount).replace('AED ', '')}</td></tr>
                  ))}
                  {u.lines.length === 0 && <tr><td className="small muted">{t("No activity in this period.")}</td></tr>}
                </tbody>
                <tfoot>
                  <tr><td colSpan={3}>{t("Income")}</td><td className="num">{money(u.income)}</td></tr>
                  <tr><td colSpan={3}>{t("Expenses")}</td><td className="num">{money(u.expenses)}</td></tr>
                  {u.arrangement === 'MANAGEMENT' ? <>
                    <tr><td colSpan={3}>{t("Sakanly fee (")}{u.feePct}%)</td><td className="num">{money(u.fee)}</td></tr>
                    <tr><td colSpan={3}>{t("Owner share")}</td><td className="num">{money(u.ownerShare)}</td></tr>
                  </> : <tr><td colSpan={3}>{t("Rent paid to landlord in this period")}</td><td className="num">{money(u.paidToLandlord)}</td></tr>}
                </tfoot>
              </table>
            </div>
          ))}
          {data.totals.ownerShare !== 0 && (
            <div className="card" style={{ background: 'var(--sand-bg)', border: 'none' }}>
              <div className="row-between"><span>{t("Owner share for")} {period.label}</span><b>{money(data.totals.ownerShare)}</b></div>
              <div className="row-between"><span>{t("Already paid out")}</span><b>{money(data.totals.paidOut)}</b></div>
              <div className="row-between" style={{ fontSize: 16, marginTop: 6 }}><span className="bold">{t("Balance due to owner")}</span><b>{money(data.totals.balanceDue)}</b></div>
            </div>
          )}
          {data.cheques.length > 0 && <>
            <div className="section-title">{t("Cheques to this landlord")}</div>
            <table className="table"><tbody>
              {data.cheques.map(c => <tr key={c.id}><td className="small">{date(c.status === 'POSTPONED' && c.postponedTo ? c.postponedTo : c.dueDate)}</td><td className="small">#{c.number} {c.unit ? `· ${c.unit.number}` : ''}</td><td className="num small">{money(c.amount)}</td><td><Badge value={c.status} map={L.chequeStatus} /></td></tr>)}
            </tbody></table>
          </>}
        </div>
      )}
    </Modal>
  );
}
