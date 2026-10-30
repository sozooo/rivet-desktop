import { useEffect, useState } from "react";
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

  const appWindow = getCurrentWindow();
  const buttons = [
    {
      label: t("window.minimize"),
      glyph: glyph.minimize,
      run: () => appWindow.minimize(),
    },
    {
      label: t(maximized ? "window.restore" : "window.maximize"),
      glyph: maximized ? glyph.restore : glyph.maximize,
      run: () => appWindow.toggleMaximize(),
    },
    {
      label: t("window.close"),
      glyph: glyph.close,
      run: () => appWindow.close(),
      close: true,
    },
  ];
  return (
    <div className="window-controls">
      {buttons.map((b) => (
        <button
          key={b.glyph}
          className={b.close ? "close" : undefined}
          title={b.label}
          aria-label={b.label}
          tabIndex={-1}
          onClick={b.run}
        >
          {b.glyph}
        </button>
      ))}
    </div>
  );
}

/** A strip to move the window by on screens that have no top bar. */
export function DragStrip() {
  return platform.desktop ? (
    <div className="window-drag" data-tauri-drag-region />
  ) : null;
}
