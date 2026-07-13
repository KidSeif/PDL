import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";

export default function OverviewPage() {
  const [data, setData] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);

  const [animatedCards, setAnimatedCards] = useState({});

  const refreshLockRef = useRef(false);
  const highlightTimeoutsRef = useRef({});
  const previousSnapshotRef = useRef(null);

  const statusColor = (status) => {
    switch (status) {
      case "NORMAL":
        return "#16a34a";
      case "ALERT":
        return "#ea580c";
      case "FAILURE_PROBABLE":
        return "#dc2626";
      default:
        return "#6b7280";
    }
  };

  const statusBg = (status) => {
    switch (status) {
      case "NORMAL":
        return "#f0fdf4";
      case "ALERT":
        return "#fff7ed";
      case "FAILURE_PROBABLE":
        return "#fef2f2";
      default:
        return "#f9fafb";
    }
  };

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
        "transform 220ms ease, box-shadow 260ms ease, border-color 260ms ease, background-color 260ms ease",
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

  const buildSnapshot = (overviewData) => {
    const summary = overviewData?.summary || {};
    const machines = overviewData?.machines || [];
    const latestTelemetry = overviewData?.latestTelemetry || [];

    return {
      summary: {
        totalMachines: summary.totalMachines ?? 0,
        normal: summary.normal ?? 0,
        alert: summary.alert ?? 0,
        failureProbable: summary.failureProbable ?? 0,
        openAlerts: summary.openAlerts ?? 0,
      },
      machineStatuses: Object.fromEntries(
        machines.map((m) => [m.machineId, m.currentStatus || "UNKNOWN"]),
      ),
      telemetryValues: Object.fromEntries(
        latestTelemetry.map((telem) => [
          telem.machineId?._id ||
            telem.machineId?.machineId ||
            telem.machineId ||
            telem._id,
          {
            temperature: telem.temperature ?? null,
            humidity: telem.humidity ?? null,
            vibration: telem.vibration ?? null,
            luminosity: telem.luminosity ?? null,
            distance: telem.distance ?? null,
            status: telem.derivedStatus || telem.status || null,
          },
        ]),
      ),
    };
  };

  const getChangedCardKeys = (previous, next) => {
    if (!previous || !next) return [];

    const changed = [];

    const summaryKeys = [
      "totalMachines",
      "normal",
      "alert",
      "failureProbable",
      "openAlerts",
    ];

    summaryKeys.forEach((key) => {
      if (previous.summary?.[key] !== next.summary?.[key]) {
        changed.push(`summary-${key}`);
      }
    });

    const allMachineIds = new Set([
      ...Object.keys(previous.machineStatuses || {}),
      ...Object.keys(next.machineStatuses || {}),
    ]);

    allMachineIds.forEach((machineId) => {
      if (
        previous.machineStatuses?.[machineId] !==
        next.machineStatuses?.[machineId]
      ) {
        changed.push(`machine-${machineId}`);
      }
    });

    const allTelemetryIds = new Set([
      ...Object.keys(previous.telemetryValues || {}),
      ...Object.keys(next.telemetryValues || {}),
    ]);

    allTelemetryIds.forEach((id) => {
      const prevTelem = previous.telemetryValues?.[id] || {};
      const nextTelem = next.telemetryValues?.[id] || {};

      const telemKeys = [
        "temperature",
        "humidity",
        "vibration",
        "luminosity",
        "distance",
        "status",
      ];

      const hasChanged = telemKeys.some(
        (key) => prevTelem[key] !== nextTelem[key],
      );

      if (hasChanged) {
        changed.push(`telem-${id}`);
      }
    });

    return changed;
  };

  useEffect(() => {
    let isMounted = true;
    refreshLockRef.current = false;
    previousSnapshotRef.current = null;
    clearHighlightTimers();

    const fetchOverview = async ({ showLoader = false } = {}) => {
      try {
        if (!isMounted) return;

        if (showLoader) {
          setInitialLoading(true);
          setError(null);
        } else {
          setIsRefreshing(true);
        }

        const res = await api.get("/analytics/overview");
        const nextData = res.data;
        const nextSnapshot = buildSnapshot(nextData);

        const changedCardKeys = showLoader
          ? []
          : getChangedCardKeys(previousSnapshotRef.current, nextSnapshot);

        previousSnapshotRef.current = nextSnapshot;

        if (!isMounted) return;

        setData(nextData);
        setError(null);
        setLastUpdated(new Date());

        if (changedCardKeys.length) {
          triggerCardAnimations(changedCardKeys);
        }
      } catch (err) {
        console.error("Overview error:", err);

        if (showLoader && isMounted) {
          setError(
            err.response?.data?.message ||
              err.message ||
              "Failed to load overview",
          );
        }
      } finally {
        // Avoid returning inside finally (unsafe). Only update state when mounted.
        if (isMounted) {
          if (showLoader) {
            setInitialLoading(false);
          } else {
            setIsRefreshing(false);
          }
        }
      }
    };

    fetchOverview({ showLoader: true });

    const interval = setInterval(async () => {
      if (refreshLockRef.current) return;

      refreshLockRef.current = true;

      try {
        await fetchOverview({ showLoader: false });
      } finally {
        refreshLockRef.current = false;
      }
    }, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      clearHighlightTimers();
    };
  }, []);

  if (initialLoading && !data) {
    return (
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "32px 24px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "2rem", marginBottom: "12px" }}>⏳</div>
        Loading dashboard...
      </div>
    );
  }

  if (error && !data) {
    return (
      <div
        style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}
      >
        <div
          style={{
            padding: "20px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "12px",
            color: "#dc2626",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const summary = data.summary || {};
  const machines = data.machines || [];
  const latestTelemetry = data.latestTelemetry || [];

  const summaryCards = [
    {
      key: "totalMachines",
      label: "Total Machines",
      value: summary.totalMachines || 0,
      color: "#1e40af",
      bg: "#eff6ff",
    },
    {
      key: "normal",
      label: "Normal",
      value: summary.normal || 0,
      color: "#16a34a",
      bg: "#f0fdf4",
    },
    {
      key: "alert",
      label: "Alert",
      value: summary.alert || 0,
      color: "#ea580c",
      bg: "#fff7ed",
    },
    {
      key: "failureProbable",
      label: "Failure Probable",
      value: summary.failureProbable || 0,
      color: "#dc2626",
      bg: "#fef2f2",
    },
    {
      key: "openAlerts",
      label: "Open Alerts",
      value: summary.openAlerts || 0,
      color: "#7c3aed",
      bg: "#f5f3ff",
    },
  ];

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "16px",
          flexWrap: "wrap",
          marginBottom: "24px",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "1.75rem",
            fontWeight: 700,
            color: "#111827",
          }}
        >
          Dashboard Overview
        </h1>

        <div
          style={{
            fontSize: "0.85rem",
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
        </div>
      </div>

      {/* Summary Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "16px",
          marginBottom: "32px",
        }}
      >
        {summaryCards.map((card) => (
          <div
            key={card.label}
            style={withCardAnimation(
              {
                background: "#fff",
                borderRadius: "12px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                border: "1px solid #e5e7eb",
                padding: "20px",
                textAlign: "center",
              },
              `summary-${card.key}`,
              card.color,
            )}
          >
            <div
              style={{
                fontSize: "2rem",
                fontWeight: 700,
                color: card.color,
                marginBottom: "4px",
              }}
            >
              {card.value}
            </div>
            <div
              style={{
                fontSize: "0.85rem",
                color: "#6b7280",
                fontWeight: 500,
              }}
            >
              {card.label}
            </div>
          </div>
        ))}
      </div>

      {/* Machines Grid */}
      <h2
        style={{
          margin: "0 0 16px",
          fontSize: "1.25rem",
          fontWeight: 700,
          color: "#111827",
        }}
      >
        Machines
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "16px",
          marginBottom: "32px",
        }}
      >
        {machines.map((m) => (
          <Link
            key={m.machineId}
            to={`/machines/${m.machineId}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div
              style={withCardAnimation(
                {
                  background: "#fff",
                  borderRadius: "12px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  border: "1px solid #e5e7eb",
                  padding: "20px",
                  cursor: "pointer",
                },
                `machine-${m.machineId}`,
                statusColor(m.currentStatus),
              )}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
              }}
              onMouseLeave={(e) => {
                const isAnimated = Boolean(
                  animatedCards[`machine-${m.machineId}`],
                );
                e.currentTarget.style.transform = isAnimated
                  ? "translateY(-2px) scale(1.01)"
                  : "translateY(0) scale(1)";
                e.currentTarget.style.boxShadow = isAnimated
                  ? `0 0 0 3px ${statusColor(m.currentStatus)}22, 0 10px 24px rgba(15, 23, 42, 0.08)`
                  : "0 1px 3px rgba(0,0,0,0.05)";
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "12px",
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: "1.1rem",
                    fontWeight: 600,
                    color: "#111827",
                  }}
                >
                  {m.name}
                </h3>

                <span
                  style={{
                    padding: "4px 10px",
                    borderRadius: "20px",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    background: statusBg(m.currentStatus),
                    color: statusColor(m.currentStatus),
                    border: `1px solid ${statusColor(m.currentStatus)}30`,
                    transition: "all 220ms ease",
                  }}
                >
                  {m.currentStatus}
                </span>
              </div>

              <p
                style={{
                  margin: "0 0 4px",
                  fontSize: "0.85rem",
                  color: "#6b7280",
                }}
              >
                <strong>Type:</strong> {m.type}
              </p>
              <p
                style={{
                  margin: "0 0 4px",
                  fontSize: "0.85rem",
                  color: "#6b7280",
                }}
              >
                <strong>Location:</strong> {m.location}
              </p>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: "0.8rem",
                  color: "#9ca3af",
                }}
              >
                ID: {m.machineId}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {/* Latest Telemetry */}
      <h2
        style={{
          margin: "0 0 16px",
          fontSize: "1.25rem",
          fontWeight: 700,
          color: "#111827",
        }}
      >
        Latest Telemetry
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "16px",
        }}
      >
        {latestTelemetry.map((telem) => {
          const telemetryKey =
            telem.machineId?._id ||
            telem.machineId?.machineId ||
            telem.machineId ||
            telem._id;

          const telemetryStatus = telem.derivedStatus || telem.status || "—";

          return (
            <div
              key={telem._id || telemetryKey}
              style={withCardAnimation(
                {
                  background: "#fff",
                  borderRadius: "12px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  border: "1px solid #e5e7eb",
                  padding: "20px",
                },
                `telem-${telemetryKey}`,
                "#2563eb",
              )}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "12px",
                }}
              >
                <strong style={{ color: "#111827" }}>
                  {telem.machineId?.name || telem.machineId || "Unknown"}
                </strong>
                <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
                  {telem.timestamp
                    ? new Date(telem.timestamp).toLocaleTimeString()
                    : "N/A"}
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                  fontSize: "0.85rem",
                }}
              >
                <div>
                  🌡️ Temp: <strong>{telem.temperature ?? "—"}°C</strong>
                </div>
                <div>
                  💧 Hum: <strong>{telem.humidity ?? "—"}%</strong>
                </div>
                <div>
                  〰️ Vib: <strong>{telem.vibration ?? "—"}</strong>
                </div>
                <div>
                  💡 Lum: <strong>{telem.luminosity ?? "—"}</strong>
                </div>
                <div>
                  📏 Dist: <strong>{telem.distance ?? "—"}cm</strong>
                </div>
                <div>
                  ⚡ Status: <strong>{telemetryStatus}</strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
