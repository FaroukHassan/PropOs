// frontend/src/pages/FinancePage.jsx
import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { api, fmt } from '../utils/api';
import { Badge, Modal, EmptyState, Spinner, FormGroup } from '../components/UI';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const now   = new Date();
const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(now.getFullYear(), now.getMonth() - i);
  return { label: d.toLocaleString('default', { month: 'long', year: 'numeric' }), value: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` };
});

const PIE_COLORS = ['#2563eb','#d97706','#16a34a','#dc2626','#7c3aed','#0891b2','#be185d'];

export default function FinancePage() {
  const [month, setMonth]       = useState(MONTHS[0].value);
  const [showExpense, setShow]  = useState(false);
  const [expForm, setExpForm]   = useState({ category:'MAINTENANCE', description:'', amount:'', date: now.toISOString().slice(0,10), vendor:'' });
  const [busy, setBusy]         = useState(false);

  const [yr, mo] = month.split('-');
  const qp = `?year=${yr}&month=${parseInt(mo)}`;

  const { data: summary,   loading: l1, refetch: r1 } = useFetch(`/finance/summary${qp}`,   [month]);
  const { data: trend,     loading: l2 }               = useFetch('/finance/revenue-trend?months=6');
  const { data: payments,  loading: l3 }               = useFetch(`/payments?month=${month}`, [month]);
  const { data: expenses,  loading: l4, refetch: r4 }  = useFetch(`/finance/expenses`,        [month]);
  const { data: breakdown, loading: l5, refetch: r5 }  = useFetch(`/finance/expense-breakdown${qp}`, [month]);

  if (l1 || l2 || l3 || l4 || l5) return <Spinner />;

  const handleMarkPaid = async (id) => {
    await api.post(`/payments/${id}/mark-paid`, { method: 'MANUAL' });
    r1();
  };

  const handleAddExpense = async e => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/finance/expenses', { ...expForm, amount: parseFloat(expForm.amount) });
      r4(); r5(); r1();
      setShow(false);
      setExpForm({ category:'MAINTENANCE', description:'', amount:'', date: now.toISOString().slice(0,10), vendor:'' });
    } finally { setBusy(false); }
  };

  const handleDeleteExpense = async (id) => {
    if (!confirm('Delete this expense?')) return;
    await api.delete(`/finance/expenses/${id}`);
    r4(); r5(); r1();
  };

  const pieData = (breakdown||[]).map(b => ({ name: b.category, value: b.total }));

  return (
    <>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div className="section-title" style={{ margin:0 }}>Finance</div>
        <div style={{ display:'flex', gap:8 }}>
          <select className="form-input" style={{ width:200 }} value={month} onChange={e => setMonth(e.target.value)}>
            {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setShow(true)}>+ Add Expense</button>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        <div className="metric-card">
          <div className="metric-label">Revenue</div>
          <div className="metric-value" style={{ color:'var(--green)' }}>{fmt.currency(summary?.totalRevenue)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Expenses</div>
          <div className="metric-value" style={{ color:'var(--red)' }}>{fmt.currency(summary?.totalExpenses)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Net Operating Income</div>
          <div className="metric-value">{fmt.currency(summary?.noi)}</div>
          <div className={`metric-change ${(summary?.noi||0) >= 0 ? 'up' : 'down'}`}>
            {(summary?.noi||0) >= 0 ? '↑ Profitable' : '↓ Loss this period'}
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Collection Rate</div>
          <div className="metric-value">{fmt.pct(summary?.collectionRate)}</div>
          <div className={`metric-change ${(summary?.collectionRate||0) >= 90 ? 'up' : 'down'}`}>
            {(summary?.collectionRate||0) >= 90 ? '✓ On target' : 'Below 90% target'}
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid-2" style={{ marginBottom:16 }}>
        <div className="card">
          <div className="card-header"><div className="card-title">Revenue trend (6 months)</div></div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={trend||[]} barSize={14} barGap={2}>
              <XAxis dataKey="month" tick={{ fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize:11 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip formatter={v => fmt.currency(v)} />
              <Legend iconSize={8} wrapperStyle={{ fontSize:12 }} />
              <Bar dataKey="revenue"  name="Revenue"  fill="var(--blue)" radius={[3,3,0,0]} />
              <Bar dataKey="expenses" name="Expenses" fill="var(--red)"  radius={[3,3,0,0]} opacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">Expense breakdown</div></div>
          {pieData.length === 0
            ? <EmptyState icon="📊" title="No expenses" message="No expenses recorded this month." />
            : <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => fmt.currency(v)} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize:11 }} />
                </PieChart>
              </ResponsiveContainer>
          }
        </div>
      </div>

      {/* Payments table */}
      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-header">
          <div className="card-title">Rent Collection — {MONTHS.find(m=>m.value===month)?.label}</div>
          <span style={{ fontSize:12, color:'var(--text-3)' }}>{(payments||[]).length} payments</span>
        </div>
        {(payments||[]).length === 0
          ? <EmptyState icon="💳" title="No payments" message="No payments scheduled this month." />
          : <div className="table-wrap">
              <table>
                <thead><tr><th>Tenant</th><th>Property / Unit</th><th>Amount</th><th>Due</th><th>Paid</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {(payments||[]).map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight:500 }}>{p.lease?.tenant?.name}</td>
                      <td>
                        <div>{p.lease?.unit?.property?.name}</div>
                        <div style={{ fontSize:11, color:'var(--text-3)' }}>Unit {p.lease?.unit?.number}</div>
                      </td>
                      <td style={{ fontWeight:600 }}>{fmt.currency(p.amount)}</td>
                      <td style={{ color:'var(--text-2)' }}>{fmt.date(p.dueDate)}</td>
                      <td style={{ color:'var(--text-2)' }}>{p.paidDate ? fmt.date(p.paidDate) : '—'}</td>
                      <td><Badge status={p.status} /></td>
                      <td>
                        {(p.status === 'PENDING' || p.status === 'LATE' || p.status === 'OVERDUE') && (
                          <button className="btn btn-sm" style={{ color:'var(--green)' }} onClick={() => handleMarkPaid(p.id)}>Mark Paid</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </div>

      {/* Expenses table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Expenses</div>
          <button className="btn btn-sm" onClick={() => setShow(true)}>+ Add</button>
        </div>
        {(expenses||[]).length === 0
          ? <EmptyState icon="🧾" title="No expenses" message="Track your property expenses here." />
          : <div className="table-wrap">
              <table>
                <thead><tr><th>Description</th><th>Category</th><th>Vendor</th><th>Date</th><th>Amount</th><th></th></tr></thead>
                <tbody>
                  {(expenses||[]).map(e => (
                    <tr key={e.id}>
                      <td style={{ fontWeight:500 }}>{e.description}</td>
                      <td><span className="badge badge-neutral">{e.category}</span></td>
                      <td style={{ color:'var(--text-2)' }}>{e.vendor || '—'}</td>
                      <td style={{ color:'var(--text-2)' }}>{fmt.date(e.date)}</td>
                      <td style={{ fontWeight:600, color:'var(--red)' }}>-{fmt.currency(e.amount)}</td>
                      <td><button className="btn btn-sm btn-danger" onClick={() => handleDeleteExpense(e.id)}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </div>

      {/* Add expense modal */}
      {showExpense && (
        <Modal title="Add Expense" onClose={() => setShow(false)}
          footer={<><button className="btn" onClick={() => setShow(false)}>Cancel</button><button className="btn btn-primary" form="exp-form" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Add Expense'}</button></>}
        >
          <form id="exp-form" onSubmit={handleAddExpense}>
            <FormGroup label="Category">
              <select className="form-input" value={expForm.category} onChange={e => setExpForm(p=>({...p,category:e.target.value}))}>
                {['MAINTENANCE','INSURANCE','TAX','UTILITIES','MANAGEMENT','MARKETING','OTHER'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </FormGroup>
            <FormGroup label="Description">
              <input className="form-input" value={expForm.description} onChange={e => setExpForm(p=>({...p,description:e.target.value}))} required placeholder="Plumbing repair — Unit 5C" />
            </FormGroup>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <FormGroup label="Amount ($)">
                <input className="form-input" type="number" min="0" step="0.01" value={expForm.amount} onChange={e => setExpForm(p=>({...p,amount:e.target.value}))} required placeholder="350.00" />
              </FormGroup>
              <FormGroup label="Date">
                <input className="form-input" type="date" value={expForm.date} onChange={e => setExpForm(p=>({...p,date:e.target.value}))} required />
              </FormGroup>
            </div>
            <FormGroup label="Vendor (optional)">
              <input className="form-input" value={expForm.vendor} onChange={e => setExpForm(p=>({...p,vendor:e.target.value}))} placeholder="ABC Plumbing Co." />
            </FormGroup>
          </form>
        </Modal>
      )}
    </>
  );
}
