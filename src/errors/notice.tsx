import { useCallback, useState } from "react";
import { useAccount } from "../github/account";
import { useI18n, type Key, type UiMode } from "../i18n/i18n";
import { useIdentity } from "../onboarding/identity";
import { platform } from "../platform";
import { useNotify } from "../ui/Toast";
import {
  errorText,
  explainError,
  type ErrorAction,
  type Explanation,
} from "./explain";
import { appLog } from "./log";

export const gitDownloadPage = "https://git-scm.com/download/win";

/** What the screen showing an error can do for its suggested action. */
export type ErrorHandlers = Partial<Record<ErrorAction, () => void>>;

type Described = {
  message: string;
  /** Git's own output, for full mode. */
  details?: string;
  explanation: Explanation | null;
};

/**
 * Plain words for a failure. Simple mode never shows git's text; full mode shows it
 * behind "Details", or as the message itself when Rivet has no explanation.
 */
export function describeError(
  raw: string,
  t: (key: Key, params?: Record<string, string | number>) => string,
  mode: UiMode,
): Described {
  const explanation = explainError(raw);
  if (explanation)
    return {
      message: t(explanation.key, explanation.params),
      details: mode === "full" ? raw : undefined,
      explanation,
    };
  return {
    message: mode === "full" ? raw : t("error.unknown"),
    explanation,
  };
}

/** The button for an explanation's suggested action, when this screen can run it. */
export function useErrorAction() {
  const { t } = useI18n();
  const notify = useNotify();
  const account = useAccount();
  const { ask } = useIdentity();
  return useCallback(
    (explanation: Explanation | null, handlers: ErrorHandlers) => {
      // Unknown failures are worth one more try.
      const action = explanation ? explanation.action : "retry";
      if (!action) return undefined;
      const path = String(explanation?.params?.path ?? "");
      const builtIn: ErrorHandlers = {
        signIn: account.available ? account.signIn : undefined,
        identity: () => void ask().then((saved) => saved && handlers.retry?.()),
        installGit: () => void platform.openWebPage(gitDownloadPage),
        trust: path
          ? () =>
              platform.trustFolder(path).then(
                () => {
                  notify(t("error.trusted", { path }));
                  handlers.retry?.();
                },
                (error) => notify(errorText(error), "error"),
              )
          : undefined,
      };
      const run = handlers[action] ?? builtIn[action];
      return run && { label: t(`error.action.${action}` as Key), run };
    },
    [account, notify, t, ask],
  );
}

/** Shows a failure in a toast, with its suggested action, and writes it to the error log. */
export function useShowError() {
  const notify = useNotify();
  const { t, mode } = useI18n();
  const actionFor = useErrorAction();
  return useCallback(
    (context: string, error: unknown, handlers: ErrorHandlers = {}) => {
      const raw = errorText(error);
      appLog.error(context, raw);
      const { message, details, explanation } = describeError(raw, t, mode);
      notify(message, "error", {
        action: actionFor(explanation, handlers),
        details,
      });
    },
    [notify, t, mode, actionFor],
  );
}

/** An error inside a screen: the plain message, and git's output behind "Details" in full mode. */
export function ErrorMessage({
  error,
  className,
}: {
  error: string;
  className?: string;
}) {
  const { t, mode } = useI18n();
  const [open, setOpen] = useState(false);
  const { message, details } = describeError(error, t, mode);
  return (
    <div className={`error-message ${className ?? ""}`} role="alert">
      <p>{message}</p>
      {details && (
        <button
          type="button"
          className="text-button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {t(open ? "error.hideDetails" : "error.details")}
        </button>
      )}
      {open && <pre className="error-details">{details}</pre>}
    </div>
  );
}
