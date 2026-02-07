# OrbitFM

**OrbitFM** is a desktop application that lets you track the International Space Station (ISS) in real time and listen to its amateur radio downlink during overhead passes. It is designed as a **listen-only**, fully legal receiver application with a clean architecture that supports future SDR hardware integration.

OrbitFM prioritizes correctness, reliability, and a clear separation between orbital tracking, audio capture, and recording.

---

## Core Features

### 1. Real-Time ISS Tracking

* Determines the user’s **current geographic location** using OS-level location services
* Computes the **current position of the ISS** locally using orbital mechanics (TLE + SGP4)
* Displays:

  * Distance from the user to the ISS
  * ISS altitude
  * Live tracking status
* Works offline using cached orbital data

---

### 2. Pass Prediction & Awareness

* Predicts upcoming ISS passes for the user’s location
* For each pass, computes:

  * Acquisition of Signal (AOS)
  * Loss of Signal (LOS)
  * Maximum elevation
  * Pass duration
* Classifies pass quality (e.g. Poor / OK / Great) based on elevation
* Uses **pass geometry**, not raw distance, to determine radio availability

---

### 3. Notifications

* Sends a **desktop notification 30 minutes before** the next good ISS pass
* Optional notification at AOS (“Going live”)
* Notifications automatically reschedule when:

  * Location changes
  * Orbital data refreshes
  * App restarts

---

### 4. Live Mode

* During an active pass window, OrbitFM enters **Live mode**
* Live mode enables the audio pipeline and recording controls
* In v0, audio comes from selectable mock sources (tone / file / mic)
* Architecture supports seamless transition to SDR-based reception later

---

### 5. Manual Recording with Pre-Roll

* User-initiated recording (no automatic detection in v0)
* Maintains a **continuous 5-second pre-roll buffer**
* When recording starts:

  * The pre-roll audio is prepended automatically
  * Live audio continues until recording stops
* Recordings are saved as WAV files on disk

---

### 6. Recording Library

* Lists all saved recordings in-app
* Displays metadata:

  * Timestamp
  * Duration
  * Associated ISS pass (if available)
  * Audio source
* Supports playback directly inside the app
* Files are stored locally; no cloud dependency

---

## Architecture Overview

OrbitFM is a **local-first desktop application** built with a clear separation of concerns.

### UI Layer

* Tauri + React + TypeScript
* Displays tracking data, pass countdowns, live status, and recordings
* Communicates with the core via Tauri IPC commands

### Core Layer (Rust)

* **Location Service** — user position
* **TLE Service** — fetches and caches ISS orbital elements
* **Tracking Service** — computes ISS position, distance, and passes
* **Notification Scheduler** — manages OS notifications
* **Receiver Service** — provides a stream of PCM audio frames
* **Recorder Service** — handles pre-roll buffering and audio file creation
* **Storage Service** — SQLite database + filesystem layout

All services run locally on the user’s machine.

---

## Data Storage

* **SQLite** (settings, passes, recordings metadata)
* **Filesystem** (WAV audio files)
* Cached orbital data allows the app to function without continuous internet access

---

## Hardware Philosophy

* OrbitFM is **listen-only** by design
* v0 does not require radio hardware
* v1+ will support external SDR receivers (e.g. RTL-SDR) through a pluggable audio source interface
* No transmission capabilities are included or planned

---

## Legal Status

* OrbitFM only **receives** radio signals
* No transmission, rebroadcasting, or interference
* Listening to ISS amateur radio downlinks is legal without a license

---

## Roadmap (High-Level)

* SDR hardware integration (RTL-SDR, etc.)
* Doppler frequency correction
* Automatic recording based on signal detection
* Visual ground-track map
* Advanced pass filtering and analytics

---

## Project Status

OrbitFM is under active development.
The current focus is correctness, robustness, and clean system design before adding hardware-dependent features.
