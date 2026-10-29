import { useState } from "react";
import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { unresolved } from "../../git/conflicts";
import { SMART_MERGE_EXTENSIONS } from "../../git/lfs";
import { extension } from "../../git/paths";
import { useI18n } from "../../i18n/i18n";
import { useNotify } from "../../ui/Toast";
import { findMergeTools, newestTool } from "../../unity/mergeTool";
import type { RepoApi } from "../repoApi";

/**
 * What happened, how many files are left, and the way out: cancel, or
 * finish once every file is settled.
 */
export function MergeBanner({ repo }: { repo: RepoApi }) {
  const { snapshot, act, openOperation } = repo;
  const { operation, files } = snapshot;
  const { t, mode } = useI18n();
  const left = unresolved(files).length;

  async function finish() {
    const kind = operation!.kind;
    const next = await act(
      (b) => b.finishOperation(),
      t(kind === "merge" ? "merge.done" : "merge.continued"),
    );
    // Simple mode finishes what Sync started and sends the result.
    if (next && !next.operation && kind === "merge" && mode === "simple")
      await repo.sync();
  }

  return (
    <section className={`merge-banner ${left ? "" : "ready"}`}>
      <div className="merge-banner-main">
        {left ? <AlertTriangle /> : <CheckCircle2 />}
        <div className="merge-banner-text">
          <strong>
            {t(
              operation && !left
                ? "merge.title.done"
                : operation
                  ? `merge.title.${operation.kind}`
                  : "merge.title.stash",
            )}
          </strong>
          <p>
            {t(
              !operation
                ? "merge.explainStash"
                : left
                  ? "merge.explain"
                  : "merge.explainDone",
            )}
          </p>
          {mode === "full" && operation?.message && (
            <code>{operation.message}</code>
          )}
        </div>
        <div className="merge-banner-actions">
          {left > 0 && (
            <span className="merge-left">
              {t("merge.left", { count: left })}
            </span>
          )}
          {operation && (
            <>
              <button
                className="button"
                onClick={() =>
                  openOperation("abort-operation", {
                    operation: operation.kind,
                  })
                }
              >
                {t(`merge.abort.${operation.kind}`)}
              </button>
              <button
                className="button primary"
                disabled={left > 0}
                title={left ? t("merge.finishFirst") : undefined}
                onClick={finish}
              >
                {t(`merge.finish.${operation.kind}`)}
              </button>
            </>
          )}
        </div>
      </div>
      <SmartMergeTip repo={repo} />
    </section>
  );
}

/** Offered when Unity files conflict in a project that doesn't merge them with Unity's tool yet. */
function SmartMergeTip({ repo }: { repo: RepoApi }) {
  const { snapshot, act } = repo;
  const { t } = useI18n();
  const notify = useNotify();
  const [busy, setBusy] = useState(false);
  const unityConflict = snapshot.files.some(
    (f) => f.conflict && SMART_MERGE_EXTENSIONS.includes(extension(f.path)),
  );
  if (snapshot.smartMerge !== false || !unityConflict) return null;

  async function enable() {
    setBusy(true);
    const tool = newestTool(await findMergeTools());
    if (tool)
      await act((b) => b.setupSmartMerge(tool.path), t("smartMerge.enabled"));
    else notify(t("smartMerge.noUnity"), "error");
    setBusy(false);
  }

  return (
    <div className="smart-merge-tip">
      <Sparkles />
      <p>{t("smartMerge.tip")}</p>
      <button className="button" disabled={busy} onClick={enable}>
        {t("smartMerge.enable")}
      </button>
    </div>
  );
}
