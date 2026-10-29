import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useI18n } from "../i18n/i18n";
import type { AvailableUpdate } from "./updates";

/** Release notes for a new version and the button that installs it. */
export function UpdateDialog({
  update,
  onClose,
}: {
  update: AvailableUpdate;
  onClose: () => void;
}) {
  const { t, mode } = useI18n();
  const [progress, setProgress] = useState<number | null | undefined>();
  const [error, setError] = useState<string>();
  const installing = progress !== undefined && !error;

  async function install() {
    setError(undefined);
    setProgress(null);
    try {
      await update.install(setProgress);
    } catch (failure) {
      setError(String(failure));
    }
  }

  return (
    <div className="modal-overlay" onClick={installing ? undefined : onClose}>
      <section
        className="modal update-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t("updates.title", { version: update.version })}
        onClick={(e) => e.stopPropagation()}
      >
        {!installing && (
          <button
            className="modal-close icon-button"
            aria-label={t("dialog.close")}
            onClick={onClose}
          >
            <X />
          </button>
        )}
        <div className="eyebrow">{t("updates.eyebrow")}</div>
        <h2>
          <Sparkles className="update-icon" />
          {t("updates.title", { version: update.version })}
        </h2>
        {/* Release notes are in English and for those who want details; simple mode just updates. */}
        {mode === "full" && (
          <>
            <h3>{t("updates.notes")}</h3>
            <p className="update-notes">
              {update.notes || t("updates.noNotes")}
            </p>
          </>
        )}
        <p className="muted">{t("updates.hint")}</p>
        {error && (
          <p className="setup-error" role="alert">
            {t("updates.failed", { error })}
          </p>
        )}
        {installing && (
          <div className="update-progress" aria-live="polite">
            <div
              className="update-bar"
              style={{ width: `${Math.round((progress ?? 0) * 100)}%` }}
            />
          </div>
        )}
        <div className="modal-actions">
          <button className="button" disabled={installing} onClick={onClose}>
            {t("updates.later")}
          </button>
          <button
            className="button primary"
            disabled={installing}
            onClick={install}
          >
            {installing
              ? progress
                ? t("updates.installing", {
                    percent: Math.round(progress * 100),
                  })
                : t("updates.installingNoSize")
              : t("updates.install")}
          </button>
        </div>
      </section>
    </div>
  );
}
