import { useEffect, useState } from "react";
import { getIssOrbitPath } from "../lib/issApi";

export function useIssOrbitPath({ spanMinutes = 90, stepMinutes = 2 } = {}) {
  const [path, setPath] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const points = await getIssOrbitPath({
          spanMinutes,
          stepMinutes
        });
        if (!mounted) return;
        setPath(points);
      } catch (err) {
        if (!mounted) return;
        setError(`Failed to load ISS orbit path: ${String(err)}`);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [spanMinutes, stepMinutes]);

  return { path, error, setError };
}
