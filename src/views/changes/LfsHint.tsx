import { useState } from "react";
import { HardDrive } from "lucide-react";
import { lfsPatterns, needsLfs, tooLarge } from "../../git/lfs";
import { useI18n } from "../../i18n/i18n";
import { useStoredState } from "../../ui/hooks";
import type { RepoApi } from "../repoApi";

/** Turns Git LFS on and tracks the art set plus anything too large for GitHub. */
export function useLfsSetup(repo: RepoApi) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const setup = async () => {
    setBusy(true);
    await repo.act(
      (b) => b.setupLfs(lfsPatterns(repo.snapshot.files)),
      t("lfs.done"),
    );
    setBusy(false);
  };
  return { busy, setup };
}

/**
 * A gentle note when changed art would go in as regular files. It can wait,
 * unless a file is too large for GitHub.
 */
export function LfsHint({ repo }: { repo: RepoApi }) {
  const { snapshot, repository } = repo;
  const { t } = useI18n();
  const [later, setLater] = useStoredState(
    `rivet.lfsLater.${repository.id}`,
    false,
  );
  const { busy, setup } = useLfsSetup(repo);
  const art = snapshot.files.filter(needsLfs);
  const urgent = snapshot.files.some(tooLarge);
  if (!art.length || (later && !urgent)) return null;
  const missing = !snapshot.lfs.installed;

  return (
    <aside className={`hint-card ${urgent || missing ? "warn" : ""}`}>
      <strong>
        <HardDrive />
        {t(missing ? "lfs.missingTitle" : "lfs.hintTitle")}
      </strong>
      <p>{missing ? t("lfs.missing") : t("lfs.hint", { count: art.length })}</p>
      <div className="row">
        {!missing && (
          <button className="button primary" disabled={busy} onClick={setup}>
            {t("lfs.setup")}
          </button>
        )}
        {!urgent && (
          <button className="text-button" onClick={() => setLater(true)}>
            {t("lfs.later")}
          </button>
        )}
      </div>
    </aside>
  );
}
