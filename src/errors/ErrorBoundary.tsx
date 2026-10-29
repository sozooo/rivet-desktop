import { Component, useState, type ReactNode } from "react";
import { AlertTriangle, Copy, RotateCw } from "lucide-react";
import { demoFlags } from "../demoFlags";
import { useI18n } from "../i18n/i18n";
import { appLog, copyReport } from "./log";

/** A crash while drawing the window: logged, explained, and one click from a reload. */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { crashed: boolean }
> {
  state = { crashed: false };

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error: unknown) {
    appLog.error(
      "Render",
      error instanceof Error ? (error.stack ?? error) : error,
    );
  }

  render() {
    if (this.state.crashed) return <Crashed />;
    return (
      <>
        {demoFlags.crash && <DemoCrash />}
        {this.props.children}
      </>
    );
  }
}

/** The browser demo's `?crash`, to see the screen below. */
function DemoCrash(): null {
  throw new Error("A crash on purpose: ?crash is in the address.");
}

function Crashed() {
  const { t, language, mode } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <div className="load-error crashed">
      <AlertTriangle />
      <h2>{t("crash.title")}</h2>
      <p>{t("crash.text")}</p>
      <div className="row">
        <button
          className="button primary"
          onClick={() => window.location.reload()}
        >
          <RotateCw />
          {t("crash.reload")}
        </button>
        <button
          className="button"
          onClick={() =>
            copyReport(`UI: ${language}, ${mode}`).then(() => setCopied(true))
          }
        >
          <Copy />
          {t(copied ? "settings.reportCopied" : "settings.report")}
        </button>
      </div>
    </div>
  );
}
