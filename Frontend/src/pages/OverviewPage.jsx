import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

export default function OverviewPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const statusColor = (status) => {
    switch (status) {
      case 'NORMAL': return '#16a34a';
      case 'ALERT': return '#ea580c';
      case 'FAILURE_PROBABLE': return '#dc2626';
      default: return '#6b7280';
    }
  };

  const statusBg = (status) => {
    switch (status) {
      case 'NORMAL': return '#f0fdf4';
      case 'ALERT': return '#fff7ed';
      case 'FAILURE_PROBABLE': return '#fef2f2';
      default: return '#f9fafb';
    }
  };

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        setLoading(true);
        const res = await api.get('/analytics/overview');
        console.log('Overview loaded:', res.data);
        setData(res.data);
        setError(null);
      } catch (err) {
        console.error('Overview error:', err);
        setError(err.response?.data?.message || err.message || 'Failed to load overview');
      } finally {
        setLoading(false);
      }
    };

    fetchOverview();
    const interval = setInterval(fetchOverview, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⏳</div>
        Loading dashboard...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ padding: '20px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', color: '#dc2626' }}>
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const summary = data.summary || {};
  const machines = data.machines || [];
  const latestTelemetry = data.latestTelemetry || [];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
      <h1 style={{ margin: '0 0 24px', fontSize: '1.75rem', fontWeight: 700, color: '#111827' }}>
        Dashboard Overview
      </h1>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {[
          { label: 'Total Machines', value: summary.totalMachines || 0, color: '#1e40af', bg: '#eff6ff' },
          { label: 'Normal', value: summary.normal || 0, color: '#16a34a', bg: '#f0fdf4' },
          { label: 'Alert', value: summary.alert || 0, color: '#ea580c', bg: '#fff7ed' },
          { label: 'Failure Probable', value: summary.failureProbable || 0, color: '#dc2626', bg: '#fef2f2' },
          { label: 'Open Alerts', value: summary.openAlerts || 0, color: '#7c3aed', bg: '#f5f3ff' },
        ].map((card) => (
          <div key={card.label} style={{
            background: '#fff',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            border: '1px solid #e5e7eb',
            padding: '20px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: card.color, marginBottom: '4px' }}>
              {card.value}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#6b7280', fontWeight: 500 }}>
              {card.label}
            </div>
          </div>
        ))}
      </div>

      {/* Machines Grid */}
      <h2 style={{ margin: '0 0 16px', fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>
        Machines
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {machines.map((m) => (
          <Link
            key={m.machineId}
            to={`/machines/${m.machineId}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div style={{
              background: '#fff',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              border: '1px solid #e5e7eb',
              padding: '20px',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
            }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#111827' }}>
                  {m.name}
                </h3>
                <span style={{
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  background: statusBg(m.currentStatus),
                  color: statusColor(m.currentStatus),
                  border: `1px solid ${statusColor(m.currentStatus)}30`
                }}>
                  {m.currentStatus}
                </span>
              </div>
              <p style={{ margin: '0 0 4px', fontSize: '0.85rem', color: '#6b7280' }}>
                <strong>Type:</strong> {m.type}
              </p>
              <p style={{ margin: '0 0 4px', fontSize: '0.85rem', color: '#6b7280' }}>
                <strong>Location:</strong> {m.location}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#9ca3af' }}>
                ID: {m.machineId}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Latest Telemetry */}
      <h2 style={{ margin: '0 0 16px', fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>
        Latest Telemetry
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {latestTelemetry.map((telem) => (
          <div key={telem._id || telem.machineId} style={{
            background: '#fff',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            border: '1px solid #e5e7eb',
            padding: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <strong style={{ color: '#111827' }}>{telem.machineId?.name || telem.machineId || 'Unknown'}</strong>
              <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                {telem.timestamp ? new Date(telem.timestamp).toLocaleTimeString() : 'N/A'}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
              <div>🌡️ Temp: <strong>{telem.temperature ?? '—'}°C</strong></div>
              <div>💧 Hum: <strong>{telem.humidity ?? '—'}%</strong></div>
              <div>〰️ Vib: <strong>{telem.vibration ?? '—'}</strong></div>
              <div>💡 Lum: <strong>{telem.luminosity ?? '—'}</strong></div>
              <div>📏 Dist: <strong>{telem.distance ?? '—'}cm</strong></div>
              <div>⚡ Status: <strong>{telem.status ?? '—'}</strong></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}