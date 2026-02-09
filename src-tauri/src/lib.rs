use serde::{Deserialize, Serialize};
use tokio::time::{sleep, Duration};

static ISS_LOCATION_ENDPOINT: &str = "https://api.wheretheiss.at/v1/satellites/25544";

#[derive(Deserialize, Serialize, Debug)]
struct ISSLocation {
    latitude: f64,
    longitude: f64,
    altitude: f64,
    timestamp: f64,
    velocity: f64,
}

#[derive(Deserialize, Serialize, Debug)]
struct IpApiComResponse {
    lat: f64,
    lon: f64,
}

#[derive(Deserialize, Serialize, Debug)]
struct IpApiCoResponse {
    latitude: f64,
    longitude: f64,
}

#[derive(Deserialize, Serialize, Debug)]
struct IpInfoResponse {
    loc: String,
}

async fn get_iss_location() -> Result<ISSLocation, String> {
    let response = reqwest::get(ISS_LOCATION_ENDPOINT)
        .await
        .map_err(|e| e.to_string())?;
    let data: ISSLocation = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}


async fn get_iss_coords() -> Result<(f64, f64, f64), String> {
    let data = get_iss_location().await?;
    Ok((data.latitude, data.longitude, data.altitude))
}

async fn get_user_location() -> Result<(f64, f64), String> {
    // Try multiple providers in order to avoid provider-specific blocking.
    // 1) ipapi.co
    if let Ok(resp) = reqwest::get("https://ipapi.co/json/").await {
        if let Ok(data) = resp.json::<IpApiCoResponse>().await {
            return Ok((data.latitude, data.longitude));
        }
    }

    // 2) ipinfo.io
    if let Ok(resp) = reqwest::get("https://ipinfo.io/json").await {
        if let Ok(data) = resp.json::<IpInfoResponse>().await {
            if let Some((lat, lon)) = data.loc.split_once(',') {
                let lat: f64 = lat
                    .trim()
                    .parse::<f64>()
                    .map_err(|e| e.to_string())?;
                let lon: f64 = lon
                    .trim()
                    .parse::<f64>()
                    .map_err(|e| e.to_string())?;
                return Ok((lat, lon));
            }
        }
    }

    // 3) ip-api.com
    if let Ok(resp) = reqwest::get("https://ip-api.com/json").await {
        if let Ok(data) = resp.json::<IpApiComResponse>().await {
            return Ok((data.lat, data.lon));
        }
    }

    Err("All IP geolocation providers failed".to_string())
}

fn haversine_km(lat1_deg: f64, lon1_deg: f64, lat2_deg: f64, lon2_deg: f64) -> f64 {
    const R: f64 = 6371.0; // km
    let lat1 = lat1_deg.to_radians();
    let lon1 = lon1_deg.to_radians();
    let lat2 = lat2_deg.to_radians();
    let lon2 = lon2_deg.to_radians();

    let dlat = lat2 - lat1;
    let dlon = lon2 - lon1;

    let sin_dlat2 = (dlat / 2.0).sin();
    let sin_dlon2 = (dlon / 2.0).sin();

    let a = sin_dlat2 * sin_dlat2 + lat1.cos() * lat2.cos() * (sin_dlon2 * sin_dlon2);
    let a = a.clamp(0.0, 1.0);
    let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());
    R * c
}


fn max_distance_for_elevation_km(alt_km: f64, min_elev_deg: f64) -> f64 {
    const R: f64 = 6371.0; // km
    let r = R + alt_km;
    let e_min = min_elev_deg.to_radians();

    // Horizon central angle (elevation = 0)
    let psi_horizon = (R / r).acos();
    if min_elev_deg <= 0.0 {
        return R * psi_horizon;
    }

    // Binary search for psi where elevation == min_elev
    let mut lo = 0.0;
    let mut hi = psi_horizon;
    for _ in 0..60 {
        let mid = (lo + hi) * 0.5;
        let elev = (mid.cos() - R / r).atan2(mid.sin());
        if elev >= e_min {
            lo = mid;
        } else {
            hi = mid;
        }
    }

    R * lo
}

#[tauri::command]
async fn time_to_iss() -> Result<f64, String> {
    let ((user_lat, user_lon), iss0) =
        tokio::try_join!(get_user_location(), get_iss_location())?;
    let (iss_lat0, iss_lon0, iss_alt0) = (iss0.latitude, iss0.longitude, iss0.altitude);

    let d0 = haversine_km(user_lat, user_lon, iss_lat0, iss_lon0);
    // Approx radio contact requires some minimum elevation above horizon.
    // 10° is a conservative default for reliable VHF/UHF contact.
    const MIN_ELEV_DEG: f64 = 10.0;
    let d_max = max_distance_for_elevation_km(iss_alt0, MIN_ELEV_DEG);

    if d0 <= d_max {
        return Ok(0.0);
    }

    // Sample again after a short interval to estimate approach speed.
    let dt_sec: f64 = 10.0;
    sleep(Duration::from_secs(dt_sec as u64)).await;

    let (iss_lat1, iss_lon1, _iss_alt1) = get_iss_coords().await?;
    let d1 = haversine_km(user_lat, user_lon, iss_lat1, iss_lon1);

    let approaching = d1 < d0;
    // Use reported orbital velocity for a more stable estimate (km/h -> km/s).
    let speed = (iss0.velocity / 3600.0).max(0.001);
    if speed <= 0.0001 {
        // If we can't estimate a meaningful speed, fall back to a rough orbital period.
        return Ok(92.6);
    }

    let orbital_period_sec = 92.6 * 60.0;
    let mut seconds = (d0 - d_max) / speed;
    if !approaching {
        // Moving away: estimate time until next contact as one orbit minus time since last contact.
        seconds = (orbital_period_sec - seconds).max(0.0);
    }
    let minutes = (seconds / 60.0).max(0.0);

    Ok((minutes * 10.0).round() / 10.0)
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
	.plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            time_to_iss
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
