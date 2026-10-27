import { createRoot } from "react-dom/client";
import "@fontsource-variable/onest";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./style.css";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(<App />);
