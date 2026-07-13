import { useState, useEffect, useRef } from "react";
import api from "../api/axios";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState("open");
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const [resolvingId, setResolvingId] = useState(null);
  const [animatedCards, setAnimatedCards] = useState({});

  const refreshLockRef = useRef(false);
  const highlightTimeoutsRef = useRef({});
  const previousSnapshotRef = useRef(null);
  const loadAlertsRef = useRef(null);

  const clearHighlightTimers = () => {
    Object.values(highlightTimeoutsRef.current).forEach(clearTimeout);
    highlightTimeoutsRef.current = {};
  };

  const triggerCardAnimations = (cardKeys = []) => {
    if (!cardKeys.length) return;

    setAnimatedCards((prev) => {
      const next = { ...prev };
      cardKeys.forEach((key) => {
        next[key] = true;
      });
      return next;
    });

    cardKeys.forEach((key) => {
      if (highlightTimeoutsRef.current[key]) {
        clearTimeout(highlightTimeoutsRef.current[key]);
      }

      highlightTimeoutsRef.current[key] = setTimeout(() => {
        setAnimatedCards((prev) => ({
          ...prev,
          [key]: false,
        }));
      }, 1000);
    });
  };

  const withCardAnimation = (baseStyle, cardKey, accent = "#2563eb") => {
    const isActive = Boolean(animatedCards[cardKey]);

    return {
      ...baseStyle,
      transition:
        "transform 220ms ease, box-shadow 260ms ease, border-color 260ms ease, background-color 260ms ease, opacity 220ms ease",
      transform: isActive
        ? "translateY(-2px) scale(1.01)"
        : baseStyle.transform || "translateY(0) scale(1)",
      boxShadow: isActive
        ? `0 0 0 3px ${accent}22, 0 10px 24px rgba(15, 23, 42, 0.08)`
        : baseStyle.boxShadow || "0 1px 3px rgba(0,0,0,0.05)",
      border: isActive
        ? `1px solid ${accent}66`
        : baseStyle.border || "1px solid #e5e7eb",
    };
  };

  const severityMeta = (sev) => {
    const s = (sev || "").toLowerCase();

    if (s === "critical" || s === "failure_probable") {
      return { color: "#dc2626", bg: "#fef2f2", label: "CRITICAL" };
    }
    if (s === "warning" || s === "alert") {
      return { color: "#ea580c", bg: "#fff7ed", label: "WARNING" };
    }
    if (s === "info" || s === "normal") {
      return { color: "#16a34a", bg: "#f0fdf4", label: "INFO" };
    }

    return {
      color: "#6b7280",
      bg: "#f9fafb",
      label: s.toUpperCase() || "UNKNOWN",
    };
  };

  const getLatestPerMachine = (alertList) => {
    const map = new Map();

    for (const alert of alertList) {
      const mid =
        typeof alert.machineId === "object"
          ? alert.machineId?._id
          : alert.machineId;

      if (!mid) continue;

      const existing = map.get(mid);
      if (
        !existing ||
        new Date(alert.triggeredAt || alert.createdAt) >
          new Date(existing.triggeredAt || existing.createdAt)
      ) {
        map.set(mid, alert);
      }
    }

    return Array.from(map.values()).sort(
      (a, b) =>
        new Date(b.triggeredAt || b.createdAt) -
        new Date(a.triggeredAt || a.createdAt),
    );
  };

  const buildDisplayAlerts = (alertList, activeFilter) => {
    return activeFilter === "open"
      ? getLatestPerMachine(alertList)
      : alertList
          .slice()
          .sort(
            (a, b) =>
              new Date(b.triggeredAt || b.createdAt) -
              new Date(a.triggeredAt || a.createdAt),
          );
  };

  const getAlertStatus = (alert, allAlerts) => {
    const status = (alert.status || "").toLowerCase();

    if (status === "escalated") {
      return {
        badge: { bg: "#fff7ed", color: "#ea580c", label: "ESCALATED" },
        message: `Escalated to ${alert.escalatedTo || "critical alert"}`,
        icon: "↗️",
        isClosed: true,
      };
    }

    if (status === "resolved") {
      const mid =
        typeof alert.machineId === "object"
          ? alert.machineId?._id
          : alert.machineId;
      const alertTime = new Date(
        alert.resolvedAt || alert.updatedAt || alert.createdAt,
      );

      const newerAlert = allAlerts.find((a) => {
        if (a._id === alert._id) return false;

        const aMid =
          typeof a.machineId === "object" ? a.machineId?._id : a.machineId;
        if (aMid !== mid) return false;

        const aTime = new Date(a.triggeredAt || a.createdAt);
        const diffMs = aTime - alertTime;

        return diffMs >= 0 && diffMs < 120000;
      });

      if (newerAlert) {
        return {
          badge: { bg: "#fff7ed", color: "#ea580c", label: "ESCALATED" },
          message: `Escalated to ${newerAlert.type || "critical alert"}`,
          icon: "↗️",
          isClosed: true,
        };
      }

      return {
        badge: { bg: "#f0fdf4", color: "#16a34a", label: "RESOLVED" },
        message: alert.resolvedAt
          ? `Resolved ${new Date(alert.resolvedAt).toLocaleString()}`
          : "Resolved",
        icon: "✓",
        isClosed: true,
      };
    }

    return { badge: null, message: null, icon: null, isClosed: false };
  };

  const buildSnapshot = (alertList, activeFilter) => {
    const displayAlerts = buildDisplayAlerts(alertList, activeFilter);

    return {
      filter: activeFilter,
      count: displayAlerts.length,
      alerts: Object.fromEntries(
        displayAlerts.map((alert) => {
          const machineKey =
            typeof alert.machineId === "object"
              ? alert.machineId?._id || alert.machineId?.name || "unknown"
              : alert.machineId || "unknown";

          return [
            alert._id,
            {
              status: alert.status || null,
              severity: alert.severity || null,
              type: alert.type || null,
              title: alert.title || alert.message || null,
              machineKey,
              triggeredAt: alert.triggeredAt || alert.createdAt || null,
              resolvedAt: alert.resolvedAt || null,
            },
          ];
        }),
      ),
    };
  };

  const getChangedCardKeys = (previous, next) => {
    if (!previous || !next) return [];

    if (previous.filter !== next.filter) return [];

    const changed = [];
    const allIds = new Set([
      ...Object.keys(previous.alerts || {}),
      ...Object.keys(next.alerts || {}),
    ]);

    allIds.forEach((id) => {
      const prevAlert = previous.alerts?.[id];
      const nextAlert = next.alerts?.[id];

      if (!prevAlert || !nextAlert) {
        changed.push(`alert-${id}`);
        return;
      }

      const keys = [
        "status",
        "severity",
        "type",
        "title",
        "machineKey",
        "triggeredAt",
        "resolvedAt",
      ];

      const hasChanged = keys.some((key) => prevAlert[key] !== nextAlert[key]);

      if (hasChanged) {
        changed.push(`alert-${id}`);
      }
    });

    return changed;
  };

  useEffect(() => {
    let isMounted = true;
    refreshLockRef.current = false;
    previousSnapshotRef.current = null;
    clearHighlightTimers();

    const loadAlerts = async ({ showLoader = false } = {}) => {
      try {
        if (!isMounted) return;

        if (showLoader) {
          setInitialLoading(true);
          setError(null);
        } else {
          setIsRefreshing(true);
        }

        const endpoint = filter === "open" ? "/alerts/open" : "/alerts";
        const res = await api.get(endpoint);
        const raw = res.data?.alerts || [];
        const data = Array.isArray(raw) ? raw : [];

        const nextSnapshot = buildSnapshot(data, filter);
        const changedCardKeys = showLoader
          ? []
          : getChangedCardKeys(previousSnapshotRef.current, nextSnapshot);

        previousSnapshotRef.current = nextSnapshot;

        if (!isMounted) return;

        setAlerts(data);
        setError(null);
        setLastUpdated(new Date());

        if (changedCardKeys.length) {
          triggerCardAnimations(changedCardKeys);
        }
      } catch (err) {
        console.error("Alerts error:", err);

        if (showLoader && isMounted) {
          setError(
            err.response?.data?.message ||
              err.message ||
              "Failed to load alerts",
          );
        }
      } finally {
        if (showLoader) {
          if (isMounted) {
            setInitialLoading(false);
          }
        } else {
          if (isMounted) {
            setIsRefreshing(false);
          }
        }
      }
    };

    loadAlertsRef.current = loadAlerts;
    loadAlerts({ showLoader: lastUpdated === null });

    const interval = setInterval(async () => {
      if (refreshLockRef.current) return;

      refreshLockRef.current = true;

      try {
        await loadAlerts({ showLoader: false });
      } finally {
        refreshLockRef.current = false;
      }
    }, 10000);

    return () => {
      isMounted = false;
      loadAlertsRef.current = null;
      clearInterval(interval);
      clearHighlightTimers();
    };
  }, [filter]);

  const handleResolve = async (alertId) => {
    try {
      setResolvingId(alertId);
      await api.patch(`/alerts/${alertId}/resolve`);

      if (loadAlertsRef.current) {
        await loadAlertsRef.current({ showLoader: false });
      }
    } catch (err) {
      alert(
        "Failed to resolve: " + (err.response?.data?.message || err.message),
      );
    } finally {
      setResolvingId(null);
    }
  };

  const displayAlerts = buildDisplayAlerts(alerts, filter);

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "1.75rem",
              fontWeight: 700,
              color: "#111827",
            }}
          >
            {filter === "open" ? "Machine Status" : "Alert History"}
          </h1>
          <p
            style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "0.9rem" }}
          >
            {filter === "open"
              ? "Current alert state per machine — latest only"
              : "All alerts chronologically — including resolved and escalated"}
          </p>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: "0.8rem",
              color: isRefreshing ? "#2563eb" : "#9ca3af",
              fontWeight: isRefreshing ? 600 : 400,
              transition: "color 200ms ease",
            }}
          >
            {isRefreshing
              ? "Updating..."
              : lastUpdated
                ? `Last updated: ${lastUpdated.toLocaleTimeString()}`
                : "Waiting for first update..."}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: "0",
            border: "1px solid #d1d5db",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          <button
            onClick={() => setFilter("open")}
            style={{
              padding: "8px 20px",
              border: "none",
              background: filter === "open" ? "#1e40af" : "#fff",
              color: filter === "open" ? "#fff" : "#374151",
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 180ms ease",
            }}
          >
            Open Only
          </button>
          <button
            onClick={() => setFilter("all")}
            style={{
              padding: "8px 20px",
              border: "none",
              borderLeft: "1px solid #d1d5db",
              background: filter === "all" ? "#1e40af" : "#fff",
              color: filter === "all" ? "#fff" : "#374151",
              fontWeight: 500,
              cursor: "pointer",
              transition: "all 180ms ease",
            }}
          >
            History
          </button>
        </div>
      </div>

      {initialLoading && lastUpdated === null && (
        <div
          style={{
            textAlign: "center",
            padding: "60px",
            color: "#6b7280",
            background: "#fff",
            borderRadius: "12px",
          }}
        >
          <div style={{ fontSize: "2rem", marginBottom: "12px" }}>⏳</div>
          Loading...
        </div>
      )}

      {error && lastUpdated === null && !initialLoading && (
        <div
          style={{
            padding: "20px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "12px",
            color: "#dc2626",
            marginBottom: "20px",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {!initialLoading && !error && displayAlerts.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "60px",
            background: "#fff",
            borderRadius: "12px",
            color: "#6b7280",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "16px" }}>✅</div>
          <h3 style={{ margin: "0 0 8px", color: "#111827" }}>
            {filter === "open" ? "All Systems Normal" : "No Alert History"}
          </h3>
        </div>
      )}

      {!initialLoading && !error && displayAlerts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {displayAlerts.map((alert) => {
            const meta = severityMeta(alert.severity);
            const statusDisplay = getAlertStatus(alert, alerts);
            const machineName =
              typeof alert.machineId === "object"
                ? alert.machineId?.name || alert.machineId?._id || "Unknown"
                : alert.machineId || "Unknown";

            return (
              <div
                key={alert._id}
                style={withCardAnimation(
                  {
                    background: "#fff",
                    borderRadius: "12px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    border: "1px solid #e5e7eb",
                    borderLeft: `4px solid ${meta.color}`,
                    padding: "20px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "16px",
                    opacity: statusDisplay.isClosed ? 0.6 : 1,
                  },
                  `alert-${alert._id}`,
                  meta.color,
                )}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      marginBottom: "8px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "4px 12px",
                        borderRadius: "20px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        background: meta.bg,
                        color: meta.color,
                      }}
                    >
                      <span
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: meta.color,
                        }}
                      />
                      {meta.label}
                    </span>

                    {statusDisplay.badge && (
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: "12px",
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          background: statusDisplay.badge.bg,
                          color: statusDisplay.badge.color,
                          border: `1px solid ${statusDisplay.badge.color}30`,
                        }}
                      >
                        {statusDisplay.badge.label}
                      </span>
                    )}

                    <span style={{ fontSize: "0.8rem", color: "#9ca3af" }}>
                      {alert.triggeredAt
                        ? new Date(alert.triggeredAt).toLocaleString()
                        : ""}
                    </span>
                  </div>

                  <p
                    style={{
                      margin: "0 0 6px",
                      fontWeight: 600,
                      fontSize: "1rem",
                      color: "#111827",
                    }}
                  >
                    {alert.title || alert.message}
                  </p>

                  <p
                    style={{ margin: 0, fontSize: "0.85rem", color: "#6b7280" }}
                  >
                    Machine: <strong>{machineName}</strong>
                    {alert.type ? ` • Type: ${alert.type}` : ""}
                  </p>

                  {statusDisplay.message && (
                    <p
                      style={{
                        margin: "8px 0 0",
                        fontSize: "0.8rem",
                        color: statusDisplay.badge.color,
                      }}
                    >
                      {statusDisplay.icon} {statusDisplay.message}
                    </p>
                  )}
                </div>

                {!statusDisplay.isClosed && (
                  <button
                    onClick={() => handleResolve(alert._id)}
                    disabled={resolvingId === alert._id}
                    style={{
                      padding: "8px 16px",
                      background: "#16a34a",
                      color: "#fff",
                      border: "none",
                      borderRadius: "8px",
                      cursor:
                        resolvingId === alert._id ? "not-allowed" : "pointer",
                      opacity: resolvingId === alert._id ? 0.6 : 1,
                      fontWeight: 600,
                      transition: "all 180ms ease",
                    }}
                  >
                    {resolvingId === alert._id ? "Resolving..." : "Resolve"}
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
