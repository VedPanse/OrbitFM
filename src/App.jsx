import { useState } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  const [ISSLocation, setISSLocation] = useState(0.0)

  async function getISSLocation() {
    setISSLocation(await invoke("temp"));
  }

  return (
    <main className="container">
      <p>ISS Location: {ISSLocation}</p>
      <button
      onClick={getISSLocation}>
        Click
      </button>
    </main>
  );
}

export default App;
