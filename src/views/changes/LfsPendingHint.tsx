import { useContext, useState } from "react";
import { CloudDownload, CloudOff, X } from "lucide-react";
import { CancelHandle } from "../../git/cancel";
import type { GitProgress } from "../../git/progress";
import { useI18n } from "../../i18n/i18n";
import { formatSize, PreviewContext } from "../../preview/data";
import { progressLabel } from "../../sync/progressText";
import { useAsync, useCancelAvailable } from "../../ui/hooks";
import type { RepoApi } from "../repoApi";

/**
 * Says when the current version's large files are still only pointers here,
 * e.g. after a project was opened without its art, and downloads the rest.
 */
export function LfsPendingHint({ repo }: { repo: RepoApi }) {
  const { t, language } = useI18n();
  const { downloadLfs } = useContext(PreviewContext);
  const [downloads, setDownloads] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<GitProgress | null>(null);
  const [cancel, setCancel] = useState<CancelHandle | null>(null);
  const cancellable = useCancelAvailable(cancel);
  // Asked again when the version changes or after a download.
  const head = repo.snapshot.commits[0]?.sha ?? "";
  const pending = useAsync(
    () => repo.backend.pendingLfs(),
    [repo.backend, head, downloads],
  );
  if (!pending?.files || !downloadLfs) return null;

  async function download() {
    const handle = new CancelHandle();
    setDownloading(true);
    setProgress(null);
    setCancel(handle);
    await downloadLfs!({ onProgress: setProgress, cancel: handle });
    setDownloading(false);
    setProgress(null);
    setCancel(null);
    setDownloads((n) => n + 1);
  }

  return (
    <aside className="hint-card warn">
      <strong>
        <CloudOff />
        {t("lfs.pendingTitle")}
      </strong>
      <p>
        {t("lfs.pending", {
          count: pending.files,
          size: formatSize(pending.bytes, language),
        })}
      </p>
      <div className="row">
        <button
          className="button primary"
          disabled={downloading}
          onClick={download}
        >
          <CloudDownload size={15} />
          {downloading
            ? progressLabel(t("lfs.downloading"), progress, t)
            : t("lfs.resume")}
        </button>
        {downloading && cancellable && (
          <button
            className="text-button"
            title={t("cancel.title")}
            onClick={() => cancel?.cancel()}
          >
            <X size={15} />
            {t("cancel.action")}
          </button>
        )}
      </div>
    </aside>
  );
}
