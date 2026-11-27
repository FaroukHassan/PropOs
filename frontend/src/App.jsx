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
import { sectionOf, SECTIONS, pathOf } from './lib/access';

import LoginPage from './pages/LoginPage';
import SignPage from './pages/SignPage';
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
import LeasingPage from './pages/LeasingPage';

const NAV = [
  ['Overview', [['/dashboard', '◧', 'Dashboard']]],
  ['Properties', [['/partitions', '▦', 'Partitions board'], ['/units', '⌂', 'Apartments'], ['/bookings', '☾', 'Holiday bookings']]],
  ['Leasing', [['/leasing', '◆', 'Leasing deals']]],
  ['People', [['/tenants', '☺', 'Tenants'], ['/landlords', '⚿', 'Landlords & owners']]],
  ['Money', [['/rent', '✓', 'Rent collection'], ['/ledger', '≡', 'Income & expenses'], ['/cheques', '✎', 'Cheques'], ['/reports', '◔', 'Reports']]],
  ['Operations', [['/maintenance', '⚒', 'Maintenance'], ['/import', '⇪', 'Import from sheets'], ['/settings', '⚙', 'Settings']]],
];
const TITLES = Object.fromEntries(NAV.flatMap(([, items]) => items.map(([to, , label]) => [to, t(label)])));
// Screens the apartment filter doesn't apply to
const NO_SCOPE = ['/landlords', '/import', '/settings', '/leasing'];
// Phone bottom bar: the four screens the team opens most; everything else is under "More".
const TABBAR = [['/dashboard', '◧', 'Home'], ['/partitions', '▦', 'Properties'], ['/rent', '✓', 'Rent'], ['/cheques', '✎', 'Cheques']];

function Sidebar({ open, onNavigate }) {
  const { user, logout, can } = useAuth();
  const nav = NAV.map(([section, items]) => [section, items.filter(([to]) => !sectionOf(to) || can.view(sectionOf(to)))]).filter(([, items]) => items.length);
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand">
        <Link to="/" className="brand-link" onClick={onNavigate} title={t('Home')}>
          <img className="brand-logo" src={`${import.meta.env.BASE_URL}brand/logo-white.png`} alt={t('Sakanly Real Estate')} />
          <span className="brand-tag">{t('Real Estate')}</span>
        </Link>
        <div className="row-between" style={{ marginTop: 4 }}>
          <div className="brand-sub" style={{ marginTop: 0 }}>{t('Your home, evolved.')}</div>
          <LangSwitch dark />
        </div>
      </div>
      <nav className="nav">
        {nav.map(([section, items]) => (
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
  const { user, loading, can } = useAuth();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  useEffect(() => setMenu(false), [pathname]);
  useMobileTables();
  if (loading) return <div className="loading" style={{ height: '100vh' }}>{t("Loading…")}</div>;
  if (!user) return <Navigate to="/login" replace />;
  // first screen this person may open
  const home = can.view('dashboard') ? '/dashboard' : (pathOf(SECTIONS.find(sec => can.view(sec))) || '/settings');
  const section = sectionOf(pathname);
  const blocked = section && !can.view(section);
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
          {blocked ? <NoAccess home={home} /> : <Routes>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/partitions" element={<PartitionsPage />} />
            <Route path="/units" element={<UnitsPage />} />
            <Route path="/units/:id" element={<UnitDetailPage />} />
            <Route path="/bookings" element={<BookingsPage />} />
            <Route path="/leasing" element={<LeasingPage />} />
            <Route path="/tenants" element={<TenantsPage />} />
            <Route path="/landlords" element={<LandlordsPage />} />
            <Route path="/rent" element={<RentPage />} />
            <Route path="/ledger" element={<LedgerPage />} />
            <Route path="/cheques" element={<ChequesPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/maintenance" element={<MaintenancePage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to={home} replace />} />
          </Routes>}
        </main>
        <nav className="tabbar" aria-label={t("Main")}>
          {TABBAR.filter(([to]) => can.view(sectionOf(to))).map(([to, icon, label]) => (
            <NavLink key={to} to={to}><span className="tab-icon">{icon}</span>{t(label)}</NavLink>
          ))}
          <button className={menu ? 'active' : ''} onClick={() => setMenu(m => !m)}><span className="tab-icon">☰</span>{t("More")}</button>
        </nav>
      </div>
    </div>
    </PeriodProvider></ScopeProvider>
  );
}

function NoAccess({ home }) {
  return (
    <div className="empty">
      <div className="icon">🔒</div>
      <h3>{t('No access')}</h3>
      <p className="small">{t("You don't have access to this section. Ask a super admin to give you access.")}</p>
      <div style={{ marginTop: 14 }}><NavLink className="btn btn-primary" to={home}>{t('Go to my home page')}</NavLink></div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/sign/:token" element={<SignPage />} />
          <Route path="/*" element={<Shell />} />
        </Routes>
      </AuthProvider>
    </ToastProvider>
  );
}
