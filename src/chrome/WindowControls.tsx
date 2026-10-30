import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useI18n } from "../i18n/i18n";
import { platform } from "../platform";

/** Windows' own caption glyphs (Segoe Fluent Icons / Segoe MDL2 Assets). */
const glyph = {
  minimize: "\uE921",
  maximize: "\uE922",
  restore: "\uE923",
  close: "\uE8BB",
};

/**
 * Minimise, maximise and close in the top-right corner. Rivet draws its own
 * title bar, so Windows can't tint it in a colour that clashes with the app.
 */
export function WindowControls() {
  const { t } = useI18n();
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    const appWindow = getCurrentWindow();
    const sync = () => appWindow.isMaximized().then(setMaximized);
    sync();
    const stop = appWindow.onResized(sync);
    return () => {
      stop.then((unlisten) => unlisten());
    };
  }, []);

  // Resting on maximize opens Windows 11's snap layouts, as on a native button.
  const snapTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const stopSnap = () => clearTimeout(snapTimer.current);
  useEffect(() => stopSnap, []);

  const appWindow = getCurrentWindow();
  const maximizeLabel = t(maximized ? "window.restore" : "window.maximize");
  return (
    <div className="window-controls">
      <button
        title={t("window.minimize")}
        aria-label={t("window.minimize")}
        tabIndex={-1}
        onClick={() => appWindow.minimize()}
      >
        {glyph.minimize}
      </button>
      {/* No tooltip here: Windows shows its snap layouts instead. */}
      <button
        aria-label={maximizeLabel}
        tabIndex={-1}
        onClick={() => {
          stopSnap();
          appWindow.toggleMaximize();
        }}
        onMouseEnter={() => {
          stopSnap();
          snapTimer.current = setTimeout(() => {
            // Win + Z acts on the active window, which must be Rivet.
            if (document.hasFocus()) invoke("show_snap_layouts");
          }, 600);
        }}
        onMouseLeave={stopSnap}
        onMouseDown={stopSnap}
      >
        {maximized ? glyph.restore : glyph.maximize}
      </button>
      <button
        className="close"
        title={t("window.close")}
        aria-label={t("window.close")}
        tabIndex={-1}
        onClick={() => appWindow.close()}
      >
        {glyph.close}
      </button>
    </div>
  );
}

/** A strip to move the window by on screens that have no top bar. */
export function DragStrip() {
  return platform.desktop ? (
    <div className="window-drag" data-tauri-drag-region />
  ) : null;
}
