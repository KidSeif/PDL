import { useState, useEffect } from 'react';
import api from '../api/axios';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState('open');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      setError(null);
      const endpoint = filter === 'open' ? '/alerts/open' : '/alerts';
      const res = await api.get(endpoint);
      const raw = res.data?.alerts || [];
      const data = Array.isArray(raw) ? raw : [];
      setAlerts(data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10000);
    return () => clearInterval(interval);
  }, [filter]);

  const handleResolve = async (alertId) => {
    try {
      setResolvingId(alertId);
      await api.patch(`/alerts/${alertId}/resolve`);
      fetchAlerts();
    } catch (err) {
      alert('Failed to resolve: ' + (err.response?.data?.message || err.message));
    } finally {
      setResolvingId(null);
    }
  };

  const severityMeta = (sev) => {
    const s = (sev || '').toLowerCase();
    if (s === 'critical' || s === 'failure_probable') {
      return { color: '#dc2626', bg: '#fef2f2', label: 'CRITICAL' };
    }
    if (s === 'warning' || s === 'alert') {
      return { color: '#ea580c', bg: '#fff7ed', label: 'WARNING' };
    }
    if (s === 'info' || s === 'normal') {
      return { color: '#16a34a', bg: '#f0fdf4', label: 'INFO' };
    }
    return { color: '#6b7280', bg: '#f9fafb', label: s.toUpperCase() || 'UNKNOWN' };
  };

  // 🔥 GROUPEMENT seulement en mode "Open Only"
  const getLatestPerMachine = (alertList) => {
    const map = new Map();
    for (const alert of alertList) {
      const mid = typeof alert.machineId === 'object' ? alert.machineId?._id : alert.machineId;
      if (!mid) continue;
      const existing = map.get(mid);
      if (!existing || new Date(alert.triggeredAt || alert.createdAt) > new Date(existing.triggeredAt || existing.createdAt)) {
        map.set(mid, alert);
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      new Date(b.triggeredAt || b.createdAt) - new Date(a.triggeredAt || a.createdAt)
    );
  };

  const displayAlerts = filter === 'open'
    ? getLatestPerMachine(alerts)
    : alerts.slice().sort((a, b) => new Date(b.triggeredAt || b.createdAt) - new Date(a.triggeredAt || a.createdAt));

  // 🔥 DETECTION ESCALADE CÔTÉ CLIENT
  const getAlertStatus = (alert, allAlerts) => {
    const status = (alert.status || '').toLowerCase();
    
    // Si le backend a déjà marqué "escalated"
    if (status === 'escalated') {
      return {
        badge: { bg: '#fff7ed', color: '#ea580c', label: 'ESCALATED' },
        message: `Escalated to ${alert.escalatedTo || 'critical alert'}`,
        icon: '↗️',
        isClosed: true
      };
    }

    // Si "resolved", vérifier si c'est en fait une escalation (auto-résolution)
    if (status === 'resolved') {
      const mid = typeof alert.machineId === 'object' ? alert.machineId?._id : alert.machineId;
      const alertTime = new Date(alert.resolvedAt || alert.updatedAt || alert.createdAt);
      
      // Chercher une alerte plus récente de la même machine (différent type)
      const newerAlert = allAlerts.find(a => {
        if (a._id === alert._id) return false;
        const aMid = typeof a.machineId === 'object' ? a.machineId?._id : a.machineId;
        if (aMid !== mid) return false;
        const aTime = new Date(a.triggeredAt || a.createdAt);
        const diffMs = aTime - alertTime;
        // Si l'alerte suivante est arrivée dans les 2 minutes après la résolution
        return diffMs >= 0 && diffMs < 120000;
      });

      if (newerAlert) {
        return {
          badge: { bg: '#fff7ed', color: '#ea580c', label: 'ESCALATED' },
          message: `Escalated to ${newerAlert.type || 'critical alert'}`,
          icon: '↗️',
          isClosed: true
        };
      }

      // Vraiment résolue manuellement
      return {
        badge: { bg: '#f0fdf4', color: '#16a34a', label: 'RESOLVED' },
        message: alert.resolvedAt ? `Resolved ${new Date(alert.resolvedAt).toLocaleString()}` : 'Resolved',
        icon: '✓',
        isClosed: true
      };
    }

    // Ouverte
    return { badge: null, message: null, icon: null, isClosed: false };
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700, color: '#111827' }}>
            {filter === 'open' ? 'Machine Status' : 'Alert History'}
          </h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.9rem' }}>
            {filter === 'open'
              ? 'Current alert state per machine — latest only'
              : 'All alerts chronologically — including resolved and escalated'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0', border: '1px solid #d1d5db', borderRadius: '8px', overflow: 'hidden' }}>
          <button
            onClick={() => setFilter('open')}
            style={{
              padding: '8px 20px',
              border: 'none',
              background: filter === 'open' ? '#1e40af' : '#fff',
              color: filter === 'open' ? '#fff' : '#374151',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            Open Only
          </button>
          <button
            onClick={() => setFilter('all')}
            style={{
              padding: '8px 20px',
              border: 'none',
              borderLeft: '1px solid #d1d5db',
              background: filter === 'all' ? '#1e40af' : '#fff',
              color: filter === 'all' ? '#fff' : '#374151',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            History
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#6b7280', background: '#fff', borderRadius: '12px' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⏳</div>
          Loading...
        </div>
      )}

      {error && !loading && (
        <div style={{ padding: '20px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', color: '#dc2626', marginBottom: '20px' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && displayAlerts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px', background: '#fff', borderRadius: '12px', color: '#6b7280' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✅</div>
          <h3 style={{ margin: '0 0 8px', color: '#111827' }}>
            {filter === 'open' ? 'All Systems Normal' : 'No Alert History'}
          </h3>
        </div>
      )}

      {!loading && !error && displayAlerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {displayAlerts.map((alert) => {
            const meta = severityMeta(alert.severity);
            const statusDisplay = getAlertStatus(alert, alerts);
            const machineName = typeof alert.machineId === 'object'
              ? (alert.machineId?.name || alert.machineId?._id || 'Unknown')
              : (alert.machineId || 'Unknown');

            return (
              <div
                key={alert._id}
                style={{
                  background: '#fff',
                  borderRadius: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  border: '1px solid #e5e7eb',
                  borderLeft: `4px solid ${meta.color}`,
                  padding: '20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '16px',
                  opacity: statusDisplay.isClosed ? 0.6 : 1
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      background: meta.bg,
                      color: meta.color
                    }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: meta.color }} />
                      {meta.label}
                    </span>

                    {statusDisplay.badge && (
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        background: statusDisplay.badge.bg,
                        color: statusDisplay.badge.color,
                        border: `1px solid ${statusDisplay.badge.color}30`
                      }}>
                        {statusDisplay.badge.label}
                      </span>
                    )}

                    <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                      {alert.triggeredAt ? new Date(alert.triggeredAt).toLocaleString() : ''}
                    </span>
                  </div>

                  <p style={{ margin: '0 0 6px', fontWeight: 600, fontSize: '1rem', color: '#111827' }}>
                    {alert.title || alert.message}
                  </p>

                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>
                    Machine: <strong>{machineName}</strong>
                    {alert.type ? ` • Type: ${alert.type}` : ''}
                  </p>

                  {statusDisplay.message && (
                    <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: statusDisplay.badge.color }}>
                      {statusDisplay.icon} {statusDisplay.message}
                    </p>
                  )}
                </div>

                {!statusDisplay.isClosed && (
                  <button
                    onClick={() => handleResolve(alert._id)}
                    disabled={resolvingId === alert._id}
                    style={{
                      padding: '8px 16px',
                      background: '#16a34a',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: resolvingId === alert._id ? 'not-allowed' : 'pointer',
                      opacity: resolvingId === alert._id ? 0.6 : 1,
                      fontWeight: 600
                    }}
                  >
                    {resolvingId === alert._id ? 'Resolving...' : 'Resolve'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}