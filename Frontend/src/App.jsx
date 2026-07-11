import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import OverviewPage from './pages/OverviewPage';
import AlertsPage from './pages/AlertsPage';
import MachineDetailPage from './pages/MachineDetailPage';
import ProtectedRoute from './components/ProtectedRoute';
import './styles/global.css';

function Navigation() {
  const token = localStorage.getItem('token');
  const location = useLocation();
  if (!token) return null;

  const isActive = (path) => location.pathname === path;

  const navLinkStyle = (path) => ({
    textDecoration: 'none',
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '0.95rem',
    fontWeight: 500,
    color: isActive(path) ? '#1e40af' : '#4b5563',
    background: isActive(path) ? '#eff6ff' : 'transparent',
    transition: 'all 0.2s ease'
  });

  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: '#ffffff',
      borderBottom: '1px solid #e5e7eb',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 24px',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <div style={{
          fontWeight: 700,
          fontSize: '1.1rem',
          color: '#1e40af',
          marginRight: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '1.3rem' }}>⚙️</span>
          PDL Monitor
        </div>

        <Link to="/" style={navLinkStyle('/')}>Overview</Link>
        <Link to="/alerts" style={navLinkStyle('/alerts')}>Alerts</Link>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
            {localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).username : ''}
          </span>
          <button
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              window.location.href = '/login';
            }}
            style={{
              padding: '6px 14px',
              border: '1px solid #d1d5db',
              background: '#fff',
              color: '#374151',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 500
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Navigation />
      <div style={{ background: '#f3f4f6', minHeight: '100vh' }}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <OverviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/alerts"
            element={
              <ProtectedRoute>
                <AlertsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/machines/:machineId"
            element={
              <ProtectedRoute>
                <MachineDetailPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}