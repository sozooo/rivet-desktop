import { invoke, isTauri } from "@tauri-apps/api/core";
import { errorText } from "./explain";

/**
 * The error log the developer can ask for. The desktop app keeps it in a rotating file next
 * to the git commands Rivet ran (src-tauri/src/applog.rs); the browser demo keeps it in memory.
 */
export interface AppLog {
  /** Records a failure and what Rivet was doing when it happened. */
  error(context: string, error: unknown): void;
  /** Versions and the latest log lines, ready to paste into a message. */
  report(context: string): Promise<string>;
}

const desktopLog: AppLog = {
  error(context, error) {
    invoke("log_write", {
      level: "error",
      message: `${context}: ${errorText(error)}`,
    }).catch(() => {});
  },
  report: (context) => invoke<string>("diagnostics_report", { context }),
};

const memory: string[] = [];
const browserLog: AppLog = {
  error(context, error) {
    memory.push(
      `${new Date().toISOString()} error ${context}: ${errorText(error)}`,
    );
    memory.splice(0, memory.length - 200);
  },
  async report(context) {
    return [
      `Rivet ${__APP_VERSION__} (browser demo)`,
      navigator.userAgent,
      context,
      "",
      `--- Last ${memory.length} log entries ---`,
      ...memory,
    ].join("\n");
  },
};

export const appLog: AppLog = isTauri() ? desktopLog : browserLog;

/** Errors nothing else caught still end up in the log. */
export function logUncaughtErrors() {
  window.addEventListener("error", (e) =>
    appLog.error("Uncaught", e.error?.stack ?? e.message),
  );
  window.addEventListener("unhandledrejection", (e) =>
    appLog.error("Unhandled rejection", e.reason?.stack ?? e.reason),
  );
}

/** Puts the report on the clipboard for pasting into a message. */
export async function copyReport(context: string) {
  await navigator.clipboard.writeText(await appLog.report(context));
}
