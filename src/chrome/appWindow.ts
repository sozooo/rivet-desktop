import { getCurrentWebview } from "@tauri-apps/api/webview";
import {
  currentMonitor,
  getCurrentWindow,
  LogicalSize,
} from "@tauri-apps/api/window";
import { platform } from "../platform";

/** How large the whole interface is drawn; Settings and Ctrl + = / − / 0 change it. */
export type UiScale = "normal" | "large" | "larger";
export const uiScales: UiScale[] = ["normal", "large", "larger"];
const zoomOf: Record<UiScale, number> = { normal: 1, large: 1.15, larger: 1.3 };

/** One step larger (1) or smaller (-1), or back to normal (0). */
export function stepScale(current: UiScale, step: -1 | 0 | 1): UiScale {
  if (step === 0) return "normal";
  const index = uiScales.indexOf(current) + step;
  return uiScales[Math.min(Math.max(index, 0), uiScales.length - 1)];
}

/** The smallest window the layout is made for at normal size (see tauri.conf.json). */
const MIN_WIDTH = 920;
const MIN_HEIGHT = 560;
/** The minimum size in force; the window starts with the configured one. */
let minimum = `${MIN_WIDTH}x${MIN_HEIGHT}`;
/** A minimum waiting for a maximized window to be restored. */
let pending: LogicalSize | null = null;
let watching = false;

/**
 * Zooms the whole page, like a browser's Ctrl + plus, so rows, buttons and
 * icons grow with the text. A larger interface needs a larger window, so the
 * window's minimum size grows too, as far as the screen allows.
 */
export async function applyScale(scale: UiScale) {
  const zoom = zoomOf[scale];
  if (!platform.desktop) {
    // The browser demo can't zoom its tab, so it zooms the page instead.
    const root = document.documentElement.style;
    root.zoom = zoom === 1 ? "" : String(zoom);
    root.setProperty("--ui-zoom", String(zoom));
    return;
  }
  await getCurrentWebview().setZoom(zoom);
  const window = getCurrentWindow();
  const monitor = await currentMonitor();
  const area = monitor?.workArea.size.toLogical(monitor.scaleFactor);
  const width = Math.round(Math.min(MIN_WIDTH * zoom, area?.width ?? Infinity));
  const height = Math.round(
    Math.min(MIN_HEIGHT * zoom, area?.height ?? Infinity),
  );
  if (`${width}x${height}` === minimum) return;
  minimum = `${width}x${height}`;
  // Changing the minimum takes a maximized window out of maximized and forgets
  // its normal size, so a maximized window gets it once it's restored.
  pending = new LogicalSize(width, height);
  if (!(await window.isMaximized())) return applyMinimum();
  if (watching) return;
  watching = true;
  window.onResized(async () => {
    if (pending && !(await window.isMaximized())) applyMinimum();
  });
}

async function applyMinimum() {
  const min = pending;
  if (!min) return;
  pending = null;
  const window = getCurrentWindow();
  await window.setMinSize(min);
  const size = (await window.innerSize()).toLogical(await window.scaleFactor());
  if (size.width < min.width || size.height < min.height)
    await window.setSize(
      new LogicalSize(
        Math.max(size.width, min.width),
        Math.max(size.height, min.height),
      ),
    );
}

/** Ctrl + = (or +) and Ctrl + − step the size; Ctrl + 0 goes back to normal. */
export function scaleShortcut(e: KeyboardEvent): -1 | 0 | 1 | null {
  if (!e.ctrlKey || e.altKey || e.metaKey) return null;
  if (e.key === "=" || e.key === "+") return 1;
  if (e.key === "-" || e.key === "_") return -1;
  if (e.key === "0") return 0;
  return null;
}
