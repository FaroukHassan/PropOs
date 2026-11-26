// frontend/src/pages/ChequesPage.jsx — cheque register. Colours follow the team's sheet:
// yellow = paid, green = postponed, white = pending.
import { useState, useMemo } from 'react';
import { useScope } from '../lib/scope';
import { usePeriod, PeriodPicker } from '../lib/period';
import { useApi, useSticky } from '../lib/hooks';
import { api, qs } from '../lib/api';
import { useAuth } from '../lib/auth';
import { money, date, L, isoDay, today, daysUntil, unitName, downloadCsv, options } from '../lib/format';
import { chequeFields } from '../lib/forms';
import { Spinner, ErrorBox, Empty, FormModal, Badge, Stat, Tabs, useToast } from '../components/ui';

const effective = c => (c.status === 'POSTPONED' && c.postponedTo ? c.postponedTo : c.dueDate);
const ROW_BG = { CLEARED: 'var(--paid-bg)', POSTPONED: 'var(--postponed-bg)', BOUNCED: 'var(--red-bg)' };

export default function ChequesPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [direction, setDirection] = useSticky('chq_dir', 'OUT');
  const [show, setShow] = useSticky('chq_show', 'open');
  const [byDate, setByDate] = useSticky('chq_bydate', false);
  const period = usePeriod();
  const { scoped } = useScope();
  const { data, loading, error, refetch } = useApi(scoped('/cheques', { direction }));
  const units = useApi('/units');
  const landlords = useApi('/landlords');
  const leases = useApi('/leases?active=1');
  const [modal, setModal] = useState(null);

  const rows = useMemo(() => {
    const inPeriod = c => { const d = String(effective(c)).slice(0, 10); return d >= period.from && d <= period.to; };
    const all = (data || []).filter(c => !byDate || inPeriod(c)).sort((a, b) => new Date(effective(a)) - new Date(effective(b)));
    if (show === 'open') return all.filter(c => ['PENDING', 'POSTPONED', 'DEPOSITED', 'BOUNCED'].includes(c.status));
    if (show === 'paid') return all.filter(c => c.status === 'CLEARED').reverse();
    return all;
  }, [data, show, byDate, period.from, period.to]);

  if (error) return <ErrorBox error={error} retry={refetch} />;
  const all = data || [];
  const open = all.filter(c => ['PENDING', 'POSTPONED', 'DEPOSITED'].includes(c.status));
  const in30 = open.filter(c => daysUntil(effective(c)) <= 30);
  const sum = list => list.reduce((s, c) => s + c.amount, 0);

  const quick = async (c, status, extra = {}) => {
    await api.patch(`/cheques/${c.id}`, { status, ...extra });
    toast(status === 'CLEARED' ? 'Marked paid and added to the ledger' : `Marked ${L.chequeStatus[status].toLowerCase()}`);
    refetch();
  };

  return (
    <>
      <div className="toolbar">
        <Tabs value={direction} onChange={setDirection} items={[['OUT', 'Issued (to landlords)'], ['IN', 'Received (from tenants)']]} />
        <Tabs value={show} onChange={setShow} items={[['open', 'Open'], ['paid', 'Paid'], ['all', 'All']]} />
        <Tabs value={byDate ? 'period' : 'any'} onChange={v => setByDate(v === 'period')} items={[['any', 'Any date'], ['period', 'Due in period']]} />
        {byDate && <PeriodPicker />}
        <div className="grow" />
        <button className="btn" onClick={() => downloadCsv(`cheques-${direction === 'OUT' ? 'issued' : 'received'}.csv`, rows.map(c => ({
          Date: isoDay(c.dueDate), 'Postponed to': isoDay(c.postponedTo), Amount: c.amount, Number: c.number, Bank: c.bank || '', Apartment: c.unit ? unitName(c.unit) : '', Name: c.partyName || '', Status: L.chequeStatus[c.status], Notes: c.notes || '',
        })))}>Export</button>
        {can.write && <>
          <button className="btn" onClick={() => setModal({ kind: 'series' })}>+ Series</button>
          <button className="btn btn-primary" onClick={() => setModal({ kind: 'one' })}>+ Cheque</button>
        </>}
      </div>

      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Stat accent label={direction === 'OUT' ? 'To pay in next 30 days' : 'To deposit in next 30 days'} value={money(sum(in30))} sub={`${in30.length} cheques`} />
        <Stat label="All open cheques" value={money(sum(open))} sub={`${open.length} cheques`} />
        <Stat label="Postponed" value={all.filter(c => c.status === 'POSTPONED').length} />
        <Stat label="Bounced" value={all.filter(c => c.status === 'BOUNCED').length} />
      </div>
      <div className="legend" style={{ marginBottom: 12 }}>
        <span><i style={{ background: 'var(--paid)' }} />Paid</span>
        <span><i style={{ background: 'var(--postponed)' }} />Postponed</span>
        <span><i style={{ background: '#fff', border: '1px solid var(--line-2)' }} />Pending</span>
        <span><i style={{ background: 'var(--red-bg)', border: '1px solid #f2c4bf' }} />Bounced</span>
      </div>

      {loading && !data ? <Spinner /> : rows.length === 0 ? (
        <Empty icon="✎" title="No cheques here">{direction === 'OUT' ? 'Add the cheques Sakanly gives landlords, or import your UNIT PAYMENTS sheet.' : 'Add post-dated cheques you receive from long-term tenants.'}</Empty>
      ) : (
        <div className="card card-flush">
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Apartment</th><th>Details</th><th>Cheque</th><th className="num">Amount</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {rows.map(c => {
                  const d = daysUntil(effective(c));
                  const isOpen = ['PENDING', 'POSTPONED', 'DEPOSITED'].includes(c.status);
                  return (
                    <tr key={c.id} style={{ background: ROW_BG[c.status] }}>
                      <td className="nowrap">
                        {c.status === 'POSTPONED' && c.postponedTo ? <><s className="faint small">{date(c.dueDate)}</s><div className="bold">{date(c.postponedTo)}</div></> : <div className="bold">{date(c.dueDate)}</div>}
                        {isOpen && <div className="tiny" style={{ color: d < 0 ? 'var(--red)' : d <= 7 ? 'var(--amber)' : 'var(--text-3)' }}>{d < 0 ? `${-d} days late` : d === 0 ? 'today' : `in ${d} days`}</div>}
                      </td>
                      <td>{c.unit ? unitName(c.unit) : '—'}</td>
                      <td className="small">{c.partyName || c.landlord?.name || c.lease?.tenant?.name || '—'}{c.notes && <div className="tiny faint" style={{ maxWidth: 320 }}>{c.notes}</div>}</td>
                      <td className="small nowrap">#{c.number}<div className="tiny faint">{c.bank}</div></td>
                      <td className="num bold">{money(c.amount)}</td>
                      <td><Badge value={c.status} map={L.chequeStatus} /></td>
                      <td className="right nowrap">
                        {can.write && isOpen && <>
                          <button className="btn btn-sm" onClick={() => quick(c, 'CLEARED')}>Paid</button>{' '}
                          <button className="btn btn-sm" onClick={() => setModal({ kind: 'postpone', cheque: c })}>Postpone</button>{' '}
                        </>}
                        {can.write && <button className="btn btn-sm btn-ghost" onClick={() => setModal({ kind: 'one', cheque: c })}>Edit</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal?.kind === 'one' && (
        <FormModal title={modal.cheque ? `Cheque #${modal.cheque.number}` : 'Add cheque'} wide
          fields={chequeFields({ units: units.data, landlords: landlords.data, leases: leases.data })}
          initial={modal.cheque ? { ...modal.cheque, dueDate: isoDay(modal.cheque.dueDate), postponedTo: isoDay(modal.cheque.postponedTo) } : { direction }}
          onClose={() => setModal(null)}
          onDelete={modal.cheque ? async () => { await api.del(`/cheques/${modal.cheque.id}`); toast('Deleted'); setModal(null); refetch(); } : undefined}
          onSubmit={async v => {
            if (modal.cheque) await api.patch(`/cheques/${modal.cheque.id}`, v); else await api.post('/cheques', v);
            toast('Saved'); setModal(null); refetch();
          }} />
      )}
      {modal?.kind === 'postpone' && (
        <FormModal title={`Postpone cheque #${modal.cheque.number}`}
          intro={<p className="small muted" style={{ marginBottom: 12 }}>{money(modal.cheque.amount)} dated {date(modal.cheque.dueDate)}</p>}
          fields={[
            { name: 'postponedTo', label: 'New date', type: 'date', required: true, default: isoDay(new Date(new Date(effective(modal.cheque)).getTime() + 14 * 86400000)) },
            { name: 'notes', label: 'Reason / notes', type: 'textarea', default: modal.cheque.notes || '' },
          ]}
          submitLabel="Postpone" onClose={() => setModal(null)}
          onSubmit={async v => { await quick(modal.cheque, 'POSTPONED', v); setModal(null); }} />
      )}
      {modal?.kind === 'series' && (
        <FormModal title="Add a series of cheques" wide
          intro={<p className="small muted" style={{ marginBottom: 12 }}>For example 4 quarterly cheques for a year's rent. Numbers count up from the first one.</p>}
          fields={[
            { name: 'direction', label: 'Cheques are', type: 'select', required: true, options: options(L.chequeDir), default: direction },
            { name: 'count', label: 'How many', type: 'number', required: true, default: 4 },
            { name: 'amount', label: 'Amount each (AED)', type: 'number', required: true },
            { name: 'everyMonths', label: 'Every … months', type: 'number', required: true, default: 3 },
            { name: 'firstDate', label: 'First cheque date', type: 'date', required: true, default: today() },
            { name: 'firstNumber', label: 'First cheque no.', required: true },
            { name: 'bank', label: 'Bank' },
            { name: 'unitId', label: 'Apartment', type: 'select', options: (units.data || []).map(u => ({ value: u.id, label: unitName(u) })) },
            { name: 'landlordId', label: 'Landlord', type: 'select', options: (landlords.data || []).map(l => ({ value: l.id, label: l.name })), show: v => v.direction === 'OUT' },
            { name: 'leaseId', label: 'Tenancy', type: 'select', options: (leases.data || []).map(l => ({ value: l.id, label: `${l.tenant.name} — ${unitName(l.unit)}` })), show: v => v.direction === 'IN' },
            { name: 'partyName', label: 'Name / paid from' },
            { name: 'notes', label: 'Notes', type: 'textarea' },
          ]}
          onClose={() => setModal(null)}
          onSubmit={async v => { const r = await api.post('/cheques/series', v); toast(`${r.created} cheques added`); setModal(null); refetch(); }} />
      )}
    </>
  );
}
