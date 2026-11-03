import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// StrictMode is intentionally not used: the WebGL scene owns GPU resources and a staged loader that
// must not be double-invoked in development.
createRoot(document.getElementById("root")!).render(<App />);
