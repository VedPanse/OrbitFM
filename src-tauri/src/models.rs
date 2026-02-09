use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct IssLocation {
    pub latitude: f64,
    pub longitude: f64,
    pub altitude: f64,
    pub timestamp: f64,
    pub velocity: f64,
}

#[derive(Serialize, Debug, Clone)]
pub struct TleData {
    pub name: Option<String>,
    pub line1: String,
    pub line2: String,
}

#[derive(Serialize, Debug, Clone)]
pub struct LatLon {
    pub latitude: f64,
    pub longitude: f64,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct IpApiComResponse {
    pub lat: f64,
    pub lon: f64,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct IpApiCoResponse {
    pub latitude: f64,
    pub longitude: f64,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct IpInfoResponse {
    pub loc: String,
}
