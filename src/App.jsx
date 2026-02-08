import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification
} from "@tauri-apps/plugin-notification";
import createGlobe from "cobe";
import "./App.css";

const ISS_ENDPOINT = "https://api.wheretheiss.at/v1/satellites/25544";

async function ensureNotificationPermission() {
  const granted = await isPermissionGranted();

  if (!granted) {
    const permission = await requestPermission();
    const permissionGranted = permission === "granted";
    if (!permissionGranted) {
      throw new Error("Notification permission was not granted.");
    }
  }
}

function sendNotificationToUser(title, body) {
  sendNotification({
    title: title,
    body: body
  });
}

function formatMetric(value, decimals = 0) {
  if (value == null || Number.isNaN(value)) return "--";
  return Number(value).toFixed(decimals);
}

// ISS marker is rendered by COBE markers to avoid duplicate overlays.


function App() {
  const [time, setTime] = useState(null);
  const [timeLoading, setTimeLoading] = useState(false);
  const [error, setError] = useState("");
  const [issData, setIssData] = useState({
    latitude: null,
    longitude: null,
    altitude: null,
    velocity: null,
    timestamp: null
  });
  const timersRef = useRef({ timeouts: [], intervalId: null });
  const canvasRef = useRef(null);
  const globeWrapRef = useRef(null);
  const dragStateRef = useRef({ dragging: false, lastX: 0, lastY: 0 });
  const globeStateRef = useRef({ phi: 1.2, theta: 0.2 });


  async function fetchTimeToISS() {
    try {
      setError("");
      setTimeLoading(true);
      const timeToISS = await invoke("time_to_iss");
      setTime(timeToISS);
      setTimeLoading(false);
      return timeToISS;
    } catch (err) {
      const msg = `Failed to get estimate: ${String(err)}`;
      setError(msg);
      setTimeLoading(false);
      throw err;
    }
  }

  async function getTimeToISS() {
    await fetchTimeToISS();
  }

  function clearScheduled() {
    for (const id of timersRef.current.timeouts) {
      clearTimeout(id);
    }
    timersRef.current.timeouts = [];
    if (timersRef.current.intervalId != null) {
      clearInterval(timersRef.current.intervalId);
      timersRef.current.intervalId = null;
    }
  }

  function scheduleTimeout(ms, fn) {
    const id = setTimeout(fn, ms);
    timersRef.current.timeouts.push(id);
  }

  async function scheduleIssNotifications() {
    clearScheduled();
    await ensureNotificationPermission();
    const minutesToIss = await fetchTimeToISS();

    const minutes = Number(minutesToIss);
    if (!Number.isFinite(minutes)) {
      throw new Error(`Invalid time_to_iss value: ${String(minutesToIss)}`);
    }

    const msPerMinute = 60 * 1000;
    const inRangeMs = Math.max(0, minutes * msPerMinute);

    if (minutes >= 30) {
      scheduleTimeout((minutes - 30) * msPerMinute, () => {
        sendNotificationToUser("ISS in 30 minutes", "Get ready.");
      });
    }

    if (minutes >= 5) {
      scheduleTimeout((minutes - 5) * msPerMinute, () => {
        sendNotificationToUser("ISS in 5 minutes", "Almost time.");
      });
    }

    if (minutes <= 0) {
      sendNotificationToUser("ISS is in range", "Look up!");
      startOutOfRangeWatcher();
      return;
    }

    scheduleTimeout(inRangeMs, () => {
      sendNotificationToUser("ISS is in range", "Look up!");
      startOutOfRangeWatcher();
    });
  }

  function startOutOfRangeWatcher() {
    if (timersRef.current.intervalId != null) {
      return;
    }

    let checking = false;
    let elapsedMinutes = 0;
    const maxMinutes = 30;

    timersRef.current.intervalId = setInterval(async () => {
      if (checking) return;
      checking = true;
      try {
        const nextMinutes = await invoke("time_to_iss");
        const minutes = Number(nextMinutes);
        if (Number.isFinite(minutes) && minutes > 0) {
          sendNotificationToUser("Goddbye, sucker", "ISS is out of range.");
          clearScheduled();
          return;
        }
      } catch (err) {
        const msg = `Failed while checking ISS range: ${String(err)}`;
        setError(msg);
      } finally {
        checking = false;
      }

      elapsedMinutes += 1;
      if (elapsedMinutes >= maxMinutes) {
        clearScheduled();
      }
    }, 60 * 1000);
  }

  useEffect(() => {
    let mounted = true;

    async function loadIss() {
      try {
        const resp = await fetch(ISS_ENDPOINT);
        if (!resp.ok) {
          throw new Error(`ISS request failed: ${resp.status}`);
        }
        const data = await resp.json();
        if (!mounted) return;
        setIssData({
          latitude: data.latitude,
          longitude: data.longitude,
          altitude: data.altitude,
          velocity: data.velocity,
          timestamp: data.timestamp
        });
      } catch (err) {
        if (!mounted) return;
        setError(`Failed to load ISS data: ${String(err)}`);
      }
    }

    loadIss();
    const intervalId = setInterval(loadIss, 5000);

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    fetchTimeToISS().catch(() => {});
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchTimeToISS().catch(() => {});
    }, 60 * 1000);

    return () => clearInterval(intervalId);
  }, []);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      const rect = canvas.getBoundingClientRect();
      width = rect.width * dpr;
      height = rect.height * dpr;
      canvas.width = width;
      canvas.height = height;
    }

    resize();

    const pulseStart = performance.now();

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width,
      height,
      phi: globeStateRef.current.phi,
      theta: globeStateRef.current.theta,
      dark: 0,
      diffuse: 1.35,
      mapSamples: 16000,
      mapBrightness: 7.5,
      baseColor: [0.28, 0.36, 0.85],
      landColor: [0.9, 0.95, 1],
      glowColor: [0.5, 0.6, 1],
      markerColor: [1, 1, 1],
      scale: 1.12,
      markers: [],
      onRender: (state) => {
        state.width = width;
        state.height = height;
        state.phi = globeStateRef.current.phi;
        state.theta = globeStateRef.current.theta;
        if (Number.isFinite(issData.latitude) && Number.isFinite(issData.longitude)) {
          const elapsed = (performance.now() - pulseStart) / 1000;
          const breath = (Math.sin(elapsed * Math.PI * 0.6) + 1) / 2;
          const ease = breath * breath * (3 - 2 * breath);
          const haloSize = 0.095 + ease * 0.025;
          state.markers = [
            {
              location: [issData.latitude, issData.longitude],
              size: haloSize,
              color: [0.75, 0.88, 1]
            },
            {
              location: [issData.latitude, issData.longitude],
              size: 0.052,
              color: [1, 1, 1]
            }
          ];
        } else {
          state.markers = [];
        }
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      resize();
    });
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    return () => {
      resizeObserver.disconnect();
      globe.destroy();
    };
  }, [issData.latitude, issData.longitude]);

  function handlePointerDown(event) {
    dragStateRef.current.dragging = true;
    dragStateRef.current.lastX = event.clientX;
    dragStateRef.current.lastY = event.clientY;
  }

  function handlePointerMove(event) {
    if (!dragStateRef.current.dragging) return;
    const dx = event.clientX - dragStateRef.current.lastX;
    const dy = event.clientY - dragStateRef.current.lastY;
    dragStateRef.current.lastX = event.clientX;
    dragStateRef.current.lastY = event.clientY;
    globeStateRef.current.phi += dx * 0.004;
    globeStateRef.current.theta += dy * 0.004;
    globeStateRef.current.theta = Math.max(-1.2, Math.min(1.2, globeStateRef.current.theta));
  }

  function handlePointerUp() {
    dragStateRef.current.dragging = false;
  }

  return (
    <main className="app">
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

      <section className="scene">
        <div ref={globeWrapRef} className="globe-wrap full">
          <canvas
            ref={canvasRef}
            className="globe-canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
          {null}
          <div className="globe-caption">ISS TRACKING • LIVE ORBIT</div>
          <div className="controls floating">
            <button onClick={getTimeToISS} className="ghost">
              Refresh ISS window
            </button>
            <button
              onClick={() => {
                setError("");
                scheduleIssNotifications().catch((err) => {
                  const msg = `Failed to send notification: ${String(err)}`;
                  setError(msg);
                });
              }}
              className="primary"
            >
              Arm notifications
            </button>
          </div>
          {error ? <p className="error floating">{error}</p> : null}
        </div>
      </section>
    </main>
  );
}

export default App;
