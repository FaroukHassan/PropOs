// frontend/src/App.jsx — layout and routes
import { t, isAr, locale } from './lib/i18n';
import LangSwitch from './components/LangSwitch';
import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, NavLink, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { ToastProvider } from './components/ui';
import { initials, L } from './lib/format';
import { useMobileTables } from './lib/mobileTables';
import { ScopeProvider, ScopePicker } from './lib/scope';
import { PeriodProvider } from './lib/period';

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
const TITLES = Object.fromEntries(NAV.flatMap(([, items]) => items.map(([to, , label]) => [to, t(label)])));
// Screens the apartment filter doesn't apply to
const NO_SCOPE = ['/landlords', '/import', '/settings'];
// Phone bottom bar: the four screens the team opens most; everything else is under "More".
const TABBAR = [['/dashboard', '◧', 'Home'], ['/partitions', '▦', 'Partitions'], ['/rent', '✓', 'Rent'], ['/cheques', '✎', 'Cheques']];

function Sidebar({ open, onNavigate }) {
  const { user, logout } = useAuth();
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand">
        <Link to="/dashboard" className="brand-link" onClick={onNavigate} title={t('Home')}>
          <img className="brand-logo" src={`${import.meta.env.BASE_URL}brand/logo-white.png`} alt={t('Sakanly Real Estate')} />
          <span className="brand-tag">{t('Real Estate')}</span>
        </Link>
        <div className="row-between" style={{ marginTop: 4 }}>
          <div className="brand-sub" style={{ marginTop: 0 }}>{t('Your home, evolved.')}</div>
          <LangSwitch dark />
        </div>
      </div>
      <nav className="nav">
        {NAV.map(([section, items]) => (
          <div key={section}>
            <div className="nav-section">{t(section)}</div>
            {items.map(([to, icon, label]) => (
              <NavLink key={to} to={to} onClick={onNavigate}><span className="nav-icon">{icon}</span>{t(label)}</NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-foot">
        <div className="badge b-sand" style={{ width: 30, height: 30, borderRadius: '50%', justifyContent: 'center', padding: 0 }}>{initials(user?.name)}</div>
        <div className="who"><div>{user?.name}</div><div>{L.role[user?.role]}</div></div>
        <button className="btn btn-sm btn-ghost" style={{ color: '#c3cbdb' }} onClick={logout} title={t("Sign out")}>{t("Sign out")}</button>
      </div>
    </aside>
  );
}

function Shell() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  useEffect(() => setMenu(false), [pathname]);
  useMobileTables();
  if (loading) return <div className="loading" style={{ height: '100vh' }}>{t("Loading…")}</div>;
  if (!user) return <Navigate to="/login" replace />;
  const title = TITLES[pathname] || (pathname.startsWith('/units/') ? t('Apartment') : 'PropOS');
  return (
    <ScopeProvider><PeriodProvider>
    <div className="app">
      <Sidebar open={menu} onNavigate={() => setMenu(false)} />
      {menu && <div className="sidebar-backdrop" onClick={() => setMenu(false)} />}
      <div className="main">
        <header className="topbar">
          <div className="row grow">
            <button className="btn btn-sm menu-btn" onClick={() => setMenu(m => !m)} aria-label={t("Menu")}>☰</button>
            <h1 className="page-title">{title}</h1>
          </div>
          <div className="row topbar-right">
            {!NO_SCOPE.includes(pathname) && !pathname.startsWith('/units/') && <ScopePicker />}
            <span className="small faint topbar-date">{new Date().toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
        </header>
        {import.meta.env.VITE_DEMO && <div className="alert alert-info" style={{ margin: 0, borderRadius: 0, textAlign: 'center' }}>{t("Demo with sample data. Click around freely; changes are not saved. Sample month: November 2026.")}</div>}
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
        <nav className="tabbar" aria-label={t("Main")}>
          {TABBAR.map(([to, icon, label]) => (
            <NavLink key={to} to={to}><span className="tab-icon">{icon}</span>{t(label)}</NavLink>
          ))}
          <button className={menu ? 'active' : ''} onClick={() => setMenu(m => !m)}><span className="tab-icon">☰</span>{t("More")}</button>
        </nav>
      </div>
    </div>
    </PeriodProvider></ScopeProvider>
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
