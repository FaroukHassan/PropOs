// frontend/src/pages/LeasingPage.jsx — the leasing department: brokerage deals for short-term
// (1–11 months) and yearly contracts, from first enquiry to signed contract and fee collected.
import { useState, useMemo } from 'react';
import { t, isAr } from '../lib/i18n';
import { useApi, useSticky } from '../lib/hooks';
import { api, qs } from '../lib/api';
import { useAuth } from '../lib/auth';
import { usePeriod, PeriodPicker } from '../lib/period';
import { money, date, shortDate, isoDay, today, pct, L, options, downloadCsv, daysUntil } from '../lib/format';
import { dealFields } from '../lib/forms';
import { Spinner, ErrorBox, Empty, FormModal, Badge, Drawer, Stat, Tabs, useToast } from '../components/ui';
import LeasingAvailability from '../components/LeasingAvailability';

const STAGES = ['LEAD', 'VIEWING', 'RESERVED', 'SIGNED', 'CANCELLED'];
const NEXT = { LEAD: 'VIEWING', VIEWING: 'RESERVED', RESERVED: 'SIGNED' };
const DATE_FIELDS = ['moveIn', 'viewingAt', 'followUpAt', 'signedAt'];
const forForm = d => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, DATE_FIELDS.includes(k) && v ? isoDay(v) : v]));
const rentText = d => (d.rent ? `${money(d.rent)}${d.contractType === 'YEARLY' ? t(' / year') : t(' / month')}` : '');
const where = d => [d.property, d.unitNo].filter(Boolean).join(' · ') || d.area || '—';

export default function LeasingPage() {
  const { can } = useAuth();
  const toast = useToast();
  const period = usePeriod();
  const [view, setView] = useSticky('deal_view', 'board');
  const [type, setType] = useSticky('deal_type', '');
  const [agent, setAgent] = useSticky('deal_agent', '');
  const [q, setQ] = useState('');
  const params = { ...period.params, contractType: type, agent };
  const { data, loading, error, refetch } = useApi(`/leasing${qs(params)}`);
  const summary = useApi(`/leasing/summary${qs(period.params)}`);
  const opts = useApi('/leasing/options');
  const [modal, setModal] = useState(null);
  const [openId, setOpenId] = useState(null);
  const reload = () => { refetch(); summary.refetch(); opts.refetch(); };

  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (data || []).filter(d => !n || [d.number, d.clientName, d.clientPhone, d.property, d.unitNo, d.landlordName, d.area].some(x => String(x ?? '').toLowerCase().includes(n)));
  }, [data, q]);

  if (error) return <ErrorBox error={error} retry={refetch} />;
  const s = summary.data;
  const agents = opts.data?.agents || [];

  const save = async (v, existing) => {
    if (existing) { await api.patch(`/leasing/${existing.id}`, v); toast(t('Saved')); }
    else { const d = await api.post('/leasing', v); toast(t('Deal #{0} added', [d.number])); }
    setModal(null); reload();
  };

  const tabs = <Tabs value={view} onChange={setView} items={[['board', t('Pipeline')], ['list', t('List')], ['agents', t('Agents')], ['availability', t('Availability')]]} />;
  if (view === 'availability') {
    return (
      <>
        <div className="toolbar">{tabs}</div>
        <LeasingAvailability onNewDeal={can.write ? initial => setModal({ kind: 'deal', initial }) : null} />
        {modal?.kind === 'deal' && (
          <FormModal wide title={t('New leasing deal')} fields={dealFields({ agents })} initial={modal.initial} onClose={() => setModal(null)} onSubmit={v => save(v)} />
        )}
      </>
    );
  }

  return (
    <>
      <div className="toolbar">
        <PeriodPicker />
        {tabs}
      </div>
      <div className="toolbar">
        <Tabs value={type} onChange={setType} items={[['', t('All contracts')], ['SHORT_TERM', t('Short term')], ['YEARLY', t('Yearly')]]} />
        {agents.length > 0 && (
          <select className="input input-sm" value={agent} onChange={e => setAgent(e.target.value)} aria-label={t('Agent')}>
            <option value="">{t('All agents')}</option>
            {agents.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
        <input className="input input-sm" placeholder={t('Search client, phone, building, deal no.')} value={q} onChange={e => setQ(e.target.value)} style={{ width: 240 }} />
        <div className="grow" />
        <button className="btn" onClick={() => downloadCsv(`leasing-deals-${period.from}_to_${period.to}.csv`, rows.map(d => ({
          Deal: d.number, Stage: L.dealStatus[d.status], Contract: L.contractType[d.contractType], Client: d.clientName, Phone: d.clientPhone || '',
          Source: d.source || '', Agent: d.agent || '', Property: d.property || '', Unit: d.unitNo || '', Area: d.area || '', Landlord: d.landlordName || '',
          'Move-in': isoDay(d.moveIn), Months: d.months || '', Rent: d.rent || '', Cheques: d.cheques || '', Fee: d.fee || '',
          'Fee collected': d.money.feeCollected, 'Fee outstanding': d.money.feeOutstanding, 'Agent commission': d.agentCommission || '', 'Broker commission': d.brokerCommission || '',
          Signed: isoDay(d.signedAt), Notes: d.notes || '',
        })))}>{t('Export')}</button>
        {can.admin && <label className="btn" title={t('Load past deals from a .json file prepared from your sheets')}>
          {t('Import deals')}
          <input type="file" accept="application/json,.json" hidden onChange={async e => {
            const f = e.target.files[0]; e.target.value = '';
            if (!f) return;
            try {
              const body = JSON.parse(await f.text());
              const r = await api.post('/leasing/import', body);
              toast(t('{0} new, {1} updated, {2} payments linked', [r.created, r.updated, r.linked + r.alreadyLinked]) + (r.unmatched.length ? ` · ${t('{0} payments not found in the ledger', [r.unmatched.length])}` : ''));
              reload();
            } catch (err) { toast(err.message, 'error'); }
          }} />
        </label>}
        {can.write && <button className="btn btn-primary" onClick={() => setModal({})}>{t('+ New deal')}</button>}
      </div>

      {s && (
        <div className="grid g4" style={{ marginBottom: 16 }}>
          <Stat accent label={t('Deals signed · {0}', [period.label])} value={`${s.signed}`}
            sub={t('{0} short term · {1} yearly', [s.byType.SHORT_TERM.deals, s.byType.YEARLY.deals])} />
          <Stat label={t('Fees from signed deals')} value={money(s.fees)} sub={t('{0} collected in this period', [money(s.feesCollected)])} />
          <Stat label={t('Fees still to collect')} value={money(s.feesOutstanding)} sub={s.heldForLandlords ? t('{0} client money held for landlords', [money(s.heldForLandlords)]) : t('All signed deals')} />
          <Stat label={t('Win rate')} value={s.conversion === null ? '—' : pct(s.conversion)}
            sub={t('{0} open: {1} leads · {2} viewings · {3} reserved', [s.open.LEAD + s.open.VIEWING + s.open.RESERVED, s.open.LEAD, s.open.VIEWING, s.open.RESERVED])}
            progress={s.conversion ?? undefined} />
        </div>
      )}

      {loading && !data ? <Spinner /> : (data || []).length === 0 && !type && !agent ? (
        <Empty icon="◆" title={t('No leasing deals yet')}
          action={can.write && <button className="btn btn-primary" onClick={() => setModal({})}>{t('+ New deal')}</button>}>
          {t('Add every enquiry as a new lead, move it to viewing, reserved and signed, and record the agency fee when it comes in.')}
        </Empty>
      ) : view === 'board' ? (
        <div className="deal-board">
          {STAGES.map(st => {
            const list = rows.filter(d => d.status === st);
            const fees = list.reduce((a, d) => a + (d.fee || 0), 0);
            return (
              <div key={st} className={`deal-col st-${st}`}>
                <div className="deal-col-head">
                  <Badge value={st} map={L.dealStatus} /><span className="small faint">{list.length}{fees ? ` · ${money(fees)}` : ''}</span>
                </div>
                {list.length === 0 && <div className="deal-empty tiny faint">{st === 'SIGNED' || st === 'CANCELLED' ? t('None in this period') : t('None')}</div>}
                {list.map(d => <DealCard key={d.id} d={d} onOpen={() => setOpenId(d.id)} />)}
              </div>
            );
          })}
        </div>
      ) : view === 'list' ? (
        rows.length === 0 ? <Empty icon="🔍" title={t('No matches')} /> : (
          <div className="card card-flush">
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>{t('Deal')}</th><th>{t('Client')}</th><th>{t('Property')}</th><th>{t('Contract')}</th><th className="num">{t('Rent')}</th><th className="num">{t('Fee')}</th><th className="num">{t('Still to collect')}</th><th>{t('Agent')}</th><th>{t('Stage')}</th></tr></thead>
                <tbody>
                  {rows.map(d => (
                    <tr key={d.id} className="clickable" onClick={() => setOpenId(d.id)}>
                      <td className="bold nowrap">#{d.number}</td>
                      <td>{d.clientName}{d.clientPhone && <div className="tiny faint"><bdi dir="ltr">{d.clientPhone}</bdi></div>}</td>
                      <td className="small">{where(d)}</td>
                      <td><Badge value={d.contractType}>{d.contractType === 'YEARLY' ? t('Yearly') : t('{0} months', [d.months || '1–11'])}</Badge></td>
                      <td className="num small">{rentText(d) || '—'}</td>
                      <td className="num">{d.fee ? money(d.fee) : '—'}</td>
                      <td className="num">{d.status === 'SIGNED' && d.money.feeOutstanding ? <b>{money(d.money.feeOutstanding)}</b> : '—'}</td>
                      <td className="small">{d.agent || '—'}</td>
                      <td><Badge value={d.status} map={L.dealStatus} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        <div className="card card-flush">
          <div className="card-head"><div className="card-title">{t('Agents · {0}', [period.label])}</div></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{t('Agent')}</th><th className="num">{t('Deals signed')}</th><th className="num">{t('Fees')}</th><th className="num">{t('Agent commission')}</th></tr></thead>
              <tbody>
                {(s?.byAgent || []).length === 0 && <tr><td colSpan={4} className="muted">{t('No signed deals in this period.')}</td></tr>}
                {(s?.byAgent || []).map(a => (
                  <tr key={a.agent}><td className="bold">{a.agent === '—' ? t('No agent') : a.agent}</td><td className="num">{a.deals}</td><td className="num">{money(a.fees)}</td><td className="num">{money(a.commission)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {openId && <DealDrawer id={openId} onClose={() => setOpenId(null)} onChanged={reload} onEdit={d => setModal({ deal: d })} />}

      {modal && (
        <FormModal wide title={modal.deal ? t('Edit deal #{0}', [modal.deal.number]) : t('New leasing deal')}
          fields={dealFields({ agents })} initial={modal.deal ? forForm(modal.deal) : { moveIn: '', followUpAt: today() }}
          onClose={() => setModal(null)} onSubmit={v => save(v, modal.deal)}
          onDelete={modal.deal && can.write ? async () => { await api.del(`/leasing/${modal.deal.id}`); toast(t('Deal deleted')); setModal(null); setOpenId(null); reload(); } : undefined} />
      )}
    </>
  );
}

function DealCard({ d, onOpen }) {
  const follow = d.followUpAt && !['SIGNED', 'CANCELLED'].includes(d.status) ? daysUntil(d.followUpAt) : null;
  return (
    <button className="deal-card" onClick={onOpen}>
      <div className="row-between"><span className="tiny faint">#{d.number}</span><Badge value={d.contractType}>{d.contractType === 'YEARLY' ? t('Yearly') : t('{0} mo', [d.months || '1–11'])}</Badge></div>
      <div className="bold deal-client">{d.clientName}</div>
      <div className="tiny muted">{where(d)}{d.unitType ? ` · ${d.unitType}` : ''}</div>
      <div className="row-between" style={{ marginTop: 6 }}>
        <span className="small">{rentText(d)}</span>
        {d.fee ? <span className="small bold">{t('Fee {0}', [money(d.fee)])}</span> : null}
      </div>
      <div className="row-between tiny" style={{ marginTop: 4 }}>
        <span className="faint">{d.agent || ''}</span>
        {follow !== null && <span className={follow < 0 ? 'deal-late' : 'faint'}>{follow < 0 ? t('Follow up {0}d late', [-follow]) : follow === 0 ? t('Follow up today') : t('Follow up {0}', [shortDate(d.followUpAt)])}</span>}
        {d.status === 'SIGNED' && d.money.feeOutstanding > 0 && <span className="deal-late">{t('{0} to collect', [money(d.money.feeOutstanding)])}</span>}
      </div>
    </button>
  );
}

function DealDrawer({ id, onClose, onChanged, onEdit }) {
  const { can } = useAuth();
  const toast = useToast();
  const { data: d, refetch } = useApi(`/leasing/${id}`);
  const [pay, setPay] = useState(null);
  const [cancel, setCancel] = useState(false);
  if (!d) return <Drawer title={t('Loading…')} onClose={onClose}><Spinner /></Drawer>;
  const m = d.money;
  const move = async (status, extra = {}) => {
    await api.patch(`/leasing/${d.id}`, { status, ...extra });
    toast(t('Moved to {0}', [L.dealStatus[status]])); refetch(); onChanged();
  };
  const wa = d.clientPhone ? `https://wa.me/${d.clientPhone.replace(/\D/g, '')}` : null;

  return (
    <Drawer title={t('Deal #{0} · {1}', [d.number, d.clientName])} subtitle={`${L.contractType[d.contractType]} · ${where(d)}`} onClose={onClose}
      actions={can.write && <button className="btn btn-sm" onClick={() => onEdit(d)}>{t('Edit')}</button>}>
      <div className="deal-steps">
        {STAGES.filter(s => s !== 'CANCELLED').map((s, i) => {
          const at = STAGES.indexOf(d.status);
          return <div key={s} className={`deal-step ${d.status === 'CANCELLED' ? '' : i < at ? 'done' : i === at ? 'now' : ''}`}><span>{i + 1}</span>{L.dealStatus[s]}</div>;
        })}
      </div>
      {d.status === 'CANCELLED' && <div className="alert alert-error">{t('Cancelled')}{d.lostReason ? ` — ${d.lostReason}` : ''}</div>}
      {can.write && (
        <div className="row wrap" style={{ marginBottom: 16 }}>
          {NEXT[d.status] && <button className="btn btn-primary" onClick={() => move(NEXT[d.status])}>{t('Move to {0}', [L.dealStatus[NEXT[d.status]]])} {isAr ? '←' : '→'}</button>}
          {d.status !== 'CANCELLED' && d.status !== 'SIGNED' && <button className="btn btn-danger" onClick={() => setCancel(true)}>{t('Cancel deal')}</button>}
          {(d.status === 'CANCELLED' || d.status === 'SIGNED') && <button className="btn" onClick={() => move('LEAD')}>{t('Reopen')}</button>}
        </div>
      )}

      <div className="section-title">{t('Client')}</div>
      <dl className="kv">
        <dt>{t('Name')}</dt><dd>{d.clientName}</dd>
        {d.clientPhone && <><dt>{t('Phone')}</dt><dd><a href={wa} target="_blank" rel="noreferrer" dir="ltr">{d.clientPhone}</a></dd></>}
        {d.clientEmail && <><dt>{t('Email')}</dt><dd>{d.clientEmail}</dd></>}
        {d.clientNationality && <><dt>{t('Nationality')}</dt><dd>{d.clientNationality}</dd></>}
        {d.source && <><dt>{t('Lead source')}</dt><dd>{t(d.source)}</dd></>}
        {d.agent && <><dt>{t('Agent')}</dt><dd>{d.agent}</dd></>}
      </dl>

      <div className="section-title">{t('Property & terms')}</div>
      <dl className="kv">
        <dt>{t('Property')}</dt><dd>{where(d)}{d.unitType ? ` · ${d.unitType}` : ''}{d.area && d.property ? ` · ${d.area}` : ''}</dd>
        {d.landlordName && <><dt>{t('Landlord')}</dt><dd>{d.landlordName}{d.landlordPhone && <> · <bdi dir="ltr">{d.landlordPhone}</bdi></>}</dd></>}
        <dt>{t('Contract')}</dt><dd>{L.contractType[d.contractType]}{d.months ? ` · ${t('{0} months', [d.months])}` : ''}</dd>
        {d.moveIn && <><dt>{t('Dates')}</dt><dd>{date(d.moveIn)}{d.endDate ? ` – ${date(d.endDate)}` : ''}</dd></>}
        {d.rent && <><dt>{t('Rent')}</dt><dd>{rentText(d)}{d.cheques ? ` · ${t('{0} cheques', [d.cheques])}` : ''}</dd></>}
        {d.deposit && <><dt>{t('Deposit')}</dt><dd>{money(d.deposit)}</dd></>}
        {d.viewingAt && <><dt>{t('Viewing')}</dt><dd>{date(d.viewingAt)}</dd></>}
        {d.followUpAt && <><dt>{t('Next follow-up')}</dt><dd>{date(d.followUpAt)}</dd></>}
        {d.signedAt && <><dt>{t('Signed')}</dt><dd>{date(d.signedAt)}</dd></>}
      </dl>
      {d.notes && <p className="small muted" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{d.notes}</p>}

      <div className="section-title">{t('Money')}</div>
      <dl className="kv">
        <dt>{t('Sakanly fee')}</dt><dd><b>{money(d.fee || 0)}</b> · {t('{0} collected', [money(m.feeCollected)])}{m.feeOutstanding ? <> · <span className="deal-late">{t('{0} to collect', [money(m.feeOutstanding)])}</span></> : ''}</dd>
        {(d.agentCommission || d.brokerCommission) ? <><dt>{t('Commissions')}</dt><dd>{[d.agentCommission && `${d.agent || t('Agent')} ${money(d.agentCommission)}`, d.brokerCommission && `${d.brokerName || t('Broker')} ${money(d.brokerCommission)}`].filter(Boolean).join(' · ')}{m.commissionOwed ? <> · <span className="deal-late">{t('{0} still to pay', [money(m.commissionOwed)])}</span></> : ''}</dd></> : null}
        {(m.clientIn || m.clientOut) ? <><dt>{t('Client money')}</dt><dd>{t('{0} received · {1} passed on', [money(m.clientIn), money(m.clientOut)])}{m.heldForLandlord ? <> · <b>{t('{0} held for landlord', [money(m.heldForLandlord)])}</b></> : ''}</dd></> : null}
        <dt>{t('Net to Sakanly')}</dt><dd><b>{money(m.net)}</b></dd>
      </dl>
      {can.write && (
        <div className="row wrap" style={{ marginTop: 10 }}>
          <button className="btn btn-sm btn-primary" onClick={() => setPay({ kind: 'fee', amount: m.feeOutstanding || '' })}>{t('+ Fee received')}</button>
          <button className="btn btn-sm" onClick={() => setPay({ kind: 'client_in', amount: '' })}>{t('+ Client money')}</button>
          <button className="btn btn-sm" onClick={() => setPay({ kind: 'client_out', amount: m.heldForLandlord || '' })}>{t('+ Paid to landlord')}</button>
          <button className="btn btn-sm" onClick={() => setPay({ kind: 'commission', amount: m.commissionOwed || '' })}>{t('+ Commission paid')}</button>
        </div>
      )}
      {d.transactions.length > 0 && (
        <table className="table" style={{ marginTop: 12 }}>
          <tbody>
            {d.transactions.map(x => (
              <tr key={x.id}><td className="small nowrap">{date(x.date)}</td><td className="small">{L.category[x.category]}</td>
                <td className="num small" style={{ color: x.type === 'INCOME' ? 'var(--green)' : 'var(--red)' }}>{x.type === 'INCOME' ? '+' : '−'}{money(x.amount)}</td></tr>
            ))}
          </tbody>
        </table>
      )}

      {pay && (
        <FormModal title={t('Record payment — Deal #{0}', [d.number])} submitLabel={t('Record')}
          fields={[
            { name: 'kind', label: t('What is it?'), type: 'select', required: true, options: options(L.dealPay), default: pay.kind, full: true },
            { name: 'amount', label: t('Amount (AED)'), type: 'number', required: true, default: pay.amount },
            { name: 'date', label: t('Date'), type: 'date', required: true, default: today() },
            { name: 'method', label: t('Paid by'), type: 'select', required: true, options: options(L.method), default: 'CASH' },
            { name: 'paidTo', label: t('Paid to'), show: v => v.kind === 'commission', placeholder: d.agent || d.brokerName || '' },
            { name: 'notes', label: t('Notes'), type: 'textarea' },
          ]}
          onClose={() => setPay(null)}
          onSubmit={async v => { await api.post(`/leasing/${d.id}/payments`, v); toast(t('Payment recorded')); setPay(null); refetch(); onChanged(); }} />
      )}
      {cancel && (
        <FormModal title={t('Cancel deal #{0}', [d.number])} submitLabel={t('Cancel deal')}
          fields={[{ name: 'lostReason', label: t('Why was it cancelled?'), full: true, placeholder: t('Client chose another flat, landlord rented it…') }]}
          onClose={() => setCancel(false)} onSubmit={async v => { await move('CANCELLED', v); setCancel(false); }} />
      )}
    </Drawer>
  );
}
