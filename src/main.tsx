import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./styles/index.css";
import { App } from "./app/App";
import { warmLocalStatus } from "./ai/local/manager";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline shell: grounding and the reset library work without a connection.
registerSW({ immediate: true });
// Check (without downloading anything) whether this device could run Gemma.
warmLocalStatus();
