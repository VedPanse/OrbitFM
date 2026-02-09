import { useEffect, useState } from "react";
import { getIssLocation } from "../lib/issApi";

export function useIssLocation(pollMs = 5000) {
  const [data, setData] = useState({
    latitude: null,
    longitude: null,
    altitude: null,
    velocity: null,
    timestamp: null
  });
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const next = await getIssLocation();
        if (!mounted) return;
        setData({
          latitude: next.latitude,
          longitude: next.longitude,
          altitude: next.altitude,
          velocity: next.velocity,
          timestamp: next.timestamp
        });
      } catch (err) {
        if (!mounted) return;
        setError(`Failed to load ISS data: ${String(err)}`);
      }
    }

    load();
    const intervalId = setInterval(load, pollMs);
    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, [pollMs]);

  return { data, error, setError };
}
