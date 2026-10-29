import { opKey, operations, type OpContext } from "../../dialogs/operations";
import { fileName } from "../../git/paths";
import type { Commit, FileChange } from "../../git/types";
import { useI18n } from "../../i18n/i18n";
import { useNotify } from "../../ui/Toast";
import type { RepoApi } from "../repoApi";

const asset = (path: string) => path.replace(/\.meta$/, "");

/**
 * Puts a file from a commit back into the working tree, as it was in that
 * commit. Asks first when that would throw away unsaved changes.
 */
export function useRestoreFile(repo: RepoApi) {
  const { snapshot, act, openOperation, showChanges } = repo;
  const { t } = useI18n();
  const notify = useNotify();
  return async (file: FileChange, commit: Commit, files: FileChange[]) => {
    // A Unity asset and its .meta go back together when the commit changed both.
    const group = files.filter((f) => asset(f.path) === asset(file.path));
    const restore = group.map((f) => ({
      path: f.path,
      // A file the commit deleted comes back as it was just before.
      revision: f.status === "deleted" ? `${commit.sha}^` : commit.sha,
    }));
    const context: OpContext = {
      branch: snapshot.branches.current,
      branches: snapshot.branches.local,
      sync: snapshot.sync,
      file,
      commit,
      restore,
    };
    const paths = new Set(restore.map((r) => r.path));
    const touches = (f: FileChange) =>
      paths.has(f.path) || (!!f.oldPath && paths.has(f.oldPath));
    if (snapshot.files.some(touches))
      return openOperation("restore-file", context);

    const op = operations["restore-file"];
    const next = await act((b) => op.run!(b, context, ""));
    if (!next) return;
    if (!next.files.some(touches))
      return notify(t("restore.same", { name: fileName(file.path) }));
    notify(
      t(opKey("restore-file", "done"), op.params(context, t, "")),
      "success",
      {
        action: {
          label: t("restore.review"),
          run: () => showChanges(asset(file.path)),
        },
      },
    );
  };
}
