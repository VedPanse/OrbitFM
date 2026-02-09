use crate::models::{IpApiCoResponse, IpApiComResponse, IpInfoResponse};

pub async fn get_user_location() -> Result<(f64, f64), String> {
    if let Ok(resp) = reqwest::get("https://ipapi.co/json/").await {
        if let Ok(data) = resp.json::<IpApiCoResponse>().await {
            return Ok((data.latitude, data.longitude));
        }
    }

    if let Ok(resp) = reqwest::get("https://ipinfo.io/json").await {
        if let Ok(data) = resp.json::<IpInfoResponse>().await {
            if let Some((lat, lon)) = data.loc.split_once(',') {
                let lat: f64 = lat.trim().parse::<f64>().map_err(|e| e.to_string())?;
                let lon: f64 = lon.trim().parse::<f64>().map_err(|e| e.to_string())?;
                return Ok((lat, lon));
            }
        }
    }

    if let Ok(resp) = reqwest::get("https://ip-api.com/json").await {
        if let Ok(data) = resp.json::<IpApiComResponse>().await {
            return Ok((data.lat, data.lon));
        }
    }

    Err("All IP geolocation providers failed".to_string())
}

pub fn haversine_km(lat1_deg: f64, lon1_deg: f64, lat2_deg: f64, lon2_deg: f64) -> f64 {
    const R: f64 = 6371.0;
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

pub fn max_distance_for_elevation_km(alt_km: f64, min_elev_deg: f64) -> f64 {
    const R: f64 = 6371.0;
    let r = R + alt_km;
    let e_min = min_elev_deg.to_radians();

    let psi_horizon = (R / r).acos();
    if min_elev_deg <= 0.0 {
        return R * psi_horizon;
    }

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
