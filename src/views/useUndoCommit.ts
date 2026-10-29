import { opKey } from "../dialogs/operations";
import { undoBlocker, type UndoBlocker } from "../git/undo";
import { useI18n, type Key } from "../i18n/i18n";
import { restoreDraft } from "./changes/draft";
import type { RepoApi } from "./repoApi";

export const blockerKey = (reason: UndoBlocker) =>
  `undo.blocked.${reason}` as Key;

/** Undoes the latest commit if it is still `sha`, or says why it can't. */
export function useUndoCommit(repo: RepoApi) {
  const { t } = useI18n();
  return (sha: string) =>
    repo.act(
      async (b) => {
        // Checked again now: the commit may have been pushed since.
        const reason = undoBlocker(await b.snapshot(), sha);
        if (reason) throw new Error(t(blockerKey(reason)));
        restoreDraft(repo.repository.id, await b.undoLastCommit());
      },
      t(opKey("undo-commit", "done")),
    );
}
