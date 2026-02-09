use crate::endpoints::ISS_LOCATION_ENDPOINT;
use crate::models::IssLocation;

/// Get ISS's location
pub async fn get_iss_location() -> Result<IssLocation, String> {
    let response = reqwest::get(ISS_LOCATION_ENDPOINT)
        .await
        .map_err(|e| e.to_string())?;
    let data: IssLocation = response.json().await.map_err(|e| e.to_string())?;
    Ok(data)
}

/// Parse only the latitude, longitude, and altitude
pub async fn get_iss_coords() -> Result<(f64, f64, f64), String> {
    let data = get_iss_location().await?;
    Ok((data.latitude, data.longitude, data.altitude))
}
