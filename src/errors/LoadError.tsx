import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { useI18n } from "../i18n/i18n";
import type { Repository } from "../repositories";
import { explainError } from "./explain";
import { appLog } from "./log";
import { ErrorMessage, useErrorAction } from "./notice";

/** A repository that can't be read: what went wrong, and a fix when there is one. */
export function LoadError({
  repository,
  error,
  onRetry,
  onRemove,
}: {
  repository: Repository;
  error: string;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const errorAction = useErrorAction();
  useEffect(() => {
    appLog.error(`Opening ${repository.path}`, error);
  }, [repository.path, error]);

  const explanation = explainError(error);
  // Retrying has its own button; this is a fix such as trusting the folder.
  const fix =
    explanation?.action && explanation.action !== "retry"
      ? errorAction(explanation, { retry: onRetry })
      : undefined;
  return (
    <div className="load-error">
      <AlertTriangle />
      <h2>{t("load.title", { name: repository.name })}</h2>
      <code>{repository.path}</code>
      <ErrorMessage error={error} />
      <div className="row">
        {fix && (
          <button className="button primary" onClick={fix.run}>
            {fix.label}
          </button>
        )}
        <button className={`button ${fix ? "" : "primary"}`} onClick={onRetry}>
          {t("load.retry")}
        </button>
        <button className="button" onClick={onRemove}>
          {t("load.remove")}
        </button>
      </div>
    </div>
  );
}
