import { useEffect, useRef } from "react";
import createGlobe from "cobe";

export default function GlobeScene({ issData, orbitPath, error, onRefresh, onTrajectory }) {
  const canvasRef = useRef(null);
  const dragStateRef = useRef({ dragging: false, lastX: 0, lastY: 0 });
  const globeStateRef = useRef({ phi: 1.2, theta: 0.2 });
  const centeredRef = useRef(false);
  const followRef = useRef(true);

  useEffect(() => {
    if (!Number.isFinite(issData.latitude) || !Number.isFinite(issData.longitude)) return;
    const latRad = (issData.latitude * Math.PI) / 180;
    const lonRad = (issData.longitude * Math.PI) / 180;
    if (!centeredRef.current || followRef.current) {
      globeStateRef.current.theta = latRad;
      globeStateRef.current.phi = lonRad;
      centeredRef.current = true;
    }
  }, [issData.latitude, issData.longitude]);

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
          for (const point of orbitPath) {
            markers.push({
              location: [point.latitude, point.longitude],
              size: 0.012,
              color: [0.7, 0.9, 1]
            });
          }
        }

        if (Number.isFinite(issData.latitude) && Number.isFinite(issData.longitude)) {
          const elapsed = (performance.now() - pulseStart) / 1000;
          const breath = (Math.sin(elapsed * Math.PI * 0.6) + 1) / 2;
          const ease = breath * breath * (3 - 2 * breath);
          const haloSize = 0.11 + ease * 0.03;
          markers.push(
            {
              location: [issData.latitude, issData.longitude],
              size: haloSize * 1.9,
              color: [1, 0.25, 0.25]
            },
            {
              location: [issData.latitude, issData.longitude],
              size: haloSize * 1.05,
              color: [1, 0.15, 0.15]
            },
            {
              location: [issData.latitude, issData.longitude],
              size: 0.08,
              color: [1, 0.6, 0.6]
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
    followRef.current = false;
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
    <div className="globe-wrap full">
      <canvas
        ref={canvasRef}
        className="globe-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <div className="globe-caption">ISS TRACKING • LIVE ORBIT</div>
      <div className="controls floating">
        <button onClick={onRefresh} className="ghost">
          Refresh ISS window
        </button>
        <button onClick={onTrajectory} className="primary">
          Trajectory Projections
        </button>
      </div>
      {error ? <p className="error floating">{error}</p> : null}
    </div>
  );
}
