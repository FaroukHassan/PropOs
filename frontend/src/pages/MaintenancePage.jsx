// frontend/src/pages/MaintenancePage.jsx
import { useState } from 'react';
import { useScope } from '../lib/scope';
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
  const { scoped } = useScope();
  const { data, loading, error, refetch } = useApi(scoped('/maintenance', { status: status === 'OPEN_ALL' ? '' : status }));
  const units = useApi('/units');
  const [modal, setModal] = useState(null);
  if (error) return <ErrorBox error={error} retry={refetch} />;
  const rows = (data || []).filter(m => status !== 'OPEN_ALL' || m.status !== 'RESOLVED');

  const setStat = async (m, s) => { await api.patch(`/maintenance/${m.id}`, { status: s }); toast(`Marked ${L.maintStatus[s].toLowerCase()}`); refetch(); };

  return (
    <>
      <div className="toolbar">
        <Tabs value={status} onChange={setStatus} items={[['OPEN_ALL', 'Not resolved'], ['OPEN', 'Open'], ['IN_PROGRESS', 'In progress'], ['RESOLVED', 'Resolved']]} />
        <div className="grow" />
        {can.write && <button className="btn btn-primary" onClick={() => setModal({})}>+ Request</button>}
      </div>
      {loading && !data ? <Spinner /> : rows.length === 0 ? <Empty icon="⚒" title="Nothing here">Log AC, plumbing and other issues so nothing is forgotten.</Empty> : (
        <div className="card card-flush">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Problem</th><th>Where</th><th>Category</th><th>Priority</th><th>Assigned</th><th>Reported</th><th className="num">Cost</th><th>Status</th><th></th></tr></thead>
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
                      {can.write && m.status === 'OPEN' && <button className="btn btn-sm" onClick={() => setStat(m, 'IN_PROGRESS')}>Start</button>}
                      {can.write && m.status !== 'RESOLVED' && <> <button className="btn btn-sm" onClick={() => setStat(m, 'RESOLVED')}>Done</button></>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {modal && (
        <FormModal title={modal.item ? 'Edit request' : 'New maintenance request'} wide fields={maintenanceFields({ units: units.data })} initial={modal.item} onClose={() => setModal(null)}
          onDelete={modal.item ? async () => { await api.del(`/maintenance/${modal.item.id}`); toast('Deleted'); setModal(null); refetch(); } : undefined}
          onSubmit={async v => {
            if (modal.item) await api.patch(`/maintenance/${modal.item.id}`, v); else await api.post('/maintenance', v);
            toast('Saved'); setModal(null); refetch();
          }} />
      )}
    </>
  );
}
