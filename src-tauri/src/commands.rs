use tokio::time::{sleep, Duration};

use crate::geo::{get_user_location, haversine_km, max_distance_for_elevation_km};
use crate::iss::{get_iss_coords, get_iss_location};
use crate::models::{IssLocation, LatLon, TleData};
use crate::orbit::build_orbit_path;
use crate::tle::get_iss_tle;

#[tauri::command]
pub async fn iss_location() -> Result<IssLocation, String> {
    get_iss_location().await
}

#[tauri::command]
pub async fn iss_tle() -> Result<TleData, String> {
    get_iss_tle().await
}

#[tauri::command]
pub async fn iss_orbit_path(span_minutes: Option<i64>, step_minutes: Option<i64>) -> Result<Vec<LatLon>, String> {
    let tle = get_iss_tle().await?;
    let span = span_minutes.unwrap_or(90);
    let step = step_minutes.unwrap_or(2);
    build_orbit_path(&tle, span, step)
}

#[tauri::command]
pub async fn time_to_iss() -> Result<f64, String> {
    let ((user_lat, user_lon), iss0) = tokio::try_join!(get_user_location(), get_iss_location())?;
    let (iss_lat0, iss_lon0, iss_alt0) = (iss0.latitude, iss0.longitude, iss0.altitude);

    let d0 = haversine_km(user_lat, user_lon, iss_lat0, iss_lon0);
    const MIN_ELEV_DEG: f64 = 10.0;
    let d_max = max_distance_for_elevation_km(iss_alt0, MIN_ELEV_DEG);

    if d0 <= d_max {
        return Ok(0.0);
    }

    let dt_sec: f64 = 10.0;
    sleep(Duration::from_secs(dt_sec as u64)).await;

    let (iss_lat1, iss_lon1, _iss_alt1) = get_iss_coords().await?;
    let d1 = haversine_km(user_lat, user_lon, iss_lat1, iss_lon1);

    let approaching = d1 < d0;
    let speed = (iss0.velocity / 3600.0).max(0.001);
    if speed <= 0.0001 {
        return Ok(92.6);
    }

    let orbital_period_sec = 92.6 * 60.0;
    let mut seconds = (d0 - d_max) / speed;
    if !approaching {
        seconds = (orbital_period_sec - seconds).max(0.0);
    }
    let minutes = (seconds / 60.0).max(0.0);

    Ok((minutes * 10.0).round() / 10.0)
}
