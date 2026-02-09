mod commands;
mod endpoints;
mod geo;
mod iss;
mod models;
mod orbit;
mod tle;

/// Main entry point
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![
            commands::time_to_iss,
            commands::iss_location,
            commands::iss_tle,
            commands::iss_orbit_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
