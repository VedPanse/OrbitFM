import { formatMetric } from "../lib/format";

export default function TopMetrics({ issData, time, timeLoading }) {
  return (
    <header className="top-metrics">
      <div className="metric">
        <span className="label">Velocity</span>
        <span className="value">{formatMetric(issData.velocity, 0)}</span>
        <span className="unit">km/h</span>
      </div>
      <div className="metric divider">
        <span className="label">Altitude</span>
        <span className="value">{formatMetric(issData.altitude, 0)}</span>
        <span className="unit">km</span>
      </div>
      <div className="metric">
        <span className="label">Next pass</span>
        <span className="value">
          {time == null ? (timeLoading ? "..." : "--") : formatMetric(time, 1)}
        </span>
        <span className="unit">min</span>
      </div>
    </header>
  );
}
