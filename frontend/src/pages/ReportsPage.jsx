// frontend/src/pages/ReportsPage.jsx
import { useState } from 'react';
import { api, fmt } from '../utils/api';

const REPORTS = [
  { id:'financial',        icon:'📈', title:'Financial Report',       desc:'P&L, revenue, expenses, NOI' },
  { id:'occupancy',        icon:'🏢', title:'Occupancy Report',        desc:'Unit occupancy per property' },
  { id:'lease-expirations',icon:'📄', title:'Lease Expirations',       desc:'Leases expiring in 90 days' },
];

function FinancialResult({ data }) {
  if (!data) return null;
  return (
    <div style={{ marginTop:24 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
        <div>
          <div style={{ fontWeight:600, fontSize:16 }}>{data.org?.name} — Financial Report</div>
          <div style={{ fontSize:12, color:'var(--text-3)' }}>
            {new Date(data.period.from).toLocaleDateString('en-US',{month:'long',year:'numeric'})} · Generated {fmt.date(data.generatedAt)}
          </div>
        </div>
        <button className="btn btn-sm" onClick={() => window.print()}>🖨 Print</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
        <div className="metric-card"><div className="metric-label">Total Revenue</div><div className="metric-value" style={{ color:'var(--green)' }}>{fmt.currency(data.revenue.total)}</div></div>
        <div className="metric-card"><div className="metric-label">Total Expenses</div><div className="metric-value" style={{ color:'var(--red)' }}>{fmt.currency(data.expenses.total)}</div></div>
        <div className="metric-card"><div className="metric-label">Net Operating Income</div><div className="metric-value">{fmt.currency(data.noi)}</div></div>
      </div>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
        <thead><tr><th style={{ textAlign:'left', padding:'6px 8px', borderBottom:'1px solid var(--border)', color:'var(--text-2)', fontSize:11 }}>Tenant</th><th style={{ textAlign:'left', padding:'6px 8px', borderBottom:'1px solid var(--border)', color:'var(--text-2)', fontSize:11 }}>Unit</th><th style={{ textAlign:'right', padding:'6px 8px', borderBottom:'1px solid var(--border)', color:'var(--text-2)', fontSize:11 }}>Amount</th><th style={{ textAlign:'left', padding:'6px 8px', borderBottom:'1px solid var(--border)', color:'var(--text-2)', fontSize:11 }}>Date</th></tr></thead>
        <tbody>
          {data.revenue.items.map(p => (
            <tr key={p.id}>
              <td style={{ padding:'7px 8px', borderBottom:'1px solid var(--border)' }}>{p.lease?.tenant?.name}</td>
              <td style={{ padding:'7px 8px', borderBottom:'1px solid var(--border)', color:'var(--text-2)' }}>Unit {p.lease?.unit?.number}</td>
              <td style={{ padding:'7px 8px', borderBottom:'1px solid var(--border)', textAlign:'right', color:'var(--green)', fontWeight:500 }}>+{fmt.currency(p.amount)}</td>
              <td style={{ padding:'7px 8px', borderBottom:'1px solid var(--border)', color:'var(--text-2)' }}>{fmt.date(p.paidDate)}</td>
            </tr>
          ))}
          {data.expenses.items.map(e => (
            <tr key={e.id}>
              <td style={{ padding:'7px 8px', borderBottom:'1px solid var(--border)' }}>{e.description}</td>
              <td style={{ padding:'7px 8px', borderBottom:'1px solid var(--border)', color:'var(--text-2)' }}>{e.category}</td>
              <td style={{ padding:'7px 8px', borderBottom:'1px solid var(--border)', textAlign:'right', color:'var(--red)', fontWeight:500 }}>-{fmt.currency(e.amount)}</td>
              <td style={{ padding:'7px 8px', borderBottom:'1px solid var(--border)', color:'var(--text-2)' }}>{fmt.date(e.date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OccupancyResult({ data }) {
  if (!data) return null;
  return (
    <div style={{ marginTop:24 }}>
      <div style={{ fontWeight:600, fontSize:16, marginBottom:4 }}>Occupancy Report</div>
      <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:16 }}>Generated {fmt.date(data.generatedAt)}</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16 }}>
        <div className="metric-card"><div className="metric-label">Total Units</div><div className="metric-value">{data.summary.totalUnits}</div></div>
        <div className="metric-card"><div className="metric-label">Occupied</div><div className="metric-value" style={{ color:'var(--green)' }}>{data.summary.occupiedUnits}</div></div>
        <div className="metric-card"><div className="metric-label">Occupancy Rate</div><div className="metric-value">{fmt.pct(data.summary.overallOccupancyRate)}</div></div>
      </div>
      {data.properties.map(p => (
        <div key={p.id} style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 16px', marginBottom:8 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div><div style={{ fontWeight:500 }}>{p.name}</div><div style={{ fontSize:12, color:'var(--text-3)' }}>{p.address}</div></div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontWeight:600 }}>{fmt.pct(p.occupancyRate)}</div>
              <div style={{ fontSize:12, color:'var(--text-2)' }}>{p.occupiedUnits}/{p.totalUnits} units</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function LeaseResult({ data }) {
  if (!data) return null;
  return (
    <div style={{ marginTop:24 }}>
      <div style={{ fontWeight:600, fontSize:16, marginBottom:4 }}>Lease Expirations (next 90 days)</div>
      <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:16 }}>{data.count} lease{data.count !== 1 ? 's' : ''} expiring</div>
      {data.leases.map(l => {
        const days = Math.ceil((new Date(l.endDate) - new Date()) / 86400000);
        return (
          <div key={l.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, padding:'12px 16px', marginBottom:8 }}>
            <div>
              <div style={{ fontWeight:500 }}>{l.tenant?.name}</div>
              <div style={{ fontSize:12, color:'var(--text-3)' }}>{l.unit?.property?.name} — Unit {l.unit?.number}</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontWeight:500, color: days <= 30 ? 'var(--red)' : 'var(--amber)' }}>{days}d remaining</div>
              <div style={{ fontSize:12, color:'var(--text-2)' }}>Ends {fmt.date(l.endDate)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ReportsPage() {
  const [active, setActive]  = useState(null);
  const [result, setResult]  = useState(null);
  const [loading, setLoad]   = useState(false);

  const run = async (id) => {
    setActive(id);
    setResult(null);
    setLoad(true);
    try {
      const data = await api.get(`/reports/${id}`);
      setResult({ id, data });
    } finally { setLoad(false); }
  };

  return (
    <>
      <div className="section-title">Reports</div>
      <div className="grid-3">
        {REPORTS.map(r => (
          <div
            key={r.id}
            className="card"
            style={{ cursor:'pointer', border: active===r.id ? '2px solid var(--blue)' : undefined, transition:'border 0.15s' }}
            onClick={() => run(r.id)}
          >
            <div style={{ fontSize:28, marginBottom:10 }}>{r.icon}</div>
            <div style={{ fontWeight:600, marginBottom:4 }}>{r.title}</div>
            <div style={{ fontSize:12, color:'var(--text-2)' }}>{r.desc}</div>
            {active === r.id && <div style={{ marginTop:10 }}><span className="badge badge-info">Selected</span></div>}
          </div>
        ))}
      </div>

      {loading && <div className="loading" style={{ padding:48 }}>Generating report…</div>}

      {result && !loading && (
        <div className="card" style={{ marginTop:8 }}>
          {result.id === 'financial'         && <FinancialResult data={result.data} />}
          {result.id === 'occupancy'         && <OccupancyResult data={result.data} />}
          {result.id === 'lease-expirations' && <LeaseResult     data={result.data} />}
        </div>
      )}
    </>
  );
}
