use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::Manager;

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

#[tauri::command]
async fn temp() -> Result<String, String> {
    let data = get_iss_location().await?;
    Ok(format!(
        "{} {} {}",
        data.latitude, data.longitude, data.altitude
    ))
}

#[tauri::command]
async fn get_ip_location() -> Result<String, String> {
    // Try multiple providers in order to avoid provider-specific blocking.
    // 1) ipapi.co
    if let Ok(resp) = reqwest::get("https://ipapi.co/json/").await {
        if let Ok(data) = resp.json::<IpApiCoResponse>().await {
            return Ok(format!("{} {}", data.latitude, data.longitude));
        }
    }

    // 2) ipinfo.io
    if let Ok(resp) = reqwest::get("https://ipinfo.io/json").await {
        if let Ok(data) = resp.json::<IpInfoResponse>().await {
            if let Some((lat, lon)) = data.loc.split_once(',') {
                return Ok(format!("{} {}", lat.trim(), lon.trim()));
            }
        }
    }

    // 3) ip-api.com
    if let Ok(resp) = reqwest::get("https://ip-api.com/json").await {
        if let Ok(data) = resp.json::<IpApiComResponse>().await {
            return Ok(format!("{} {}", data.lat, data.lon));
        }
    }

    Err("All IP geolocation providers failed".to_string())
}

#[tauri::command]
fn diagnose_location(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let identifier = app.config().identifier.clone();
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?;
    let info_plist_path = resource_dir
        .parent()
        .map(|p| p.join("Info.plist"));

    let mut plist_present = false;
    let mut plist_keys = Vec::new();
    if let Some(path) = info_plist_path.as_ref() {
        if let Ok(contents) = std::fs::read_to_string(path) {
            plist_present = true;
            for key in [
                "NSLocationWhenInUseUsageDescription",
                "NSLocationAlwaysAndWhenInUseUsageDescription",
                "NSLocationUsageDescription",
            ] {
                if contents.contains(key) {
                    plist_keys.push(key);
                }
            }
        }
    }

    Ok(json!({
        "identifier": identifier,
        "resourceDir": resource_dir,
        "infoPlistPath": info_plist_path,
        "infoPlistPresent": plist_present,
        "locationKeysFound": plist_keys,
    }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_geolocation::init())
        .invoke_handler(tauri::generate_handler![
            temp,
            get_ip_location,
            diagnose_location
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
