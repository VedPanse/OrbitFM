import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  const [ISSLocation, setISSLocation] = useState(0.0);
  const [lastError, setLastError] = useState("");
  const [coords, setCoords] = useState(null);

  async function getISSLocation() {
    setISSLocation(await invoke("temp"));
  }

  async function getUserLocation() {
    setLastError("");
    try {
      const ipLoc = await invoke("get_ip_location");
      const [lat, lon] = String(ipLoc)
        .trim()
        .split(/\s+/)
        .map(Number);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        throw new Error(`Invalid IP location response: ${ipLoc}`);
      }
      setCoords({ latitude: lat, longitude: lon, accuracy: null });
    } catch (err) {
      setLastError(`Failed to get IP location: ${String(err)}`);
    }
  }

  return (
    <main className="container">
      <p>ISS Location: {ISSLocation}</p>
      {coords ? (
        <p>
          Location: {coords.latitude}, {coords.longitude} (±
          {coords.accuracy == null ? "unknown" : `${coords.accuracy}m`})
        </p>
      ) : null}
      {lastError ? <p>{lastError}</p> : null}
      <button
        onClick={() => {
          getISSLocation();
          getUserLocation();
        }}
      >
        Click
      </button>
    </main>
  );
}

export default App;
