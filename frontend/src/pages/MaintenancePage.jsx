// frontend/src/pages/MaintenancePage.jsx
import { t } from '../lib/i18n';
import { useState } from 'react';
import { useScope } from '../lib/scope';
import { usePeriod, PeriodPicker } from '../lib/period';
import { useApi, useSticky } from '../lib/hooks';
import { api, qs } from '../lib/api';
import { useAuth } from '../lib/auth';
import { money, date, L, unitName } from '../lib/format';
import { maintenanceFields } from '../lib/forms';
import { Spinner, ErrorBox, Empty, FormModal, Badge, Tabs, useToast } from '../components/ui';

export default function MaintenancePage() {
  const { can } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useSticky('maint_status', 'OPEN_ALL');
  const [byDate, setByDate] = useSticky('maint_bydate', false);
  const period = usePeriod();
  const { scoped } = useScope();
  const { data, loading, error, refetch } = useApi(scoped('/maintenance', { status: status === 'OPEN_ALL' ? '' : status }));
  const units = useApi('/units');
  const [modal, setModal] = useState(null);
  if (error) return <ErrorBox error={error} retry={refetch} />;
  const inPeriod = m => { const d = String(m.createdAt).slice(0, 10); return d >= period.from && d <= period.to; };
  const rows = (data || []).filter(m => (status !== 'OPEN_ALL' || m.status !== 'RESOLVED') && (!byDate || inPeriod(m)));

  const setStat = async (m, s) => { await api.patch(`/maintenance/${m.id}`, { status: s }); toast(t("Marked {0}", [L.maintStatus[s].toLowerCase()])); refetch(); };

  return (
    <>
      <div className="toolbar">
        <Tabs value={status} onChange={setStatus} items={[['OPEN_ALL', t("Not resolved")], ['OPEN', t("Open")], ['IN_PROGRESS', t("In progress")], ['RESOLVED', t("Resolved")]]} />
        <Tabs value={byDate ? 'period' : 'any'} onChange={v => setByDate(v === 'period')} items={[['any', t("Any date")], ['period', t("Reported in period")]]} />
        {byDate && <PeriodPicker />}
        <div className="grow" />
        {can.write && <button className="btn btn-primary" onClick={() => setModal({})}>{t("+ Request")}</button>}
      </div>
      {loading && !data ? <Spinner /> : rows.length === 0 ? <Empty icon="⚒" title={t("Nothing here")}>{t("Log AC, plumbing and other issues so nothing is forgotten.")}</Empty> : (
        <div className="card card-flush">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{t("Problem")}</th><th>{t("Where")}</th><th>{t("Category")}</th><th>{t("Priority")}</th><th>{t("Assigned")}</th><th>{t("Reported")}</th><th className="num">{t("Cost")}</th><th>{t("Status")}</th><th></th></tr></thead>
              <tbody>
                {rows.map(m => (
                  <tr key={m.id} className={can.write ? 'clickable' : ''} onClick={() => can.write && setModal({ item: m })}>
                    <td className="bold">{m.title}{m.description && <div className="tiny faint">{m.description}</div>}</td>
                    <td className="small">{unitName(m.unit)}{m.spaceCode ? ` · ${m.spaceCode}` : ''}</td>
                    <td className="small">{L.maintCategory[m.category]}</td>
                    <td><Badge value={m.priority} map={L.priority} /></td>
                    <td className="small">{m.assignedTo || '—'}</td>
                    <td className="small">{date(m.createdAt)}</td>
                    <td className="num">{m.cost ? money(m.cost) : '—'}</td>
                    <td><Badge value={m.status} map={L.maintStatus} /></td>
                    <td className="right nowrap" onClick={e => e.stopPropagation()}>
                      {can.write && m.status === 'OPEN' && <button className="btn btn-sm" onClick={() => setStat(m, 'IN_PROGRESS')}>{t("Start")}</button>}
                      {can.write && m.status !== 'RESOLVED' && <> <button className="btn btn-sm" onClick={() => setStat(m, 'RESOLVED')}>{t("Done")}</button></>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {modal && (
        <FormModal title={modal.item ? t("Edit request") : t("New maintenance request")} wide fields={maintenanceFields({ units: units.data })} initial={modal.item} onClose={() => setModal(null)}
          onDelete={modal.item ? async () => { await api.del(`/maintenance/${modal.item.id}`); toast(t("Deleted")); setModal(null); refetch(); } : undefined}
          onSubmit={async v => {
            if (modal.item) await api.patch(`/maintenance/${modal.item.id}`, v); else await api.post('/maintenance', v);
            toast(t("Saved")); setModal(null); refetch();
          }} />
      )}
    </>
  );
}
