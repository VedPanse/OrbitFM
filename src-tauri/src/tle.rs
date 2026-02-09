use crate::endpoints::ISS_TLE_ENDPOINT;
use crate::models::TleData;
use serde::Deserialize;

#[derive(Deserialize)]
struct TleApiResponse {
    header: Option<String>,
    name: Option<String>,
    line1: String,
    line2: String,
}

pub async fn get_iss_tle() -> Result<TleData, String> {
    let response = reqwest::get(ISS_TLE_ENDPOINT)
        .await
        .map_err(|e| e.to_string())?;
    let text = response.text().await.map_err(|e| e.to_string())?;
    parse_tle_json(&text)
        .or_else(|| parse_tle_text(&text))
        .ok_or_else(|| "Unexpected TLE format.".to_string())
}

fn parse_tle_json(text: &str) -> Option<TleData> {
    let parsed: TleApiResponse = serde_json::from_str(text).ok()?;
    let name = parsed.header.or(parsed.name);
    Some(TleData {
        name,
        line1: parsed.line1,
        line2: parsed.line2,
    })
}

fn parse_tle_text(text: &str) -> Option<TleData> {
    let lines: Vec<&str> = text
        .lines()
        .map(|line| line.trim())
        .filter(|line| !line.is_empty())
        .collect();

    for idx in 0..lines.len() {
        if lines[idx].starts_with("1 ") {
            if let Some(line2) = lines.get(idx + 1) {
                if line2.starts_with("2 ") {
                    let name = if idx > 0 && !lines[idx - 1].starts_with("0 ") {
                        Some(lines[idx - 1].to_string())
                    } else {
                        None
                    };
                    return Some(TleData {
                        name,
                        line1: lines[idx].to_string(),
                        line2: line2.to_string(),
                    });
                }
            }
        }
    }

    None
}
