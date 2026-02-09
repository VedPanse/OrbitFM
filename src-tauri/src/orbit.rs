use chrono::{DateTime, Duration, Utc};
use satellite::{eci_to_geodetic, degrees_lat, degrees_long, gstime, jday_date, propagate_date, twoline2satrec, EciVec3};

use crate::models::{LatLon, TleData};

pub fn build_orbit_path(tle: &TleData, span_minutes: i64, step_minutes: i64) -> Result<Vec<LatLon>, String> {
    let mut satrec = twoline2satrec(&tle.line1, &tle.line2);
    let now: DateTime<Utc> = Utc::now();
    let span = span_minutes.max(1);
    let step = step_minutes.max(1);
    let mut points = Vec::new();

    let mut t = -span;
    while t <= span {
        let time = now + Duration::minutes(t);
        if let Ok(result) = propagate_date(&mut satrec, &time) {
            let value = serde_json::to_value(&result).map_err(|e| e.to_string())?;
            let position = value
                .get("position")
                .and_then(|pos| pos.as_object())
                .ok_or_else(|| "Missing position in Sgp4Result".to_string())?;
            let x = position
                .get("x")
                .and_then(|v| v.as_f64())
                .ok_or_else(|| "Missing position.x in Sgp4Result".to_string())?;
            let y = position
                .get("y")
                .and_then(|v| v.as_f64())
                .ok_or_else(|| "Missing position.y in Sgp4Result".to_string())?;
            let z = position
                .get("z")
                .and_then(|v| v.as_f64())
                .ok_or_else(|| "Missing position.z in Sgp4Result".to_string())?;
            let gmst = gstime(jday_date(time));
            let position = eci_to_geodetic(&EciVec3 { x, y, z }, gmst);
            let lat = match degrees_lat(position.latitude) {
                Ok(value) => value,
                Err(_) => {
                    t += step;
                    continue;
                }
            };
            let lon = match degrees_long(position.longitude) {
                Ok(value) => value,
                Err(_) => {
                    t += step;
                    continue;
                }
            };
            if lat.is_finite() && lon.is_finite() {
                points.push(LatLon {
                    latitude: lat,
                    longitude: lon,
                });
            }
        }
        t += step;
    }

    if points.is_empty() {
        return Err("No orbit points computed.".to_string());
    }

    Ok(points)
}
