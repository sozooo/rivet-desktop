import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Download, RefreshCw } from "lucide-react";
import { gitDownloadPage } from "../errors/notice";
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
  { status: "ok" } | { status: "missing" } | { status: "old"; version: string };

/**
 * Checks on start that Git is installed and recent enough. Without it nothing works,
 * so the whole window explains what to install; a missing Git LFS only gets a note.
 */
export function GitCheck({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const notify = useNotify();
  const [health, setHealth] = useState<Health>();
  const [checking, setChecking] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const noted = useRef(false);

  const check = useCallback(async () => {
    setChecking(true);
    const { git, lfs } = await platform.gitVersions();
    setChecking(false);
    if (!git) return setHealth({ status: "missing" });
    if (!atLeast(git, requiredGit))
      return setHealth({ status: "old", version: git });
    setHealth({ status: "ok" });
    if (!lfs && !noted.current) {
      noted.current = true;
      notify(t("lfs.missing"), "warning");
    }
  }, [notify, t]);
  useEffect(() => {
    check();
  }, [check]);

  if (!health) return null;
  if (health.status === "ok") return children;
  const old = health.status === "old";
  return (
    <section className="git-check" role="alert">
      <div className="git-check-content">
        <div className="brand">
          <span className="brand-mark">r</span>
          <span>
            rivet<span className="brand-dot">.</span>
          </span>
        </div>
        <div className="eyebrow">{t("health.eyebrow")}</div>
        <h1>{t(old ? "health.old.title" : "health.missing.title")}</h1>
        <p>
          {old
            ? t("health.old.text", {
                version: health.version,
                required: requiredGit,
              })
            : t("health.missing.text")}
        </p>
        <div className="row">
          <button
            className="button primary"
            onClick={() => platform.openWebPage(gitDownloadPage)}
          >
            <Download />
            {t("health.download")}
          </button>
          <button
            className="button"
            disabled={checking}
            onClick={() => {
              setAttempts((n) => n + 1);
              check();
            }}
          >
            <RefreshCw className={checking ? "spin" : ""} />
            {t(checking ? "health.checking" : "health.recheck")}
          </button>
        </div>
        <p className="git-check-status" role="status">
          {attempts > 0 && !checking && !old ? t("health.stillMissing") : " "}
        </p>
        <small>git-scm.com/download/win</small>
      </div>
    </section>
  );
}
