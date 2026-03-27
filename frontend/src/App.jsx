// frontend/src/App.jsx
import { Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import LoginPage      from './pages/LoginPage';
import RegisterPage   from './pages/RegisterPage';
import DashboardPage  from './pages/DashboardPage';
import PropertiesPage from './pages/PropertiesPage';
import TenantsPage    from './pages/TenantsPage';
import LeasesPage     from './pages/LeasesPage';
import MaintenancePage from './pages/MaintenancePage';
import FinancePage    from './pages/FinancePage';
import ReportsPage    from './pages/ReportsPage';

const NAV = [
  { to: '/dashboard',   icon: '▦',  label: 'Dashboard',   section: 'Overview'    },
  { to: '/properties',  icon: '🏢', label: 'Properties',   section: null          },
  { to: '/tenants',     icon: '👤', label: 'Tenants',      section: 'People'      },
  { to: '/leases',      icon: '📄', label: 'Leases',       section: null          },
  { to: '/maintenance', icon: '🔧', label: 'Maintenance',  section: 'Operations'  },
  { to: '/finance',     icon: '💰', label: 'Finance',      section: null          },
  { to: '/reports',     icon: '📊', label: 'Reports',      section: 'More'        },
];

function Sidebar() {
  const { user, logout } = useAuth();
  let lastSection = null;

  return (
    <aside className="sidebar">
      <div className="logo">
        <div className="logo-name">PropOS</div>
        <div className="logo-sub">Property Management</div>
      </div>

      <nav className="nav">
        {NAV.map(({ to, icon, label, section }) => {
          const showSection = section && section !== lastSection;
          if (section) lastSection = section;
          return (
            <div key={to}>
              {showSection && <div className="nav-section">{section}</div>}
              <NavLink
                to={to}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <span className="nav-icon">{icon}</span>
                {label}
              </NavLink>
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px' }}>
          <div className="avatar avatar-blue" style={{ width: 30, height: 30, fontSize: 11 }}>
            {user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{user?.role}</div>
          </div>
          <button className="btn btn-sm" onClick={logout} title="Sign out">↩</button>
        </div>
      </div>
    </aside>
  );
}

function TopBar() {
  const { pathname } = useLocation();
  const labels = { '/dashboard': 'Dashboard', '/properties': 'Properties', '/tenants': 'Tenants', '/leases': 'Leases', '/maintenance': 'Maintenance', '/finance': 'Finance', '/reports': 'Reports' };
  return (
    <div className="topbar">
      <div className="page-title">{labels[pathname] || 'PropOS'}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
      </div>
    </div>
  );
}

function AppLayout() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading" style={{ height: '100vh' }}>Loading…</div>;
  if (!user)   return <Navigate to="/login" replace />;

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main">
        <TopBar />
        <main className="page-content">
          <Routes>
            <Route path="/dashboard"   element={<DashboardPage  />} />
            <Route path="/properties"  element={<PropertiesPage />} />
            <Route path="/tenants"     element={<TenantsPage    />} />
            <Route path="/leases"      element={<LeasesPage     />} />
            <Route path="/maintenance" element={<MaintenancePage/>} />
            <Route path="/finance"     element={<FinancePage    />} />
            <Route path="/reports"     element={<ReportsPage    />} />
            <Route path="*"            element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login"    element={<LoginPage    />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/*"        element={<AppLayout    />} />
      </Routes>
    </AuthProvider>
  );
}
