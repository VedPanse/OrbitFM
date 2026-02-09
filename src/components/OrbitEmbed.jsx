export default function OrbitEmbed({ error, onRefresh, onBack, mode = "full" }) {
  const wrapperClass = mode === "panel" ? "orbit-panel" : "globe-wrap full";
  return (
    <div className={wrapperClass}>
      <iframe
        className="orbit-frame"
        title="ISS Orbit Projections"
        src="/orbit.html"
        frameBorder="0"
        allow="fullscreen"
      />
      <div className="controls floating">
        <button onClick={onRefresh} className="ghost">
          Refresh ISS window
        </button>
        <button onClick={onBack} className="primary">
          {mode === "panel" ? "Hide Orbit" : "Back to Globe"}
        </button>
      </div>
      {error ? <p className="error floating">{error}</p> : null}
    </div>
  );
}
