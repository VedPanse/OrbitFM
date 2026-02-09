import { invoke } from "@tauri-apps/api/core";

export function getIssLocation() {
  return invoke("iss_location");
}

export function getIssOrbitPath(options = {}) {
  const { spanMinutes, stepMinutes } = options;
  return invoke("iss_orbit_path", {
    span_minutes: spanMinutes,
    step_minutes: stepMinutes
  });
}

export function getTimeToIss() {
  return invoke("time_to_iss");
}
