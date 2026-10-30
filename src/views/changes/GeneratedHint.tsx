import { useState } from "react";
import { FolderCog } from "lucide-react";
import { useI18n } from "../../i18n/i18n";
import type { RepoApi } from "../repoApi";

/**
 * A calm note when Unity's generated folders (Library, Temp…) aren't ignored.
 * Never-committed ones are already left out of commits, and Fix writes Unity's
 * .gitignore; committed ones get a confirmed step that stops tracking them.
 */
export function GeneratedHint({ repo }: { repo: RepoApi }) {
  const { snapshot, act, openOperation } = repo;
  const { t, mode } = useI18n();
  const [busy, setBusy] = useState(false);
  if (!snapshot.generated) return null;
  const { untracked, tracked } = snapshot.generated;
  const committed = tracked.length > 0;
  const paths = committed ? tracked : untracked;
  const folders = paths.filter((p) => p.endsWith("/"));
  // Simple mode talks about folders; editors' project files come along unnamed.
  const shown = mode === "simple" && folders.length ? folders : paths;
  const names = [
    ...new Set(
      shown.map((p) =>
        mode === "simple" ? p.replace(/\/$/, "").split("/").pop()! : p,
      ),
    ),
  ];

  const fix = async () => {
    setBusy(true);
    await act((b) => b.ignoreUnityGenerated(), t("generated.fixed"));
    setBusy(false);
  };
  const untrack = () =>
    openOperation("untrack-generated", {
      generated: snapshot.generated,
      summary: t("generated.untrackMessage"),
    });

  return (
    <aside className="hint-card generated-hint">
      <strong>
        <FolderCog />
        {t(committed ? "generated.trackedTitle" : "generated.title")}
      </strong>
      <p>
        {t(
          committed
            ? "generated.tracked"
            : folders.length
              ? "generated.folders"
              : "generated.files",
        )}
      </p>
      <ul className="generated-names">
        {names.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
      <div className="row">
        {committed ? (
          <button className="button primary" onClick={untrack}>
            {t("generated.untrack")}
          </button>
        ) : (
          <button className="button primary" disabled={busy} onClick={fix}>
            {t("generated.fix")}
          </button>
        )}
      </div>
    </aside>
  );
}
