import { useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import "./App.css";

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


function App() {
  const [time, setTime] = useState(null);
  const [error, setError] = useState("");
  const timersRef = useRef({ timeouts: [], intervalId: null });

  async function fetchTimeToISS() {
    try {
      setError("");
      setTime("Calculating...");
      const timeToISS = await invoke("time_to_iss");
      setTime(timeToISS);
      return timeToISS;
    } catch (err) {
      const msg = `Failed to get estimate: ${String(err)}`;
      setError(msg);
      setTime(null);
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

  return (
    <main className="container">
      {time != null ? (
        <p>
          {time} min
        </p>
      ) : null}
      {error ? <p>{error}</p> : null}
      <button
        onClick={() => {
          getTimeToISS();
        }}
      >
        Click
      </button>
      <button onClick={() => {
      	setError("");
      	scheduleIssNotifications()
      		.catch((err) => {
      			const msg = `Failed to send notification: ${String(err)}`;
      			setError(msg);
      		});
      }}>
      	Get notification
      </button>
    </main>
  );
}

export default App;
