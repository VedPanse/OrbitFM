import { useCallback, useEffect, useState } from "react";
import { getTimeToIss } from "../lib/issApi";

export function useTimeToIss(pollMs = 60 * 1000) {
  const [time, setTime] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setError("");
      setLoading(true);
      const next = await getTimeToIss();
      setTime(next);
      setLoading(false);
      return next;
    } catch (err) {
      const msg = `Failed to get estimate: ${String(err)}`;
      setError(msg);
      setLoading(false);
      throw err;
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      refresh().catch(() => {});
    }, pollMs);
    return () => clearInterval(intervalId);
  }, [pollMs, refresh]);

  return { time, loading, error, setError, refresh };
}
