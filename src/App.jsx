import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification
} from "@tauri-apps/plugin-notification";
import createGlobe from "cobe";
import * as satellite from "satellite.js";
import "./App.css";

const ISS_ENDPOINT = "https://api.wheretheiss.at/v1/satellites/25544";
const ISS_TLE_ENDPOINT = "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE";

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

function parseTle(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;
  if (lines.length >= 3 && lines[1].startsWith("1 ") && lines[2].startsWith("2 ")) {
    return { name: lines[0], line1: lines[1], line2: lines[2] };
  }
  if (lines[0].startsWith("1 ") && lines[1].startsWith("2 ")) {
    return { name: null, line1: lines[0], line2: lines[1] };
  }
  return null;
}


function App() {
  const [time, setTime] = useState(null);
  const [timeLoading, setTimeLoading] = useState(false);
  const [error, setError] = useState("");
  const [showOrbit, setShowOrbit] = useState(false);
  const [tleData, setTleData] = useState({ name: null, line1: null, line2: null });
  const [orbitPath, setOrbitPath] = useState([]);
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
    let mounted = true;

    async function loadTle() {
      try {
        const resp = await fetch(ISS_TLE_ENDPOINT);
        if (!resp.ok) {
          throw new Error(`TLE request failed: ${resp.status}`);
        }
        const text = await resp.text();
        const parsed = parseTle(text);
        if (!mounted) return;
        if (!parsed) {
          throw new Error("Unexpected TLE format.");
        }
        setTleData(parsed);
      } catch (err) {
        if (!mounted) return;
        setError(`Failed to load ISS TLE: ${String(err)}`);
      }
    }

    loadTle();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!tleData.line1 || !tleData.line2) return;
    const satrec = satellite.twoline2satrec(tleData.line1, tleData.line2);
    const now = new Date();
    const minutesSpan = 90;
    const stepMinutes = 2;
    const points = [];

    for (let t = -minutesSpan; t <= minutesSpan; t += stepMinutes) {
      const time = new Date(now.getTime() + t * 60 * 1000);
      const positionAndVelocity = satellite.propagate(satrec, time);
      const positionEci = positionAndVelocity.position;
      if (!positionEci) continue;
      const gmst = satellite.gstime(time);
      const positionGd = satellite.eciToGeodetic(positionEci, gmst);
      const lat = satellite.degreesLat(positionGd.latitude);
      const lon = satellite.degreesLong(positionGd.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        points.push([lat, lon]);
      }
    }

    setOrbitPath(points);
  }, [tleData.line1, tleData.line2]);

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
      landColor: [0.12, 0.36, 0.22],
      glowColor: [0.5, 0.6, 1],
      markerColor: [0.7, 0.9, 1],
      scale: 1.12,
      markers: [],
      onRender: (state) => {
        state.width = width;
        state.height = height;
        state.phi = globeStateRef.current.phi;
        state.theta = globeStateRef.current.theta;
        const markers = [];
        if (orbitPath.length > 0) {
          for (const [lat, lon] of orbitPath) {
            markers.push({
              location: [lat, lon],
              size: 0.012,
              color: [0.7, 0.9, 1]
            });
          }
        }
        if (Number.isFinite(issData.latitude) && Number.isFinite(issData.longitude)) {
          const elapsed = (performance.now() - pulseStart) / 1000;
          const breath = (Math.sin(elapsed * Math.PI * 0.6) + 1) / 2;
          const ease = breath * breath * (3 - 2 * breath);
          const haloSize = 0.095 + ease * 0.025;
          markers.push(
            {
              location: [issData.latitude, issData.longitude],
              size: haloSize * 1.45,
              color: [0.15, 0.95, 0.8]
            },
            {
              location: [issData.latitude, issData.longitude],
              size: haloSize,
              color: [0.35, 0.9, 1]
            },
            {
              location: [issData.latitude, issData.longitude],
              size: 0.045,
              color: [1, 1, 1]
            }
          );
        }
        state.markers = markers;
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
  }, [issData.latitude, issData.longitude, orbitPath]);


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
        {showOrbit ? (
          <div className="globe-wrap full">
            <iframe
              className="orbit-frame"
              title="ISS Orbit Projections"
              src="/orbit.html"
              frameBorder="0"
              allow="fullscreen"
            />
            <div className="controls floating">
              <button onClick={getTimeToISS} className="ghost">
                Refresh ISS window
              </button>
              <button
                onClick={() => {
                  setError("");
                  setShowOrbit((prev) => !prev);
                }}
                className="primary"
              >
                Back to Globe
              </button>
            </div>
            {error ? <p className="error floating">{error}</p> : null}
          </div>
        ) : (
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
                  setShowOrbit(true);
                }}
                className="primary"
              >
                Trajectory Projections
              </button>
            </div>
            {error ? <p className="error floating">{error}</p> : null}
          </div>
        )}
      </section>
    </main>
  );
}

export default App;
