// frontend/src/pages/DashboardPage.jsx
import { useFetch } from '../hooks/useFetch';
import { fmt, STATUS_BADGE } from '../utils/api';
import { Badge, Spinner } from '../components/UI';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

function MetricCard({ label, value, change, changeType }) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {change && <div className={`metric-change ${changeType}`}>{change}</div>}
    </div>
  );
}

function OccupancyRing({ rate = 0, occupied = 0, total = 0 }) {
  const r = 28, circ = 2 * Math.PI * r;
  const dash = (rate / 100) * circ;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:20 }}>
      <div style={{ position:'relative', width:80, height:80, flexShrink:0 }}>
        <svg viewBox="0 0 80 80" width="80" height="80">
          <circle cx="40" cy="40" r={r} fill="none" stroke="var(--border)" strokeWidth="10"/>
          <circle cx="40" cy="40" r={r} fill="none" stroke="var(--blue)" strokeWidth="10"
            strokeDasharray={`${dash} ${circ}`} strokeDashoffset={circ * 0.25}
            strokeLinecap="round" style={{ transition:'stroke-dasharray 0.6s' }}/>
        </svg>
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
          <div style={{ fontSize:16, fontWeight:600 }}>{rate.toFixed(0)}%</div>
          <div style={{ fontSize:9, color:'var(--text-3)' }}>occupied</div>
        </div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--blue)' }}/>
          <span>Occupied <strong>{occupied}</strong></span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--border-2)' }}/>
          <span>Vacant <strong>{total - occupied}</strong></span>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: summary,  loading: l1 } = useFetch('/finance/summary');
  const { data: trend,    loading: l2 } = useFetch('/finance/revenue-trend?months=6');
  const { data: payments, loading: l3 } = useFetch('/payments?month=' + new Date().toISOString().slice(0,7));
  const { data: props,    loading: l4 } = useFetch('/properties');
  const { data: maint,    loading: l5 } = useFetch('/maintenance?status=OPEN');

  if (l1 || l2 || l3 || l4 || l5) return <Spinner />;

  // Compute occupancy from properties
  const totalUnits    = (props || []).reduce((s, p) => s + (p.totalUnits    || 0), 0);
  const occupiedUnits = (props || []).reduce((s, p) => s + (p.occupiedUnits || 0), 0);
  const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

  const recentPayments = (payments || []).slice(0, 5);
  const openMaint      = (maint    || []).slice(0, 4);

  const MAINT_ICONS = { PLUMBING:'🚿', ELECTRICAL:'💡', HVAC:'🔥', APPLIANCE:'🔧', GENERAL:'🔒', STRUCTURAL:'🏗' };

  return (
    <>
      <div className="metrics-grid">
        <MetricCard label="Total Properties"  value={(props||[]).length}             change={`${totalUnits} total units`} changeType="" />
        <MetricCard label="Occupancy Rate"    value={fmt.pct(occupancyRate)}         change={`${occupiedUnits} of ${totalUnits} units`} changeType="up" />
        <MetricCard label="Monthly Revenue"   value={fmt.currency(summary?.totalRevenue)}  change={`NOI: ${fmt.currency(summary?.noi)}`} changeType="up" />
        <MetricCard label="Collection Rate"   value={fmt.pct(summary?.collectionRate)}     change={summary?.collectionRate >= 90 ? '✓ On target' : '↓ Below 90%'} changeType={summary?.collectionRate >= 90 ? 'up' : 'down'} />
      </div>

      <div className="grid-3-1">
        {/* Revenue trend chart */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Revenue vs Expenses (6 months)</div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={trend || []} barGap={2} barSize={14}>
              <XAxis dataKey="month" tick={{ fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize:11 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip formatter={(v) => fmt.currency(v)} />
              <Legend iconSize={8} wrapperStyle={{ fontSize:12 }} />
              <Bar dataKey="revenue"  name="Revenue"  fill="var(--blue)" radius={[3,3,0,0]} />
              <Bar dataKey="expenses" name="Expenses" fill="var(--red)"  radius={[3,3,0,0]} opacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Occupancy */}
        <div className="card">
          <div className="card-header"><div className="card-title">Occupancy</div></div>
          <OccupancyRing rate={occupancyRate} occupied={occupiedUnits} total={totalUnits} />
          <div style={{ marginTop:16, paddingTop:12, borderTop:'1px solid var(--border)' }}>
            {(props||[]).slice(0,3).map(p => (
              <div key={p.id} style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:5, color:'var(--text-2)' }}>
                <span>{p.name}</span>
                <span style={{ color:'var(--text)' }}>{p.occupiedUnits}/{p.totalUnits}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Recent Payments */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Recent Payments</div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Tenant</th><th>Amount</th><th>Status</th><th>Due</th></tr></thead>
              <tbody>
                {recentPayments.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign:'center', color:'var(--text-3)', padding:24 }}>No payments this month</td></tr>
                )}
                {recentPayments.map(p => (
                  <tr key={p.id}>
                    <td>{p.lease?.tenant?.name || '—'}</td>
                    <td style={{ fontWeight:500 }}>{fmt.currency(p.amount)}</td>
                    <td><Badge status={p.status} /></td>
                    <td style={{ color:'var(--text-3)' }}>{fmt.dateShort(p.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Maintenance */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Open Maintenance</div>
            <span style={{ fontSize:12, color:'var(--text-3)' }}>{(maint||[]).length} open</span>
          </div>
          {openMaint.length === 0
            ? <div style={{ textAlign:'center', color:'var(--text-3)', padding:24, fontSize:13 }}>🎉 All clear!</div>
            : openMaint.map(m => (
              <div className="maint-item" key={m.id}>
                <div className="maint-icon" style={{ background: m.priority === 'URGENT' ? 'var(--red-bg)' : m.priority === 'HIGH' ? 'var(--amber-bg)' : 'var(--bg-3)' }}>
                  {MAINT_ICONS[m.category] || '🔧'}
                </div>
                <div className="maint-info">
                  <div className="maint-title">{m.title}</div>
                  <div className="maint-sub">Unit {m.unit?.number} · {m.unit?.property?.name} · {fmt.dateShort(m.createdAt)}</div>
                </div>
                <Badge priority={m.priority} />
              </div>
            ))
          }
        </div>
      </div>
    </>
  );
}
