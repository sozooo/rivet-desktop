import { AppWindow, X } from "lucide-react";
import { fileName } from "../git/paths";
import { useI18n } from "../i18n/i18n";
import type { OpenAppWarning } from "../openApps/openApps";

/**
 * Asked before Rivet rewrites files that Unity or Blender has open: what to
 * do in each first. It never blocks; "Continue" goes ahead as it is.
 */
export function OpenAppsDialog({
  warnings,
  onAnswer,
}: {
  warnings: OpenAppWarning[];
  onAnswer: (go: boolean) => void;
}) {
  const { t, mode } = useI18n();
  const unityProjects = warnings.filter((w) => w.app === "unity").length;
  const line = (w: OpenAppWarning) =>
    w.app === "unity"
      ? // Naming the project only helps when a repository has several open.
        w.project && unityProjects > 1
        ? t("openApps.unityProject", { project: w.project.replace(/\/$/, "") })
        : t("openApps.unity")
      : t(w.unsaved ? "openApps.blenderUnsaved" : "openApps.blender", {
          name: mode === "simple" ? fileName(w.path) : w.path,
        });
  return (
    <div className="modal-overlay" onClick={() => onAnswer(false)}>
      <section
        className="modal"
        role="alertdialog"
        aria-modal="true"
        aria-label={t("openApps.title")}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="modal-close icon-button"
          aria-label={t("dialog.close")}
          onClick={() => onAnswer(false)}
        >
          <X />
        </button>
        <h2>{t("openApps.title")}</h2>
        <p>{t("openApps.describe")}</p>
        <ul className="open-apps">
          {warnings.map((w) => (
            <li key={w.app === "unity" ? `unity:${w.project}` : w.path}>
              <AppWindow />
              {line(w)}
            </li>
          ))}
        </ul>
        <div className="modal-actions">
          <button className="button" onClick={() => onAnswer(false)}>
            {t("common.cancel")}
          </button>
          <button
            className="button primary"
            autoFocus
            onClick={() => onAnswer(true)}
          >
            {t("openApps.continue")}
          </button>
        </div>
      </section>
    </div>
  );
}
