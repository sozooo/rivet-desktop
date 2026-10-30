import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Download, RefreshCw } from "lucide-react";
import { DragStrip } from "../chrome/WindowControls";
import { gitDownloadPage, ErrorMessage } from "../errors/notice";
import { useI18n } from "../i18n/i18n";
import { platform } from "../platform";
import { useNotify } from "../ui/Toast";

/** `git stash show --include-untracked` arrived in 2.32. */
export const requiredGit = "2.32";

/** True when a dotted version is at least `required`. */
export function atLeast(version: string, required: string) {
  const have = version.split(".").map(Number);
  const need = required.split(".").map(Number);
  for (let i = 0; i < need.length; i++) {
    if ((have[i] ?? 0) !== need[i]) return (have[i] ?? 0) > need[i];
  }
  return true;
}

type Health =
  | { status: "ok" }
  /** Downloading Rivet's own Git; `old` is the too-old version found, if any. */
  | { status: "installing"; old?: string; received: number; total: number }
  | { status: "failed"; error: string };

const megabytes = (bytes: number) => Math.round(bytes / 1_048_576);

/**
 * Checks on start that Git is there and recent enough. Without it nothing
 * works, so Rivet downloads its own copy right away; installing Git by hand is
 * only the fallback when that fails. A missing Git LFS only gets a note.
 */
export function GitCheck({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const notify = useNotify();
  const [health, setHealth] = useState<Health>();
  const noted = useRef(false);

  const check = useCallback(async () => {
    const { git, lfs } = await platform.gitVersions();
    if (git && atLeast(git, requiredGit)) {
      setHealth({ status: "ok" });
      if (!lfs && !noted.current) {
        noted.current = true;
        notify(t("lfs.missing"), "warning");
      }
      return;
    }
    const old = git ?? undefined;
    setHealth({ status: "installing", old, received: 0, total: 0 });
    try {
      await platform.installGit((received, total) =>
        setHealth({ status: "installing", old, received, total }),
      );
    } catch (error) {
      return setHealth({ status: "failed", error: String(error) });
    }
    const after = await platform.gitVersions();
    setHealth(
      after.git
        ? { status: "ok" }
        : { status: "failed", error: "git --version found no Git" },
    );
  }, [notify, t]);
  useEffect(() => {
    check();
  }, [check]);

  if (!health) return null;
  if (health.status === "ok") return children;
  const installing = health.status === "installing";
  return (
    <section className="git-check" role={installing ? "status" : "alert"}>
      <DragStrip />
      <div className="git-check-content">
        <div className="brand">
          <span className="brand-mark">r</span>
          <span>
            rivet<span className="brand-dot">.</span>
          </span>
        </div>
        <div className="eyebrow">{t("health.eyebrow")}</div>
        {installing ? (
          <>
            <h1>{t("health.installing.title")}</h1>
            <p>
              {health.old
                ? t("health.installing.old", {
                    version: health.old,
                    required: requiredGit,
                  })
                : t("health.installing.missing")}
            </p>
            <div className="update-progress git-progress">
              <div
                className="update-bar"
                style={{
                  width: health.total
                    ? `${Math.round((health.received / health.total) * 100)}%`
                    : "0%",
                }}
              />
            </div>
            <p className="git-check-status">
              {health.total && health.received >= health.total
                ? t("health.unpacking")
                : health.total
                  ? t("health.progress", {
                      received: megabytes(health.received),
                      total: megabytes(health.total),
                    })
                  : " "}
            </p>
          </>
        ) : (
          <>
            <h1>{t("health.failed.title")}</h1>
            <ErrorMessage error={health.error} className="git-check-error" />
            <p>{t("health.failed.text")}</p>
            <div className="row">
              <button className="button primary" onClick={check}>
                <RefreshCw />
                {t("health.retry")}
              </button>
              <button
                className="button"
                onClick={() => platform.openWebPage(gitDownloadPage)}
              >
                <Download />
                {t("health.download")}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
