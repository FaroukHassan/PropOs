// frontend/src/App.jsx — layout and routes
import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { ToastProvider } from './components/ui';
import { initials, L } from './lib/format';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import PartitionsPage from './pages/PartitionsPage';
import UnitsPage from './pages/UnitsPage';
import UnitDetailPage from './pages/UnitDetailPage';
import BookingsPage from './pages/BookingsPage';
import TenantsPage from './pages/TenantsPage';
import RentPage from './pages/RentPage';
import LedgerPage from './pages/LedgerPage';
import ChequesPage from './pages/ChequesPage';
import LandlordsPage from './pages/LandlordsPage';
import ReportsPage from './pages/ReportsPage';
import MaintenancePage from './pages/MaintenancePage';
import ImportPage from './pages/ImportPage';
import SettingsPage from './pages/SettingsPage';

const NAV = [
  ['Overview', [['/dashboard', '◧', 'Dashboard']]],
  ['Properties', [['/partitions', '▦', 'Partitions board'], ['/units', '⌂', 'Apartments'], ['/bookings', '☾', 'Holiday bookings']]],
  ['People', [['/tenants', '☺', 'Tenants'], ['/landlords', '⚿', 'Landlords & owners']]],
  ['Money', [['/rent', '✓', 'Rent collection'], ['/ledger', '≡', 'Income & expenses'], ['/cheques', '✎', 'Cheques'], ['/reports', '◔', 'Reports']]],
  ['Operations', [['/maintenance', '⚒', 'Maintenance'], ['/import', '⇪', 'Import from sheets'], ['/settings', '⚙', 'Settings']]],
];
const TITLES = Object.fromEntries(NAV.flatMap(([, items]) => items.map(([to, , label]) => [to, label])));

function Sidebar({ open, onNavigate }) {
  const { user, logout } = useAuth();
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand">
        <div className="brand-name">Sakanly <span>PropOS</span></div>
        <div className="brand-sub">Feels like home · سكنلي</div>
      </div>
      <nav className="nav">
        {NAV.map(([section, items]) => (
          <div key={section}>
            <div className="nav-section">{section}</div>
            {items.map(([to, icon, label]) => (
              <NavLink key={to} to={to} onClick={onNavigate}><span className="nav-icon">{icon}</span>{label}</NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-foot">
        <div className="badge b-sand" style={{ width: 30, height: 30, borderRadius: '50%', justifyContent: 'center', padding: 0 }}>{initials(user?.name)}</div>
        <div className="who"><div>{user?.name}</div><div>{L.role[user?.role]}</div></div>
        <button className="btn btn-sm btn-ghost" style={{ color: '#c3cbdb' }} onClick={logout} title="Sign out">Sign out</button>
      </div>
    </aside>
  );
}

function Shell() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  useEffect(() => setMenu(false), [pathname]);
  if (loading) return <div className="loading" style={{ height: '100vh' }}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  const title = TITLES[pathname] || (pathname.startsWith('/units/') ? 'Apartment' : 'PropOS');
  return (
    <div className="app">
      <Sidebar open={menu} onNavigate={() => setMenu(false)} />
      <div className="main">
        <header className="topbar">
          <div className="row">
            <button className="btn btn-sm menu-btn" onClick={() => setMenu(m => !m)} aria-label="Menu">☰</button>
            <h1 className="page-title">{title}</h1>
          </div>
          <span className="small faint">{new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
        </header>
        {import.meta.env.VITE_DEMO && <div className="alert alert-info" style={{ margin: 0, borderRadius: 0, textAlign: 'center' }}>Demo with sample data. Click around freely; changes are not saved. Sample month: November 2026.</div>}
        <main className="content">
          <Routes>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/partitions" element={<PartitionsPage />} />
            <Route path="/units" element={<UnitsPage />} />
            <Route path="/units/:id" element={<UnitDetailPage />} />
            <Route path="/bookings" element={<BookingsPage />} />
            <Route path="/tenants" element={<TenantsPage />} />
            <Route path="/landlords" element={<LandlordsPage />} />
            <Route path="/rent" element={<RentPage />} />
            <Route path="/ledger" element={<LedgerPage />} />
            <Route path="/cheques" element={<ChequesPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/maintenance" element={<MaintenancePage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={<Shell />} />
        </Routes>
      </AuthProvider>
    </ToastProvider>
  );
}
