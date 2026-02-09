import { useState } from "react";
import "./App.css";
import GlobeScene from "./components/GlobeScene";
import OrbitEmbed from "./components/OrbitEmbed";
import TopMetrics from "./components/TopMetrics";
import { useIssLocation } from "./hooks/useIssLocation";
import { useIssOrbitPath } from "./hooks/useIssOrbitPath";
import { useTimeToIss } from "./hooks/useTimeToIss";
import { useIssNotifications } from "./hooks/useIssNotifications";

function App() {
  const [showOrbit, setShowOrbit] = useState(false);
  const { data: issData, error: issError, setError: setIssError } = useIssLocation();
  const { path: orbitPath, error: orbitError, setError: setOrbitError } = useIssOrbitPath();
  const { time, loading: timeLoading, error: timeError, setError: setTimeError, refresh } = useTimeToIss();
  const { scheduleNotifications } = useIssNotifications(refresh, (msg) => {
    setIssError(msg);
  });

  const error = issError || orbitError || timeError;

  return (
    <main className="app">
      <TopMetrics issData={issData} time={time} timeLoading={timeLoading} />
      <section className="scene">
        <GlobeScene
          issData={issData}
          orbitPath={orbitPath}
          error={error}
          onRefresh={() => {
            setIssError("");
            setOrbitError("");
            setTimeError("");
            refresh().catch(() => {});
          }}
          onTrajectory={() => {
            setIssError("");
            setOrbitError("");
            setTimeError("");
            scheduleNotifications().catch(() => {});
            setShowOrbit((prev) => !prev);
          }}
        />
        {showOrbit ? (
          <OrbitEmbed
            mode="panel"
            error={error}
            onRefresh={() => {
              setIssError("");
              setOrbitError("");
              setTimeError("");
              refresh().catch(() => {});
            }}
            onBack={() => {
              setIssError("");
              setOrbitError("");
              setTimeError("");
              setShowOrbit(false);
            }}
          />
        ) : null}
      </section>
    </main>
  );
}

export default App;
