import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import { useParams, Link } from "react-router-dom";
import api from "../api/axios";

export default function MachineDetailPage() {
  const { machineId } = useParams();
  const [machine, setMachine] = useState(null);
  const [telemetry, setTelemetry] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Machine details
        const machineRes = await api.get(`/machines/${machineId}`);
        const machineData = machineRes.data?.machine || machineRes.data;
        console.log("Machine data:", machineData);
        setMachine(machineData);

        // Telemetry history
        const telemRes = await api.get(
          `/telemetry/history/${machineId}?limit=50`,
        );
        const telemData = Array.isArray(telemRes.data)
          ? telemRes.data
          : telemRes.data?.telemetry || telemRes.data?.data || [];
        console.log("Telemetry data:", telemData.length, telemData);
        setTelemetry(telemData.reverse());

        // Prediction
        try {
          const predictionRes = await api.get(
            `/analytics/predict/${machineId}`,
          );
          const predictionData = predictionRes.data?.prediction || null;
          console.log("Prediction data:", predictionData);
          setPrediction(predictionData);
        } catch (predictionError) {
          console.error("Prediction fetch error:", predictionError);
          setPrediction(null);
        }

        // Alerts
        const alertsRes = await api.get("/alerts");
        const allAlerts = alertsRes.data?.alerts || [];
        const machineAlerts = allAlerts.filter((a) => {
          const id =
            typeof a.machineId === "object" ? a.machineId?._id : a.machineId;
          return id === machineId;
        });
        setAlerts(machineAlerts);
      } catch (err) {
        console.error("MachineDetail error:", err);
        setError(
          err.response?.data?.message ||
            err.message ||
            "Failed to load machine data",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [machineId]);

  if (loading) {
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
        Loading machine data...
      </div>
    );
  }

  if (error) {
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
            marginBottom: "16px",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
        <Link
          to="/"
          style={{ color: "#1e40af", textDecoration: "none", fontWeight: 500 }}
        >
          ← Back to Overview
        </Link>
      </div>
    );
  }

  if (!machine) return null;

  const latestTelem = telemetry[telemetry.length - 1] || {};

  const Sparkline = ({ data, color, height = 60, width = 300 }) => {
    if (!data || !data.length)
      return (
        <div style={{ color: "#9ca3af", fontSize: "0.85rem" }}>No data</div>
      );

    const values = data.map(
      (d) =>
        d.value ||
        d.temperature ||
        d.vibration ||
        d.humidity ||
        d.luminosity ||
        d.distance ||
        0,
    );

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const points = values
      .map((v, i) => {
        const x = (i / (values.length - 1)) * width;
        const y = height - ((v - min) / range) * height;
        return `${x},${y}`;
      })
      .join(" ");

    return (
      <svg width={width} height={height} style={{ overflow: "visible" }}>
        <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
        <circle
          cx={width}
          cy={height - ((values[values.length - 1] - min) / range) * height}
          r="4"
          fill={color}
        />
      </svg>
    );
  };

  Sparkline.propTypes = {
    data: PropTypes.arrayOf(PropTypes.object),
    color: PropTypes.string.isRequired,
    height: PropTypes.number,
    width: PropTypes.number,
  };

  const metrics = [
    {
      label: "Temperature",
      key: "temperature",
      unit: "°C",
      color: "#dc2626",
      icon: "🌡️",
    },
    {
      label: "Humidity",
      key: "humidity",
      unit: "%",
      color: "#2563eb",
      icon: "💧",
    },
    {
      label: "Vibration",
      key: "vibration",
      unit: "g",
      color: "#7c3aed",
      icon: "〰️",
    },
    {
      label: "Luminosity",
      key: "luminosity",
      unit: "lux",
      color: "#ea580c",
      icon: "💡",
    },
    {
      label: "Distance",
      key: "distance",
      unit: "cm",
      color: "#059669",
      icon: "📏",
    },
  ];

  const getAlertStatus = (alert, allAlerts) => {
    const status = (alert.status || "").toLowerCase();

    if (status === "escalated") {
      return {
        badge: "ESCALATED",
        color: "#ea580c",
        message: `Escalated to ${alert.escalatedTo || "critical"}`,
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
          badge: "ESCALATED",
          color: "#ea580c",
          message: `Escalated to ${newerAlert.type || "critical"}`,
        };
      }

      return {
        badge: "RESOLVED",
        color: "#16a34a",
        message: `Resolved ${
          alert.resolvedAt ? new Date(alert.resolvedAt).toLocaleString() : ""
        }`,
      };
    }

    return { badge: null, color: null, message: null };
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ marginBottom: "24px" }}>
        <Link
          to="/"
          style={{
            color: "#6b7280",
            textDecoration: "none",
            fontSize: "0.9rem",
            fontWeight: 500,
          }}
        >
          ← Back to Overview
        </Link>
      </div>

      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          border: "1px solid #e5e7eb",
          padding: "24px",
          marginBottom: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "8px",
              flexWrap: "wrap",
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: "1.5rem",
                fontWeight: 700,
                color: "#111827",
              }}
            >
              {machine.name || machine.machineId}
            </h1>
            <span
              style={{
                padding: "4px 12px",
                borderRadius: "20px",
                fontSize: "0.75rem",
                fontWeight: 700,
                textTransform: "uppercase",
                background: statusBg(machine.currentStatus),
                color: statusColor(machine.currentStatus),
                border: `1px solid ${statusColor(machine.currentStatus)}30`,
              }}
            >
              {machine.currentStatus || "UNKNOWN"}
            </span>
          </div>
          <p style={{ margin: "4px 0", color: "#6b7280", fontSize: "0.95rem" }}>
            <strong>Type:</strong> {machine.type || "N/A"} •{" "}
            <strong>Location:</strong> {machine.location || "N/A"}
          </p>
          <p style={{ margin: "4px 0", color: "#9ca3af", fontSize: "0.85rem" }}>
            Machine ID: {machine.machineId}
          </p>
        </div>

        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: "0.85rem",
              color: "#6b7280",
              marginBottom: "4px",
            }}
          >
            Current Status
          </div>
          <div
            style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: statusColor(machine.currentStatus),
            }}
          >
            {machine.currentStatus || "—"}
          </div>
        </div>
      </div>

      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          border: "1px solid #e5e7eb",
          padding: "24px",
          marginBottom: "24px",
        }}
      >
        <h2
          style={{
            margin: "0 0 16px",
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "#111827",
          }}
        >
          Prediction
        </h2>

        {!prediction ? (
          <p style={{ color: "#6b7280", margin: 0 }}>
            Prediction data is not available.
          </p>
        ) : !prediction.enoughData ? (
          <p style={{ color: "#6b7280", margin: 0 }}>
            {prediction.message ||
              "Not enough telemetry history for prediction."}
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
            }}
          >
            <div
              style={{
                padding: "16px",
                borderRadius: "10px",
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
              }}
            >
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "#6b7280",
                  marginBottom: "6px",
                }}
              >
                Predicted Temperature
              </div>
              <div
                style={{
                  fontSize: "1.35rem",
                  fontWeight: 700,
                  color: "#dc2626",
                }}
              >
                {prediction.predictedTemperature} °C
              </div>
            </div>

            <div
              style={{
                padding: "16px",
                borderRadius: "10px",
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
              }}
            >
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "#6b7280",
                  marginBottom: "6px",
                }}
              >
                Predicted Vibration
              </div>
              <div
                style={{
                  fontSize: "1.35rem",
                  fontWeight: 700,
                  color: "#7c3aed",
                }}
              >
                {prediction.predictedVibration} g
              </div>
            </div>

            <div
              style={{
                padding: "16px",
                borderRadius: "10px",
                background: statusBg(prediction.predictedStatus),
                border: `1px solid ${statusColor(prediction.predictedStatus)}30`,
              }}
            >
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "#6b7280",
                  marginBottom: "6px",
                }}
              >
                Predicted Status
              </div>
              <div
                style={{
                  fontSize: "1.35rem",
                  fontWeight: 700,
                  color: statusColor(prediction.predictedStatus),
                }}
              >
                {prediction.predictedStatus}
              </div>
            </div>

            <div
              style={{
                padding: "16px",
                borderRadius: "10px",
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
              }}
            >
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "#6b7280",
                  marginBottom: "6px",
                }}
              >
                Risk Score
              </div>
              <div
                style={{
                  fontSize: "1.35rem",
                  fontWeight: 700,
                  color:
                    prediction.riskScore >= 80
                      ? "#dc2626"
                      : prediction.riskScore >= 60
                        ? "#ea580c"
                        : "#16a34a",
                }}
              >
                {prediction.riskScore} / 100
              </div>
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        {metrics.map((metric) => {
          const val = latestTelem[metric.key];
          const history = telemetry
            .map((t) => ({ value: t[metric.key] }))
            .filter((t) => t.value !== undefined && t.value !== null);

          return (
            <div
              key={metric.key}
              style={{
                background: "#fff",
                borderRadius: "12px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                border: "1px solid #e5e7eb",
                padding: "20px",
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
                <span
                  style={{
                    fontSize: "0.9rem",
                    color: "#6b7280",
                    fontWeight: 500,
                  }}
                >
                  {metric.icon} {metric.label}
                </span>
                <span
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: 700,
                    color: metric.color,
                  }}
                >
                  {val !== undefined && val !== null
                    ? `${val}${metric.unit ? " " + metric.unit : ""}`
                    : "—"}
                </span>
              </div>
              <Sparkline data={history} color={metric.color} />
            </div>
          );
        })}
      </div>

      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          border: "1px solid #e5e7eb",
          padding: "24px",
        }}
      >
        <h2
          style={{
            margin: "0 0 16px",
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "#111827",
          }}
        >
          Latest Alert
        </h2>

        {alerts.length === 0 ? (
          <p style={{ color: "#6b7280", margin: 0 }}>
            No alerts for this machine.
          </p>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            {alerts.slice(0, 1).map((alert) => {
              const status = getAlertStatus(alert, alerts);

              return (
                <div
                  key={alert._id}
                  style={{
                    padding: "12px 16px",
                    borderRadius: "8px",
                    background:
                      alert.status === "resolved" && status.badge === "RESOLVED"
                        ? "#f9fafb"
                        : "#fef2f2",
                    borderLeft: `3px solid ${
                      status.badge === "ESCALATED"
                        ? "#ea580c"
                        : alert.status === "resolved"
                          ? "#16a34a"
                          : "#dc2626"
                    }`,
                    fontSize: "0.9rem",
                  }}
                >
                  <strong
                    style={{
                      color:
                        status.badge === "ESCALATED"
                          ? "#ea580c"
                          : alert.status === "resolved"
                            ? "#16a34a"
                            : "#dc2626",
                    }}
                  >
                    {status.badge === "ESCALATED"
                      ? "↗️"
                      : alert.status === "resolved"
                        ? "✓"
                        : "●"}{" "}
                    {alert.severity?.toUpperCase()}
                  </strong>
                  {" — "}
                  {alert.title || alert.message}

                  {status.message && (
                    <span
                      style={{
                        color: status.color,
                        fontSize: "0.8rem",
                        marginLeft: "8px",
                        display: "block",
                        marginTop: "4px",
                      }}
                    >
                      {status.message}
                    </span>
                  )}

                  <span
                    style={{
                      color: "#9ca3af",
                      fontSize: "0.8rem",
                      marginLeft: "8px",
                      display: "block",
                      marginTop: "4px",
                    }}
                  >
                    {new Date(alert.triggeredAt).toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
