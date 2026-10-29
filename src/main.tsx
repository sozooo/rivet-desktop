import { createRoot } from "react-dom/client";
import "@fontsource-variable/onest";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./style.css";
import { App } from "./App";
import { logUncaughtErrors } from "./errors/log";

logUncaughtErrors();
createRoot(document.getElementById("root")!).render(<App />);
