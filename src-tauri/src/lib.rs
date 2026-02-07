use serde::{Deserialize, Serialize};

static ISS_LOCATION_ENDPOINT: &str = "https://api.wheretheiss.at/v1/satellites/25544";

#[derive(Deserialize, Serialize, Debug)]
struct ISSLocation {
    latitude: f64,
    longitude: f64,
    altitude: f64,
    timestamp: f64,
    velocity: f64,
}


async fn get_iss_location() -> Result<ISSLocation, String> {
    let response = reqwest::get(ISS_LOCATION_ENDPOINT)
        .await
        .map_err(|e| e.to_string())?;
    let data: ISSLocation = response.json().await.map_err(|e| e.to_string())?;
    println!("{}", data.latitude);
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


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![temp])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
