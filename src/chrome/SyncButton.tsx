import {
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  Check,
  CloudUpload,
  RefreshCw,
} from "lucide-react";
import type { GitProgress } from "../git/progress";
import type { SyncState } from "../git/types";
import { useI18n } from "../i18n/i18n";

/**
 * Simple mode's one button for the server: it says what syncing would do,
 * or that there's nothing to do. Checking for news is the ↻ next to the branch.
 */
export function SyncButton({
  sync,
  merging,
  working,
  progress,
  detail,
  onSync,
}: {
  sync: SyncState;
  merging: boolean;
  /** What is being sent or received right now, e.g. "Getting… 42%". */
  working: string | null;
  /** How far it got, drawn along the button's bottom edge. */
  progress: GitProgress | null;
  /** The whole story for the tooltip. */
  detail?: string;
  onSync: () => void;
}) {
  const { t } = useI18n();
  if (working)
    return (
      <button className="button primary sync-button" disabled title={detail}>
        <RefreshCw className="spinning" />
        {working}
        {progress?.percent != null && (
          <span
            className="sync-progress"
            style={{ width: `${progress.percent}%` }}
          />
        )}
      </button>
    );
  const action = !sync.upstream
    ? "publish"
    : sync.behind && sync.ahead
      ? "both"
      : sync.behind
        ? "pull"
        : sync.ahead
          ? "push"
          : null;
  if (!action)
    return (
      <span className="sync-done" title={t("top.syncedTitle")}>
        <Check />
        {t("top.synced")}
      </span>
    );
  const Icon = {
    publish: CloudUpload,
    both: ArrowDownUp,
    pull: ArrowDown,
    push: ArrowUp,
  }[action];
  return (
    <button
      className="button primary sync-button"
      disabled={merging}
      title={t(merging ? "top.syncMerging" : `top.syncTitle.${action}`)}
      onClick={onSync}
    >
      <Icon />
      {t(`top.syncAction.${action}`)}
      {action === "both" ? (
        <span className="sync-count">
          ↓{sync.behind} ↑{sync.ahead}
        </span>
      ) : action !== "publish" ? (
        <span className="sync-count">
          {action === "pull" ? sync.behind : sync.ahead}
        </span>
      ) : null}
    </button>
  );
}
