import { useCallback, useRef } from "react";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification
} from "@tauri-apps/plugin-notification";

export function useIssNotifications(getTimeToIss, onError) {
  const timersRef = useRef({ timeouts: [], intervalId: null });

  const clearScheduled = useCallback(() => {
    for (const id of timersRef.current.timeouts) {
      clearTimeout(id);
    }
    timersRef.current.timeouts = [];
    if (timersRef.current.intervalId != null) {
      clearInterval(timersRef.current.intervalId);
      timersRef.current.intervalId = null;
    }
  }, []);

  const ensurePermission = useCallback(async () => {
    const granted = await isPermissionGranted();
    if (granted) return;
    const permission = await requestPermission();
    if (permission !== "granted") {
      throw new Error("Notification permission was not granted.");
    }
  }, []);

  const send = useCallback((title, body) => {
    sendNotification({ title, body });
  }, []);

  const scheduleTimeout = useCallback((ms, fn) => {
    const id = setTimeout(fn, ms);
    timersRef.current.timeouts.push(id);
  }, []);

  const startOutOfRangeWatcher = useCallback(() => {
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
        const nextMinutes = await getTimeToIss();
        const minutes = Number(nextMinutes);
        if (Number.isFinite(minutes) && minutes > 0) {
          send("Goddbye, sucker", "ISS is out of range.");
          clearScheduled();
          return;
        }
      } catch (err) {
        onError?.(`Failed while checking ISS range: ${String(err)}`);
      } finally {
        checking = false;
      }

      elapsedMinutes += 1;
      if (elapsedMinutes >= maxMinutes) {
        clearScheduled();
      }
    }, 60 * 1000);
  }, [clearScheduled, getTimeToIss, onError, send]);

  const scheduleNotifications = useCallback(async () => {
    try {
      clearScheduled();
      await ensurePermission();
      const minutesToIss = await getTimeToIss();

      const minutes = Number(minutesToIss);
      if (!Number.isFinite(minutes)) {
        throw new Error(`Invalid time_to_iss value: ${String(minutesToIss)}`);
      }

      const msPerMinute = 60 * 1000;
      const inRangeMs = Math.max(0, minutes * msPerMinute);

      if (minutes >= 30) {
        scheduleTimeout((minutes - 30) * msPerMinute, () => {
          send("ISS in 30 minutes", "Get ready.");
        });
      }

      if (minutes >= 5) {
        scheduleTimeout((minutes - 5) * msPerMinute, () => {
          send("ISS in 5 minutes", "Almost time.");
        });
      }

      if (minutes <= 0) {
        send("ISS is in range", "Look up!");
        startOutOfRangeWatcher();
        return;
      }

      scheduleTimeout(inRangeMs, () => {
        send("ISS is in range", "Look up!");
        startOutOfRangeWatcher();
      });
    } catch (err) {
      onError?.(`Failed to send notification: ${String(err)}`);
      throw err;
    }
  }, [clearScheduled, ensurePermission, getTimeToIss, onError, scheduleTimeout, send, startOutOfRangeWatcher]);

  return { scheduleNotifications, clearScheduled };
}
